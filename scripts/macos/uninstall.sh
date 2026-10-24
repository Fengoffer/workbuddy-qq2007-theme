#!/bin/bash
# WorkBuddy QQ 2007 Theme - macOS Uninstaller / Rollback
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMMON_DIR="$REPO_DIR/scripts/common"

# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"
APP="${WORKBUDDY_APP:-/Applications/WorkBuddy.app}"
RESTORE_ASAR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --restore-asar) RESTORE_ASAR="$2"; shift 2 ;;
    -h|--help)
      echo "用法: uninstall.sh [--app PATH] [--restore-asar 备份目录]"
      exit 0 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

RES="$APP/Contents/Resources"; ASAR="$RES/app.asar"; UP="$RES/app.asar.unpacked/renderer"; INDEX="$UP/index.html"
[ -f "$ASAR" ] || { echo "找不到 $ASAR"; exit 1; }

if workbuddy_is_running "$APP"; then
  echo "正在退出 WorkBuddy ..."
  request_workbuddy_quit
  if ! wait_workbuddy_exit "$APP" 20; then
    echo "请先完全退出 WorkBuddy。"
    exit 1
  fi
fi

if [ -n "$RESTORE_ASAR" ]; then
  [ -f "$RESTORE_ASAR/app.asar" ] || { echo "备份目录里没有 app.asar: $RESTORE_ASAR"; exit 1; }
  echo "警告：将用备份替换 app.asar。"
  cp "$RESTORE_ASAR/app.asar" "$ASAR.restore-tmp"
  mv "$ASAR.restore-tmp" "$ASAR"
  echo "app.asar 已恢复。"
fi

if [ -f "$INDEX" ]; then
  TARGET=$(python3 "$COMMON_DIR/asar_index_size.py" "$ASAR")
  cp "$INDEX" "$INDEX.bak-$(date +%Y%m%d-%H%M%S)"
  python3 "$COMMON_DIR/patch_index.py" --index "$INDEX" --target "$TARGET" --strip-only
  echo "index.html 已清理主题注入（$TARGET bytes）。"
fi

ASSETS="$UP/assets"
for f in qq2008-skin.css qq2008-583-adapter.css qq2007-chrome.css qq2007-chrome.js qq2008-notify.js \
         qq-penguin-user.png qq7-icons.png qq7-penguin.png qq7-show.png qq7-skin-shirt.png qq-message.wav qq-failure.wav; do
  rm -f "$ASSETS/$f"
done
rm -rf "$ASSETS/qq7pet"
echo "✅ 已卸载主题。重新打开 WorkBuddy 即恢复原版。"
