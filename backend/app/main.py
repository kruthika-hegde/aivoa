from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import deviations, ai

settings = get_settings()

# Creates the deviations table on startup if it doesn't exist yet.
# For a production system, prefer Alembic migrations instead.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AIVOA Deviation Management API",
    description="AI-powered deviation intake for an API pharmaceutical manufacturer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(deviations.router)
app.include_router(ai.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
