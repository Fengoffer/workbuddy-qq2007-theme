# 兼容性矩阵与版本适配

> 本文件记录「主题在哪些 WorkBuddy 版本上验证过」，以及 WorkBuddy 升级后如何重新适配。改动支持范围时请同步更新本文件、安装器中的版本判断和 `CHANGELOG.md`。

## 1. 当前支持矩阵

| 平台 | WorkBuddy | 状态 | 说明 |
| --- | --- | --- | --- |
| macOS 26.6.2（arm64） | 5.8.3 | ✅ 已验证 | 作者日常环境，安装 / 卸载 / 宠物 / 通知音 / 次级窗口均已实测 |
| macOS 14 / 15（Intel / Apple Silicon） | 5.8.3 | ⚠️ 未逐一验证 | 预期可用；布局差异应在验收清单里能立刻发现 |
| Windows 10 / 11 | 5.8.3 | ⚠️ 实验性 | 脚本已提供，但作者无 Windows 实机；仅支持 `app.asar.unpacked\renderer` 结构 |
| 其他 WorkBuddy 版本 | — | ❓ 未知 | 安装器默认拦截，需 `--force` / `-Force` 才会继续，位置可能错位 |

> 主题只适用于 **unpacked renderer** 结构。若 WorkBuddy 把 `renderer/index.html` 打包进 `app.asar`，安装器会安全退出，不做任何修改。

## 2. 环境自检

```bash
# macOS 系统版本
sw_vers

# WorkBuddy 版本
defaults read /Applications/WorkBuddy.app/Contents/Info.plist CFBundleShortVersionString

# 是否 unpacked renderer
ls -l /Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/renderer/index.html

# asar 头部记录的 index.html 目标大小
python3 scripts/common/asar_index_size.py \
  /Applications/WorkBuddy.app/Contents/Resources/app.asar

# 当前注入状态
bash scripts/maintenance/verify-install.sh
```

Windows：

```powershell
(Get-Item "$env:LOCALAPPDATA\Programs\WorkBuddy\WorkBuddy.exe").VersionInfo.ProductVersion
Test-Path "$env:LOCALAPPDATA\Programs\WorkBuddy\resources\app.asar.unpacked\renderer\index.html"
```

## 3. 安装后验收清单

每次发布、每次 WorkBuddy 升级后都要逐项确认：

- [ ] WorkBuddy 能正常启动，不白屏、不崩溃（控制台无 React error #299）；
- [ ] 标题栏是 XP Luna 蓝色，macOS 红绿灯垂直居中、不遮挡；
- [ ] 菜单栏「新建任务 / 助理 / 技能 / 定时任务 / 资料库 / 聊天 / 原版」都指向原功能；
- [ ] 右侧好友面板显示正常，可折叠；打开 WorkBuddy 原生右侧面板时好友栏自动让位；
- [ ] 状态栏等级、在线状态、经典签名轮播正常，点击可换一条；
- [ ] 会话列表、聊天气泡、输入框、发送键、模型选择器样式正确，文字不糊；
- [ ] 流式输出、停止、复制、重新生成、附件、产物卡片可用；
- [ ] 通知音只有一声 QQ 滴滴（没有「咚 + 滴滴」双响）；
- [ ] QQ 宠物出现：待机呼吸、点击互动、输入时抬头、切会话跑动、选项举牌；
- [ ] 设置 / 文件查看 / 浏览器等次级窗口是原生样式，没有被 QQ 外壳遮挡；
- [ ] 点击菜单栏「原版」能关闭皮肤；
- [ ] 左下角状态栏、右侧好友列表、环境信息里的用户名与 WorkBuddy 登录账号一致；切换 / 退出账号后自动更新或显示「WorkBuddy 用户」；
- [ ] 拖动标题栏 / 菜单栏空白处可移动窗口；最大化状态下拖动会先还原再跟随；
- [ ] 双击标题栏顶部（系统原生区）与菜单栏空白处都能缩放；
- [ ] 卸载后 WorkBuddy 完全恢复原版，且启动正常。

## 4. WorkBuddy 升级后的适配流程

1. **先恢复原版**，保留旧备份：
   ```bash
   bash scripts/macos/uninstall.sh
   ```
2. **记录新环境**：版本、`Resources` 目录结构、`index.html` 是否仍为 unpacked、asar 记录大小。
3. **确认基线未变**：`verify-install.sh` 在未安装状态下应报告「未注入」，安装后应全部通过。
4. **安装并跑验收清单**（可用 `--force` 跳过版本拦截，但必须确认已有备份）。
5. **修选择器**：如果外壳/气泡/面板错位，`Cmd+Option+I` 打开开发者工具，对照 `theme/qq2007-chrome.js`、`theme/qq2007-chrome.css`、`theme/qq2008-583-adapter.css` 里的 DOM 钩子（class / `data-*` / 结构选择器）逐个核对并更新。
6. **更新版本判断**：
   - `scripts/macos/install.sh`：`[ "$VERSION" != "5.8.3" ]`；
   - `scripts/windows/install.ps1`：`$version -notmatch '^5\.8\.3'`；
   - 如果新旧版本都支持，改成允许列表更好。
7. **更新文档**：本文件的矩阵、README 的版本徽章、CHANGELOG。
8. **发布**：按 [MAINTAINING.md](MAINTAINING.md) 的流程发 patch（仅兼容修复）或 minor（新增支持版本）。

## 5. 已知限制

| 限制 | 影响 | 处理 |
| --- | --- | --- |
| packed `app.asar` 结构 | 无法安全注入，安装器直接退出 | 等待适配，不要手动改 asar |
| Windows 未实机验证 | 脚本可能存在路径 / 编码差异 | 欢迎提 Issue 附目录结构、报错和截图 |
| 首次加载 Ruffle 需编译约 12 MB wasm | 第一次进入可能要等几秒 | 之后走缓存；安装器会预热，属正常现象 |
| WorkBuddy 更新可能改变通知音路径 | 滴滴声可能失效 | 更新 `theme/qq2008-notify.js` 的拦截路径 |
| 皮肤开关依赖 `localStorage` | 清缓存后恢复默认（开启） | 用菜单栏「原版」按钮切换 |
| 仅主窗口应用皮肤 | 次级窗口保持原生 | 设计如此，避免遮挡原生功能 |
| macOS 原生标题栏高度按 38px 适配 | 不同系统版本可能偏移热区分界 | 调整 CSS 变量 `--qq7-native-titlebar` |
| 账号名优先读 WorkBuddy 账号服务（`__genieAccountService`），回退用户菜单 DOM | 未来版本改内部服务或菜单结构时可能先显示「WorkBuddy 用户」 | 更新 `readServiceAccount` / `ACCOUNT_NAME_SELECTORS` |
| 右侧「专家」组按最近使用 → 自定义 / 云同步 → 完整目录排序 | 目录顺序依赖 WorkBuddy 接口，未按行业分类分组 | 后续可按分类展示 |
| 团队 / 金融投资专家不在好友面板直接召唤 | 需要 WorkBuddy 原生团队 / 财务确认，主题不绕过确认流程 | 好友列表显示「团队」「金融」标记，到专家中心召唤 |

## 6. 反馈模板

提兼容性 Issue 时请附：

```text
系统：macOS 26.6.2 / Windows 11 23H2 ...
WorkBuddy 版本：5.8.3
安装方式：install.sh / install.ps1
现象：白屏 / 错位 / 宠物不动 / 通知音异常 ...
控制台报错（如有）：
备份目录：（只附 metadata.json，不要附会话内容）
截图：（请先脱敏）
```
