# Changelog

## Unreleased

### 修复
- 修复状态栏与好友面板用户名写死、不跟随登录账号的问题：改为从 WorkBuddy 用户菜单实时读取，账号异步加载完成后 1.5s 内自动同步到状态栏 / 好友列表 / 环境信息；未登录或读取失败时显示「WorkBuddy 用户」
- 修复安装主题后顶部标题栏无法拖动窗口、双击不能缩放的问题：主题把 `.teams-container` 下移到 94px 后，原版 `.workbuddy-topbar` 的 `-webkit-app-region: drag` 拖拽区已不在窗口顶部；现由 `.qq7-titlebar` 接管拖拽区
- macOS 顶部条拆分：标题栏顶部约 38px 保留系统原生拖拽与双击缩放（最顺滑）；标题栏下沿热区与菜单栏由主题接管（第二次按下即触发缩放、拖动超过 4px 才 `startDrag`、最大化时先还原再拖），整条顶部条都能拖动和双击，菜单项保持点击
- 窗口缩放时把 resize / ResizeObserver 触发的布局同步合并到下一帧执行，减少放大缩小卡顿

### 维护工程
- 新增 GitHub Actions CI：Python 单元测试、ShellCheck、PowerShell 语法、JavaScript 语法、仓库卫生与版本一致性检查
- 新增 `tests/test_patch_index.py`：覆盖注入、清理、字节数对齐、幂等性与 asar 头部读取
- 新增 `.github` Issue / PR 模板与 Release 自动分类规则
- 新增 [docs/MAINTAINING.md](docs/MAINTAINING.md) 维护手册、[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) 兼容性矩阵
- 新增 `scripts/maintenance/`：`verify-install.sh` 只读校验注入状态、`sync-remotes.sh` 同步 GitHub / Gitee、`create-gitee-release.sh` 通过 OpenAPI 创建 Gitee 发行版
- 新增 `.editorconfig` 与 `.gitattributes`，统一编码与换行符
- README 增加 CI 徽章与维护 / 兼容性入口

## 1.0.0 (2026-10-23)

首个开源版本。

### 主题外壳
- QQ 2007 / XP Luna 蓝色标题栏（macOS 红绿灯垂直居中）
- QQ 2007 菜单栏、右侧好友面板、底部状态栏、窗口描边
- 可拖拽会话列表分栏、侧栏折叠让位
- 设置 / 文件查看 / 浏览器等次级窗口恢复原生
- 主窗口右侧面板打开时好友栏自动收起

### 聊天界面
- QQ 2007 白色凹陷会话面板、气泡、输入框、发送键
- 标题与会话列表使用 PingFang SC 中等字重，修复粗体发虚
- 原版交互（流式输出、停止、复制、重新生成、附件）保持可用

### 经典元素
- 373 条经典 QQ 签名随机轮播，点击切换
- WorkBuddy 通知音替换为经典 QQ 滴滴声（多播放路径拦截、去重、原生静音）

### QQ 宠物
- 基于 Ruffle + `xuemian168/qqpet_automation` 的真实 QQ 宠物 SWF
- 19 个动作：待机 3 / 玩耍 7 / 点击互动 7 / 说话 2
- 点击弹跳 + 爱心、输入踮脚、会话切换跑动、选项举牌
- 离屏预热、隐藏时暂停、动作 GIF 文档

### 安装与安全
- macOS 安装 / 卸载脚本（字节数严格对齐、备份、失败回滚）
- Windows 实验性 PowerShell 安装 / 卸载脚本（仅支持 unpacked renderer）
- AI 一键安装约定、完整安装文档、排错文档、第三方声明
