from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_medical_pre_eval_returns_disclaimer():
    response = client.post(
        "/vision/medical-pre-eval",
        json={"imageUrls": ["https://example.com/xray.png"], "notes": "Pre-op"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "disclaimer" in data
    assert "Non-diagnostic".lower() in data["disclaimer"].lower()
