#!/bin/sh
set -e
cd "$(dirname "$0")"
set -a
. ./.env
set +a
exec python3 server.py
