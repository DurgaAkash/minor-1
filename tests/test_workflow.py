"""Integration tests for the SmartRoute AI passenger-to-admin workflow.

Run from the repository root:
    python -m unittest discover -s tests -v

These tests use a temporary SQLite database and never touch backend/smartroute.db.
"""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import app as backend_app  # noqa: E402


class PassengerAdminWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "workflow-test.db"
        self.db_path_patch = patch.object(backend_app, "DB_PATH", self.db_path)
        self.db_path_patch.start()
        backend_app.initialize_database()
        self.client = backend_app.app.test_client()

    def tearDown(self):
        self.db_path_patch.stop()
        self.temp_dir.cleanup()

    def test_passenger_request_is_visible_to_admin_and_approval_returns_to_passenger(self):
        # Passenger submits a new service request.
        submitted = self.client.post("/api/requests", json={
            "source": "Village A",
            "destination": "Town B",
            "preferred_time": "Morning",
            "expected_passengers": 24,
            "reason": "Students and workers need an earlier bus."
        })
        self.assertEqual(submitted.status_code, 201)
        request_id = submitted.get_json()["id"]

        # Admin dashboard reads the same request from SQLite.
        admin_list = self.client.get("/api/requests")
        self.assertEqual(admin_list.status_code, 200)
        visible_request = next(row for row in admin_list.get_json() if row["id"] == request_id)
        self.assertEqual(visible_request["status"], "PENDING")
        self.assertEqual(visible_request["source"], "Village A")

        # Admin approves and records a decision note.
        decision = self.client.patch(f"/api/requests/{request_id}", json={
            "status": "APPROVED",
            "admin_note": "Approved for the next planning review."
        })
        self.assertEqual(decision.status_code, 200)
        self.assertEqual(decision.get_json()["request"]["status"], "APPROVED")

        # Passenger portal's GET endpoint sees the updated status and note.
        passenger_list = self.client.get("/api/requests")
        self.assertEqual(passenger_list.status_code, 200)
        passenger_view = next(row for row in passenger_list.get_json() if row["id"] == request_id)
        self.assertEqual(passenger_view["status"], "APPROVED")
        self.assertEqual(passenger_view["admin_note"], "Approved for the next planning review.")

    def test_admin_rejection_is_visible_to_passenger(self):
        submitted = self.client.post("/api/requests", json={
            "source": "Village C",
            "destination": "Town D",
            "preferred_time": "Evening",
            "expected_passengers": 8,
            "reason": "Requesting a later return service."
        })
        request_id = submitted.get_json()["id"]

        rejected = self.client.patch(f"/api/requests/{request_id}", json={
            "status": "REJECTED",
            "admin_note": "Insufficient demand in the current sample."
        })
        self.assertEqual(rejected.status_code, 200)

        passenger_rows = self.client.get("/api/requests").get_json()
        row = next(item for item in passenger_rows if item["id"] == request_id)
        self.assertEqual(row["status"], "REJECTED")
        self.assertEqual(row["admin_note"], "Insufficient demand in the current sample.")

    def test_invalid_admin_decision_is_rejected(self):
        submitted = self.client.post("/api/requests", json={
            "source": "Village E",
            "destination": "Town F",
            "preferred_time": "Afternoon",
            "expected_passengers": 3,
            "reason": "Need a service."
        })
        request_id = submitted.get_json()["id"]

        response = self.client.patch(f"/api/requests/{request_id}", json={
            "status": "WAITING"
        })
        self.assertEqual(response.status_code, 400)

    def test_unknown_request_id_returns_not_found(self):
        response = self.client.patch("/api/requests/99999", json={
            "status": "APPROVED",
            "admin_note": "Test"
        })
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
