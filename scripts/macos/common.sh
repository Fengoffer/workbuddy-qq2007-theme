#!/bin/bash
# macOS 安装 / 卸载脚本共用的进程检测与退出逻辑。

# WorkBuddy 5.8.3 的主进程可执行文件是 Contents/MacOS/Electron；
# 旧版或其他渠道可能是 Contents/MacOS/WorkBuddy，两者都要匹配。
workbuddy_is_running() {
  local app="$1"
  pgrep -f "$app/Contents/MacOS/Electron" >/dev/null 2>&1 && return 0
  pgrep -f "$app/Contents/MacOS/WorkBuddy" >/dev/null 2>&1 && return 0
  pgrep -f "$app/Contents/Frameworks/WorkBuddy Helper" >/dev/null 2>&1 && return 0
  return 1
}

request_workbuddy_quit() {
  # 只发一次 quit：对未运行的 App 执行 `tell application ... to quit` 可能会把它拉起来
  osascript -e 'tell application id "com.tencent.workbuddy.mac" to quit' >/dev/null 2>&1 && return 0
  osascript -e 'tell application "WorkBuddy" to quit' >/dev/null 2>&1 || true
}

# 等待 App 退出：成功返回 0，超时仍运行返回 1。
wait_workbuddy_exit() {
  local app="$1"
  local tries="${2:-20}"
  local i=0
  while [ "$i" -lt "$tries" ]; do
    workbuddy_is_running "$app" || return 0
    sleep 0.5
    i=$((i + 1))
  done
  workbuddy_is_running "$app" && return 1
  return 0
}
