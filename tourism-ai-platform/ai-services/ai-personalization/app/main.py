from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import recommendations

app = FastAPI(title="Health Tourism Personalization", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.logs = []
app.include_router(recommendations.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-personalization"}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8500, reload=True)
