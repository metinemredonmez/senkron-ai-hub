from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import rag

app = FastAPI(title="Health Tourism NLP Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)
app.include_router(rag.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-nlp"}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8200, reload=True)
