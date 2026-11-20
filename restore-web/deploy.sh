#!/bin/sh
# restore-web 部署入口：前台运行，监听 0.0.0.0:$PORT
# 平台注入 PORT（默认 8080）；dist 缺失时自动构建前端。
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
PORT="${PORT:-8080}"
DIST="${ROOT}/dist"

if [ ! -f "$DIST/index.html" ] || [ ! -d "$DIST/assets" ]; then
  echo "[deploy] dist 缺失或不完整，开始构建前端" >&2
  [ -x node_modules/.bin/vite ] || npm ci
  npm run build
fi

export QUEST_STATIC_DIR="$DIST"
export QUEST_PORT="$PORT"

exec python3 - <<'PY'
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

dist = os.environ["QUEST_STATIC_DIR"]
port = int(os.environ.get("QUEST_PORT", "8080"))

class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=dist, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        pass

httpd = ThreadingHTTPServer(("0.0.0.0", port), SPAHandler)
print(f"restore-web static server on 0.0.0.0:{port}", flush=True)
httpd.serve_forever()
PY
