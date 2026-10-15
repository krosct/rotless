<p align="center">
  <img src="img/rotless_logo_3.png" alt="rotless — Smart Pantry, Reduce Waste" width="440" />
</p>

# rotless

Smart pantry web app — *"rot less"* (less food waste). Tracks household food batches and expiry dates, warning members via Telegram before food expires.

## Stack

- **Backend:** PHP 8.3+ (8.5 on the VPS) + Laravel (REST API only, `/api/v1/*`)
- **Frontend:** React + TypeScript + Vite (`frontend/`)
- **Database:** PostgreSQL
- **Infra:** PostgreSQL in Docker (`docker-compose.yml`); the app runs on the system, with
  [FrankenPHP](https://frankenphp.dev) on the VPS, published by [devkit](https://github.com/krosct/devkit)
- **Auth:** Laravel Sanctum (token-based)

## Local dev

Needs PHP 8.3+ with Composer and the extensions `pdo_pgsql`, `dom`, `intl`, `bcmath`, `gd` and
`zip` (Ubuntu: `sudo apt install php-pgsql php-xml php-intl php-bcmath php-gd php-zip`), Node 22
and Docker (for PostgreSQL only).

```bash
cp .env.example .env            # set DB_PASSWORD (openssl rand -hex 32), then: php artisan key:generate
~/Documentos/devkit/deploy.sh local
```

That starts PostgreSQL (`docker compose up -d --wait db`), installs the PHP dependencies, runs
the migrations, serves the API on http://localhost:8000 and the Vite dev server on
http://localhost:5173, which proxies `/api` to the API. Ctrl+C stops the API and Vite; the
database keeps running (`docker compose stop` stops it). For the queue and the scheduler, run
`php artisan queue:work` and `php artisan schedule:work` in other terminals.

## Install on Android (PWA)

The frontend is an installable PWA (`vite-plugin-pwa`). Open the production
URL in Chrome on Android and tap **⋮ → Instalar app** (or the install banner).
It gets a home-screen icon and opens standalone, without the browser UI. The
service worker caches only the app shell; API calls always hit the network.
The service worker is generated only by `npm run build`, not by `npm run dev`.

## Deploy

rotless is published with [devkit](https://github.com/krosct/devkit), like the other apps on
its VPS, which all sit behind one shared Caddy. `deploy.conf` holds what is specific to rotless;
devkit does the rest.

Pushes to `main` that pass CI are deployed by `.github/workflows/deploy.yml`, **after a manual
approval** of the `production` environment in GitHub Actions. devkit builds the frontend on the
runner, sends the release over SSH and, on the VPS, in `/srv/rotless`:

1. writes the settings sent by the workflow into `.env` (key by key; the database password is
   generated on the first deploy and kept), unpacks the release into `releases/<release>` and
   runs `INSTALL` (`deploy.conf`) while the running release keeps serving: FrankenPHP (PHP and
   its web server, one static binary) and Composer in `tools/` (pinned, checksum verified),
   `composer install --no-dev`, a database dump into `data/backups/` (newest 10 kept) and
   pending migrations (additive only);
2. switches the user service `rotless` to the new release: `RUN` makes sure PostgreSQL is up,
   starts the queue worker and the scheduler, and runs FrankenPHP with the `Caddyfile` on the
   port devkit chose (Laravel for `/api/*`, the built SPA for the rest);
3. checks that it stays up and answers `GET /api/v1/health`, or goes back to the previous
   release (migrations are never rolled back);
4. publishes `rotless.caddy` on the shared Caddy (`/srv/caddy/sites/`, HTTPS with the
   Cloudflare Origin Certificate in `/srv/caddy/certs/`), which forwards to FrankenPHP, and
   checks the public address. Only Cloudflare reaches the VPS: devkit closes 80/443 to
   everyone else.

What stays on the VPS across releases: `/srv/rotless/.env`, `/srv/rotless/data/storage`
(Laravel's storage), `data/backups` and the database volume `rotless_db-data` (the Compose
project is always `rotless`). On a VPS without the shared Caddy, the first deploy installs it
(passwordless sudo, or run it from a terminal). The VPS needs Docker, for PostgreSQL.

### Settings and secrets of the `production` environment

The app settings are listed in the `env` input of the deploy step: each one comes from the
secret or variable `DEPLOY_<NAME>` of the `production` environment (secrets for `APP_KEY` and
the Telegram tokens, variables for the rest). One left unset is removed from the server's `.env`
and Laravel uses its default. `DB_PASSWORD` is not sent: it stays on the server.

Access to the VPS: `DEPLOY_HOST` (the VPS IP, a secret so it stays masked in the public Actions
logs), `DEPLOY_USER`, `DEPLOY_SSH_KEY` (a key with a shell on the VPS: devkit runs its own steps
there) and `DEPLOY_KNOWN_HOSTS`:

```bash
ssh rotless-vps 'cat /etc/ssh/ssh_host_ed25519_key.pub' \
  | awk -v h="<VPS IP>" '{print h, $1, $2}' \
  | gh secret set DEPLOY_KNOWN_HOSTS --env production
```

A non-default SSH port goes in the `DEPLOY_PORT` environment variable.

### Manual deploy and helpers

```bash
~/Documentos/devkit/deploy.sh vps rotless-vps   # same deploy from this folder; keeps the server's settings
~/Documentos/devkit/deploy.sh status|logs|restart|stop rotless-vps
```

Stopping the service stops the app, the queue and the scheduler; PostgreSQL keeps running
(`ssh rotless-vps 'docker compose -p rotless stop'` stops it). To undo a release, `git revert`
it on `main` and let it deploy. Never run `docker compose down -v`: it deletes the database
volume.
