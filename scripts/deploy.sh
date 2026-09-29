#!/usr/bin/env bash
#
# Deploy one commit of main on the VPS. Runs on the VPS, from the git checkout
# of the project (see "Deploy" in README.md). Called by
# .github/workflows/deploy.yml over SSH with a key restricted to this script
# (forced command), or by hand:
#   ./scripts/deploy.sh <40-char commit sha>
#
# The workflow builds the frontend on the GitHub runner and streams it here as
# a tar.gz on stdin: `npm ci` + `vite build` is the step that pushes the 1 GB
# e2-micro into swap. Without a tarball on stdin (manual run), it is built here
# in a Node container, which is slow on this VPS.
#
# Only the current tip of origin/main is deployed; an older commit (a run that
# was superseded while it waited for approval) is skipped.
#
# Steps:
#   1. prepare (nothing live changes): check out the commit in a separate
#      worktree, unpack/build the frontend there, tag the running images as
#      :previous, build the new images one service at a time
#   2. back up the database (pg_dump) into ~/rotless-backups
#   3. activate: check out the commit here, run pending migrations (additive
#      only), recreate the containers, publish the frontend, restart queue and
#      scheduler (and Caddy when its config changed)
#   4. health check on GET /api/v1/health
# If a step after the image build fails, the previous commit, the :previous
# images and the previous frontend are put back, with no rebuild. Migrations
# are never rolled back: they are additive, so the previous code runs on the
# new schema.
#
# The deploy runs detached from the SSH session and logs to
# ~/.rotless-deploy/logs/, so a dropped connection (the VPS thrashing in swap)
# does not stop it half-way. Follow a running deploy with:
#   tail -f ~/.rotless-deploy/logs/$(ls -t ~/.rotless-deploy/logs | head -n1)
#
# Never runs migrate:fresh, db:wipe or `docker compose down -v`.
#
# This file runs from the live checkout, so a change to it takes effect on the
# deploy after the one that ships it.
#
# Optional env vars: DEPLOY_BRANCH (main), DEPLOY_BACKUP_DIR (~/rotless-backups),
# DEPLOY_KEEP_BACKUPS (10), DEPLOY_STATE_DIR (~/.rotless-deploy),
# COMPOSE_PROJECT_NAME (the directory name, as docker compose uses by default).

set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
PROJECT_DIR="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
cd "$PROJECT_DIR"

BRANCH="${DEPLOY_BRANCH:-main}"
BACKUP_DIR="${DEPLOY_BACKUP_DIR:-$HOME/rotless-backups}"
KEEP_BACKUPS="${DEPLOY_KEEP_BACKUPS:-10}"
STATE_DIR="${DEPLOY_STATE_DIR:-$HOME/.rotless-deploy}"
STAGE_DIR="$STATE_DIR/stage"
LOG_DIR="$STATE_DIR/logs"
PREVIOUS_DIST="$STATE_DIR/dist-previous"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$PROJECT_DIR")}"
PROJECT_NAME="${PROJECT_NAME,,}"
HEALTH_URL="http://127.0.0.1:8000/api/v1/health"
MAX_FRONTEND_BYTES=$((50 * 1024 * 1024))
KEEP_LOGS=20
# Services with `build:` in docker-compose.yml; compose names their images
# <project>-<service>.
BUILT_SERVICES=(app queue scheduler)

PREV=""
TARGET=""
LIVE_CHANGED=false
HAVE_PREVIOUS=false
DONE=false

die() {
  echo "error: $*" >&2
  exit 1
}

env_get() { grep -E "^${1}=" .env | head -n1 | cut -d= -f2- | tr -d '"' || true; }

check_sha() {
  [[ "$1" =~ ^[0-9a-f]{40}$ ]] || die "expected a 40-char commit sha, got '${1}'."
}

# --- Docker ----------------------------------------------------------------
# Use sudo only when the user is not in the docker group (`sudo -n` never
# prompts, which would hang a non-interactive SSH session).
setup_docker() {
  DOCKER=(docker)
  if ! docker info >/dev/null 2>&1; then
    if command -v sudo >/dev/null 2>&1 && sudo -n docker info >/dev/null 2>&1; then
      DOCKER=(sudo -n docker)
    else
      die "cannot reach the Docker daemon (add this user to the docker group)."
    fi
  fi
  "${DOCKER[@]}" compose version >/dev/null 2>&1 || die "Docker Compose v2 is required."

  # Live stack, and the same project built from the staging worktree: the
  # images get the same names, so `up --no-build` below picks them up.
  DC=("${DOCKER[@]}" compose -p "$PROJECT_NAME" --profile caddy)
  DC_STAGE=("${DOCKER[@]}" compose -p "$PROJECT_NAME" --profile caddy
    --project-directory "$STAGE_DIR" -f "$STAGE_DIR/docker-compose.yml"
    --env-file "$PROJECT_DIR/.env")
}

# --- Checks before anything changes -----------------------------------------
preflight() {
  [[ -d .git ]] || die "$PROJECT_DIR is not a git checkout. See 'Deploy' in README.md for the one-time setup."
  [[ -f .env ]] || die ".env is missing; set up the stack on the VPS first."
  [[ -s certs/origin.pem && -s certs/origin.key ]] || die "certs/origin.pem or certs/origin.key is missing."

  # A deploy must never start a new, empty database: the project name decides
  # the volume name, and a moved or renamed directory would change it.
  "${DOCKER[@]}" volume inspect "${PROJECT_NAME}_db-data" >/dev/null 2>&1 \
    || die "volume ${PROJECT_NAME}_db-data not found; set COMPOSE_PROJECT_NAME to the existing project."

  # Local edits to tracked files would be lost by the checkout; stop instead.
  if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    git status --short --untracked-files=no >&2
    die "tracked files were changed on the server; commit them to main or discard them first."
  fi
}

resolve_target() {
  local requested="$1" tip

  echo "==> Fetching origin/${BRANCH}"
  git fetch --quiet origin "$BRANCH"
  tip="$(git rev-parse "origin/${BRANCH}")"

  if [[ "$requested" != "$tip" ]]; then
    echo "==> ${requested} is no longer the tip of origin/${BRANCH} (${tip}); skipping."
    echo "    The run for the newer commit deploys it."
    exit 0
  fi

  TARGET="$requested"
  PREV="$(git rev-parse HEAD)"
}

# --- Prepare (the running site is not touched) ------------------------------
stage_checkout() {
  local rev="$1"
  echo "==> Checking out ${rev} in ${STAGE_DIR}"
  git worktree remove --force "$STAGE_DIR" >/dev/null 2>&1 || rm -rf "$STAGE_DIR"
  git worktree prune
  git worktree add --quiet --detach "$STAGE_DIR" "$rev"
}

# Unpacks the tarball the workflow built, or builds the frontend here when
# there is none (manual run): host npm, or a disposable Node 22 container so
# the VPS does not need Node.
stage_frontend() {
  local tarball="$1" dist="$STAGE_DIR/frontend/dist"

  if [[ -n "$tarball" ]]; then
    echo "==> Unpacking the frontend built by the workflow"
    mkdir -p "$dist"
    tar -xzf "$tarball" -C "$dist" --no-same-owner --no-same-permissions
    rm -f "$tarball"
    [[ -f "$dist/index.html" ]] || die "the frontend tarball has no index.html."
    return
  fi

  echo "==> Building the frontend on the VPS (no tarball on stdin; slow on a 1 GB VPS)"
  if command -v npm >/dev/null 2>&1; then
    (cd "$STAGE_DIR/frontend" && npm ci --no-audit --no-fund && npm run build)
  else
    mkdir -p "$STATE_DIR/npm-cache"
    "${DOCKER[@]}" run --rm \
      --user "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/npm-cache \
      -v "$STAGE_DIR/frontend:/app" -v "$STATE_DIR/npm-cache:/npm-cache" -w /app \
      node:22-alpine sh -c "npm ci --no-audit --no-fund && npm run build"
  fi
}

# Keeps what is running now, so a rollback only has to retag and copy back.
save_previous() {
  local svc cid image count=0

  for svc in "${BUILT_SERVICES[@]}"; do
    cid="$("${DC[@]}" ps -q "$svc" 2>/dev/null || true)"
    [[ -n "$cid" ]] || continue
    image="$("${DOCKER[@]}" inspect -f '{{.Image}}' "$cid")"
    "${DOCKER[@]}" tag "$image" "${PROJECT_NAME}-${svc}:previous"
    count=$((count + 1))
  done
  (( count == ${#BUILT_SERVICES[@]} )) && HAVE_PREVIOUS=true

  rm -rf "$PREVIOUS_DIST"
  if [[ -d frontend/dist ]]; then
    cp -a frontend/dist "$PREVIOUS_DIST"
  fi
}

# One service at a time: parallel builds on the e2-micro run out of memory.
# The first build fills the cache, so the others take seconds.
build_images() {
  local compose=("$@") svc
  for svc in "${BUILT_SERVICES[@]}"; do
    echo "==> Building the ${svc} image"
    "${compose[@]}" build --progress=plain "$svc"
  done
}

prepare() {
  local tarball="$1"
  stage_checkout "$TARGET"
  stage_frontend "$tarball"
  save_previous

  # The images share their names with the running stack; from here on a
  # failure must restore the previous ones (see on_exit).
  LIVE_CHANGED=true
  build_images "${DC_STAGE[@]}"
}

# --- Database backup -------------------------------------------------------
wait_for_db() {
  local db_user="$1" db_name="$2"
  for _ in $(seq 1 30); do
    "${DC[@]}" exec -T db pg_isready -U "$db_user" -d "$db_name" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "error: the database did not become ready." >&2
  return 1
}

# Dumps the database before migrating. The dump holds personal data: it stays
# on the VPS, readable only by this user. The newest KEEP_BACKUPS are kept.
backup_db() {
  local db_user db_name file
  db_user="$(env_get DB_USERNAME)"; db_user="${db_user:-rotless}"
  db_name="$(env_get DB_DATABASE)"; db_name="${db_name:-rotless}"

  "${DC[@]}" up -d db
  wait_for_db "$db_user" "$db_name" || return 1

  (umask 077 && mkdir -p "$BACKUP_DIR")
  file="$BACKUP_DIR/rotless-$(date -u +%Y%m%dT%H%M%SZ)-${PREV:0:12}.sql.gz"
  echo "==> Backing up the database to ${file}"
  (umask 077 && "${DC[@]}" exec -T db pg_dump -U "$db_user" "$db_name" | gzip > "$file.partial")
  gzip -t "$file.partial"
  mv "$file.partial" "$file"

  # shellcheck disable=SC2012 # file names are generated above, no spaces
  ls -1t "$BACKUP_DIR"/rotless-*.sql.gz | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f --
}

# --- Activate --------------------------------------------------------------
# Copies a built frontend into the directory Caddy serves. New hashed assets
# land before index.html switches to them; old files go last.
publish_frontend() {
  local src="$1"
  mkdir -p frontend/dist
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete-after "$src/" frontend/dist/
  else
    find frontend/dist -mindepth 1 -delete
    cp -a "$src/." frontend/dist/
  fi
}

# The first request after a restart is slow on 1/8 OCPU; allow ~3 minutes.
wait_healthy() {
  echo "==> Health check (${HEALTH_URL})"
  for _ in $(seq 1 90); do
    if curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null; then
      echo
      return 0
    fi
    sleep 2
  done
  echo "error: health check failed." >&2
  return 1
}

# Switches the live checkout to <rev> and restarts the stack on the images
# already built/tagged. <migrate> is false during a rollback.
activate() {
  local rev="$1" frontend_src="$2" migrate="$3" caddy_changed=false

  git diff --quiet HEAD "$rev" -- Caddyfile || caddy_changed=true

  echo "==> Checking out ${rev}"
  git checkout --quiet --force -B "$BRANCH" "$rev"

  if [[ "$caddy_changed" == true ]]; then
    echo "==> Validating the new Caddyfile"
    "${DC[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  fi

  if [[ "$migrate" == true ]]; then
    # On the new image, before the new code serves requests.
    echo "==> Running pending migrations (additive only)"
    "${DC[@]}" run --rm --no-deps app php artisan migrate --force
  fi

  # --renew-anon-volumes: the vendor/ volume is refreshed from the new image,
  # so new Composer dependencies are used. Named volumes (db-data) are kept.
  echo "==> Starting the new containers"
  "${DC[@]}" up -d --no-build --renew-anon-volumes

  if [[ -n "$frontend_src" ]]; then
    echo "==> Publishing the frontend"
    publish_frontend "$frontend_src"
  fi

  "${DC[@]}" exec -T app chmod -R ug+rwX storage bootstrap/cache
  "${DC[@]}" exec -T app php artisan config:clear

  # queue:work and schedule:work keep the old code in memory until restarted.
  echo "==> Restarting queue and scheduler"
  "${DC[@]}" restart queue scheduler

  # Caddyfile is a single-file bind mount: the container keeps the old file
  # until it restarts.
  if [[ "$caddy_changed" == true ]]; then
    echo "==> Restarting Caddy"
    "${DC[@]}" restart caddy
  fi

  wait_healthy || return 1
}

rollback() {
  local svc frontend_src=""
  set +e
  echo
  echo "!! Deploy of ${TARGET} failed; rolling back to ${PREV}" >&2

  if [[ "$HAVE_PREVIOUS" == true ]]; then
    for svc in "${BUILT_SERVICES[@]}"; do
      "${DOCKER[@]}" tag "${PROJECT_NAME}-${svc}:previous" "${PROJECT_NAME}-${svc}:latest"
    done
  else
    # First deploy on this stack (nothing was running): rebuild the old commit.
    stage_checkout "$PREV" && build_images "${DC_STAGE[@]}"
  fi
  [[ -d "$PREVIOUS_DIST" ]] && frontend_src="$PREVIOUS_DIST"

  if activate "$PREV" "$frontend_src" false; then
    echo "!! Rolled back to ${PREV}. Check 'docker compose logs' for the failure." >&2
  else
    echo "!! Rollback failed too. Run 'docker compose ps' and 'docker compose logs' on the VPS." >&2
  fi
}

on_exit() {
  local rc=$?
  trap - EXIT
  if [[ "$DONE" != true && "$LIVE_CHANGED" == true && "$PREV" != "$TARGET" ]]; then
    rollback
  fi
  git worktree remove --force "$STAGE_DIR" >/dev/null 2>&1 || true
  exit "$rc"
}

# --- Entry points ----------------------------------------------------------
# The deploy itself, detached from the SSH session.
run_deploy() {
  local requested="$1" tarball="$2"

  # One deploy at a time (CI and a manual run could overlap).
  exec 9>"$STATE_DIR/deploy.lock"
  flock -n 9 || die "another deploy is running."

  setup_docker
  preflight
  resolve_target "$requested"
  echo "==> Deploying ${TARGET} (live: ${PREV})"

  trap on_exit EXIT
  prepare "$tarball"
  backup_db
  activate "$TARGET" "$STAGE_DIR/frontend/dist" true

  DONE=true
  echo "==> Service status"
  "${DC[@]}" ps
  # Old image layers pile up on every build; dangling ones are unused (the
  # :previous tags keep the last release for a manual rollback).
  "${DOCKER[@]}" image prune -f >/dev/null || true
  echo "==> Deployed ${TARGET}"
}

main() {
  if [[ "${1:-}" == --detached ]]; then
    run_deploy "${2:-}" "${3:-}"
    return
  fi

  # Forced command: the sha arrives as the command the client asked to run.
  local requested="${1:-${SSH_ORIGINAL_COMMAND:-}}" tarball="" log pid rc=0
  check_sha "$requested"
  mkdir -p "$STATE_DIR" "$LOG_DIR"

  # The frontend tarball, when the workflow streams one on stdin.
  if [[ ! -t 0 ]]; then
    tarball="$STATE_DIR/frontend-${requested:0:12}-$$.tar.gz"
    head -c "$((MAX_FRONTEND_BYTES + 1))" > "$tarball"
    if [[ ! -s "$tarball" ]]; then
      rm -f "$tarball"
      tarball=""
    elif (( $(stat -c %s "$tarball") > MAX_FRONTEND_BYTES )); then
      rm -f "$tarball"
      die "the frontend tarball is larger than ${MAX_FRONTEND_BYTES} bytes."
    fi
  fi

  log="$LOG_DIR/deploy-$(date -u +%Y%m%dT%H%M%SZ)-${requested:0:12}.log"
  echo "==> Log: ${log}"

  # Created here, not by the redirection below: that one runs in the child,
  # and tail could otherwise open the file before it exists.
  : > "$log"

  # setsid: a new session, so a dropped SSH connection does not stop it.
  setsid "$SCRIPT_PATH" --detached "$requested" "$tarball" >> "$log" 2>&1 < /dev/null &
  pid=$!
  # The exit code is the deploy's, from wait; tail only mirrors the log.
  tail -n +1 -f --pid="$pid" "$log" || true
  wait "$pid" || rc=$?
  [[ -z "$tarball" ]] || rm -f "$tarball"

  # shellcheck disable=SC2012 # file names are generated above, no spaces
  ls -1t "$LOG_DIR"/deploy-*.log | tail -n +"$((KEEP_LOGS + 1))" | xargs -r rm -f --
  exit "$rc"
}

main "$@"
