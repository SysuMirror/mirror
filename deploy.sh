#!/bin/sh
# 兼容旧平台的部署入口：统一转交给 run.sh。
# run.sh 负责寻找 Node 22+ 并以单一前台进程 exec server.js（supervisor 自启 / 守护）。
set -e
exec /bin/sh "$(dirname "$0")/run.sh"