# 维护手册

> 面向本项目的长期维护者。普通使用者请先看 [README](../README.md)、[安装文档](INSTALL_MACOS.md) 和 [排错文档](TROUBLESHOOTING.md)。

## 1. 项目定位

本项目只做一件事：**把 QQ 2007 皮肤安全地注入 WorkBuddy 的渲染层**。

硬约束（任何提交都必须满足）：

- 不修改 `app.asar`；
- 只写 `app.asar.unpacked/renderer/` 下的主题资源；
- `index.html` 的字节数必须严格等于 `app.asar` 头部记录的 `size`；
- 不读写 WorkBuddy 的会话、账号、缓存、数据库；
- 安装失败必须回滚，并保留备份。

细节见 [SAFETY.md](SAFETY.md)。

## 2. 目录结构

| 路径 | 作用 |
| --- | --- |
| `theme/` | 真正注入到 WorkBuddy 的资源 |
| `theme/qq2008-skin.css` | 皮肤基础样式（历史命名，当前版本仍复用） |
| `theme/qq2008-583-adapter.css` | WorkBuddy 5.8.3 聊天界面适配 |
| `theme/qq2007-chrome.css` / `.js` | 2007 外壳、菜单栏、好友面板、状态栏、签名、QQ 宠物 |
| `theme/qq2008-notify.js` | 皮肤开关、通知音替换 |
| `theme/qq7pet/` | Ruffle 运行时 + 19 个宠物 SWF |
| `scripts/common/` | 跨平台共享的字节对齐工具 |
| `scripts/macos/` `scripts/windows/` | 安装 / 卸载脚本 |
| `scripts/maintenance/` | 维护辅助脚本（只读校验、双远端同步） |
| `scripts/ci/` | CI 用的仓库卫生检查 |
| `tests/` | Python 单元测试（注入 / 清理 / 字节对齐 / 幂等性） |
| `docs/` | 安装、安全、排错、兼容性、GIF、截图 |

## 3. 分支与版本

- `main` 始终可发布，正式版本都从 `main` 打 tag；
- 功能分支 `feature/<简述>`，修复分支 `fix/<简述>`，文档与工程改动 `docs/<简述>`、`chore/<简述>`；
- 即使单人维护，也建议走 PR：保留一次 CI + 自查记录。

版本遵循 SemVer：

| 类型 | 场景 |
| --- | --- |
| patch（1.0.x） | 修 bug、兼容性微调、文档/CI 改动，不改变用户可感知行为 |
| minor（1.x.0） | 新增宠物动作、新增皮肤模块、新增支持版本 |
| major（x.0.0） | 需要用户手动迁移或重装才能升级 |

版本号只有两处来源，**CI 会校验一致性**：

1. `CHANGELOG.md` 中最新的 `## x.y.z`；
2. 两个安装器里的 `themeVersion`（`scripts/macos/install.sh`、`scripts/windows/install.ps1`）。

## 4. 本地开发

```bash
# 安装到本机 WorkBuddy（会自动备份、退出 App、注入并校验字节数）
bash scripts/macos/install.sh

# 只读检查：注入状态、字节数、资源是否齐全
bash scripts/maintenance/verify-install.sh

# 卸载 / 恢复原版
bash scripts/macos/uninstall.sh
```

改完 `theme/` 下的资源，**直接重新运行 `install.sh` 即可**：安装器是幂等的（备份 → 覆盖资源 → 重新注入 → 校验），不需要先卸载。

开发提示：

- 改动 CSS/JS 后，在 WorkBuddy 里 `Cmd+R` 重载渲染进程，或重启 App；
- 宠物相关日志前缀是 `[QQ 2007 pet]`，在开发者工具 Console 里过滤；
- 只有在 WorkBuddy 完全退出时才能注入，安装器会自动请求退出；
- 新增或重命名 `theme/` 根目录资源时，必须同时更新 `install.sh` 与 `install.ps1` 的复制清单，否则 CI 会失败。

## 5. 发布流程

### 5.1 准备

1. 确认 `main` 工作区干净、CI 为绿；
2. 把 `CHANGELOG.md` 顶部的 `## Unreleased` 改成 `## x.y.z (YYYY-MM-DD)` 并补全条目；
3. 同步更新两个安装器的 `themeVersion`；
4. 按 5.2 做发布前验证。

### 5.2 发布前验证清单

```bash
python3 -m unittest discover -s tests -v
python3 scripts/ci/check_repo_hygiene.py
bash scripts/maintenance/verify-install.sh
```

- [ ] 卸载后用新版本重装一次，WorkBuddy 能正常启动；
- [ ] 标题栏、菜单栏、好友面板、聊天气泡、签名、通知音、宠物、次级窗口全部正常；
- [ ] 备份目录中 `metadata.json` 的 `themeVersion` 是新版本号；
- [ ] 截图 / GIF 已更新（如涉及界面变化）。

### 5.3 打 tag 并推送双仓库

```bash
git add -A
git commit -m "chore(release): vX.Y.Z"
git tag -a vX.Y.Z -m "WorkBuddy QQ 2007 主题 vX.Y.Z"
bash scripts/maintenance/sync-remotes.sh
```

`sync-remotes.sh` 会把 `main` 和所有 tag 同时推到 GitHub（`origin`）和 Gitee（`gitee`），避免两个仓库漂移。

### 5.4 GitHub Release

```bash
gh release create vX.Y.Z \
  --repo Fengoffer/workbuddy-qq2007-theme \
  --title "WorkBuddy QQ 2007 主题 vX.Y.Z" \
  --notes-file /tmp/release-notes.md
```

`--notes-file` 用 CHANGELOG 对应段落整理即可；PR 分类规则在 `.github/release.yml`。

### 5.5 Gitee Release

Gitee 没有免 token 的 CLI，需网页操作：

1. 打开 https://gitee.com/fengoffer/workbuddy-qq2007-theme/releases
2. 新建发行版 → 选择 tag `vX.Y.Z`；
3. 粘贴与 GitHub 相同的说明。

Gitee 会同步代码和 tag，但 Release 说明需要手动维护。

### 5.6 发布后

- 在本机跑一次 `verify-install.sh`；
- 关注两个仓库的 Issue；
- 如果 WorkBuddy 发布新版本导致布局变化，按 [COMPATIBILITY.md](COMPATIBILITY.md) 处理。

## 6. CI 做什么

`.github/workflows/ci.yml` 在 push 到 `main`、PR 和手动触发时运行：

| 步骤 | 内容 |
| --- | --- |
| Python | `py_compile` + `tests/` 单元测试 |
| 仓库卫生 | 体积上限、垃圾文件、凭据、版本一致性、主题资源与安装器对齐 |
| JavaScript | `node --check` 语法检查（`qq2007-chrome.js`、`qq2008-notify.js`） |
| ShellCheck | `scripts/macos/*.sh`、`scripts/maintenance/*.sh` |
| PowerShell | 用 PowerShell Parser 解析 `scripts/windows/*.ps1` |

CI 最常见的失败原因：

- `CHANGELOG.md` 改了版本但忘了改 `themeVersion`（或反过来）；
- 新增了 `theme/` 资源但没有加进两个安装器的复制清单；
- 新增文件超过 20 MiB；
- ShellCheck 报未引用变量、未加引号等；
- PowerShell 解析错误（通常是中文引号或括号不配对）。

## 7. 常见维护任务

### 7.1 新增宠物动作

1. 把 SWF 放进 `theme/qq7pet/`（安装器整目录递归复制，无需改清单）；
2. 在 `theme/qq2007-chrome.js` 的动作池中注册（按待机 / 玩耍 / 点击互动 / 说话分类）；
3. 更新 `docs/PET_ACTIONS.md` 与对应 GIF；
4. 同步 README / CHANGELOG 中的动作数量（当前：19 个）。

### 7.2 适配新的 WorkBuddy 版本

见 [COMPATIBILITY.md](COMPATIBILITY.md)。核心是：先确认目录结构仍是 unpacked renderer，再用开发者工具核对 DOM 钩子，最后更新两个安装器里的版本判断。

### 7.3 修改经典签名库

签名在 `theme/qq2007-chrome.js` 中（搜索签名数组）；改完更新 README 里的条数（当前 373 条），并确认状态栏轮播、点击切换、避免连续重复仍然正常。

### 7.4 替换通知音

`theme/qq-message.wav`、`theme/qq-failure.wav` 保持文件名不变；多播放路径拦截、900ms 去重和原生静音逻辑在 `theme/qq2008-notify.js`。改完实测「只响一次滴滴声」。

### 7.5 新增主题资源

1. 放进 `theme/`；
2. 加入 `scripts/macos/install.sh` 的 `for f in ...` 列表；
3. 加入 `scripts/windows/install.ps1` 的 `$files = @(...)` 列表；
4. 在 `scripts/macos/uninstall.sh` 与 `scripts/windows/uninstall.ps1` 的删除列表里同步补上；
5. 跑 `python3 scripts/ci/check_repo_hygiene.py` 确认对齐。

## 8. 安全红线

- 永远不修改 `app.asar`（只有 `uninstall.sh --restore-asar` 会从备份整体恢复，属于显式操作）；
- `index.html` 注入后必须逐字节对齐，任何对齐失败都要中止并回滚；
- 不引入遥测、不上传任何数据、不写用户目录（备份目录除外）；
- 不提交真实会话、账号、文件名等隐私内容，截图必须先脱敏；
- 第三方素材必须可追溯：Ruffle（MIT / Apache-2.0）、宠物动作素材（xuemian168/qqpet_automation，腾讯版权，禁止商用），改动时同步更新 `THIRD_PARTY_NOTICES.md`。

## 9. 紧急回滚

| 情况 | 处理 |
| --- | --- |
| 安装后白屏 / 崩溃 | `bash scripts/macos/uninstall.sh`，再打开 WorkBuddy |
| 卸载后仍异常 | 用备份恢复 asar：`bash scripts/macos/uninstall.sh --restore-asar ~/WorkBuddy/QQ2007ThemeBackups/<时间戳>` |
| Windows 异常 | `powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall.ps1`（必要时加 `-RestoreAsar`） |
| 主题开关异常 | 清除 `localStorage.WORKBUDDY_QQ2008_SKIN_ENABLED` 后重载 |

完整说明见 [README 的安全与回滚](../README.md#安全与回滚) 与 [SAFETY.md](SAFETY.md)。

## 10. 文档地图

| 文档 | 内容 |
| --- | --- |
| [README](../README.md) | 项目介绍、功能、安装、AI 一键安装 |
| [INSTALL_MACOS](INSTALL_MACOS.md) / [INSTALL_WINDOWS](INSTALL_WINDOWS.md) | 分平台安装步骤 |
| [SAFETY](SAFETY.md) | 字节对齐原理、数据安全承诺、回滚 |
| [TROUBLESHOOTING](TROUBLESHOOTING.md) | 常见问题与排查 |
| [COMPATIBILITY](COMPATIBILITY.md) | 版本兼容矩阵与升级适配流程 |
| [PET_ACTIONS](PET_ACTIONS.md) | 全部宠物动作 GIF |
| [AI_INSTALL](../AI_INSTALL.md) | 给 AI 助手的安装约定 |
| [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md) | 第三方素材与许可 |
