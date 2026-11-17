#!/bin/sh
# SSE Deploy (sdpy) 入口：前台运行，监听 0.0.0.0:$PORT
# 平台在环境变量里设 MIRROR_DEV_MODE=1 即切到独立 dev Pod 演示模式：
# 自带前端构建、不接 UniSSO、不接主站，静态与接口由同一个前台进程托管。
# 未设置时走下面原有的生产静态服务路径，行为完全不变。
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
PORT="${PORT:-8080}"
export PORT
DIST="${ROOT}/web/dist"

if [ "${MIRROR_DEV_MODE:-0}" = "1" ]; then
  if [ ! -f "$DIST/index.html" ]; then
    echo "[mirror-dev] web/dist 缺失，开始构建前端（dev 模式，同源 /api）" >&2
    ( cd "$ROOT/web" && {
        # 用 vite 可执行文件判断依赖是否装全：残留的半截 node_modules（有目录、无 .bin）
        # 会让安装被跳过，随后 npm run build 报 sh: 1: vite: not found。
        [ -x node_modules/.bin/vite ] || npm ci --include=dev
        # 必须走 .env.dev 文件，不能用 VITE_API_BASE=/api 环境变量：
        # Git Bash / MSYS 会把 /api 转成本地路径（file:///.../PortableGit/api），
        # 打进产物后整站接口都会失败，而且页面看起来「能打开」。
        [ -f .env.dev ] || cp .env.dev.example .env.dev
        npm run build -- --mode dev
      } ) || {
        echo "[mirror-dev] 构建失败：请提供 Node 18+ / npm，或在平台预置 web/dist" >&2
        exit 1
      }
    # 产物自检：dev 构建的 API 必须收敛到同源 /api，不能残留主站地址或被转换的本地路径
    if grep -Rqs 'ssemarket\.cn/api\|file:///\|PortableGit' "$DIST/assets"; then
      echo "[mirror-dev] 前端 API 基址异常，拒绝启动；请删除 web/dist 后重新构建" >&2
      exit 1
    fi
  fi
  export MIRROR_DEV_MODE=1
  exec python3 "$ROOT/dev/dev_gateway.py"
fi

if [ ! -d "$DIST" ]; then
  echo "missing web/dist — run: cd quest/web && npm ci && npm run build"
  exit 1
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
print(f"quest static server on 0.0.0.0:{port}", flush=True)
httpd.serve_forever()
PY
