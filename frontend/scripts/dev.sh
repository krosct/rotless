#!/usr/bin/env bash
#
# One command to try the app locally:
#   1. brings up the Docker backend stack (app, db, queue, scheduler) when it is
#      not already running;
#   2. waits for the API health check;
#   3. runs the Vite dev server in the foreground.
#
# When the dev server exits (Ctrl+C), the backend is stopped again if this
# command was the one that started it. A backend that was already running is
# left untouched. Inside the Docker dev override (docker-compose.dev.yml) there
# is no Docker CLI, so only the Vite server is started.
set -uo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$FRONTEND_DIR/.." && pwd)"
API_HEALTH_URL="${VITE_API_HEALTH_URL:-http://127.0.0.1:8000/api/v1/health}"
VITE_BIN="${VITE_BIN:-$FRONTEND_DIR/node_modules/.bin/vite}"

started_backend=0

cleanup() {
  if [ "$started_backend" -eq 1 ]; then
    echo ""
    echo "==> Parando o backend (app, db, queue, scheduler)..."
    (cd "$ROOT_DIR" && docker compose down) || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if [ ! -x "$VITE_BIN" ]; then
  echo "==> Dependências do frontend ausentes. Rode: (cd frontend && npm install)" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1 && [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  if [ -n "$(cd "$ROOT_DIR" && docker compose ps -q app 2>/dev/null)" ]; then
    echo "==> Backend já está no ar; deixando como está."
  else
    echo "==> Subindo o backend (app, db, queue, scheduler)..."
    if (cd "$ROOT_DIR" && docker compose up -d); then
      started_backend=1

      if command -v curl >/dev/null 2>&1; then
        for _ in $(seq 1 60); do
          if curl -fsS -o /dev/null "$API_HEALTH_URL" 2>/dev/null; then
            echo "==> Backend pronto."
            break
          fi
          sleep 0.5
        done
      fi
    else
      echo "==> Falha ao subir o backend; iniciando apenas o frontend." >&2
    fi
  fi
else
  echo "==> Docker não disponível aqui; iniciando apenas o frontend."
fi

echo "==> Iniciando o frontend (Vite)..."
cd "$FRONTEND_DIR"
"$VITE_BIN" "$@"
