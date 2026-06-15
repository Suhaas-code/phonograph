#!/usr/bin/env bash
#
# start.sh — install deps, migrate the DB, build the frontend, run Phonograph.
#
# Phonograph is a Python (FastAPI) backend plus a static React frontend. In
# production the FastAPI process serves BOTH the built frontend (frontend/dist)
# and the /api routes on a single port, so "start" means:
#   backend deps -> migrate -> build frontend -> run uvicorn.
#
# Used as the systemd ExecStart for the `phonograph` service and re-run on every
# redeploy by deploy.sh. Nginx (phonograph.pravaig.dpdns.org) proxies to $PORT.
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# --- Environment ------------------------------------------------------------
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export PORT="${PORT:-8090}"
VENV="$APP_DIR/backend/.venv"

# --- Backend env file (first run) -------------------------------------------
# Create backend/.env from the template and generate a real signing secret so
# the deploy is secure out of the box.
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  SECRET="$(openssl rand -hex 32)"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET}|" backend/.env
  echo "[start] created backend/.env from template (generated SECRET_KEY)"
fi

# Frontend builds against the same origin behind Nginx.
if [ ! -f frontend/.env ]; then
  echo "VITE_API_BASE=/api" > frontend/.env
  echo "[start] created frontend/.env"
fi

# --- Backend dependencies ---------------------------------------------------
# Recreate the venv / reinstall only when requirements.txt is newer than the
# last install, so normal restarts are fast.
if [ ! -d "$VENV" ]; then
  echo "[start] creating Python venv..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
fi
if [ ! -f "$VENV/.deps-installed" ] || [ backend/requirements.txt -nt "$VENV/.deps-installed" ]; then
  echo "[start] installing backend dependencies..."
  "$VENV/bin/pip" install --quiet -r backend/requirements.txt
  touch "$VENV/.deps-installed"
else
  echo "[start] backend dependencies up to date"
fi

# --- Database migrations ----------------------------------------------------
echo "[start] applying database migrations..."
(cd backend && "$VENV/bin/alembic" upgrade head)

# --- Frontend dependencies + build ------------------------------------------
if [ ! -d frontend/node_modules ] || [ frontend/package-lock.json -nt frontend/node_modules/.package-lock.json ]; then
  echo "[start] installing frontend dependencies (npm ci)..."
  (cd frontend && npm ci)
else
  echo "[start] frontend dependencies up to date"
fi

echo "[start] building frontend (vite build -> frontend/dist)..."
(cd frontend && npm run build)

# --- Run --------------------------------------------------------------------
echo "[start] starting Phonograph on :$PORT"
cd backend
exec "$VENV/bin/uvicorn" app.main:app --host 127.0.0.1 --port "$PORT" --workers 2
