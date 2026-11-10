#!/usr/bin/env sh
set -eu
MODE="${1:-status}"
INSTALL_DIR="${2:-}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="${INSTALL_DIR:-${T3ZH_INSTALL_DIR:-}}"
if [ "$(uname -s)" = Darwin ]; then
  if [ -z "$INSTALL_DIR" ]; then
    for candidate in '/Applications/T3 Code.app/Contents' "$HOME/Applications/T3 Code.app/Contents"; do
      if [ -f "$candidate/Resources/server.asar" ]; then
        INSTALL_DIR="$candidate"
        break
      fi
    done
  fi
  if [ -n "$INSTALL_DIR" ] && [ -x "$INSTALL_DIR/MacOS/T3 Code" ]; then
    export ELECTRON_RUN_AS_NODE=1
    exec "$INSTALL_DIR/MacOS/T3 Code" "$SCRIPT_DIR/patch.mjs" "$MODE" "$INSTALL_DIR"
  fi
fi
if ! command -v node >/dev/null 2>&1; then
  echo '未找到可用运行时。请指定 T3 Code 安装目录，或安装 Node.js 18+。' >&2
  exit 1
fi
if [ -n "$INSTALL_DIR" ]; then
  exec node "$SCRIPT_DIR/patch.mjs" "$MODE" "$INSTALL_DIR"
fi
exec node "$SCRIPT_DIR/patch.mjs" "$MODE"
