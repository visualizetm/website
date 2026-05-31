#!/usr/bin/env bash
# Smoke test for visualize-website
# Usage: bash .claude/skills/run-website/smoke.sh [dev|preview|build]
# All commands are run from the repo root.

set -e
cd "$(dirname "$0")/../../.."

MODE=${1:-preview}

cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

if [ "$MODE" = "build" ]; then
  echo "==> Building..."
  npm run build
  echo "==> Build OK"
  exit 0
fi

if [ "$MODE" = "dev" ]; then
  PORT=5173
  npm run dev -- --port $PORT &
else
  # default: preview (serves built dist/)
  npm run build --silent 2>/dev/null || npm run build
  PORT=4173
  npm run preview -- --port $PORT &
fi

SERVER_PID=$!
echo "==> Waiting for server (pid $SERVER_PID) on port $PORT..."
for i in $(seq 1 20); do
  curl -sf "http://localhost:$PORT/" -o /dev/null && break
  sleep 0.5
done

echo "==> Smoke-testing routes..."
ROUTES=("/" "/services" "/showcase" "/contact" "/book" "/pricing" "/prints" "/portal")
FAIL=0
for route in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$route")
  if [ "$code" = "200" ]; then
    echo "  OK  $route"
  else
    echo "  FAIL $route → $code"
    FAIL=1
  fi
done

if [ $FAIL -eq 0 ]; then
  echo "==> All routes OK"
else
  echo "==> Some routes FAILED" >&2
  exit 1
fi
