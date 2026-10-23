#!/bin/bash
# WorkBuddy QQ 2007 Theme - macOS Installer
# 只修改 WorkBuddy.app/Contents/Resources 下的主题资源，不触碰任何用户数据。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
THEME_DIR="$REPO_DIR/theme"
COMMON_DIR="$REPO_DIR/scripts/common"

# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

APP="${WORKBUDDY_APP:-/Applications/WorkBuddy.app}"
LAUNCH=1
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --app) APP="$2"; shift 2 ;;
    --no-launch) LAUNCH=0; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help)
      cat <<EOF
用法: install.sh [--app /Applications/WorkBuddy.app] [--no-launch] [--force]

  --app PATH   指定 WorkBuddy.app 路径
  --no-launch  安装完成后不自动打开 WorkBuddy
  --force      跳过版本检查（不推荐）

安装前会自动备份 app.asar 和 index.html 到:
  ~/WorkBuddy/QQ2007ThemeBackups/<时间戳>/
EOF
      exit 0 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || { echo "此脚本仅支持 macOS。Windows 请用 scripts/windows/install.ps1"; exit 1; }
[ -d "$APP" ] || { echo "找不到 WorkBuddy.app：$APP"; echo "请用 --app 指定路径，或确认已安装 WorkBuddy。"; exit 1; }

RES="$APP/Contents/Resources"
ASAR="$RES/app.asar"
UP="$RES/app.asar.unpacked/renderer"
INDEX="$UP/index.html"

[ -f "$ASAR" ] || { echo "找不到 $ASAR"; exit 1; }
[ -f "$INDEX" ] || {
  echo "当前 WorkBuddy 版本不是「unpacked renderer」结构，无法安全注入主题。"
  echo "本安装器不会修改 app.asar，因此已停止，未做任何更改。"
  exit 1
}

VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist" 2>/dev/null || echo "unknown")
echo "WorkBuddy 版本: $VERSION"
if [ "$VERSION" != "5.8.3" ] && [ "$FORCE" -ne 1 ]; then
  echo "提示：本主题主要在 WorkBuddy 5.8.3 上验证。其他版本可能布局不同。"
  echo "如果确认要继续，请加 --force 后重新运行。"
  exit 2
fi

# 1. 退出 WorkBuddy（5.8.3 主进程是 MacOS/Electron，不是 MacOS/WorkBuddy）
if workbuddy_is_running "$APP"; then
  echo "正在退出 WorkBuddy ..."
  request_workbuddy_quit
  if ! wait_workbuddy_exit "$APP" 20; then
    echo "WorkBuddy 仍在运行，请先 Command+Q 完全退出后再安装。"
    exit 1
  fi
fi

# 2. 备份
TS=$(date +%Y%m%d-%H%M%S)
BK="$HOME/WorkBuddy/QQ2007ThemeBackups/$TS"
mkdir -p "$BK"
echo "备份到: $BK"
cp "$ASAR" "$BK/app.asar"
cp "$INDEX" "$BK/index.html"
TARGET=$(python3 "$COMMON_DIR/asar_index_size.py" "$ASAR")
[ "$TARGET" -gt 0 ] || { echo "无法读取 asar 中的 index.html 大小，已中止。"; exit 1; }
cat > "$BK/metadata.json" <<EOF
{
  "app": "$APP",
  "version": "$VERSION",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "indexTargetSize": $TARGET,
  "asarSha256": "$(shasum -a 256 "$ASAR" | awk '{print $1}')",
  "indexSha256": "$(shasum -a 256 "$INDEX" | awk '{print $1}')",
  "themeVersion": "1.0.8"
}
EOF
shasum -a 256 "$ASAR" "$INDEX" > "$BK/SHA256.txt"

# 3. 复制主题资源
ASSETS="$UP/assets"
mkdir -p "$ASSETS/qq7pet"
COPIED=()
for f in qq2008-skin.css qq2008-583-adapter.css qq2007-chrome.css qq2007-chrome.js qq2008-notify.js \
         qq-penguin-user.png qq7-icons.png qq7-penguin.png qq7-show.png qq-message.wav qq-failure.wav; do
  cp "$THEME_DIR/$f" "$ASSETS/$f"
  COPIED+=("$f")
done
cp -R "$THEME_DIR/qq7pet/." "$ASSETS/qq7pet/"

rollback() {
  echo "安装失败，正在回滚 index.html ..."
  cp "$BK/index.html" "$INDEX"
  for f in "${COPIED[@]}"; do rm -f "$ASSETS/$f"; done
  rm -rf "$ASSETS/qq7pet"
  echo "已回滚。WorkBuddy 未被修改。备份保留在: $BK"
}
trap 'rollback' ERR

# 4. 注入（严格保持 asar 记录的字节数）
python3 "$COMMON_DIR/patch_index.py" --index "$INDEX" --target "$TARGET"

# 5. 自检
SIZE=$(stat -f%z "$INDEX")
[ "$SIZE" -eq "$TARGET" ] || { echo "index.html 大小异常: $SIZE != $TARGET"; false; }
grep -q "qq2008-skin.css" "$INDEX" || { echo "注入校验失败"; false; }
grep -q '<div id="root"></div>' "$INDEX" || { echo "root 节点校验失败"; false; }
trap - ERR

# 6. 完成
cat > "$BK/ROLLBACK.md" <<EOF
# 回滚方法

1. 完全退出 WorkBuddy（Command+Q）。
2. 运行：
   bash "$REPO_DIR/scripts/macos/uninstall.sh"
3. 如果 WorkBuddy 仍无法启动，再用备份恢复整个 app.asar：
   bash "$REPO_DIR/scripts/macos/uninstall.sh" --restore-asar "$BK"
EOF

echo
echo "✅ 安装完成。"
echo "备份目录: $BK"
echo "回滚命令: bash \"$REPO_DIR/scripts/macos/uninstall.sh\""
echo "如需恢复 app.asar: 见 $BK/ROLLBACK.md"
if [ "$LAUNCH" -eq 1 ]; then
  echo "正在启动 WorkBuddy ..."
  # 从 Electron 型 Agent / 终端环境调用时，避免继承 ELECTRON_RUN_AS_NODE 导致 App 以 Node 模式秒退
  env -u ELECTRON_RUN_AS_NODE open -a "$APP" || true
fi
