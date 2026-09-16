# rotless

Smart pantry web app — *"rot less"* (less food waste). Tracks household food batches and expiry dates, warning members via Telegram before food expires.

## Stack

- **Backend:** PHP 8.3 + Laravel (REST API only, `/api/v1/*`)
- **Frontend:** React + TypeScript + Vite (`frontend/`)
- **Database:** PostgreSQL
- **Infra:** Docker Compose (`app`, `db`, `queue`, `scheduler`)
- **Auth:** Laravel Sanctum (token-based)

## Quick start

```bash
docker compose up -d
docker compose exec app composer install
docker compose exec app php artisan migrate
```

See `AGENTS.md` for full conventions, testing policy, and deploy flow.
