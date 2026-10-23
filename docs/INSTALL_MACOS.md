# macOS 安装指南

## 1. 确认环境

- WorkBuddy 5.8.3（`/Applications/WorkBuddy.app`）
- 系统 Python 3：`/usr/bin/python3 --version` 能正常输出版本
- 安装前请 **完全退出 WorkBuddy**（Command+Q，确认 Dock 里没有运行指示点）

检查 WorkBuddy 目录结构：

```bash
ls -la /Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/renderer/index.html
```

如果这个文件存在，说明是 `unpacked renderer` 结构，可以安装；否则安装器会安全退出。

## 2. 安装

```bash
git clone --depth 1 https://github.com/Fengoffer/workbuddy-qq2007-theme.git
# 或者 Gitee 镜像
# git clone --depth 1 https://gitee.com/fengoffer/workbuddy-qq2007-theme.git
cd workbuddy-qq2007-theme
bash scripts/macos/install.sh
```

安装器会：

1. 读取 `app.asar` 头部，得到 `renderer/index.html` 的原始大小；
2. 退出 WorkBuddy（如果正在运行）；
3. 备份 `app.asar`、`index.html` 到 `~/WorkBuddy/QQ2007ThemeBackups/<时间戳>/`；
4. 把 `theme/` 下的资源复制到 `app.asar.unpacked/renderer/assets/`；
5. 在 `index.html` 中注入主题 `link/script`，并用注释填充让文件字节数 **严格等于** asar 记录值；
6. 校验字节数、`#root`、注入标记，校验失败自动回滚；
7. 打开 WorkBuddy。

### 常用参数

```bash
# 指定 App 路径（多版本/自定义路径）
bash scripts/macos/install.sh --app /Applications/WorkBuddy.app

# 安装后不自动启动
bash scripts/macos/install.sh --no-launch

# 跳过版本号提示（例如 WorkBuddy 小版本升级后）
bash scripts/macos/install.sh --force
```

### 权限问题

如果 `/Applications/WorkBuddy.app` 属于管理员且当前用户无写权限，安装器会报 `Permission denied`。可以：

```bash
sudo -E bash scripts/macos/install.sh
```

`-E` 用于把当前用户的 `HOME` 传给安装器，保证备份仍然写到你的用户目录，而不是 `/var/root`。

## 3. 首次打开

- 主题会自动启用；
- 首次加载 QQ 宠物需要编译约 12MB wasm，可能需要几秒钟，期间显示静态企鹅；
- 右上角菜单栏的「原版」可以随时关闭皮肤。

## 4. 卸载 / 恢复

```bash
cd workbuddy-qq2007-theme
bash scripts/macos/uninstall.sh
```

如果 WorkBuddy 无法启动：

```bash
# 先退出残留进程
pkill -f "WorkBuddy.app/Contents/MacOS/WorkBuddy" 2>/dev/null
bash scripts/macos/uninstall.sh
open -a /Applications/WorkBuddy.app
```

如果仍然异常，用备份恢复 `app.asar`：

```bash
bash scripts/macos/uninstall.sh --restore-asar ~/WorkBuddy/QQ2007ThemeBackups/<时间戳>
```

## 5. 安装器做了什么（可审计）

| 路径 | 操作 |
| --- | --- |
| `app.asar` | **只读**，不修改（除 `--restore-asar` 时从备份恢复） |
| `app.asar.unpacked/renderer/index.html` | 注入主题引用，保持字节数 |
| `app.asar.unpacked/renderer/assets/*` | 复制主题资源 |
| `~/WorkBuddy/QQ2007ThemeBackups/*` | 备份 |
| `~/Library/Application Support/WorkBuddy` | **不访问**（用户数据） |

## 6. 校验安装结果

```bash
# 字节数应与 asar 记录一致
stat -f%z "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/renderer/index.html"

# 应该能看到主题样式引用
grep -o 'qq2008-skin.css' "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/renderer/index.html"
```
