from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path

app = Flask(__name__)
CORS(app)

DB_PATH = Path(__file__).with_name("smartroute.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            source TEXT NOT NULL,
            destination TEXT NOT NULL,
            preferred_time TEXT NOT NULL,
            expected_passengers INTEGER NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'PENDING',
            admin_note TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(requests)")}
    if "admin_note" not in columns:
        conn.execute("ALTER TABLE requests ADD COLUMN admin_note TEXT DEFAULT ''")

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
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "success",
        "message": "SmartRoute AI SQLite backend is running"
    })


@app.route("/api/checkins", methods=["POST"])
def add_checkin():
    data = request.get_json(silent=True) or {}

    source = data.get("source")
    destination = data.get("destination")
    travel_time = data.get("travel_time")
    passengers = data.get("passengers")

    if not all([source, destination, travel_time, passengers]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        passengers = int(passengers)
        if passengers < 1:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid passenger count"}), 400

    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO checkins
        (source, destination, travel_time, passengers)
        VALUES (?, ?, ?, ?)
    """, (source, destination, travel_time, passengers))

    conn.commit()
    record_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "Check-in saved successfully",
        "id": record_id
    }), 201


@app.route("/api/checkins", methods=["GET"])
def get_checkins():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM checkins ORDER BY id DESC"
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/requests", methods=["POST"])
def add_request():
    data = request.get_json(silent=True) or {}

    source = data.get("source")
    destination = data.get("destination")
    preferred_time = data.get("preferred_time")
    expected_passengers = data.get("expected_passengers")
    reason = data.get("reason", "")

    if not all([source, destination, preferred_time, expected_passengers]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        expected_passengers = int(expected_passengers)
        if expected_passengers < 1:
            raise ValueError()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid passenger count"}), 400

    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO requests
        (source, destination, preferred_time, expected_passengers, reason)
        VALUES (?, ?, ?, ?, ?)
    """, (source, destination, preferred_time,
          expected_passengers, reason))

    conn.commit()
    record_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "Bus request submitted successfully",
        "id": record_id
    }), 201


@app.route("/api/requests/<int:request_id>", methods=["PATCH"])
def update_request(request_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).upper()
    admin_note = str(data.get("admin_note", ""))

    if status not in ("APPROVED", "REJECTED"):
        return jsonify({"error": "Status must be APPROVED or REJECTED"}), 400

    conn = get_db()
    cursor = conn.execute(
        "UPDATE requests SET status = ?, admin_note = ? WHERE id = ?",
        (status, admin_note, request_id)
    )
    conn.commit()
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Request not found"}), 404

    row = conn.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Request status updated", "request": dict(row)})


@app.route("/api/requests", methods=["GET"])
def get_requests():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM requests ORDER BY id DESC"
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


@app.route("/api/schedules", methods=["GET"])
def get_schedules():
    published_only = request.args.get("published_only", "false").lower() == "true"
    conn = get_db()
    if published_only:
        rows = conn.execute(
            "SELECT * FROM schedules WHERE status = 'APPROVED' ORDER BY source, destination, time_slot"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM schedules ORDER BY updated_at DESC, id DESC"
        ).fetchall()
    conn.close()

    results = []
    for row in rows:
        item = dict(row)
        try:
            item["departures"] = __import__("json").loads(item["departures"])
        except (TypeError, ValueError):
            item["departures"] = []
        results.append(item)
    return jsonify(results)


@app.route("/api/schedules", methods=["POST"])
def save_schedule_proposal():
    data = request.get_json(silent=True) or {}
    source = str(data.get("source", "")).strip()
    destination = str(data.get("destination", "")).strip()
    time_slot = str(data.get("time_slot", "")).strip()
    departures = data.get("departures", [])

    try:
        predicted = int(data.get("predicted_passengers"))
        buses = int(data.get("buses"))
        if predicted < 0 or buses < 1 or not isinstance(departures, list):
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid passenger forecast, bus count or departures"}), 400

    if not source or not destination or not time_slot or source.casefold() == destination.casefold():
        return jsonify({"error": "Source, destination and time slot are required"}), 400

    route_key = "|".join([source.casefold(), destination.casefold(), time_slot.casefold()])
    departures_json = __import__("json").dumps([str(value) for value in departures])

    conn = get_db()
    conn.execute("""
        INSERT INTO schedules
        (route_key, source, destination, time_slot, predicted_passengers, buses, departures, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        ON CONFLICT(route_key) DO UPDATE SET
            source = excluded.source,
            destination = excluded.destination,
            time_slot = excluded.time_slot,
            status = CASE
                WHEN schedules.predicted_passengers != excluded.predicted_passengers
                  OR schedules.buses != excluded.buses
                  OR schedules.departures != excluded.departures
                THEN 'PENDING'
                ELSE schedules.status
            END,
            predicted_passengers = excluded.predicted_passengers,
            buses = excluded.buses,
            departures = excluded.departures,
            updated_at = CURRENT_TIMESTAMP
    """, (route_key, source, destination, time_slot, predicted, buses, departures_json))
    conn.commit()
    row = conn.execute("SELECT * FROM schedules WHERE route_key = ?", (route_key,)).fetchone()
    conn.close()
    result = dict(row)
    result["departures"] = __import__("json").loads(result["departures"])
    return jsonify(result), 200


@app.route("/api/schedules/<int:schedule_id>", methods=["PATCH"])
def review_schedule(schedule_id):
    data = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).upper()
    admin_note = str(data.get("admin_note", "")).strip()
    if status not in ("APPROVED", "REJECTED"):
        return jsonify({"error": "Status must be APPROVED or REJECTED"}), 400

    conn = get_db()
    cursor = conn.execute(
        "UPDATE schedules SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (status, admin_note, schedule_id)
    )
    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Schedule proposal not found"}), 404
    row = conn.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,)).fetchone()
    conn.commit()
    conn.close()
    result = dict(row)
    result["departures"] = __import__("json").loads(result["departures"])
    return jsonify({"message": "Schedule decision saved", "schedule": result})


if __name__ == "__main__":
    initialize_database()
    app.run(host="127.0.0.1", port=5001, debug=True)
