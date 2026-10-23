# Windows 安装指南（实验性）

> **重要：** 作者只在 macOS 实机上验证过本主题。Windows 安装器遵循同样的安全策略，但尚未在 Windows 实机跑通全流程。欢迎在 Issue 中反馈目录结构和报错。

## 1. 前提

- Windows 10 / 11
- PowerShell 5.1+
- WorkBuddy 5.8.3（安装位置任意，脚本会自动搜索）
- 关键条件：WorkBuddy 安装目录下存在

```text
resources\app.asar
resources\app.asar.unpacked\renderer\index.html
```

如果只有 `app.asar`、没有 `app.asar.unpacked\renderer`，说明该版本是 packed 结构。安装器会安全退出，**不会**修改 `app.asar`，避免破坏 Electron 完整性校验导致无法启动。

## 2. 安装

```powershell
git clone --depth 1 https://github.com/Fengoffer/workbuddy-qq2007-theme.git
cd workbuddy-qq2007-theme
powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1
```

安装器会：

1. 在 `%LOCALAPPDATA%\Programs`、`Program Files`、注册表卸载项中查找 WorkBuddy；
2. 检查版本（非 5.8.3 需加 `-Force`）；
3. 请求关闭 WorkBuddy（`CloseMainWindow`），必要时可加 `-Kill` 强制关闭；
4. 备份到 `%USERPROFILE%\WorkBuddy\QQ2007ThemeBackups\<时间戳>\`；
5. 复制主题资源；
6. 注入 `index.html` 并保持 asar 记录的字节数；
7. 校验失败自动回滚。

### 参数

```powershell
# 指定安装目录
powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1 -AppPath "C:\Users\你\AppData\Local\Programs\WorkBuddy"

# 强制关闭 WorkBuddy（请先确认没有未保存任务）
powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1 -Kill

# 跳过版本检查
powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1 -Force

# 安装后不自动启动
powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1 -NoLaunch
```

## 3. 卸载 / 恢复

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall.ps1
```

如果应用无法启动：

```powershell
Get-Process WorkBuddy -ErrorAction SilentlyContinue | Stop-Process -Force
powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall.ps1
```

用备份恢复整个 `app.asar`：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows\uninstall.ps1 -RestoreAsar "C:\Users\你\WorkBuddy\QQ2007ThemeBackups\2026-10-23-130000"
```

## 4. 已知限制

- 没有 Windows 实机测试，布局细节（字体、DWM 窗口边框、DPI 缩放）可能与 macOS 不同；
- 只支持 unpacked renderer 结构；
- 不修改 `app.asar`；
- WorkBuddy 升级后安装可能被覆盖，需要重新运行安装器。

## 5. 反馈

提 Issue 时请附上：

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Programs\WorkBuddy\resources" | Select Name
Get-Content "$env:USERPROFILE\WorkBuddy\QQ2007ThemeBackups\<时间戳>\metadata.json"
```

以及安装器完整输出（不要包含账号、会话内容）。
