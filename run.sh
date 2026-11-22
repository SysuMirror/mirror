#!/bin/sh
# 前台入口（supervisor / 平台托管）。不自行 daemonize。
# Node 22+ 必需：使用内置 node:sqlite。supervisor 拉起的非登录 shell 没有 nvm/module，
# 因此这里显式按顺序找运行时；找到后 exec，保持单一前台进程。
set -e
cd "$(dirname "$0")"

NODE_BIN="${NODE_BIN:-}"
if [ -z "$NODE_BIN" ]; then
  for candidate in \
    "$HOME/.nvm/versions/node"/v22*/bin/node \
    /shared/opt/node/22.*/bin/node \
    /usr/local/bin/node \
    /usr/bin/node
  do
    [ -x "$candidate" ] || continue
    major=$("$candidate" -v 2>/dev/null | sed 's/^v//; s/\..*//')
    if [ "$major" -ge 22 ] 2>/dev/null; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  echo "[mirror] Node 22+ 未找到；请加载 /shared/opt/node/22.* 或设置 NODE_BIN" >&2
  exit 1
fi

echo "[mirror] using $NODE_BIN ($("$NODE_BIN" -v))"
export NODE_ENV=production
exec "$NODE_BIN" --disable-warning=ExperimentalWarning server.js