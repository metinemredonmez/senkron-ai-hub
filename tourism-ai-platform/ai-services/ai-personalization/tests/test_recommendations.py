from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_next_best_action_logs_event():
    response = client.post(
        "/rec/next-best",
        json={"case_id": "case-1", "stage": "pricing"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recommendedAction"] == "schedule-consultation"
    assert app.state.logs, "Expected evaluation log"


def test_journey_hints():
    response = client.post(
        "/rec/journey-hints",
        json={"case_id": "case-1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["hints"]
