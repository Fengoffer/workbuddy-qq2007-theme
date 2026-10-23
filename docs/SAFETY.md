# 安全与回滚

## 为什么需要字节数对齐

WorkBuddy 的 `renderer/index.html` 在 `app.asar` 头部被标记为 `unpacked: true`，但 Electron 读取外部 `index.html` 时仍按头部记录的 `size` 截断。

如果直接往 `index.html` 末尾追加内容，文件变大，末尾的 `<div id="root"></div>` 会被截掉，React 无法挂载，表现为：

- 白屏；
- 控制台 React error #299；
- WorkBuddy 启动后立即崩溃。

因此安装器会：

1. 从 `app.asar` 读取 `renderer/index.html.size`；
2. 注入主题 `link/script`；
3. 用 HTML 注释填充/压缩，让文件字节数 **精确等于** 记录值；
4. 校验失败自动回滚。

## 安装器不会做什么

- 不修改 `app.asar`（除非你显式 `--restore-asar` 从备份恢复）；
- 不访问 `~/Library/Application Support/WorkBuddy`、`%APPDATA%\WorkBuddy`；
- 不读取、上传任何会话/账号/文件数据；
- 不删除用户文件；
- 不在后台常驻进程。

## 备份

| 平台 | 位置 |
| --- | --- |
| macOS | `~/WorkBuddy/QQ2007ThemeBackups/<时间戳>/` |
| Windows | `%USERPROFILE%\WorkBuddy\QQ2007ThemeBackups\<时间戳>\` |

内容：

```text
app.asar        # 完整备份
index.html      # 安装前版本
metadata.json   # App 路径、版本、index 目标大小、SHA256
SHA256.txt
ROLLBACK.md     # 回滚说明
```

## 回滚决策树

1. **只是不想要主题了** → 运行 `uninstall`；
2. **WorkBuddy 打不开** → 退出进程 → 运行 `uninstall` → 打开；
3. **uninstall 后仍打不开** → 用 `--restore-asar <备份目录>` 恢复整个 app.asar；
4. **仍失败** → 重新安装官方 WorkBuddy（用户数据在 `Application Support`，卸载 App 不会删除）；
5. 全程不要删除 `~/WorkBuddy/QQ2007ThemeBackups`。

## 手动回滚（应急）

如果脚本都不可用，可以手工编辑 `app.asar.unpacked/renderer/index.html`：

- 删除 `<link ... qq2008-skin.css>` 和 `<script ... qq2008-notify.js>` 两行；
- 保证文件仍是 `asar` 记录的字节数（用注释空格补齐）；
- 确认 `<div id="root"></div>` 存在。

但更推荐直接复制备份目录里的 `index.html` 覆盖回去。

## 数据安全承诺

本主题不包含遥测、不上传数据、不修改账号设置。唯一副作用是 WorkBuddy 的界面外观和通知音。若你发现任何异常，请先回滚并保留备份目录，再提 Issue。
