# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Every operation is stored in `household_movements`: batches added,
  edited, consumed or discarded (partially or fully) and deleted, product
  edits, household renames, invitations, members joining, leaving and
  changing role, with who did it and each field's before and after. Batches
  that existed before are backfilled (insert-only migration).
- `POST /api/v1/batches/{id}/consume` consumes or discards some or all units
  of a batch; partial consumption now shows in the history with its units.
- Household history rebuilt on the movements: a timeline by day that leads
  with who did what ("Marina consumiu 2 un de Leite") and lists each change
  ("Validade: 01/10 → 03/10"), including deletions, with filters and paging.
- Reports for owners and managers (`GET /api/v1/households/{id}/reports`,
  "Ver relatórios" under the history): use rate against the previous period,
  consumption vs waste over time, what is at risk now and expiring next,
  most wasted and most consumed products, activity per member, and tips on
  where to act. Every chart has a table view and works in dark mode.
- The footer shows the site version (`git describe`: the release tag, plus
  the commits since it when there are any).
- Demo mode: three taps on the shield of the login screen open a test
  account ("Teste") in a fictitious household with five people and a
  history of 100 operations, all in the browser and discarded on logout.
  Expiry dates are relative to the day it is opened. Linking Telegram there
  makes the bot send a sample alert, without linking any account
  (`POST /api/v1/telegram/demo-link`).

### Changed

- The app runs on Brasília time (America/Sao_Paulo) instead of UTC: expiry
  validation, the daily expiry alerts (now at 08:00) and the reports follow the
  household's calendar. A one-off, data-preserving migration shifts the
  timestamps already stored back by 3 hours.

### Fixed

- Reports no longer drop the first hours of the previous comparison period.
- The new batch form no longer offers tomorrow as "today" in the evening.
- The back buttons of the household history return to the household
  settings instead of the user settings.
- The deploy job no longer fails when it starts following the VPS log
  before the log file exists; it always reports the deploy's own result.

## 0.2.0 - 2026-09-28

Production release on the VPS: FrankenPHP behind Caddy and Cloudflare, rate
limits, and deploys from `main` after an approved CI run.

### Added

- Telegram account linking, confirmed automatically on the settings page,
  and password change for the signed-in user.
- After login or registration from an invitation link, the user returns to
  the invitation.
- Household member list sortable by join date or name, owner first.
- Rate limits on login (per account and per IP), registration, password
  change, public lookups, the Telegram webhook and the authenticated API;
  429 responses carry `Retry-After`.
- Deploy workflow: after CI passes on `main` and the `production` environment
  is approved, the frontend is built on the runner and `scripts/deploy.sh`
  deploys the commit on the VPS (database backup, additive migrations, health
  check and automatic rollback).
- Caddy reverse proxy and a production-matching dev stack.
- CI job that runs the migrations and the health check against Postgres.

### Changed

- The API is served by FrankenPHP (PHP 8.3, classic mode) instead of
  `php artisan serve`.
- The site is served through Cloudflare: HTTPS with a Cloudflare Origin
  Certificate, connections from outside Cloudflare's IP ranges are dropped,
  the visitor IP comes from `CF-Connecting-IP`, and port 80 is no longer
  published.
- The app runs on Postgres only; SQLite is kept for the in-memory test
  database. Postgres is tuned for a small VPS and bound to `127.0.0.1`.
- `DB_PASSWORD` is required: there is no default Postgres password.
- The frontend always calls the API on the same origin.
- The Docker image installs Composer dependencies in their own layer, so
  code-only rebuilds skip `composer install`.

### Fixed

- A transient `/me` failure no longer signs the user out.
- Health check of the FrankenPHP-based services.

## 0.1.0 - 2026-09-24

First release of **rotless**, a smart pantry web app that tracks household
food batches and warns members before they expire.

### Added

- Token authentication with Laravel Sanctum: register, login, logout and me.
- Households with role-based access (`owner`, `manager`, `member`); members
  act only inside their own household and only owners/managers manage members.
- Household invitations by email with accept, expiry and single-use token.
- Products cached from the OpenFoodFacts API by barcode, plus manual products
  with photo upload.
- Batches with quantity, expiry date and status (`active`, `consumed`,
  `discarded`).
- Daily expiry check: scheduler dispatches `BatchesNearExpiry`, a listener
  fans out one queued `SendTelegramExpiryAlert` job per member, and every
  attempt is recorded in `notification_log`.
- React + TypeScript SPA: dashboard of expiring batches, batch form, camera
  barcode scanner, household and user settings, invitation acceptance.
- Versioned REST API under `/api/v1/*` with JSON resources and a
  `GET /api/v1/health` endpoint reporting database connectivity.
- Docker Compose stack with `app`, `db`, `queue` and `scheduler` services.
- Pest backend suite (feature tests per endpoint, policy tests, expiry-window
  unit tests) and Vitest frontend suite; external HTTP is faked.
- CI workflow running Pint, PHPStan, Pest and the frontend lint/test/build.
