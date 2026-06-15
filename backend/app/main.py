"""Phonograph API application entry point."""
import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    admin,
    auth,
    collections,
    libraries,
    search,
    sharing,
    streaming_links,
    tracks,
)
from app.config import settings

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)

app = FastAPI(
    title="Phonograph API",
    version="1.0.0",
    description="Self-hosted, metadata-first music library manager (no audio).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(admin.router)
api.include_router(libraries.router)
api.include_router(tracks.router)
api.include_router(collections.router)
api.include_router(sharing.router)
api.include_router(streaming_links.router)
api.include_router(search.router)


@api.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@api.get("/config", tags=["meta"])
def public_config() -> dict:
    """Public, non-secret config the frontend needs at boot."""
    return {
        "google_oauth_enabled": settings.google_oauth_enabled,
        "supported_formats": ["FLAC", "MP3", "Opus", "OGG", "AAC", "M4A", "WAV"],
        "streaming_services": [
            "spotify",
            "tidal",
            "qobuz",
            "deezer",
            "amazon_music",
            "youtube_music",
        ],
    }


app.include_router(api)
