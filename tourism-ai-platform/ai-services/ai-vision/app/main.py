from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import vision

app = FastAPI(title="Health Tourism Vision Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(vision.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-vision"}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8400, reload=True)
