#!/usr/bin/env bash
#
# devkit's INSTALL step (deploy.conf), on the VPS, in the new release folder, while the running
# release keeps serving:
#   1. builds the image rotless-app:<release> (app, queue and scheduler share it)
#   2. backs up the database (pg_dump) into <root>/data/backups (newest 10 kept)
#   3. runs pending migrations on the new image (additive only: the previous release runs on the
#      new schema, so devkit can roll back to it)
# devkit then switches the service to this release (scripts/devkit-run.sh). Never runs
# migrate:fresh, db:wipe or `docker compose down -v`.

set -euo pipefail
# shellcheck source=scripts/devkit-common.sh
. scripts/devkit-common.sh

BACKUP_DIR="$ROOT/data/backups"
KEEP_BACKUPS=10

# The configuration devkit is about to activate (it becomes <root>/.env when this release starts).
env_file="$ROOT/.devkit/env.new"
[[ -f "$env_file" ]] || env_file="$ROOT/.env"
[[ -f "$env_file" ]] || die "no .env for rotless in $ROOT."
compose_with "$env_file"
env_get() { sed -n "s/^$1=//p" "$env_file" | tail -n1 | tr -d '"'; }

docker info >/dev/null 2>&1 || die "cannot reach Docker (is $(id -un) in the docker group?)."

# Laravel's storage lives outside the releases; the containers write it as root.
mkdir -p "$ROTLESS_STORAGE"/app/public "$ROTLESS_STORAGE"/app/private "$ROTLESS_STORAGE"/logs \
  "$ROTLESS_STORAGE"/framework/cache/data "$ROTLESS_STORAGE"/framework/sessions \
  "$ROTLESS_STORAGE"/framework/views

# Plain docker build, as docker-compose.yml describes it: newer Compose versions build through
# bake, which asks for an extra grant for `network: host`.
echo "==> Building the image rotless-app:${ROTLESS_TAG}"
docker build --progress=plain --network host -t "rotless-app:${ROTLESS_TAG}" "$RELEASE_DIR"

# The database keeps running across deploys; on a new server this starts it.
echo "==> Database"
"${DC[@]}" up -d --no-build db
db_user="$(env_get DB_USERNAME)"; db_user="${db_user:-rotless}"
db_name="$(env_get DB_DATABASE)"; db_name="${db_name:-rotless}"
for _ in $(seq 1 30); do
  "${DC[@]}" exec -T db pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1 && break
  sleep 2
done
"${DC[@]}" exec -T db pg_isready -U "$db_user" -d "$db_name" >/dev/null || die "the database did not become ready."

# The dump holds personal data: readable only by this user.
file="$BACKUP_DIR/rotless-$(date -u +%Y%m%dT%H%M%SZ)-${ROTLESS_TAG}.sql.gz"
echo "==> Backing up the database to ${file}"
(umask 077 && mkdir -p "$BACKUP_DIR" && "${DC[@]}" exec -T db pg_dump -U "$db_user" "$db_name" | gzip > "$file.partial")
gzip -t "$file.partial"
mv "$file.partial" "$file"
# shellcheck disable=SC2012 # file names are generated above, no spaces
ls -1t "$BACKUP_DIR"/rotless-*.sql.gz | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f --

echo "==> Running pending migrations (additive only)"
"${DC[@]}" run --rm --no-deps app php artisan migrate --force

# Images of releases devkit no longer keeps (it keeps the last 3, for rollbacks).
docker image ls rotless-app --format '{{.Tag}}' | while read -r tag; do
  [[ "$tag" == "$ROTLESS_TAG" || "$tag" == dev || -d "$ROOT/releases/$tag" ]] || docker image rm "rotless-app:$tag" >/dev/null 2>&1 || true
done
docker image prune -f >/dev/null || true
