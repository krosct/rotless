#!/usr/bin/env bash
#
# devkit's RUN step (deploy.conf): the service of the current release on the VPS. Brings the Docker
# stack to this release (the images were built by devkit-install.sh) and then follows its logs, so
# `deploy.sh logs HOST` shows them. Stopping the service stops only the logs: the containers keep
# running (restart: unless-stopped), so a deploy recreates only what changed and the database is
# never stopped. To stop rotless: docker compose -p rotless stop.

set -euo pipefail
# shellcheck source=scripts/devkit-common.sh
. scripts/devkit-common.sh

[[ -n "${ROTLESS_HTTP_PORT:-}" ]] || die "ROTLESS_HTTP_PORT is not set (SERVICE_ENV in deploy.conf)."
compose_with "$ROOT/.env"

# --renew-anon-volumes: vendor/ comes from the new image, with its Composer dependencies. It also
# recreates every service it is given, so the database (started by devkit-install.sh) is left out.
"${DC[@]}" up -d --no-build --renew-anon-volumes --remove-orphans app queue scheduler caddy
"${DC[@]}" exec -T app chmod -R ug+rwX storage bootstrap/cache

exec "${DC[@]}" logs -f --since 1m
