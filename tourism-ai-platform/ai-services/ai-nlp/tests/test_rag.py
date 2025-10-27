from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_ingest_and_query(tmp_path):
    sample = tmp_path / "guide.md"
    sample.write_text("Medical travel packages include airport transfers.")

    with sample.open("rb") as fh:
        response = client.post(
            "/rag/ingest",
            files={"file": (sample.name, fh, "text/markdown")},
            headers={"x-tenant": "tenant-1"},
        )
    assert response.status_code == 200

    query = client.post(
        "/rag/query",
        json={"tenant_id": "tenant-1", "query": "airport transfers"},
    )
    assert query.status_code == 200
    payload = query.json()
    assert payload["sources"], "Expected at least one source"
