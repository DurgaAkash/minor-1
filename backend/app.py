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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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


@app.route("/api/requests", methods=["GET"])
def get_requests():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM requests ORDER BY id DESC"
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])


if __name__ == "__main__":
    initialize_database()
    app.run(host="127.0.0.1", port=5001, debug=True)
