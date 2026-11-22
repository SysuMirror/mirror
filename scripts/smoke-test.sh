#!/bin/sh
# 本机冒烟：健康门 + 首页/社区 SPA + 静态资源 + bootstrap。
# 用法：./scripts/smoke-test.sh [http://127.0.0.1:8080]
set -e
BASE="${1:-http://127.0.0.1:8080}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "health:  $(curl -fsS "$BASE/api/healthz")"
echo "legacy:  $(curl -fsS "$BASE/mirror-api/healthz")"
SPA_JS=$(ls "$ROOT/web/app/assets" | grep '\.js$' | head -1)
for path in / /index.html /app.html "/app/assets/$SPA_JS" /assets/hero-bg.jpg /landing-fx.js /landing-fx.css; do
  printf '%-28s %s\n' "$path" "$(curl -fsS -o /dev/null -w '%{http_code} %{content_type} %{size_download}' "$BASE$path")"
done
curl -fsS "$BASE/api/bootstrap" | head -c 220
echo
