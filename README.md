# Phonograph

A self-hosted, **metadata-first** music library manager. Phonograph catalogs
your music across multiple devices and locations and answers audiophile
questions — *what's missing where, which copy is highest quality, what should I
upgrade* — **without ever storing, streaming, transferring, or playing audio**.
The browser extracts metadata locally; only metadata is uploaded.

## What it does (V1)

- **Auth** with username/password + optional Google OAuth, gated by an admin
  approval workflow. Unapproved accounts cannot access any content.
- **Browser scanner**: pick a local folder, the browser recursively reads audio
  files (FLAC, MP3, Opus, OGG, AAC, M4A, WAV), extracts metadata client-side, and
  uploads only the metadata.
- **Libraries**: one scanned collection per device/location, with stats and rescan.
- **Track grouping**: logical songs deduplicated across libraries by normalized
  artist + title, with manual merge/split overrides.
- **Variants**: physical file versions per library, ranked by quality
  (bit depth → sample rate → lossless → bitrate), with comparison views.
- **Collections**: user collections plus auto-generated Album and Tag/Genre
  collections.
- **Sharing**: share collections with approved users via link or direct grant.
- **Search & analytics**: search by artist/track/album/genre/codec; missing
  tracks, upgrade gaps (missing variants), duplicate variants, library comparison,
  and quality distribution.
- **Streaming links**: attach external service URLs to tracks, with suggestions
  from matching tracks.

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS + TanStack Query
- **Backend**: FastAPI (Python 3.12) + Pydantic + SQLAlchemy
- **Database**: PostgreSQL (Alembic migrations)
- **Deploy**: Nginx + Cloudflare + systemd on an Ubuntu VPS

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # set DATABASE_URL, SECRET_KEY, INITIAL_ADMIN_EMAIL
./.venv/bin/alembic upgrade head
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

API docs at http://localhost:8000/docs.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173 (proxies /api to :8000)
```

The first account you register — or one whose email matches
`INITIAL_ADMIN_EMAIL` — becomes an approved admin automatically. Other accounts
start `pending` and must be approved from the Admin page.

> **Folder scanning** uses the `webkitdirectory` file input, supported in
> Chromium-based browsers and Firefox. Audio bytes never leave the browser —
> only extracted metadata is uploaded.

## Deployment

See [deploy/README.md](deploy/README.md).

## Project layout

```
backend/    FastAPI app, services, SQLAlchemy models, Alembic migrations
frontend/   React SPA (scanner, libraries, tracks, collections, analytics)
deploy/     Nginx config, systemd unit, deployment guide
architecture.md   The V1 specification this implements
```
