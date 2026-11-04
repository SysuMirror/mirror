#!/bin/sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x deploy.sh
cd web
npm install
npm run build
cd "$ROOT"
rm -f quest.zip
zip -r quest.zip deploy.sh web/dist -x "*.DS_Store"
echo "Built $ROOT/quest.zip"
