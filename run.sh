#!/bin/sh
# 本地 / 容器启动入口。
# .env 由 server.py 的 env() 自行读取，不经 shell source：
# 避免 /bin/sh (dash) 解析带空格的值时报错退出，也避免密钥进入进程环境列表。
set -e
cd "$(dirname "$0")"
exec python3 server.py
