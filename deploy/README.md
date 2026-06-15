# Deploying Phonograph

Target: Ubuntu VPS behind Nginx + Cloudflare, backend managed by systemd.

## 1. System packages

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv postgresql nginx
```

## 2. Database

```bash
sudo -u postgres psql -c "CREATE ROLE phonograph LOGIN PASSWORD 'strong-password';"
sudo -u postgres createdb -O phonograph phonograph
```

## 3. Backend

```bash
sudo mkdir -p /opt/phonograph && sudo chown $USER /opt/phonograph
git clone <repo> /opt/phonograph
cd /opt/phonograph/backend
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements.txt
cp .env.example .env       # then edit: DATABASE_URL, SECRET_KEY, INITIAL_ADMIN_EMAIL, CORS_ORIGINS
./.venv/bin/alembic upgrade head
```

Create a dedicated service user and install the unit:

```bash
sudo useradd --system --home /opt/phonograph phonograph || true
sudo chown -R phonograph:phonograph /opt/phonograph
sudo cp deploy/phonograph-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now phonograph-api
```

The first registered account (or the account matching `INITIAL_ADMIN_EMAIL`) is
automatically an approved admin.

## 4. Frontend

```bash
cd /opt/phonograph/frontend
npm ci
echo "VITE_API_BASE=/api" > .env
npm run build
sudo mkdir -p /var/www/phonograph
sudo cp -r dist/* /var/www/phonograph/
```

## 5. Nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/phonograph
sudo ln -s /etc/nginx/sites-available/phonograph /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Point Cloudflare DNS at the VPS and enable proxying / TLS. Because the SPA and
API share an origin (`/api`), no extra CORS config is required in production;
`CORS_ORIGINS` only matters when the frontend runs on a different origin (e.g.
the Vite dev server).

## 6. Google OAuth (optional)

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`
(`https://your-domain/oauth/callback`) in `backend/.env`, then restart the
service. Leave them blank to disable the "Continue with Google" button.

## Upgrades

```bash
cd /opt/phonograph && git pull
cd backend && ./.venv/bin/pip install -r requirements.txt && ./.venv/bin/alembic upgrade head
sudo systemctl restart phonograph-api
cd ../frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/phonograph/
```
