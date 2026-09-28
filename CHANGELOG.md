# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
