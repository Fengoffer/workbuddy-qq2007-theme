#!/bin/bash
# 只读检查：当前 macOS 上的 WorkBuddy 是否已正确注入 QQ 2007 主题。
# 不修改任何文件，可随时运行。
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMMON_DIR="$REPO_DIR/scripts/common"
APP="${WORKBUDDY_APP:-/Applications/WorkBuddy.app}"

while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    -h|--help)
      echo "用法: verify-install.sh [--app /Applications/WorkBuddy.app]"
      exit 0 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || { echo "此脚本仅支持 macOS。"; exit 1; }

RES="$APP/Contents/Resources"
ASAR="$RES/app.asar"
UP="$RES/app.asar.unpacked/renderer"
INDEX="$UP/index.html"
ASSETS="$UP/assets"

THEME_ASSETS=(
  qq2008-skin.css
  qq2008-583-adapter.css
  qq2007-chrome.css
  qq2007-chrome.js
  qq2008-notify.js
  qq-penguin-user.png
  qq7-icons.png
  qq7-penguin.png
  qq7-show.png
  qq-message.wav
  qq-failure.wav
)

FAIL=0
ok() { echo "✅ $*"; }
bad() { echo "❌ $*"; FAIL=$((FAIL + 1)); }

[ -d "$APP" ] || { echo "找不到 WorkBuddy.app：$APP"; exit 1; }
[ -f "$ASAR" ] || { echo "找不到 $ASAR"; exit 1; }

if [ ! -f "$INDEX" ]; then
  echo "ℹ️  当前 WorkBuddy 不是 unpacked renderer 结构（找不到 $INDEX），主题不可安装。"
  exit 2
fi

TARGET=$(python3 "$COMMON_DIR/asar_index_size.py" "$ASAR") || exit 1
SIZE=$(stat -f%z "$INDEX")

echo "App：$APP"
echo "index.html：$SIZE bytes；asar 记录：$TARGET bytes"

if [ "$SIZE" -eq "$TARGET" ]; then
  ok "字节数与 asar 记录一致"
else
  bad "字节数不一致（$SIZE != $TARGET），存在白屏 / 截断风险"
fi

if grep -q '<div id="root"></div>' "$INDEX"; then
  ok "#root 节点存在"
else
  bad "#root 节点丢失"
fi

INSTALLED=0
if grep -q 'qq2008-skin.css' "$INDEX" && grep -q 'qq2008-notify.js' "$INDEX"; then
  INSTALLED=1
fi

if [ "$INSTALLED" -eq 1 ]; then
  echo "主题状态：已安装"

  for f in "${THEME_ASSETS[@]}"; do
    [ -f "$ASSETS/$f" ] || bad "缺少主题资源：assets/$f"
  done
  [ -f "$ASSETS/qq7pet/ruffle.js" ] || bad "缺少 Ruffle 运行时：assets/qq7pet/ruffle.js"

  SWF_COUNT=$(find "$ASSETS/qq7pet" -maxdepth 1 -name '*.swf' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$SWF_COUNT" -ge 1 ]; then
    ok "宠物动作 SWF：$SWF_COUNT 个"
  else
    bad "没有找到任何宠物动作 SWF"
  fi
else
  echo "主题状态：未安装（index.html 中没有主题注入）"
  if [ -d "$ASSETS/qq7pet" ] || [ -f "$ASSETS/qq2008-skin.css" ]; then
    echo "⚠️  检测到残留的主题资源文件，建议运行 bash scripts/macos/uninstall.sh 清理。"
  fi
fi

echo
if [ "$FAIL" -eq 0 ]; then
  if [ "$INSTALLED" -eq 1 ]; then
    echo "结论：主题已正确安装。"
  else
    echo "结论：当前为原版状态，可安全安装。"
  fi
  exit 0
fi

echo "结论：发现 $FAIL 个问题，建议重新安装，或按 docs/TROUBLESHOOTING.md 处理。"
exit 1
