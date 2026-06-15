# Deploying Phonograph

Target: Ubuntu VPS behind Nginx + Cloudflare, at
**phonograph.pravaig.dpdns.org**, managed by systemd with hourly git
auto-deploy.

Phonograph runs as a **single process**: the FastAPI backend (uvicorn on
`127.0.0.1:8090`) serves both the `/api` routes and the built React frontend
(`frontend/dist`). Nginx proxies the whole subdomain to that one port, matching
the other sites on this VPS.

```
Cloudflare ──TLS──> Nginx (phonograph.pravaig.dpdns.org) ──> 127.0.0.1:8090 (uvicorn)
                                                              ├── /api/*  FastAPI
                                                              └── /*      frontend/dist (SPA)
```

## Scripts

- **`start.sh`** (repo root) — installs backend deps, runs DB migrations, builds
  the frontend, and execs uvicorn on `$PORT` (default 8090). This is the systemd
  `ExecStart`; it is re-run on every restart/redeploy. On first run it creates
  `backend/.env` (with a generated `SECRET_KEY`) and `frontend/.env`.
- **`deploy.sh`** (repo root) — hourly cron job: if `origin/main` has moved,
  `git reset --hard` to it and `systemctl restart phonograph`. Runtime state
  lives in PostgreSQL and the gitignored `.env` files, so resets are safe.

## One-time setup

### 1. System packages

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv postgresql nginx nodejs npm
```

### 2. Database

```bash
sudo -u postgres psql -c "CREATE ROLE phonograph LOGIN PASSWORD 'phonograph';"
sudo -u postgres createdb -O phonograph phonograph
```

(Match the credentials in `DATABASE_URL` inside `backend/.env`.)

### 3. Code

```bash
git clone <repo> /home/ubuntu/projects/phonograph
cd /home/ubuntu/projects/phonograph
# Optionally pre-set backend/.env (DATABASE_URL, INITIAL_ADMIN_EMAIL, Google
# OAuth). Otherwise start.sh creates it on first run.
```

The first registered account — or one whose email matches `INITIAL_ADMIN_EMAIL`
in `backend/.env` — becomes an approved admin automatically.

### 4. systemd service

```bash
sudo cp deploy/phonograph.service /etc/systemd/system/phonograph.service
sudo systemctl daemon-reload
sudo systemctl enable --now phonograph
sudo systemctl status phonograph        # first start builds the frontend — give it a minute
journalctl -u phonograph -f             # watch start.sh output
```

### 5. Nginx

```bash
sudo cp deploy/phonograph.nginx /etc/nginx/sites-available/phonograph
sudo ln -sfn /etc/nginx/sites-available/phonograph /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Cloudflare already proxies the subdomain and the Origin cert is at
`/etc/ssl/cloudflare/`. No CORS config is needed because the SPA and API share
one origin.

### 6. Hourly auto-deploy

```bash
crontab -l 2>/dev/null | cat - deploy/crontab.phonograph | crontab -
crontab -l        # verify the 0 * * * * entry
```

`deploy.sh` logs to `deploy/deploy.log`.

### 7. Google OAuth (optional)

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`
(`https://phonograph.pravaig.dpdns.org/oauth/callback`) in `backend/.env`, then
`sudo systemctl restart phonograph`. Leave blank to hide the Google button.

## Manual redeploy

```bash
cd /home/ubuntu/projects/phonograph && git pull && sudo systemctl restart phonograph
# or just run the cron script directly:
./deploy.sh
```
