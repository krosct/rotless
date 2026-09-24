# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
