<!--
PR title must follow Conventional Commits (enforced by the "PR Title" workflow), e.g.:
  feat(api): add batch expiry endpoint
Keep this template and fill every section. Write "N/A" when a section does not apply.
-->

## Summary

<!-- What changed, in 1-3 bullets. -->

-

## Motivation

<!-- Why this change is needed, and the problem it solves. Link the issue: Closes #123 -->

## Changes

<!-- Key implementation points, grouped by area. Delete empty lines. -->

- **Backend:**
- **Frontend:**
- **Infra / DB:**

## How tested

<!-- Exact commands run and the observed result. -->

- [ ] `docker compose exec app vendor/bin/pint --test`
- [ ] `docker compose exec app vendor/bin/phpstan analyse`
- [ ] `docker compose exec app vendor/bin/pest`
- [ ] `cd frontend && npm run lint && npm run test && npm run build`

## Database impact

<!-- Migration? Additive/backward compatible? Backfill needed? Rollback plan? Write "None" when there is no schema/data change. -->

## Screenshots

<!-- Required for UI changes; otherwise delete this section. -->

## Breaking changes / Deploy notes

<!-- Env vars, infra steps or manual actions required before/after merge. Write "None" when there are none. -->

## Checklist

- [ ] PR title follows Conventional Commits
- [ ] Branch is up to date with `main`
- [ ] Lint, static analysis and tests pass locally and in CI
- [ ] `README.md` / `AGENTS.md` / `CHANGELOG.md` updated when relevant
- [ ] No secrets, tokens or `.env` committed
- [ ] Schema changes are additive and backward compatible
