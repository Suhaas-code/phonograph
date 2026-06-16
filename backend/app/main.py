"""Phonograph API application entry point."""
import logging
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    admin,
    auth,
    bugs,
    collections,
    extensions,
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
api.include_router(bugs.router)
api.include_router(extensions.router)


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


# In production the built frontend (frontend/dist) is served from this same
# process so the whole app sits behind a single Nginx proxy_pass. When dist/
# is absent (e.g. local dev with the Vite server), only the API is served.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount(
        "/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets"
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        """Serve static files when they exist, else index.html for SPA routes."""
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
