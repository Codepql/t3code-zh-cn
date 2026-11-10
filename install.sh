#!/usr/bin/env sh
set -eu
MODE="${1:-apply}"
case "$MODE" in
  apply|restore|upgrade|check|status) ;;
  *) echo '用法：install.sh apply|restore|upgrade|check|status [安装目录]' >&2; exit 2 ;;
esac
INSTALL_DIR="${2:-${T3ZH_INSTALL_DIR:-}}"
T3ZH_DATA_DIR="${T3ZH_DATA_DIR:-$HOME/.t3/localization/zh-CN}"
export T3ZH_DATA_DIR
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/t3code-zh-cn.XXXXXXXX")
trap 'rm -rf -- "$TEMP_DIR"' EXIT
trap 'exit 1' HUP INT TERM
echo '正在下载最新汉化工具…'
curl -fsSL 'https://github.com/Codepql/t3code-zh-cn/archive/refs/heads/main.zip' -o "$TEMP_DIR/source.zip"
unzip -q "$TEMP_DIR/source.zip" -d "$TEMP_DIR"
echo "备份和状态目录：$T3ZH_DATA_DIR"
sh "$TEMP_DIR/t3code-zh-cn-main/run.sh" "$MODE" "$INSTALL_DIR"
