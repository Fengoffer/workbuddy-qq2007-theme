# 给 AI 的一键安装约定

你是被授权在这台电脑上安装桌面主题的 AI 编程助手。请严格遵守以下规则。

## 硬性安全规则

1. **禁止修改 `app.asar`**。只允许修改 `app.asar.unpacked/renderer/index.html` 和 `app.asar.unpacked/renderer/assets/`。
2. **禁止读写用户数据**：`~/Library/Application Support/WorkBuddy`、`%APPDATA%\WorkBuddy`、数据库、会话、账号、文件。
3. **安装前必须备份**：`~/WorkBuddy/QQ2007ThemeBackups/<时间戳>/` 或 `%USERPROFILE%\WorkBuddy\QQ2007ThemeBackups\<时间戳>\`。
4. 安装器返回非 0 时，**立即运行卸载脚本恢复**，不要继续尝试手工修改 `index.html`。
5. 任何情况下都不要删除备份目录。

## macOS

```bash
set -e
# 1. 退出 WorkBuddy
osascript -e 'tell application "WorkBuddy" to quit' 2>/dev/null || true
sleep 4
pkill -f "WorkBuddy.app/Contents/MacOS/Electron" 2>/dev/null || pkill -f "WorkBuddy.app/Contents/MacOS/WorkBuddy" 2>/dev/null || true

# 2. 克隆到临时目录
TMP="$(mktemp -d)"
# 国内网络可换成 https://gitee.com/fengoffer/workbuddy-qq2007-theme.git
git clone --depth 1 https://github.com/Fengoffer/workbuddy-qq2007-theme.git "$TMP/wbqq7"

# 3. 安装
bash "$TMP/wbqq7/scripts/macos/install.sh"

# 4. 验证
sleep 8
pgrep -f "WorkBuddy.app/Contents/MacOS/Electron" >/dev/null && echo "WorkBuddy 已启动"
```

如果安装失败或启动后白屏：

```bash
bash "$TMP/wbqq7/scripts/macos/uninstall.sh"
env -u ELECTRON_RUN_AS_NODE open -a /Applications/WorkBuddy.app
```

## Windows（实验性）

```powershell
git clone --depth 1 https://github.com/Fengoffer/workbuddy-qq2007-theme.git "$env:TEMP\wbqq7"
powershell -ExecutionPolicy Bypass -File "$env:TEMP\wbqq7\scripts\windows\install.ps1"
```

如果提示不是 unpacked 结构，请停止，不要尝试修改 `app.asar`，把目录结构反馈给用户。

## 安装后检查清单

- [ ] `WorkBuddy.app/Contents/Resources/app.asar` 的 SHA256 与安装前一致（安装器不会改它）；
- [ ] `index.html` 字节数等于 `metadata.json.indexTargetSize`；
- [ ] `index.html` 含 `qq2008-skin.css` 且含 `<div id="root"></div>`；
- [ ] WorkBuddy 能正常启动，标题栏/菜单栏/好友面板出现；
- [ ] 菜单栏「原版」可以关闭皮肤；
- [ ] 宠物、状态栏签名正常显示。

## 报告格式

安装完成后请返回：

```text
平台: macOS
WorkBuddy 版本: 5.8.3
安装结果: 成功 / 失败
备份目录: ...
index.html 字节数: ... / 期望 ...
app.asar SHA256: ...（安装后）
问题: 无 / 具体报错
```
