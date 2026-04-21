#!/bin/sh
# Entrypoint for running the web app.
# Cloudflare tunnel points at :8080, so the dev server binds there.
set -e

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

exec npm run dev -- --host 0.0.0.0 --port 8080
