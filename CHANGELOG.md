# Changelog

## 1.2.0 (2026-10-23)

### 新增
- 右侧「专家」组接入完整专家目录（`experts.list()`），与最近使用 / 自定义 / 云同步专家合并去重，当前本机 101 位

### 修复
- 专家召唤保留当前草稿：输入框非空时只切换专家，不再用默认提示词覆盖用户输入
- 召唤按钮可被 Tab 聚焦（悬停 / 聚焦时显示），触屏设备常驻显示
- 好友列表刷新增加请求序号，避免慢请求覆盖新结果
- tooltip 箭头按 top / bottom / left / right placement 分别着色
- 宠物再上移，首页 / 会话页与输入框保持 12px+ 间隙

### 维护工程
- 静态测试补充完整目录、草稿保留、刷新序号、键盘可达性和 tooltip placement 断言
- README / 兼容性文档更新专家目录与召唤行为说明

## 1.1.1 (2026-10-23)

### 修复
- 修复 WorkBuddy 原生 tooltip 背景透明、文字近白导致看清的问题：改为浅黄底、深蓝字、1px 边框，tooltip 箭头同步

## 1.1.0 (2026-10-23)

### 新增
- 右侧好友列表改为「专家」「技能」两组：专家组显示最近使用、自定义 / 云同步专家；技能组只显示已安装技能
- 专家行悬停显示「召唤」按钮，点击调用 WorkBuddy 原生专家召唤（`experts.summon` + `conversations.prepareInput`），回到新任务并自动带入该专家与默认提示词

### 修复
- QQ 宠物上移，避免遮挡新任务输入框内容与底部工具栏
- 输入框底部工具栏高度由 57px 降到 45px，收紧留白
- 移除输入区强制 `z-index`，避免压住 WorkBuddy 原生 tooltip

### 维护工程
- 静态测试补充专家 / 技能分组和召唤入口断言

## 1.0.9 (2026-10-23)

### 新增
- 右侧好友列表改为 WorkBuddy 专家 / 已安装技能：在线显示最近使用的专家，离线显示其余已安装技能与自定义 / 云同步专家
- 标题栏像素企鹅图标由 20px 放大到 32px，并使用 pixelated 渲染保持清晰

### 说明
- WorkBuddy 目前没有暴露精确的专家 / 技能 `lastUsedAt`，在线列表暂以「最近使用」专家为准；后续可增加本地使用时间记录
- 好友列表每 30 秒刷新，启动后前几秒会补刷新，等待 App 的专家 / 技能服务就绪

### 维护工程
- 静态测试补充好友列表数据渲染与图标尺寸断言
- README / 兼容性文档补充好友列表来源与在线口径说明

## 1.0.8 (2026-10-23)

### 修复
- 好友面板折叠箭头补充 `aria-controls` 与 `:focus-visible` 焦点样式
- 折叠状态持久化到 `localStorage`，重启 / 刷新后保持上次收起 / 展开状态

### 维护工程
- MAINTAINING 记录 CHANGELOG 版本标题格式要求
- 静态测试补充 `aria-controls`、焦点样式与持久化断言

## 1.0.7 (2026-10-23)

### 修复
- 好友面板折叠箭头补 `title` / `aria-label` / `aria-expanded`，收起后提示改为「展开好友面板」，并支持 Enter / Space 键盘切换
- 修正 CHANGELOG 多个版本标题日期重复的问题

### 维护工程
- 仓库卫生检查新增 CHANGELOG 版本标题格式校验（`## X.Y.Z (YYYY-MM-DD)`）
- 好友面板折叠静态测试改为宽松正则，并补充键盘 / aria 断言

## 1.0.6 (2026-10-23)

### 修复
- 修复右侧好友面板收起后无法展开、必须重启 WorkBuddy 的问题：折叠样式缺少 `#qq7-root` 作用域，被基础 tab 的 id 选择器覆盖，隐藏的 tab 仍占位把折叠箭头挤出窗口；现在收起后只显示可点击的展开箭头

### 维护工程
- 静态测试锁定好友面板折叠选择器作用域

## 1.0.5 (2026-10-23)

### 修复
- 账号名优先从 WorkBuddy 账号服务读取，侧栏收起 / 冷启动时也能显示当前账号，不再只能显示「WorkBuddy 用户」；账号服务不可用时回退用户菜单 DOM
- 订阅账号服务变化，登录 / 切换 / 退出后即时刷新

### 文档
- README 与兼容性已知限制更新账号名来源说明

### 维护工程
- 静态测试补充账号服务读取与登出方法断言

## 1.0.4 (2026-10-23)

### 修复
- 登出判断改为优先看可见 trigger：可见节点中没有登录态、且是头像式登录按钮时才判登出；避免隐藏的旧登录态 node 掩盖真实登出（与 v1.0.3 的隐藏旧登录按钮问题对称）

### 维护工程
- 静态测试补充“可见 trigger 优先”断言

## 1.0.3 (2026-10-23)

### 修复
- 登出判断更稳健：只要存在任意登录态 `.user-menu-trigger--workbuddy` 就不判登出，并优先使用可见 trigger，避免隐藏的旧登录节点误清账号缓存

### 文档
- 安装 / 排障文档的 `pkill` 兜底命令补 `|| true`，避免严格 shell 下因无匹配中断
- 兼容性已知限制补充：账号名读取依赖 WorkBuddy 用户菜单 DOM

### 维护工程
- 静态测试补充登出判断的登录态 / 可见节点断言

## 1.0.2 (2026-10-23)

### 修复
- 明确退出登录（用户菜单只剩头像按钮）时清空账号缓存并显示「WorkBuddy 用户」，覆盖“登录过期”之外的登出路径

### 文档
- 安装 / 排障 / AI 安装文档中的进程名改为 WorkBuddy 5.8.3 实际的 `Contents/MacOS/Electron`，启动命令补 `env -u ELECTRON_RUN_AS_NODE`
- README、INSTALL_MACOS、TROUBLESHOOTING 中的启动命令同步加环境清理

### 维护工程
- 修复维护脚本中变量紧邻中文标点时的 unbound variable 问题（`verify-install.sh` / `sync-remotes.sh` / `create-gitee-release.sh`）
- Gitee 发行版脚本补充 `target_commitish`（默认取 tag 对应 commit），token 临时文件提前注册清理 trap
- 静态回归检查新增：中文标点变量、`target_commitish`、文档进程名与启动命令、退出登录账号钩子

## 1.0.1 (2026-10-23)

### 修复
- 状态栏 / 好友列表 / 环境信息里的用户名改为实时读取 WorkBuddy 登录账号：账号异步加载完成后自动同步；登录过期或退出登录时清空旧缓存并显示「WorkBuddy 用户」，不再写死作者昵称
- 账号名读取优先选择可见节点，避免隐藏的旧菜单导致显示上一个账号
- macOS 顶部条拆分：标题栏顶部约 38px 保留系统原生拖拽与双击缩放（最顺滑）；标题栏下沿热区与菜单栏由主题接管，整条顶部条都能拖动和双击，菜单项保持点击
- 拖动超过 4px 才真正开始；窗口最大化时先还原并轮询到非最大化后再拖，避免慢机器上拖动失效
- 双击缩放改为第二次按下立即触发，并按手势去重，避免卡顿时双触发
- 窗口缩放时把 resize / ResizeObserver 触发的布局同步合并到下一帧，减少放大缩小卡顿

### 安装与安全
- 修正 macOS 安装 / 卸载脚本对 WorkBuddy 5.8.3 主进程名（`Contents/MacOS/Electron`）的检测：卸载前会真正退出 App，退出失败会中止而不是继续修改
- 安装完成后启动 App 时清理 `ELECTRON_RUN_AS_NODE`，避免从 Electron 型 Agent / 终端环境启动失败
- Gitee Release 脚本不再把 token 放进 curl 进程参数

### 维护工程
- 新增 GitHub Actions CI：Python 单元测试、ShellCheck、PowerShell 语法、JavaScript 语法、仓库卫生与版本一致性检查
- 新增 `tests/test_patch_index.py` 与 `tests/test_theme_static.py`：覆盖注入 / 字节对齐 / 幂等性，以及作者昵称、进程名、热区等静态回归
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
