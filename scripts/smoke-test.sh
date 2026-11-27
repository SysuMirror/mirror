#!/bin/sh
set -eu
BASE="${1:-http://127.0.0.1:8080}"
for path in / /index.html /api/healthz /mirror-api/healthz /landing-mirror.js /landing-fx.js /landing-fx.css /assets/mirror-facets.webp /assets/platform-architecture.webp; do
  status="$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE$path")"
  test "$status" = 200
  printf '%-39s %s\n' "$path" "$status"
done
test "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/app.html")" = 302
test "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login")" = 404
test "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/mirror-api/orders/forward")" = 404
