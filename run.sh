#!/usr/bin/env sh
set -eu
MODE="${1:-status}"
INSTALL_DIR="${2:-}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -n "$INSTALL_DIR" ]; then
  exec node "$SCRIPT_DIR/patch.mjs" "$MODE" "$INSTALL_DIR"
fi
exec node "$SCRIPT_DIR/patch.mjs" "$MODE"
