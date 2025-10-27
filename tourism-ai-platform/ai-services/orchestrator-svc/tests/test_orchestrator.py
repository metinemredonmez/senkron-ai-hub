from fastapi.testclient import TestClient

from app.main import create_app


def build_payload(symptoms=None):
    return {
        "tenantId": "tenant-1",
        "caseId": "case-123",
        "patient": {"firstName": "Emre"},
        "intake": {
            "targetProcedure": "Rhinoplasty",
            "symptoms": symptoms or [],
            "metrics": {"bmi": 24},
        },
    }


def test_orchestration_happy_path():
    app = create_app()
    client = TestClient(app)

    response = client.post("/orchestrator/cases", json=build_payload())
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "quote-ready"
    assert data["pricing"]["currency"] == "EUR"
    assert data["disclaimers"]


def test_orchestration_with_approval():
    app = create_app()
    client = TestClient(app)

    response = client.post(
        "/orchestrator/cases",
        json=build_payload(symptoms=["chest pain"]),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "awaiting-approval"
    assert data["approvals"], "Expected approval task"

    resume = client.post(
        "/orchestrator/cases/approval",
        json={
            "tenantId": "tenant-1",
            "caseId": "case-123",
            "taskId": data["approvals"][0]["id"],
            "decision": "APPROVED",
        },
    )
    assert resume.status_code == 200
    resume_data = resume.json()
    assert resume_data["status"] == "quote-ready"
