# 常见问题排查

## 安装阶段

### `找不到 WorkBuddy.app`
- macOS 默认路径 `/Applications/WorkBuddy.app`；
- 如果装在别处：`--app /path/to/WorkBuddy.app`。

### `不是 unpacked renderer 结构，无法安全注入`
说明该版本把 renderer 打包在 `app.asar` 里。安装器不会修改 `app.asar`，因此安全退出。
请提 Issue 附上：

```bash
find /Applications/WorkBuddy.app/Contents/Resources -maxdepth 3 -name "index.html"
```

### `Permission denied`
`/Applications` 通常需要管理员权限：

```bash
sudo -E bash scripts/macos/install.sh
```

### `WorkBuddy 仍在运行`
请 Command+Q 完全退出，或在任务管理器 / 活动监视器里结束所有 WorkBuddy 进程。

### `index.html 大小异常 / 字节数对齐失败`
安装器已自动回滚。请确认 WorkBuddy 没有被其他进程同时修改；重新运行安装器。如重复失败，附上安装输出。

## 启动阶段

### 白屏 / 启动后立即退出 / React error #299
`index.html` 被截断的典型表现。处理：

```bash
pkill -f "WorkBuddy.app/Contents/MacOS/Electron" 2>/dev/null || pkill -f "WorkBuddy.app/Contents/MacOS/WorkBuddy" 2>/dev/null || true
bash scripts/macos/uninstall.sh
env -u ELECTRON_RUN_AS_NODE open -a /Applications/WorkBuddy.app
```

仍失败则恢复 app.asar：

```bash
bash scripts/macos/uninstall.sh --restore-asar ~/WorkBuddy/QQ2007ThemeBackups/<时间戳>
```

### 窗口出现但样式错乱 / 布局重叠
- 确认 WorkBuddy 版本是 5.8.3；
- 关闭皮肤（菜单栏「原版」）再打开；
- 如果升级过 WorkBuddy，主题可能被覆盖，重新安装；
- 提 Issue 附截图 + 版本号。

### 设置窗口仍被好友栏遮挡
早期版本的问题，已在 1.0.0 修复：设置/文件查看/浏览器等次级窗口会恢复原生，不加载 QQ 外壳。

## 主题功能

### 菜单栏没有「原版」
刷新页面（Command+R）或重启 WorkBuddy；如果仍未出现，检查 `index.html` 是否包含 `qq2008-notify.js`。

### 宠物不显示
- 首次加载需编译 wasm，等几秒；
- 打开开发者工具（`--remote-debugging-port`）查看 `[QQ 2007 pet]` 日志；
- 确认 `assets/qq7pet/` 文件完整（`ruffle.js`、`core.ruffle.*.js`、`*.wasm`、`*.swf`）；
- 如果皮肤关闭，宠物会一起隐藏。

### 宠物动作变少 / 消失
动作 SWF 缺失或加载失败。检查 `theme/qq7pet/` 是否完整；重新运行安装器。

### 签名不轮播
- 签名每 20~60 秒切换一次；
- 点击状态栏签名可立即切换；
- 如果状态栏没有签名，可能被其他界面覆盖，提 Issue。

### 通知音不是 QQ 滴滴
WorkBuddy 升级后可能改了通知音路径。当前只拦截 `sounds/*.wav`、`audio.src`、`Audio`、`fetch` 等路径；如失效请提 Issue 并附新版本号。

### 点了菜单栏「+」没反应 / 菜单不出来

「+」是颜色编辑按钮（位于菜单栏「原版」右侧），属于 1.3.0 新增功能。

1. 确认版本：安装目录里 `grep -c qq7-colorbtn theme/qq2007-chrome.js` 应大于 0；
2. 确认注入生效：点一下窗口任意处让主题重新初始化，或按 `Cmd+R` 刷新；
3. 皮肤关闭时按钮会随外壳隐藏，这是正常行为（先点菜单栏「原版」切回主题）。

### 换色后只有部分界面变色 / 颜色发灰

主题用 CSS 变量令牌（`--qq7-c-XXXXXX`）驱动换色，令牌名就是原始色值。
如果部分区域没变色，通常是该处写死了字面色值，需要在样式表里改成
`var(--qq7-c-XXXXXX, #原色值)` 形式。这是维护问题，请提 Issue 附截图。

### 换色后想恢复默认蓝色

点颜色菜单第一项「颜色恢复」即可；或清掉存储：

```js
localStorage.removeItem('WORKBUDDY_QQ7_SKIN_HUE');
localStorage.removeItem('WORKBUDDY_QQ7_SKIN_LIGHT');
```

### 通知音有两声
已做过 900ms 去重和原生通知静音。如果仍有两声，可能是 macOS 系统通知声音：到「系统设置 → 通知 → WorkBuddy」关闭声音。

## Windows

### 找不到目录
用 `-AppPath` 指定；或检查：

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Programs" -Directory | Where-Object Name -match WorkBuddy
```

### 提示不是 unpacked 结构
当前 Windows 版本不支持，安装器已安全退出，不会修改任何文件。请提 Issue 附目录结构。

## 如何提供有效反馈

请附上：

1. WorkBuddy 版本（macOS：`defaults read /Applications/WorkBuddy.app/Contents/Info.plist CFBundleShortVersionString`）；
2. 安装器完整输出；
3. `~/WorkBuddy/QQ2007ThemeBackups/<时间戳>/metadata.json`；
4. 出错截图（请先对会话内容打码）；
5. 是否修改过 `app.asar`。

不要上传包含账号、会话、文件名的原始截图。
