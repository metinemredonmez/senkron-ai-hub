from fastapi.testclient import TestClient

from app.main import create_app


def test_metrics_endpoint_exposes_prometheus_payload():
    app = create_app()
    client = TestClient(app)

    response = client.get("/metrics")
    assert response.status_code == 200
    body = response.text
    assert "process_cpu_seconds_total" in body
