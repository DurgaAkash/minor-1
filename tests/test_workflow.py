"""Integration and access-control tests for SmartRoute AI.

Run from the repository root:
    python -m unittest discover -s tests -v

All tests use a temporary SQLite database.
"""
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
        self.assertEqual(result["schedule_status"], "PENDING_ADMIN_APPROVAL")

        proposals = self.client.get("/api/schedules", headers=self.headers(self.admin_token)).get_json()
        self.assertEqual(len(proposals), 1)
        self.assertEqual(proposals[0]["status"], "PENDING")
        self.assertEqual(proposals[0]["predicted_passengers"], 24)

        # Passenger cannot see the proposal until the admin approves it.
        passenger_schedules = self.client.get(
            "/api/schedules?published_only=true",
            headers=self.headers(self.passenger_token)
        ).get_json()
        self.assertEqual(passenger_schedules, [])

        approved = self.client.patch(
            f"/api/schedules/{proposals[0]['id']}",
            headers=self.headers(self.admin_token),
            json={"status": "APPROVED", "admin_note": "Approved for demo."}
        )
        self.assertEqual(approved.status_code, 200)
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
        self.assertIn("schedule approved", passenger_requests[0]["admin_note"].lower())

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

    def test_random_forest_forecast_is_combined_with_half_pending_request_signal(self):
        with patch.object(backend_app, "fetch_ml_forecast", return_value=30.0):
            submitted = self.submit_request(self.passenger_token, count=20)
        self.assertEqual(submitted.status_code, 201)
        self.assertEqual(submitted.get_json()["agent"]["planning_demand"], 40)
        self.assertEqual(submitted.get_json()["agent"]["ml_forecast"], 30.0)

    def test_logout_revokes_the_session_token(self):
        response = self.client.post(
            "/api/auth/logout", headers=self.headers(self.passenger_token)
        )
        self.assertEqual(response.status_code, 200)
        after_logout = self.client.get(
            "/api/auth/me", headers=self.headers(self.passenger_token)
        )
        self.assertEqual(after_logout.status_code, 401)

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
