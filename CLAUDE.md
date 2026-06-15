# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

V1 is **implemented**. Layout:

- `backend/` — FastAPI app (`app/`), services, SQLAlchemy models, Alembic migrations.
- `frontend/` — React + Vite SPA (browser scanner, libraries, tracks, collections, analytics).
- `deploy/` — Nginx config, systemd unit, deployment guide.
- `architecture.md` — the V1 spec this implements.

### Commands

Backend (from `backend/`):

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env                     # set DATABASE_URL, SECRET_KEY, INITIAL_ADMIN_EMAIL
./.venv/bin/alembic upgrade head         # apply migrations
./.venv/bin/alembic revision --autogenerate -m "msg"   # after model changes
./.venv/bin/uvicorn app.main:app --reload --port 8000  # run (docs at /docs)
```

Frontend (from `frontend/`):

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173, proxies /api to :8000
npm run build        # typecheck + production build to dist/
npm run typecheck
```

There is no automated test suite yet; verify via `/docs` and the SPA.

### Documented assumptions (where architecture.md was ambiguous)

- **Tracks are scoped per-owner** (added `owner_id` to Track). "Missing tracks between libraries" means within one user's libraries; this keeps users' catalogs and sharing isolated.
- **Manual merge/split persistence**: `Track.merged_keys` (JSONB) remembers absorbed grouping keys so merges survive rescans; `Track.manual` / `Variant.pinned` flag manually-adjusted records. No extra entities added.
- **Rescan semantics**: a scan with `replace=true` swaps out the library's variants; orphaned tracks are pruned.
- **Auth**: JWT bearer tokens via the OAuth2 password flow, plus optional Google OAuth. First user (or `INITIAL_ADMIN_EMAIL`) becomes an approved admin.
- **bcrypt pinned to 4.0.1** for passlib 1.7.4 compatibility.

## What this is

Phonograph is a self-hosted, **metadata-first** music library manager. The single most important constraint: **the platform never stores, streams, transfers, plays, or uploads audio files** — only metadata. Any feature that touches audio bytes is out of scope (see the V1 Non-Goals in architecture.md). Treat this as a hard invariant when designing anything.

## Planned stack

- **Frontend**: React + TypeScript + Vite, TanStack Query for server state, TailwindCSS.
- **Backend**: FastAPI (Python 3.12+), Pydantic, SQLAlchemy.
- **Database**: PostgreSQL.
- **Auth**: OAuth2 + username/password, gated by an **admin approval workflow** (`approval_status` on User — unapproved accounts cannot access content, including shared collections).
- **Deploy**: Nginx + Cloudflare on an Ubuntu VPS, managed via systemd.

## Architecture invariants

These are the load-bearing design decisions; getting them right matters more than file layout.

**Scanning happens in the browser, not the server.** The web client selects a local folder, recursively discovers audio files, and extracts metadata **client-side**. Only the extracted metadata is uploaded to the metadata upload API. The server never receives audio. Supported formats: FLAC, MP3, Opus, OGG, AAC, M4A, WAV.

**Raw metadata and normalized metadata are stored separately.** Always preserve the raw tags as extracted; generate normalized fields (e.g. `normalized_artist`, `normalized_title`) as a distinct, additional representation. The scanner must gracefully tolerate missing tags, malformed tags, inconsistent capitalization, and duplicates.

**The domain model has three layers — do not conflate them:**

- **Library** — one scanned collection on one device/location (e.g. "Laptop FLAC Archive", "NAS Backup"). Owned by a user.
- **Track** — a *logical* song identity, deduplicated across libraries. The grouping key is `normalized_artist + normalized_title`. One Track can exist in many libraries.
- **Variant** — a *physical* file version of a Track within a specific Library (codec, container, bitrate, bit_depth, sample_rate, etc.). A Track has many Variants; the same logical song in FLAC and in MP3 is two Variants of one Track.

Track grouping must support **manual split/merge overrides** — automatic normalization will not always be correct.

**Variants are always ordered by quality.** Ordering priority: higher bit depth → higher sample rate → lossless before lossy → higher bitrate. Centralize this comparison logic so missing-variant detection, comparison views, and quality distribution analytics all agree.

**Collections are a unified grouping system** spanning user-made, album, tag, and shared types (`Collection.type`). Albums and tags are *system-generated* collections; user collections and shared collections are user-driven. Sharing requires permission validation and is restricted to approved users only.

**Streaming Links** attach to a *Track* (not a Variant), mapping to external services (Spotify, Tidal, Qobuz, Deezer, Amazon Music, YouTube Music). They are pointers/URLs only — consistent with the no-audio rule.

## Core analytics features (the point of the product)

The library analysis engine exists to answer cross-library questions: **missing tracks** (in one library but not another), **missing/duplicate variants**, library comparison, and quality distribution. Design Track/Variant queries with these comparisons in mind.

## Build order

architecture.md defines 10 phases; the dependency-meaningful ones: Auth + approval (1) → DB schema (2) → browser scanner (3) → track grouping engine (4) → library management (5) → variant management (6) → collections (7) → sharing (8) → search/analytics (9) → streaming links (10).
