#!/bin/sh
# Entrypoint for running the web app.
# Cloudflare tunnel points at :8080, so the dev server binds there.
set -e

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

# Source env if present (pull TUNNEL_* out)
if [ -f .env.local ]; then
  TUNNEL_HOST=$(grep '^TUNNEL_HOST=' .env.local | cut -d= -f2-)
  TUNNEL_USER=$(grep '^TUNNEL_USER=' .env.local | cut -d= -f2-)
  TUNNEL_LOCAL_PORT=$(grep '^TUNNEL_LOCAL_PORT=' .env.local | cut -d= -f2-)
  TUNNEL_REMOTE=$(grep '^TUNNEL_REMOTE=' .env.local | cut -d= -f2-)
fi

# If tunnel config is present and no tunnel is currently running, start one.
if [ -n "$TUNNEL_HOST" ] && [ -n "$TUNNEL_LOCAL_PORT" ] && [ -n "$TUNNEL_REMOTE" ]; then
  if ! nc -z 127.0.0.1 "$TUNNEL_LOCAL_PORT" 2>/dev/null; then
    echo "opening SSH tunnel: localhost:${TUNNEL_LOCAL_PORT} → ${TUNNEL_HOST} → ${TUNNEL_REMOTE}"
    ssh -f -N \
      -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -L "127.0.0.1:${TUNNEL_LOCAL_PORT}:${TUNNEL_REMOTE}" \
      "${TUNNEL_USER}@${TUNNEL_HOST}"
    # brief wait for forwarder to accept
    sleep 1
    if ! nc -z 127.0.0.1 "$TUNNEL_LOCAL_PORT" 2>/dev/null; then
      echo "WARN: tunnel didn't come up — the app will fail to query the DB."
    fi
  else
    echo "SSH tunnel already listening on 127.0.0.1:${TUNNEL_LOCAL_PORT}"
  fi
fi

exec npm run dev -- --host 0.0.0.0 --port 8080
