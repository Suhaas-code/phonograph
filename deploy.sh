#!/usr/bin/env bash
#
# deploy.sh — hourly deploy check.
#
# Compares the local checkout against origin/main. If the remote commit has
# moved, it pulls the new code and redeploys by restarting the `phonograph`
# service (which re-runs start.sh: deps -> migrate -> build -> run).
#
# Run hourly from cron (see deploy/crontab.phonograph).
#
set -euo pipefail

APP_DIR="/home/ubuntu/projects/phonograph"
BRANCH="main"
LOG="$APP_DIR/deploy/deploy.log"

cd "$APP_DIR"
exec >>"$LOG" 2>&1
echo "===== $(date '+%F %T') update check ====="

git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "up to date ($LOCAL)"
  exit 0
fi

echo "update available: $LOCAL -> $REMOTE"

# Take the new code, discarding any local changes to tracked files. Runtime
# state lives in PostgreSQL and in the gitignored .env files, so a hard reset
# does not touch production data.
git reset --hard "origin/$BRANCH"

# Redeploy: restarting re-runs start.sh (deps + migrate + build + server).
sudo systemctl restart phonograph
echo "redeployed origin/$BRANCH ($REMOTE) and restarted phonograph"
