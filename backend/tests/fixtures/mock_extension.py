"""Reference mock extension for local/integration testing.

A minimal, self-contained extension service implementing the Phonograph contract
(see EXTENSIONS.md). It returns a deterministic Spotify search link and a fixed
genre for every track it receives, so install → refresh → update → remove can be
exercised end-to-end.

Run it on its own port, then install its manifest from Settings → Extensions:

    cd backend
    ./.venv/bin/uvicorn tests.fixtures.mock_extension:app --port 9100

Manifest URL: http://localhost:9100/manifest
(set EXTENSION_ALLOW_HTTP=true in the backend .env for http/localhost during dev).
"""
from urllib.parse import quote_plus

from fastapi import FastAPI, Request

app = FastAPI(title="Mock Phonograph Extension")

MANIFEST = {
    "api_version": "1.0",
    "name": "Mock Enricher",
    "version": "1.0.0",
    "author": "Phonograph Test Suite",
    "endpoint_url": "http://localhost:9100",
    "capabilities": ["metadata.refresh", "streaming_links.resolve"],
    "required_permissions": ["read:tracks", "write:streaming_links", "write:track_metadata"],
}


@app.get("/manifest")
def manifest() -> dict:
    return MANIFEST


@app.post("/install")
async def install(request: Request) -> dict:
    return {"ok": True}


@app.post("/uninstall")
async def uninstall(request: Request) -> dict:
    return {"ok": True}


@app.post("/refresh")
async def refresh(request: Request) -> dict:
    payload = await request.json()
    results = []
    for track in payload.get("tracks", []):
        query = quote_plus(f"{track.get('artist', '')} {track.get('title', '')}".strip())
        results.append(
            {
                "ref": track["ref"],
                "streaming_links": [
                    {"service": "spotify", "url": f"https://open.spotify.com/search/{query}"}
                ],
                "genre": "Test Genre",
                "year": track.get("year"),
            }
        )
    return {"results": results}
