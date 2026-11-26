"""SmartRoute AI API: SQLite storage, role-based demo auth and server-side demand agent."""
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
import hashlib
import json
import math
import os
import re
import secrets
import sqlite3
import urllib.error
import urllib.request

from flask import Flask, g, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [
    "http://127.0.0.1:5500", "http://localhost:5500",
    re.compile(r"^http://(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}):5500$")
]}})

DB_PATH = Path(__file__).with_name("smartroute.db")
TOKEN_HOURS = 12
BUS_CAPACITY = 50
ML_PREDICTION_URL = os.getenv("SMARTROUTE_ML_URL", "http://127.0.0.1:5000/api/predict")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210000)
    return salt.hex() + "$" + digest.hex()


def verify_password(password, stored_hash):
    try:
        salt_hex, digest_hex = stored_hash.split("$", 1)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 210000)
        return secrets.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def initialize_database():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('passenger', 'admin')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER REFERENCES users(id),
            source TEXT NOT NULL,
            destination TEXT NOT NULL,
            travel_time TEXT NOT NULL,
            passengers INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER REFERENCES users(id),
            source TEXT NOT NULL,
            destination TEXT NOT NULL,
            preferred_time TEXT NOT NULL,
            travel_date TEXT NOT NULL DEFAULT '',
            expected_passengers INTEGER NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'PENDING',
            admin_note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            route_key TEXT NOT NULL UNIQUE,
            source TEXT NOT NULL,
            destination TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            predicted_passengers INTEGER NOT NULL,
            buses INTEGER NOT NULL,
            departures TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            admin_note TEXT DEFAULT '',
            bus_number TEXT DEFAULT '',
            bus_name TEXT DEFAULT '',
            tracking_pin_hash TEXT DEFAULT '',
            bus_assignment_type TEXT NOT NULL DEFAULT 'OPERATOR',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bus_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
            travel_date TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            accuracy REAL,
            speed REAL,
            heading REAL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(schedule_id, travel_date)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agent_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trigger_type TEXT NOT NULL,
            source TEXT NOT NULL,
            destination TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            ml_forecast REAL,
            planning_demand INTEGER NOT NULL,
            buses INTEGER NOT NULL,
            data_basis TEXT NOT NULL,
            explanation TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    schedule_columns = {row["name"] for row in conn.execute("PRAGMA table_info(schedules)")}
    for column, definition in (
        ("bus_number", "TEXT DEFAULT ''"),
        ("bus_name", "TEXT DEFAULT ''"),
        ("tracking_pin_hash", "TEXT DEFAULT ''"),
        ("bus_assignment_type", "TEXT NOT NULL DEFAULT 'OPERATOR'")
    ):
        if column not in schedule_columns:
            conn.execute(f"ALTER TABLE schedules ADD COLUMN {column} {definition}")

    # Repair legacy proposals whose time slot is a 24-hour clock value but
    # whose departure list was incorrectly defaulted to 07:00 AM.
    for schedule in conn.execute("SELECT id, time_slot, buses, departures FROM schedules").fetchall():
        try:
            datetime.strptime(str(schedule["time_slot"]).strip(), "%H:%M")
            expected_departures = json.dumps(make_departures(schedule["time_slot"], schedule["buses"]))
            current_departures = json.dumps(json.loads(schedule["departures"]))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if current_departures != expected_departures:
            conn.execute(
                "UPDATE schedules SET departures = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (expected_departures, schedule["id"])
            )

    request_columns = {row["name"] for row in conn.execute("PRAGMA table_info(requests)")}
    if "travel_date" not in request_columns:
        conn.execute("ALTER TABLE requests ADD COLUMN travel_date TEXT NOT NULL DEFAULT ''")

    for table, column in (("checkins", "owner_id"), ("requests", "owner_id")):
        columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} INTEGER REFERENCES users(id)")

    # Allocate stable virtual fleet IDs to existing approved schedules that do not
    # yet have an operator-confirmed vehicle. These IDs are planning labels only.
    conn.execute("""
        UPDATE schedules
        SET bus_number = 'SRA-AI-' || printf('%04d', id),
            bus_name = 'AI Fleet Slot',
            bus_assignment_type = 'AI_VIRTUAL'
        WHERE status = 'APPROVED' AND COALESCE(trim(bus_number), '') = ''
    """)

    # Demo accounts are intentionally for local evaluation only. Set these
    # environment variables to replace the default passwords before sharing.
    demo_accounts = [
        (os.getenv("SMARTROUTE_PASSENGER_USERNAME", "passenger"),
         os.getenv("SMARTROUTE_PASSENGER_PASSWORD", "travel123"), "passenger"),
        (os.getenv("SMARTROUTE_ADMIN_USERNAME", "admin"),
         os.getenv("SMARTROUTE_ADMIN_PASSWORD", "admin123"), "admin"),
    ]
    for username, password, role in demo_accounts:
        if username and password and conn.execute(
            "SELECT 1 FROM users WHERE username = ?", (username,)
        ).fetchone() is None:
            conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                (username, hash_password(password), role)
            )

    # Older prototype versions had one shared demo passenger and no owner_id.
    # Attach those legacy records to the configured demo passenger so their
    # history remains visible after passenger-level isolation is enabled.
    passenger_username = os.getenv("SMARTROUTE_PASSENGER_USERNAME", "passenger")
    passenger = conn.execute(
        "SELECT id FROM users WHERE username = ? AND role = 'passenger'",
        (passenger_username,)
    ).fetchone()
    if passenger:
        conn.execute("UPDATE requests SET owner_id = ? WHERE owner_id IS NULL", (passenger["id"],))
        conn.execute("UPDATE checkins SET owner_id = ? WHERE owner_id IS NULL", (passenger["id"],))

    # When upgrading to demo auto-approval, publish already-generated pending proposals too.
    conn.execute("UPDATE schedules SET status = 'APPROVED' WHERE status = 'PENDING'")
    conn.execute("""
        UPDATE requests SET status = 'APPROVED',
          admin_note = 'Auto-approved by SmartRoute AI demo agent after demand analysis. Prototype schedule only; confirm with the bus operator.'
        WHERE status = 'PENDING' AND EXISTS (
          SELECT 1 FROM schedules
          WHERE schedules.status = 'APPROVED'
            AND lower(trim(schedules.source)) = lower(trim(requests.source))
            AND lower(trim(schedules.destination)) = lower(trim(requests.destination))
            AND lower(trim(schedules.time_slot)) = lower(trim(requests.preferred_time))
        )
    """)
    conn.commit()
    conn.close()


def require_role(*roles):
    def decorator(handler):
        @wraps(handler)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify({"error": "Sign in required."}), 401
            token = header[7:].strip()
            if not token:
                return jsonify({"error": "Sign in required."}), 401
            conn = get_db()
            row = conn.execute("""
                SELECT users.id, users.username, users.role
                FROM sessions JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > ?
            """, (hashlib.sha256(token.encode()).hexdigest(), int(datetime.now(timezone.utc).timestamp()))).fetchone()
            conn.close()
            if row is None:
                return jsonify({"error": "Session expired. Please sign in again."}), 401
            if roles and row["role"] not in roles:
                return jsonify({"error": "You do not have permission to perform this action."}), 403
            g.current_user = dict(row)
            return handler(*args, **kwargs)
        return wrapped
    return decorator


def make_departures(time_slot, buses):
    value = str(time_slot).strip()
    base_minutes = {"morning": 7 * 60, "afternoon": 12 * 60, "evening": 17 * 60}
    try:
        parsed_time = datetime.strptime(value, "%H:%M")
        start = parsed_time.hour * 60 + parsed_time.minute
    except ValueError:
        # Keep compatibility with older check-ins and requests using day-part labels.
        start = base_minutes.get(value.lower(), 7 * 60)
    values = []
    for index in range(max(1, min(int(buses), 20))):
        minutes = start + index * 30
        hour24, minute = divmod(minutes, 60)
        suffix = "AM" if hour24 < 12 else "PM"
        hour12 = hour24 % 12 or 12
        values.append(f"{hour12:02d}:{minute:02d} {suffix}")
    return values


def fetch_ml_forecast(source, destination, time_slot):
    """Return only an exact route/time ML match; never invent a forecast for a new route."""
    try:
        req = urllib.request.Request(ML_PREDICTION_URL, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=2.0) as response:
            payload = json.loads(response.read().decode("utf-8"))
        for item in payload.get("predictions", []):
            same_route = (
                str(item.get("source", "")).strip().casefold() == source.casefold()
                and str(item.get("destination", "")).strip().casefold() == destination.casefold()
                and str(item.get("time", "")).strip().casefold() == time_slot.casefold()
            )
            if same_route:
                return max(0.0, float(item.get("predicted_passengers", 0)))
    except (OSError, ValueError, TypeError, urllib.error.URLError, json.JSONDecodeError):
        pass
    return None


def run_agent_analysis(source, destination, time_slot, trigger_type="request"):
    """Run automatically on each passenger submission, even when the admin UI is closed."""
    source = str(source).strip()
    destination = str(destination).strip()
    time_slot = str(time_slot).strip()
    if not source or not destination or source.casefold() == destination.casefold():
        return None

    conn = get_db()
    pending = conn.execute("""
        SELECT COALESCE(SUM(expected_passengers), 0) AS total
        FROM requests
        WHERE lower(trim(source)) = lower(trim(?))
          AND lower(trim(destination)) = lower(trim(?))
          AND lower(trim(preferred_time)) = lower(trim(?))
          AND status = 'PENDING'
    """, (source, destination, time_slot)).fetchone()["total"]
    checkins = conn.execute("""
        SELECT COALESCE(SUM(passengers), 0) AS total
        FROM checkins
        WHERE lower(trim(source)) = lower(trim(?))
          AND lower(trim(destination)) = lower(trim(?))
          AND lower(trim(travel_time)) = lower(trim(?))
    """, (source, destination, time_slot)).fetchone()["total"]
    conn.close()

    ml_forecast = fetch_ml_forecast(source, destination, time_slot)
    if ml_forecast is not None:
        planning_demand = max(0, round(ml_forecast + int(pending) * 0.5))
        basis = "Random Forest route/time forecast plus 50% of pending request demand"
        explanation = (
            f"Model forecast {round(ml_forecast)} passengers; {int(pending)} passengers "
            "are represented in pending service requests. Planning demand adds half "
            "of the request signal to avoid treating requests as confirmed boardings."
        )
    else:
        # Without passenger-level identity, check-ins and requests may overlap.
        # Use the larger observed signal rather than adding both and double-counting.
        planning_demand = max(0, int(pending), int(checkins))
        basis = "Larger of observed check-ins and pending requests; no matching ML forecast"
        explanation = (
            f"No exact historical model forecast was available for this route/time. "
            f"The fallback uses the larger of {int(checkins)} check-in passengers and "
            f"{int(pending)} pending-request passengers to reduce possible overlap. "
            "This is an observed-data planning estimate, not an ML prediction."
        )

    buses = max(1, math.ceil(planning_demand / BUS_CAPACITY))
    departures = json.dumps(make_departures(time_slot, buses))
    route_key = "|".join((source.casefold(), destination.casefold(), time_slot.casefold()))

    conn = get_db()
    conn.execute("""
        INSERT INTO schedules
          (route_key, source, destination, time_slot, predicted_passengers, buses, departures, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED')
        ON CONFLICT(route_key) DO UPDATE SET
          source = excluded.source,
          destination = excluded.destination,
          time_slot = excluded.time_slot,
          status = 'APPROVED',
          predicted_passengers = excluded.predicted_passengers,
          buses = excluded.buses,
          departures = excluded.departures,
          updated_at = CURRENT_TIMESTAMP
    """, (route_key, source, destination, time_slot, planning_demand, buses, departures))
    saved_schedule = conn.execute(
        "SELECT id, status, predicted_passengers, buses, bus_number, bus_assignment_type FROM schedules WHERE route_key = ?",
        (route_key,)
    ).fetchone()
    # Auto-allocate a non-registrational fleet ID when no real operator bus is linked.
    # Never replace an operator-confirmed bus number or generate a driver GPS PIN here.
    if not str(saved_schedule["bus_number"] or "").strip() or saved_schedule["bus_assignment_type"] == "AI_VIRTUAL":
        virtual_number = f"SRA-AI-{int(saved_schedule['id']):04d}"
        conn.execute("""
            UPDATE schedules
            SET bus_number = ?, bus_name = ?, bus_assignment_type = 'AI_VIRTUAL',
                tracking_pin_hash = '', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (virtual_number, f"AI Fleet Slot ({buses} required)", saved_schedule["id"]))
    # Demo-mode agent auto-approval: this publishes a prototype schedule immediately.
    # It is not a real bus-operator confirmation or dispatch authorization.
    conn.execute("""
        UPDATE requests SET status = 'APPROVED',
          admin_note = 'Auto-approved by SmartRoute AI demo agent after demand analysis. Prototype schedule only; confirm with the bus operator.'
        WHERE lower(trim(source)) = lower(trim(?))
          AND lower(trim(destination)) = lower(trim(?))
          AND lower(trim(preferred_time)) = lower(trim(?))
          AND status = 'PENDING'
    """, (source, destination, time_slot))
    cursor = conn.execute("""
        INSERT INTO agent_runs
          (trigger_type, source, destination, time_slot, ml_forecast, planning_demand, buses, data_basis, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (trigger_type, source, destination, time_slot, ml_forecast,
          planning_demand, buses, basis, explanation))
    run_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        "id": run_id, "source": source, "destination": destination,
        "time_slot": time_slot, "ml_forecast": ml_forecast,
        "planning_demand": planning_demand, "buses": buses,
        "data_basis": basis, "explanation": explanation,
        "schedule_status": "AUTO_APPROVED"
    }


@app.get("/api/health")
def health():
    return jsonify({"status": "success", "message": "SmartRoute AI SQLite backend is running"})


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    if not username or not password:
        return jsonify({"error": "Username and password are required."}), 400
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if user is None or not verify_password(password, user["password_hash"]):
        conn.close()
        return jsonify({"error": "Invalid username or password."}), 401
    token = secrets.token_urlsafe(32)
    expires = int((datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)).timestamp())
    conn.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
                 (hashlib.sha256(token.encode()).hexdigest(), user["id"], expires))
    conn.commit()
    conn.close()
    return jsonify({
        "token": token,
        "expires_at": expires,
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]}
    })


@app.get("/api/auth/me")
@require_role("passenger", "admin")
def who_am_i():
    return jsonify({"user": g.current_user})


@app.post("/api/auth/logout")
@require_role("passenger", "admin")
def logout():
    token = request.headers.get("Authorization", "")[7:].strip()
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hashlib.sha256(token.encode()).hexdigest(),))
    conn.commit()
    conn.close()
    return jsonify({"message": "Signed out."})


@app.post("/api/checkins")
@require_role("passenger")
def add_checkin():
    data = request.get_json(silent=True) or {}
    source = str(data.get("source", "")).strip()
    destination = str(data.get("destination", "")).strip()
    travel_time = str(data.get("travel_time", "")).strip()
    try:
        passengers = int(data.get("passengers"))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid passenger count."}), 400
    if not source or not destination or not travel_time or source.casefold() == destination.casefold():
        return jsonify({"error": "Enter two different locations and a travel time."}), 400
    if not 1 <= passengers <= 500:
        return jsonify({"error": "Passenger count must be between 1 and 500."}), 400
    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO checkins (owner_id, source, destination, travel_time, passengers)
        VALUES (?, ?, ?, ?, ?)
    """, (g.current_user["id"], source, destination, travel_time, passengers))
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    agent = run_agent_analysis(source, destination, travel_time, "check-in")
    return jsonify({"message": "Check-in saved successfully.", "id": record_id, "agent": agent}), 201


@app.get("/api/checkins")
@require_role("admin")
def get_checkins():
    conn = get_db()
    rows = conn.execute("SELECT * FROM checkins ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.post("/api/requests")
@require_role("passenger")
def add_request():
    data = request.get_json(silent=True) or {}
    source = str(data.get("source", "")).strip()
    destination = str(data.get("destination", "")).strip()
    preferred_time = str(data.get("preferred_time", "")).strip()
    # Older clients may omit travel_date; default them to today for backward compatibility.
    travel_date = str(data.get("travel_date") or datetime.now().date().isoformat()).strip()
    reason = str(data.get("reason", "")).strip()
    try:
        expected_passengers = int(data.get("expected_passengers"))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid passenger count."}), 400
    valid_time = False
    try:
        datetime.strptime(preferred_time, "%H:%M")
        valid_time = True
    except ValueError:
        valid_time = preferred_time.casefold() in ("morning", "afternoon", "evening")
    try:
        requested_date = datetime.strptime(travel_date, "%Y-%m-%d").date()
        valid_date = requested_date >= datetime.now().date()
    except ValueError:
        valid_date = False
    if not source or not destination or not valid_time or not valid_date or source.casefold() == destination.casefold():
        return jsonify({"error": "Enter two different locations, a valid future travel date, and a suggested departure time."}), 400
    if not 1 <= expected_passengers <= 500:
        return jsonify({"error": "Expected passengers must be between 1 and 500."}), 400
    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO requests (owner_id, source, destination, preferred_time, travel_date, expected_passengers, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (g.current_user["id"], source, destination, preferred_time, travel_date, expected_passengers, reason))
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    agent = run_agent_analysis(source, destination, preferred_time, "request")
    return jsonify({
        "message": "Request saved and automatic demand analysis completed.",
        "id": record_id, "agent": agent,
        "schedule_status": "AUTO_APPROVED_BY_AGENT"
    }), 201


@app.get("/api/requests")
@require_role("passenger", "admin")
def get_requests():
    conn = get_db()
    if g.current_user["role"] == "admin":
        rows = conn.execute("SELECT * FROM requests ORDER BY id DESC").fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM requests WHERE owner_id = ? ORDER BY id DESC",
            (g.current_user["id"],)
        ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.patch("/api/requests/<int:request_id>")
@require_role("admin")
def update_request(request_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).upper()
    admin_note = str(data.get("admin_note", "")).strip()
    if status not in ("APPROVED", "REJECTED"):
        return jsonify({"error": "Status must be APPROVED or REJECTED."}), 400
    conn = get_db()
    cursor = conn.execute(
        "UPDATE requests SET status = ?, admin_note = ? WHERE id = ?",
        (status, admin_note, request_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Request not found."}), 404
    row = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
    conn.commit()
    conn.close()
    return jsonify({"message": "Request status updated.", "request": dict(row)})


@app.get("/api/schedules")
@require_role("passenger", "admin")
def get_schedules():
    published_only = request.args.get("published_only", "false").lower() == "true"
    conn = get_db()
    if g.current_user["role"] == "passenger" or published_only:
        rows = conn.execute(
            "SELECT * FROM schedules WHERE status = 'APPROVED' ORDER BY source, destination, time_slot"
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM schedules ORDER BY updated_at DESC, id DESC").fetchall()
    results = []
    for row in rows:
        item = dict(row)
        item.pop("tracking_pin_hash", None)
        try:
            item["departures"] = json.loads(item["departures"])
        except (TypeError, ValueError):
            item["departures"] = []
        # Keep displayed departures aligned with an exact 24-hour time slot.
        try:
            datetime.strptime(str(item["time_slot"]).strip(), "%H:%M")
            expected = make_departures(item["time_slot"], item["buses"])
            if item["departures"] != expected:
                item["departures"] = expected
                conn.execute(
                    "UPDATE schedules SET departures = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (json.dumps(expected), item["id"])
                )
        except (TypeError, ValueError):
            pass
        results.append(item)
    conn.commit()
    conn.close()
    return jsonify(results)


@app.post("/api/schedules")
@require_role("admin")
def save_schedule_proposal():
    data = request.get_json(silent=True) or {}
    source = str(data.get("source", "")).strip()
    destination = str(data.get("destination", "")).strip()
    time_slot = str(data.get("time_slot", "")).strip()
    departures = data.get("departures", [])
    try:
        predicted = int(data.get("predicted_passengers"))
        buses = int(data.get("buses"))
        if predicted < 0 or not 1 <= buses <= 100 or not isinstance(departures, list):
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid forecast, bus count or departures."}), 400
    if not source or not destination or not time_slot or source.casefold() == destination.casefold():
        return jsonify({"error": "Source, destination and time slot are required."}), 400
    route_key = "|".join([source.casefold(), destination.casefold(), time_slot.casefold()])
    departures_json = json.dumps([str(value) for value in departures])
    conn = get_db()
    conn.execute("""
        INSERT INTO schedules
          (route_key, source, destination, time_slot, predicted_passengers, buses, departures, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        ON CONFLICT(route_key) DO UPDATE SET
          source = excluded.source, destination = excluded.destination, time_slot = excluded.time_slot,
          status = CASE
            WHEN schedules.predicted_passengers != excluded.predicted_passengers
              OR schedules.buses != excluded.buses OR schedules.departures != excluded.departures
            THEN 'PENDING' ELSE schedules.status END,
          predicted_passengers = excluded.predicted_passengers, buses = excluded.buses,
          departures = excluded.departures, updated_at = CURRENT_TIMESTAMP
    """, (route_key, source, destination, time_slot, predicted, buses, departures_json))
    conn.commit()
    row = conn.execute("SELECT * FROM schedules WHERE route_key = ?", (route_key,)).fetchone()
    conn.close()
    result = dict(row)
    result.pop("tracking_pin_hash", None)
    result["departures"] = json.loads(result["departures"])
    return jsonify(result), 200


@app.patch("/api/schedules/<int:schedule_id>")
@require_role("admin")
def review_schedule(schedule_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).upper()
    admin_note = str(data.get("admin_note", "")).strip()
    if status not in ("APPROVED", "REJECTED"):
        return jsonify({"error": "Status must be APPROVED or REJECTED."}), 400
    conn = get_db()
    cursor = conn.execute(
        "UPDATE schedules SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, admin_note, schedule_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Schedule proposal not found."}), 404
    row = conn.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,)).fetchone()
    linked_request_status = "APPROVED" if status == "APPROVED" else "REJECTED"
    linked_note = admin_note or (
        "Related schedule approved and published." if status == "APPROVED"
        else "Related schedule proposal rejected by admin."
    )
    conn.execute("""
        UPDATE requests SET status = ?, admin_note = ?
        WHERE lower(trim(source)) = lower(trim(?))
          AND lower(trim(destination)) = lower(trim(?))
          AND lower(trim(preferred_time)) = lower(trim(?))
    """, (linked_request_status, linked_note, row["source"], row["destination"], row["time_slot"]))
    conn.commit()
    conn.close()
    result = dict(row)
    result["departures"] = json.loads(result["departures"])
    return jsonify({"message": "Schedule decision saved.", "schedule": result})


@app.patch("/api/schedules/<int:schedule_id>/bus")
@require_role("admin")
def assign_bus(schedule_id):
    data = request.get_json(silent=True) or {}
    bus_number = str(data.get("bus_number", "")).strip()[:30]
    bus_name = str(data.get("bus_name", "")).strip()[:60]
    if not bus_number or not bus_name:
        return jsonify({"error": "Enter both a bus number and bus name."}), 400
    pin = str(secrets.randbelow(90000000) + 10000000)
    pin_hash = hashlib.sha256(pin.encode("utf-8")).hexdigest()
    conn = get_db()
    cursor = conn.execute("""
        UPDATE schedules
        SET bus_number = ?, bus_name = ?, tracking_pin_hash = ?,
            bus_assignment_type = 'OPERATOR', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (bus_number, bus_name, pin_hash, schedule_id))
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Schedule not found."}), 404
    conn.commit()
    conn.close()
    return jsonify({
        "message": "Bus assigned. Share this one-time setup PIN privately with the driver.",
        "bus_number": bus_number, "bus_name": bus_name,
        "bus_assignment_type": "OPERATOR", "driver_pin": pin
    })


@app.post("/api/tracking/location")
def update_bus_location():
    data = request.get_json(silent=True) or {}
    try:
        schedule_id = int(data.get("schedule_id"))
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))
        accuracy = float(data.get("accuracy")) if data.get("accuracy") is not None else None
        speed = float(data.get("speed")) if data.get("speed") is not None else None
        heading = float(data.get("heading")) if data.get("heading") is not None else None
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid schedule ID or GPS coordinates."}), 400
    pin = str(data.get("pin", "")).strip()
    travel_date = str(data.get("travel_date") or datetime.now().date().isoformat()).strip()
    try:
        parsed_date = datetime.strptime(travel_date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "Invalid tracking date."}), 400
    if parsed_date != datetime.now().date():
        return jsonify({"error": "GPS tracking can only be shared for today's journey."}), 400
    if not pin or not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return jsonify({"error": "A valid driver PIN and GPS position are required."}), 400
    if accuracy is not None and not (0 <= accuracy <= 100000):
        return jsonify({"error": "Invalid GPS accuracy."}), 400

    conn = get_db()
    schedule = conn.execute(
        "SELECT id, status, tracking_pin_hash FROM schedules WHERE id = ?", (schedule_id,)
    ).fetchone()
    supplied_hash = hashlib.sha256(pin.encode("utf-8")).hexdigest()
    if schedule is None or schedule["status"] != "APPROVED" or not schedule["tracking_pin_hash"] or not secrets.compare_digest(schedule["tracking_pin_hash"], supplied_hash):
        conn.close()
        return jsonify({"error": "Invalid driver PIN or unavailable schedule."}), 403
    conn.execute("""
        INSERT INTO bus_locations
          (schedule_id, travel_date, latitude, longitude, accuracy, speed, heading, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(schedule_id, travel_date) DO UPDATE SET
          latitude = excluded.latitude, longitude = excluded.longitude,
          accuracy = excluded.accuracy, speed = excluded.speed,
          heading = excluded.heading, updated_at = CURRENT_TIMESTAMP
    """, (schedule_id, travel_date, latitude, longitude, accuracy, speed, heading))
    conn.commit()
    conn.close()
    return jsonify({"message": "Bus location updated.", "updated": True})


@app.delete("/api/tracking/location")
def stop_bus_location():
    data = request.get_json(silent=True) or {}
    try:
        schedule_id = int(data.get("schedule_id"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid schedule ID."}), 400
    pin = str(data.get("pin", "")).strip()
    travel_date = str(data.get("travel_date") or datetime.now().date().isoformat()).strip()
    conn = get_db()
    schedule = conn.execute(
        "SELECT tracking_pin_hash FROM schedules WHERE id = ?", (schedule_id,)
    ).fetchone()
    supplied_hash = hashlib.sha256(pin.encode("utf-8")).hexdigest()
    if schedule is None or not schedule["tracking_pin_hash"] or not secrets.compare_digest(schedule["tracking_pin_hash"], supplied_hash):
        conn.close()
        return jsonify({"error": "Invalid driver PIN."}), 403
    conn.execute("DELETE FROM bus_locations WHERE schedule_id = ? AND travel_date = ?", (schedule_id, travel_date))
    conn.commit()
    conn.close()
    return jsonify({"message": "Bus tracking stopped."})


@app.get("/api/tracking/<int:schedule_id>")
@require_role("passenger", "admin")
def get_bus_location(schedule_id):
    conn = get_db()
    row = conn.execute("""
        SELECT s.id AS schedule_id, s.source, s.destination, s.bus_number, s.bus_name,
               l.latitude, l.longitude, l.accuracy, l.speed, l.heading, l.updated_at
        FROM schedules s
        LEFT JOIN bus_locations l ON l.schedule_id = s.id
          AND l.travel_date = ?
        WHERE s.id = ? AND s.status = 'APPROVED'
    """, (datetime.now().date().isoformat(), schedule_id)).fetchone()
    conn.close()
    if row is None:
        return jsonify({"error": "Published schedule not found."}), 404
    return jsonify(dict(row))


@app.get("/api/agent/runs")
@require_role("admin")
def get_agent_runs():
    conn = get_db()
    rows = conn.execute("SELECT * FROM agent_runs ORDER BY id DESC LIMIT 100").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.post("/api/agent/analyze")
@require_role("admin")
def analyze_pending_demand():
    conn = get_db()
    routes = conn.execute("""
        SELECT source, destination, preferred_time AS time_slot
        FROM requests WHERE status = 'PENDING'
        UNION
        SELECT source, destination, travel_time AS time_slot
        FROM checkins
    """).fetchall()
    conn.close()
    runs = [
        run_agent_analysis(row["source"], row["destination"], row["time_slot"], "admin-refresh")
        for row in routes
    ]
    return jsonify({"message": "Demand analysis completed.", "runs": runs})


if __name__ == "__main__":
    initialize_database()
    app.run(host="0.0.0.0", port=5001, debug=False)
