#!/usr/bin/env bash
# Build Next.js standalone output and stage static assets for the Tauri sidecar.
set -euo pipefail

npm run build

# Production builds emit to .next-build (see distDir in next.config.ts) so they
# never touch the dev server's .next cache.
DIST_DIR=".next-build"
STANDALONE="$DIST_DIR/standalone"
STATIC="$DIST_DIR/static"
PUBLIC="public"

if [ ! -f "$STANDALONE/server.js" ]; then
  echo "error: $STANDALONE/server.js not found - is output: 'standalone' set in next.config.ts?"
  exit 1
fi

mkdir -p "$STANDALONE/.next"
cp -R "$STATIC" "$STANDALONE/.next/static"

if [ -d "$PUBLIC" ]; then
  cp -R "$PUBLIC" "$STANDALONE/public"
fi

echo "Standalone sidecar ready at $STANDALONE"
