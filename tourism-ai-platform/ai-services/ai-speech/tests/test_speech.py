from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_transcribe_creates_job(tmp_path):
    sample = tmp_path / "voice.wav"
    sample.write_bytes(b"fake-audio")

    with sample.open("rb") as fh:
        response = client.post(
            "/stt/transcribe",
            files={"audio": (sample.name, fh, "audio/wav")},
        )
    assert response.status_code == 200
    job_id = response.json()["id"]

    status = client.get(f"/jobs/{job_id}")
    assert status.status_code == 200
    payload = status.json()
    assert payload["result"]["text"].startswith("Transcribed")


def test_tts_returns_audio_url():
    response = client.post(
        "/tts/synthesize",
        json={"text": "Welcome to health tourism", "voice": "en-US-female"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["result"]["audioUrl"].endswith(".mp3")
