from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import get_settings
from ..services.job_store import store

router = APIRouter()


class TextToSpeechRequest(BaseModel):
    text: str
    voice: str = "en-US-male"


@router.post("/stt/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    content = await audio.read()
    text = f"Transcribed {len(content)} bytes from {audio.filename}."
    job = store.create_job(
        "stt",
        {
            "text": text,
            "timestamps": [[0.0, 1.5, text]],
        },
    )
    return job


@router.post("/tts/synthesize")
async def synthesize(request: TextToSpeechRequest):
    settings = get_settings()
    job = store.create_job("tts", {})
    audio_url = f"{settings.presign_base_url}/{request.voice}/{job['id']}.mp3"
    store.update_job(
        job["id"],
        {
            "audioUrl": audio_url,
            "text": request.text,
        },
    )
    return store.get_job(job["id"])


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
