<div align="center">
  <img src="frontend/assets/phonograph-sd.png" alt="Phonograph" width="300">
  <p><em>The metadata-first manager for your music libraries</em></p>
</div>

<p align="center"><strong>catalog every device · dedupe across libraries · find missing tracks &amp; quality gaps · never touches audio</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/audio-never%20stored-10b981.svg" alt="Audio: never stored">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" alt="Python 3.12">
  <img src="https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white" alt="React + TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/deploy-Nginx%20%2B%20systemd-009639?logo=nginx&logoColor=white" alt="Nginx + systemd">
</p>

<p align="center">
  <a href="#what-it-does">What it does</a> ·
  <a href="#how-it-works-30-seconds">How it works</a> ·
  <a href="#get-started-60-seconds">Get started</a> ·
  <a href="#features-by-phase">Features</a> ·
  <a href="#deployment">Deploy</a> ·
  <a href="architecture.md">Architecture</a>
</p>

<p align="center"><sub>Live demo: <a href="https://phonograph.pravaig.dpdns.org">phonograph.pravaig.dpdns.org</a></sub></p>

---

Phonograph catalogs your music across every device and location and answers the
questions audiophiles actually care about — *what's missing where, which copy is
the highest quality, what should I upgrade* — **without ever storing, streaming,
transferring, or playing audio**. Your browser extracts metadata locally; only
the metadata is ever uploaded.

## What it does

- **Browser scanner** — pick a local folder; the browser recursively reads audio
  files (FLAC, MP3, Opus, OGG, AAC, M4A, WAV), extracts tags + format info
  **client-side**, and uploads only the metadata.
- **Libraries** — one scanned collection per device/location, with stats and rescan.
- **Track grouping** — logical songs deduplicated across libraries by normalized
  artist + title, with manual merge / split overrides.
- **Variants** — physical file versions per library, ranked by quality
  (bit depth → sample rate → lossless → bitrate), with comparison views.
- **Collections** — your own collections plus auto-generated Album and Tag/Genre ones.
- **Sharing** — share collections with approved users via link or direct grant.
- **Analytics** — all-library comparison matrix, missing tracks, upgrade gaps,
  duplicate variants, and quality distribution.
- **Streaming links** — attach Spotify/Tidal/Qobuz/Deezer/Amazon/YouTube URLs to
  tracks, with suggestions from matching tracks.
- **Accounts** — username/password + optional Google OAuth, gated by an admin
  approval workflow. Unapproved accounts cannot access any content.

## How it works (30 seconds)

```
 You (web browser)
   │  select a local folder
   ▼
 Browser metadata scanner   ── reads files locally, extracts tags + codec/bitrate/…
   │  uploads METADATA ONLY (never audio bytes)
   ▼
 ┌─────────────────────────────────────────────────────────┐
 │  Phonograph API   (FastAPI — your server, your data)     │
 │  ─────────────────────────────────────────────────────  │
 │  Normalize  →  Track grouping  →  Variant quality rank   │
 │                     │                                     │
 │   Libraries · Collections · Sharing · Streaming links    │
 │                     ▼                                     │
 │            Library analysis engine                       │
 │   missing tracks · upgrade gaps · duplicates · compare   │
 └─────────────────────────────────────────────────────────┘
   │
   ▼
 PostgreSQL   (metadata only — no audio, ever)
```

- **Normalize** — raw tags are preserved verbatim; normalized artist/title are
  generated separately for grouping.
- **Track grouping** — `normalized_artist + normalized_title` groups variants into
  one logical track; manual merge/split overrides survive rescans.
- **Variant quality** — one comparator (bit depth → sample rate → lossless →
  bitrate) drives ordering, missing-variant detection, and analytics so every view agrees.

→ See [architecture.md](architecture.md) for the full V1 specification.

## Get started (60 seconds)

```bash
# Backend (from backend/)
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env                       # set DATABASE_URL, SECRET_KEY, INITIAL_ADMIN_EMAIL
./.venv/bin/alembic upgrade head
./.venv/bin/uvicorn app.main:app --reload --port 8000     # API + docs at /docs

# Frontend (from frontend/)
npm install
cp .env.example .env
npm run dev                                # http://localhost:5173 (proxies /api to :8000)
```

The first account you register — or one whose email matches `INITIAL_ADMIN_EMAIL`
— becomes an approved **admin** automatically. Other accounts start `pending` and
are approved from the Admin page.

> **Folder scanning** uses the `webkitdirectory` file input (Chromium-based
> browsers and Firefox). Audio bytes never leave the browser — only extracted
> metadata is uploaded.

## Stack

| Layer     | Tech                                                         |
|-----------|--------------------------------------------------------------|
| Frontend  | React · TypeScript · Vite · TailwindCSS · TanStack Query     |
| Backend   | FastAPI · Python 3.12 · Pydantic · SQLAlchemy               |
| Database  | PostgreSQL (Alembic migrations)                             |
| Deploy    | Nginx · Cloudflare · systemd on an Ubuntu VPS               |

## Features by phase

architecture.md defines 10 V1 phases — all implemented:

| #  | Phase                  | Highlights                                                    |
|----|------------------------|--------------------------------------------------------------|
| 1  | Authentication         | register · login · Google OAuth · admin approval gate        |
| 2  | Database               | users, libraries, tracks, variants, collections, shares      |
| 3  | Browser scanner        | folder pick · recursive discovery · client-side extraction   |
| 4  | Track grouping engine  | normalization · merge / split overrides                      |
| 5  | Library management      | create · scan · rescan · contents · stats                   |
| 6  | Variant management      | detection · quality ranking · comparison                    |
| 7  | Collections             | CRUD · add/remove · auto Album + Tag collections            |
| 8  | Sharing                 | share links · direct grants · approved-users-only           |
| 9  | Search &amp; analytics  | search · missing tracks/variants · duplicates · compare     |
| 10 | Streaming links         | attach · suggest · display (pointers only)                  |

## Deployment

Single-process deploy: the FastAPI app serves both `/api` and the built frontend,
behind one Nginx `proxy_pass`. `start.sh` installs deps, migrates, builds the
frontend, and runs the server; `deploy.sh` pulls `origin/main` and restarts on a
schedule. Full guide: **[deploy/README.md](deploy/README.md)**.

```bash
sudo cp deploy/phonograph.service /etc/systemd/system/ && sudo systemctl enable --now phonograph
sudo cp deploy/phonograph.nginx /etc/nginx/sites-available/phonograph
sudo ln -sfn /etc/nginx/sites-available/phonograph /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```

## Project layout

```
backend/    FastAPI app, services, SQLAlchemy models, Alembic migrations
frontend/   React SPA (scanner, libraries, tracks, collections, analytics)
deploy/     Nginx config, systemd unit, deployment guide
start.sh    install deps → migrate → build frontend → run (systemd ExecStart)
deploy.sh   hourly: pull origin/main and restart if changed
architecture.md   the V1 specification this implements
```

## The one hard rule

Phonograph is **metadata-only**. It never stores, streams, transfers, plays, or
uploads audio files — anything that touches audio bytes is out of scope. The
browser extracts metadata locally and uploads only that.

## License

Self-hosted and source-available. No open-source license has been applied yet —
all rights reserved by the project owner until one is added.
