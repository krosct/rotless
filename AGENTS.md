# AGENTS.md — rotless

## Guidelines

- `base.md` is auto-loaded globally via `opencode.jsonc`; do not re-load it. Additionally load, per task type:
  - PHP/Laravel tasks: `~/.config/opencode/docs/guidelines/php.md`
  - Container/Compose tasks: `~/.config/opencode/docs/guidelines/docker.md`
  - Migration/query tasks: `~/.config/opencode/docs/guidelines/sql.md`
  - `frontend/` tasks: `~/.config/opencode/docs/guidelines/typescript.md` + `react.md`

## Precedence (highest first)

1. Explicit user instruction in the current session.
2. This `AGENTS.md`.
3. Language overlay (`php.md`, `docker.md`, `sql.md`, `typescript.md`, `react.md`).
4. `base.md`.
5. Skills and agents docs.

## Project overview

**rotless** — smart pantry web app. Tracks household food batches and expiry dates, warns users via Telegram before food expires.

- Name meaning: "rot less" (menos desperdício).
- Language of code, comments, docs, identifiers: **English**. Talk to the user in pt-BR.

## Stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Backend    | PHP 8.3 + Laravel (API REST only, no Blade views)   |
| Frontend   | React + TypeScript + Vite (SPA in `frontend/`), Node 22 |
| Database   | PostgreSQL (Eloquent ORM, migrations)               |
| Infra      | Docker Compose: `app`, `db`, `queue`, `scheduler`   |
| Auth       | Laravel Sanctum (token-based, SPA)                  |
| Tests      | Pest (backend), Vitest (frontend)                   |
| CI         | GitHub Actions: lint + tests on every push          |
| Notifs     | Telegram Bot API (queued jobs)                      |
| Git hooks  | lefthook + commitlint (validate conventional commits) |

## Architecture

Modular API-first: Laravel exposes `/api/v1/*`; React is the only UI consumer.

- `app/Models/` — `User`, `Household`, `HouseholdInvitation`, `Product`, `Batch`, `NotificationLog`
- `app/Http/Controllers/Api/V1/` — versioned controllers (`Auth`, `Batch`, `Invitation`, `Health`)
- `app/Http/Requests/` — Form Requests for all validation (no inline validation)
- `app/Policies/` — authorization (users act only inside their own household; only owners manage members/invitations)
- `app/Services/` — external API clients (e.g. `OpenFoodFactsClient`)
- `app/Events/`, `app/Listeners/` — e.g. `BatchesNearExpiry` event
- `app/Jobs/` — queued jobs, e.g. `SendTelegramExpiryAlert`
- Routes: `routes/api.php`; scheduler: `routes/console.php` (`Schedule::daily()`)

### Core domain rules

- A `Batch` belongs to a `Product` and a `Household`; has `quantity`, `expires_at`, `status` (`active|consumed|discarded`).
- A user belongs to one or more `Households` via pivot with role (`owner|member`).
- Daily scheduler checks active batches expiring within configurable window (default 3 days) → dispatches event → queue job → Telegram message per household member + row in `notification_log`.
- Products are cached in DB from OpenFoodFacts API (barcode lookup); manual products (no barcode) allowed with photo.

## Commands

```bash
# Backend
docker compose up -d                  # start app, db, queue, scheduler
docker compose exec app composer install
docker compose exec app php artisan migrate --seed
docker compose exec app vendor/bin/pint        # lint/format (fix)
docker compose exec app vendor/bin/phpstan analyse  # static analysis (Larastan, level 5)
docker compose exec app vendor/bin/pest --filter name  # focused test
# Frontend
cd frontend && npm install && npm run dev
npm run lint && npm run build
```

Record exact commands here after first setup if they differ.

## Conventions

- PHP: `declare(strict_types=1);` in new app files; full type hints; `readonly` + constructor promotion where applicable; `enum` for fixed sets (statuses, roles).
- Follow Laravel conventions (Artisan generators, `app/` structure). Match neighboring files.
- Always `===`; no loose comparisons.
- Validation exclusively via Form Requests. Authorization via Policies (never inline checks).
- DB access only through Eloquent/query builder (prepared statements). No raw interpolated SQL.
- API responses: JSON resources (`app/Http/Resources/`). Success envelope: `{"data": ...}`. Error envelope: `{"message": string, "errors"?: Record<field, string[]>}` (Laravel validation shape).
- Frontend: functional components + hooks; TypeScript strict; keep API client in `frontend/src/api/`.

## Git

- Branch per task; commit locally after each concluded task; push only when PR-ready and the user explicitly confirms.
- Conventional commits (`feat:`, `fix:`, `chore:`, ...).
- Never commit: `vendor/`, `node_modules/`, `.env*`, `storage/*.key`, secrets, Telegram bot token.

## Security

- Secrets only via `.env` (never committed); Telegram bot token and OpenFoodFacts base URL are env vars.
- Validate required env vars at boot; fail fast.
- Never log secrets or personal data.

## Testing policy

- Backend: Pest feature tests for every API endpoint, policy test per rule, unit test for expiry logic (date window calculation — the core business rule).
- Mock Telegram API and OpenFoodFacts HTTP calls (Http::fake); never real network in tests.
- Run focused tests during development; full suite before finishing a task.

## CI/CD and Deploy

- CI (GitHub Actions, `.github/workflows/ci.yml`): on every push run `pint` (lint), `pest` (backend tests) and `npm run build` (frontend). Pin all action versions by 40-char SHA, not by tag.
- CD (GitHub Actions, `.github/workflows/deploy.yml`): after CI passes on `main`, deploy to a VPS running the same Docker Compose stack.
- Deploy flow: SSH into VPS → `git pull` → `docker compose build` → `docker compose up -d` → `php artisan migrate --force` → restart `queue` and `scheduler` services.
- VPS runs an HTTPS reverse proxy (Caddy) in front of the stack; `queue` and `scheduler` services must be running for notifications to work.
- Secrets (SSH key, VPS host, Telegram bot token) live only in GitHub Actions secrets and the VPS `.env` — never in the repo.
- Health check: `GET /api/v1/health` must exist and be used by CI/deploy verification.
- Observability: `docker compose logs` on the VPS; notification failures are visible in `notification_log` and job failed_jobs table.
- Deployments run only via the `deploy-project` skill, and only with explicit user confirmation.

## Observability

- Keep `/api/v1/health` returning DB connectivity status.
- Alerting/monitoring failures (job errors, scheduler skips) are diagnosed via `docker compose logs` and failed jobs; record diagnosis steps here as they emerge.

## Project Specifics

- Toolchain: PHP 8.3 (local and Docker image), Node 22 for the frontend. Version is pinned by the Dockerfile/composer.json/package.json once created.
- Git hooks: lefthook + commitlint installed via npm devDependencies; run `lefthook install` once after first setup to enable the commit-msg hook.
- Release/versioning: this is a web app — no Packagist publish. Version source is the git tag; keep a `CHANGELOG.md` in sync with tags.
- Project overview source: `README.md` at repo root.
