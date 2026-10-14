# shellcheck shell=bash
# Shared by devkit-install.sh and devkit-run.sh (sourced, never run). Both run in a release
# folder of devkit on the VPS: <root>/releases/<release>, next to <root>/.env and <root>/data.
#
# The Compose project is always "rotless": the database volume (rotless_db-data) keeps its name
# whatever folder the release is in.

RELEASE_DIR="$(pwd)"
ROOT="${DEVKIT_ROOT:-$(cd ../.. && pwd)}"
ROTLESS_TAG="$(basename "$RELEASE_DIR")"
export ROTLESS_TAG
export ROTLESS_STORAGE="$ROOT/data/storage"

die() {
  echo "error: $*" >&2
  exit 1
}

# Compose with the given .env: Laravel reads it (mounted into the containers) and Compose takes the
# DB_* values for Postgres from it.
compose_with() {
  export ROTLESS_ENV_FILE="$1"
  # shellcheck disable=SC2034 # used by the scripts that source this file
  DC=(docker compose -p rotless --profile caddy --project-directory "$RELEASE_DIR"
    -f "$RELEASE_DIR/docker-compose.yml" -f "$RELEASE_DIR/docker-compose.prod.yml" --env-file "$1")
}
