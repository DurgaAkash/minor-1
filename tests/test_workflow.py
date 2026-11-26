"""Integration and access-control tests for SmartRoute AI.

Run from the repository root:
    python -m unittest discover -s tests -v

All tests use a temporary SQLite database.
"""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import app as backend_app  # noqa: E402


class SmartRouteApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "workflow-test.db"
        self.db_path_patch = patch.object(backend_app, "DB_PATH", self.db_path)
        self.db_path_patch.start()
        backend_app.initialize_database()
        self.client = backend_app.app.test_client()
        self.passenger_token = self.login("passenger", "travel123")["token"]
        self.admin_token = self.login("admin", "admin123")["token"]

    def tearDown(self):
        self.db_path_patch.stop()
        self.temp_dir.cleanup()

    def login(self, username, password):
        response = self.client.post("/api/auth/login", json={
            "username": username, "password": password
        })
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    @staticmethod
    def headers(token):
        return {"Authorization": "Bearer " + token}

    def submit_request(self, token, source="Village A", destination="Town B", count=24):
        return self.client.post("/api/requests", headers=self.headers(token), json={
            "source": source,
            "destination": destination,
            "preferred_time": "Morning",
            "expected_passengers": count,
            "reason": "Students and workers need a reliable service."
        })

    def test_legacy_shared_records_are_migrated_to_demo_passenger(self):
        with tempfile.TemporaryDirectory() as directory:
            legacy_path = Path(directory) / "legacy.db"
            with sqlite3.connect(legacy_path) as conn:
                conn.execute("""
                    CREATE TABLE requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source TEXT NOT NULL, destination TEXT NOT NULL,
                        preferred_time TEXT NOT NULL, expected_passengers INTEGER NOT NULL,
                        reason TEXT, status TEXT DEFAULT 'PENDING',
                        admin_note TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.execute("""
                    CREATE TABLE checkins (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source TEXT NOT NULL, destination TEXT NOT NULL,
                        travel_time TEXT NOT NULL, passengers INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                conn.execute(
                    "INSERT INTO requests (source, destination, preferred_time, expected_passengers) VALUES (?, ?, ?, ?)",
                    ("Legacy Village", "Legacy Town", "Morning", 9)
                )
                conn.execute(
                    "INSERT INTO checkins (source, destination, travel_time, passengers) VALUES (?, ?, ?, ?)",
                    ("Legacy Village", "Legacy Town", "Morning", 6)
                )

            with patch.object(backend_app, "DB_PATH", legacy_path):
                backend_app.initialize_database()
                client = backend_app.app.test_client()
                login = client.post("/api/auth/login", json={
                    "username": "passenger", "password": "travel123"
                })
                token = login.get_json()["token"]
                passenger_rows = client.get(
                    "/api/requests", headers={"Authorization": "Bearer " + token}
                ).get_json()
                self.assertEqual(len(passenger_rows), 1)
                self.assertEqual(passenger_rows[0]["source"], "Legacy Village")

                admin_login = client.post("/api/auth/login", json={
                    "username": "admin", "password": "admin123"
                })
                admin_token = admin_login.get_json()["token"]
                checkins = client.get(
                    "/api/checkins", headers={"Authorization": "Bearer " + admin_token}
                ).get_json()
                self.assertEqual(len(checkins), 1)
                self.assertEqual(checkins[0]["source"], "Legacy Village")

    def test_login_issues_session_and_wrong_password_is_rejected(self):
        denied = self.client.post("/api/auth/login", json={
            "username": "passenger", "password": "wrong"
        })
        self.assertEqual(denied.status_code, 401)
        me = self.client.get("/api/auth/me", headers=self.headers(self.passenger_token))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.get_json()["user"]["role"], "passenger")

    def test_private_endpoints_require_authentication(self):
        self.assertEqual(self.client.get("/api/requests").status_code, 401)
        self.assertEqual(self.client.post("/api/checkins", json={}).status_code, 401)
        self.assertEqual(self.client.get("/api/checkins", headers=self.headers(self.passenger_token)).status_code, 403)

    def test_passenger_requests_are_isolated_and_admin_can_review_all(self):
        first = self.submit_request(self.passenger_token)
        self.assertEqual(first.status_code, 201)
        request_id = first.get_json()["id"]

        # Create a second passenger and a separate request.
        conn = backend_app.get_db()
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("passenger2", backend_app.hash_password("second123"), "passenger")
        )
        conn.commit()
        conn.close()
        second_token = self.login("passenger2", "second123")["token"]
        second = self.submit_request(second_token, "Village C", "Town D", 8)
        self.assertEqual(second.status_code, 201)

        first_list = self.client.get("/api/requests", headers=self.headers(self.passenger_token)).get_json()
        second_list = self.client.get("/api/requests", headers=self.headers(second_token)).get_json()
        admin_list = self.client.get("/api/requests", headers=self.headers(self.admin_token)).get_json()
        self.assertEqual([row["id"] for row in first_list], [request_id])
        self.assertEqual(len(second_list), 1)
        self.assertEqual(len(admin_list), 2)

        decision = self.client.patch(
            f"/api/requests/{request_id}", headers=self.headers(self.admin_token),
            json={"status": "APPROVED", "admin_note": "Included in service planning."}
        )
        self.assertEqual(decision.status_code, 200)
        passenger_view = self.client.get(
            "/api/requests", headers=self.headers(self.passenger_token)
        ).get_json()[0]
        self.assertEqual(passenger_view["status"], "APPROVED")
        self.assertEqual(passenger_view["admin_note"], "Included in service planning.")

    def test_passenger_request_triggers_agent_without_admin_dashboard(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=None):
            submitted = self.submit_request(self.passenger_token, count=24)
        self.assertEqual(submitted.status_code, 201)
        result = submitted.get_json()
        self.assertEqual(result["agent"]["planning_demand"], 24)
        self.assertEqual(result["schedule_status"], "AUTO_APPROVED_BY_AGENT")

        proposals = self.client.get("/api/schedules", headers=self.headers(self.admin_token)).get_json()
        self.assertEqual(len(proposals), 1)
        self.assertEqual(proposals[0]["status"], "APPROVED")
        self.assertEqual(proposals[0]["predicted_passengers"], 24)

        # The AI demo agent automatically approves and publishes the prototype schedule.
        published = self.client.get(
            "/api/schedules?published_only=true",
            headers=self.headers(self.passenger_token)
        ).get_json()
        self.assertEqual(len(published), 1)
        self.assertEqual(published[0]["status"], "APPROVED")
        passenger_requests = self.client.get(
            "/api/requests", headers=self.headers(self.passenger_token)
        ).get_json()
        self.assertEqual(passenger_requests[0]["status"], "APPROVED")
        self.assertIn("auto-approved", passenger_requests[0]["admin_note"].lower())

    def test_startup_auto_approves_existing_pending_proposals(self):
        conn = backend_app.get_db()
        conn.execute("""
            INSERT INTO requests (owner_id, source, destination, preferred_time, expected_passengers, reason)
            VALUES (1, 'Old Village', 'Old Town', 'Morning', 10, 'Existing pending request')
        """)
        conn.execute("""
            INSERT INTO schedules (route_key, source, destination, time_slot, predicted_passengers, buses, departures, status)
            VALUES ('old village|old town|morning', 'Old Village', 'Old Town', 'Morning', 10, 1, '[\"07:00 AM\"]', 'PENDING')
        """)
        conn.commit()
        conn.close()

        backend_app.initialize_database()
        schedules = self.client.get('/api/schedules', headers=self.headers(self.admin_token)).get_json()
        requests = self.client.get('/api/requests', headers=self.headers(self.admin_token)).get_json()
        self.assertEqual(schedules[0]['status'], 'APPROVED')
        self.assertEqual(requests[0]['status'], 'APPROVED')
    def test_checkin_runs_agent_and_is_visible_only_to_admin(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=None):
            submitted = self.client.post(
                "/api/checkins", headers=self.headers(self.passenger_token),
                json={"source": "Village X", "destination": "Town Y",
                      "travel_time": "Evening", "passengers": 17}
            )
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(submitted.get_json()["agent"]["planning_demand"], 17)
        admin_rows = self.client.get(
            "/api/checkins", headers=self.headers(self.admin_token)
        ).get_json()
        self.assertEqual(len(admin_rows), 1)
        passenger_rows = self.client.get(
            "/api/checkins", headers=self.headers(self.passenger_token)
        )
        self.assertEqual(passenger_rows.status_code, 403)

    def test_fallback_uses_larger_signal_to_reduce_possible_double_counting(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=None):
            checkin = self.client.post(
                "/api/checkins", headers=self.headers(self.passenger_token),
                json={"source": "Village M", "destination": "Town N",
                      "travel_time": "Morning", "passengers": 18}
            )
            request = self.submit_request(
                self.passenger_token, "Village M", "Town N", 25
            )
        self.assertEqual(checkin.status_code, 201)
        self.assertEqual(request.status_code, 201)
        self.assertEqual(request.get_json()["agent"]["planning_demand"], 25)

    def test_random_forest_forecast_is_combined_with_half_pending_request_signal(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=30.0):
            submitted = self.submit_request(self.passenger_token, count=20)
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(submitted.get_json()["agent"]["planning_demand"], 40)
        self.assertEqual(submitted.get_json()["agent"]["ml_forecast"], 30.0)

    def test_24_hour_request_time_generates_matching_departure(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=None):
            submitted = self.client.post(
                "/api/requests", headers=self.headers(self.passenger_token),
                json={
                    "source": "Village Evening", "destination": "Town Evening",
                    "preferred_time": "17:30", "travel_date": backend_app.datetime.now().date().isoformat(),
                    "expected_passengers": 3
                }
            )
        self.assertEqual(submitted.status_code, 201)
        schedules = self.client.get(
            "/api/schedules?published_only=true",
            headers=self.headers(self.passenger_token)
        ).get_json()
        self.assertEqual(len(schedules), 1)
        self.assertEqual(schedules[0]["time_slot"], "17:30")
        self.assertEqual(schedules[0]["departures"], ["05:30 PM"])

    def test_operator_bus_number_can_be_saved_without_gps_tracking(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=None):
            self.submit_request(self.passenger_token, "Fleet Village", "Fleet Town", 3)
        schedule = self.client.get(
            "/api/schedules", headers=self.headers(self.admin_token)
        ).get_json()[0]
        assigned = self.client.patch(
            f"/api/schedules/{schedule['id']}/bus",
            headers=self.headers(self.admin_token),
            json={"bus_number": "TN 01 AB 1234", "bus_name": "Village Express"}
        )
        self.assertEqual(assigned.status_code, 200)
        payload = assigned.get_json()
        self.assertEqual(payload["bus_number"], "TN 01 AB 1234")
        self.assertEqual(payload["bus_name"], "Village Express")
        self.assertNotIn("driver_pin", payload)
        gps = self.client.post("/api/tracking/location", json={
            "schedule_id": schedule["id"], "pin": "12345678",
            "latitude": 13.0827, "longitude": 80.2707
        })
        self.assertEqual(gps.status_code, 404)
        tracking = self.client.get(
            f"/api/tracking/{schedule['id']}",
            headers=self.headers(self.passenger_token)
        )
        self.assertEqual(tracking.status_code, 404)


    def test_logout_revokes_the_session_token(self):
        response = self.client.post(
            "/api/auth/logout", headers=self.headers(self.passenger_token)
        )
        self.assertEqual(response.status_code, 200)
        after_logout = self.client.get(
            "/api/auth/me", headers=self.headers(self.passenger_token)
        )
        self.assertEqual(after_logout.status_code, 401)

    def test_rejected_schedule_updates_linked_request(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=None):
            submitted = self.submit_request(self.passenger_token, "Village R", "Town S", 12)
        schedule = self.client.get(
            "/api/schedules", headers=self.headers(self.admin_token)
        ).get_json()[0]
        rejected = self.client.patch(
            f"/api/schedules/{schedule['id']}",
            headers=self.headers(self.admin_token),
            json={"status": "REJECTED", "admin_note": "Not feasible this month."}
        )
        self.assertEqual(rejected.status_code, 200)
        passenger_request = self.client.get(
            "/api/requests", headers=self.headers(self.passenger_token)
        ).get_json()[0]
        self.assertEqual(passenger_request["status"], "REJECTED")
        self.assertEqual(passenger_request["admin_note"], "Not feasible this month.")

    def test_passenger_cannot_create_or_approve_schedules(self):
        response = self.client.post(
            "/api/schedules", headers=self.headers(self.passenger_token),
            json={"source": "A", "destination": "B", "time_slot": "Morning",
                  "predicted_passengers": 20, "buses": 1, "departures": ["07:00 AM"]}
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_decisions_and_unknown_schedule_are_rejected(self):
        submitted = self.submit_request(self.passenger_token)
        request_id = submitted.get_json()["id"]
        invalid = self.client.patch(
            f"/api/requests/{request_id}", headers=self.headers(self.admin_token),
            json={"status": "WAITING"}
        )
        self.assertEqual(invalid.status_code, 400)
        missing = self.client.patch(
            "/api/schedules/99999", headers=self.headers(self.admin_token),
            json={"status": "APPROVED"}
        )
        self.assertEqual(missing.status_code, 404)


if __name__ == "__main__":
    unittest.main()
