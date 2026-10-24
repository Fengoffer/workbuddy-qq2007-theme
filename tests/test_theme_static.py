#!/usr/bin/env python3
"""主题静态回归检查（不执行 WorkBuddy / Electron）。

防止曾经出现过的问题再次写回：
- 用户名回退到作者昵称、账号缓存不刷新；
- 安装 / 卸载脚本用错 WorkBuddy 主进程名；
- 安装完成后启动没有清理 ELECTRON_RUN_AS_NODE；
- macOS 顶部条热区 / 账号名钩子被误删。

运行：python3 -m unittest discover -s tests -v
"""
from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME_JS = ROOT / "theme" / "qq2007-chrome.js"
THEME_CSS = ROOT / "theme" / "qq2007-chrome.css"
INSTALL_SH = ROOT / "scripts" / "macos" / "install.sh"
UNINSTALL_SH = ROOT / "scripts" / "macos" / "uninstall.sh"
COMMON_SH = ROOT / "scripts" / "macos" / "common.sh"
SHELL_DIRS = (ROOT / "scripts",)
DOCS_WITH_LAUNCH = ("AI_INSTALL.md", "docs/INSTALL_MACOS.md", "docs/TROUBLESHOOTING.md", "README.md")


class ThemeStaticTests(unittest.TestCase):
    def setUp(self) -> None:
        self.js = THEME_JS.read_text(encoding="utf-8")
        self.css = THEME_CSS.read_text(encoding="utf-8")

    def test_no_hardcoded_author_nickname(self) -> None:
        self.assertNotIn("小锋", self.js)
        self.assertIn('"WorkBuddy 用户"', self.js)

    def test_account_name_hooks_exist(self) -> None:
        self.assertIn("user-menu-trigger-name", self.js)
        self.assertIn("qq7-account-name", self.js)
        self.assertIn("accountNameCache", self.js)
        self.assertIn("INVALID_ACCOUNT_NAMES", self.js)
        self.assertIn("__genieAccountService", self.js)
        self.assertIn("readServiceAccount", self.js)
        self.assertIn("isLoggedIn", self.js)

    def test_native_tooltip_contrast(self) -> None:
        self.assertIn("body.qq7-shell .cr-tooltip", self.css)
        self.assertIn("background: #ffffe1", self.css)
        # 文字色可能是字面量，也可能被换肤令牌化为 var(--qq7-c-173352, #173352)；
        # 两种形式都锁定同一个色值 0x173352，双向换色都不会影响对比度约束。
        self.assertIn("#173352", self.css)

    def test_friend_panel_categories_and_summon(self) -> None:
        self.assertIn('data-list="expert"', self.js)
        self.assertIn('data-list="skill"', self.js)
        self.assertIn("summonFriendExpert", self.js)
        self.assertIn("prepareInput", self.js)
        self.assertIn("window.wb.experts?.list?.()", self.js)
        self.assertIn("hasHomeDraft", self.js)
        self.assertIn("preserveBlocks", self.js)
        self.assertIn("friendRefreshSeq", self.js)
        self.assertIn("lastFriendSignature", self.js)
        self.assertIn("hasHomeDraft", self.js)
        self.assertIn('tabindex="-1"', self.js)
        self.assertIn("canSummon", self.js)
        self.assertIn("is-keyboard-active", self.js)
        self.assertIn("data-friend-filter", self.js)
        self.assertIn("role=\"listbox\"", self.js)
        self.assertIn("aria-activedescendant", self.js)
        self.assertIn("08-FinanceInvestment", self.js)
        self.assertIn("blockedLabel", self.js)
        self.assertIn("#qq7-root .qq7-friend-row[hidden]", self.css)
        self.assertIn("opacity: 0", self.css)
        self.assertIn("pointer-events: none", self.css)
        self.assertIn("cr-tooltip--placement-bottom", self.css)

    def test_notify_sound_url_declared_before_use(self) -> None:
        """installNotificationSound 里 QQ_SOUND_URL 必须先声明后使用。

        曾经的 bug：const QQ_SOUND_URL 声明在 new Audio(QQ_SOUND_URL) 之后，
        TDZ ReferenceError 被 try/catch 吞掉，qqNotify 恒为 null，
        整个通知音替换功能自 v1.0.0 起静默失效。
        """
        start = self.js.index("function installNotificationSound")
        end = self.js.index("function start()", start)
        body = self.js[start:end]
        # 用真实代码语句定位首次使用（注释里也会出现该标识符，不能算使用）
        first_use = body.index("qqNotify = new Audio(QQ_SOUND_URL)")
        first_decl = body.index("const QQ_SOUND_URL")
        self.assertLess(
            first_decl,
            first_use,
            msg="QQ_SOUND_URL 声明必须在首次使用之前（TDZ），否则通知音替换静默失效",
        )
        self.assertIn("qqNotify = new Audio(QQ_SOUND_URL)", body)

    def test_summon_success_path_resets_button(self) -> None:
        """召唤成功路径必须复位按钮，不能只依赖 refreshFriendData。"""
        self.assertIn("resetSummonButton", self.js)
        start = self.js.index("async function summonFriendExpert")
        end = self.js.index("function friendPanelHtml", start)
        body = self.js[start:end]
        prepare = body.index("prepareInput(payload)")
        self.assertIn("resetSummonButton(button, original", body[prepare:])

    def test_account_name_escaped_in_innerhtml(self) -> None:
        """账号名进入 innerHTML 前必须转义，防止昵称含 HTML 造成注入。"""
        self.assertIn("${escapeHtml(name)}", self.js)
        self.assertIn("${escapeHtml(displayName())}", self.js)
        self.assertNotIn("${name}</b>", self.js)
        self.assertNotIn("${displayName()}</b>", self.js)

    def test_friend_render_cap_consistent(self) -> None:
        """渲染截断后行数口径必须明确：rendered=实际渲染数（键盘/筛选用），total=数据源总数。"""
        self.assertIn("FRIEND_RENDER_CAP", self.js)
        self.assertIn("list.dataset.rendered", self.js)
        self.assertIn("list.dataset.total", self.js)
        self.assertIn("friendCountText(visible.length, rendered, total)", self.js)
        self.assertNotIn("items.slice(0, 200)", self.js)

    def test_keyboard_rows_use_hidden_flag(self) -> None:
        """键盘导航与筛选同口径：用 row.hidden 而不是 offsetParent。"""
        self.assertNotIn("row.offsetParent", self.js)

    def test_notify_volume_follows_shared_config(self) -> None:
        """替换通知音的音量/开关与 qq2008-notify.js 共用同一 localStorage 配置。"""
        self.assertIn("WORKBUDDY_QQ2008_TASK_SOUND_VOLUME", self.js)
        self.assertIn("WORKBUDDY_QQ2008_SKIN_ENABLED", self.js)

    def test_notification_wrapper_keeps_statics(self) -> None:
        """Notification 包装必须保留静态属性，否则 requestPermission() 直接 TypeError。"""
        self.assertIn("WrappedNotification.requestPermission = NativeNotification.requestPermission", self.js)
        self.assertIn('"permission", "maxActions"', self.js)

    def test_notify_replay_respects_config(self) -> None:
        """replay 走 playQQ(true)：跳过去重但尊重音量/开关配置。"""
        self.assertIn("{ replay: () => playQQ(true) }", self.js)

    def test_skin_off_cleans_runtime_classes(self) -> None:
        """皮肤关闭时清理宠物运行态 class 和举牌，避免视觉残留。"""
        start = self.js.index("function syncSkin")
        body = self.js[start : start + 1200]
        self.assertIn("qq7-pet-loading", body)
        self.assertIn("qq7-pet-has-options", body)
        self.assertIn('dataset.show = "0"', body)

    def test_friend_signature_covers_guard_fields(self) -> None:
        """列表签名必须包含 canSummon/blockedLabel，否则 guard 迟到时 UI 不同步。"""
        self.assertIn("e.canSummon ? 1 : 0", self.js)
        self.assertIn("e.blockedLabel", self.js)

    def test_enter_key_always_stops_propagation(self) -> None:
        """列表 Enter 无论行是否可召唤都要阻止冒泡，避免触发 App 全局快捷键。"""
        start = self.js.index('event.key === "Enter"')
        zone = self.js[start : self.js.index('event.key === "Escape"', start)]
        self.assertLess(zone.index("preventDefault"), zone.index("if (summon)"))
        self.assertIn("stopPropagation", zone)

    def test_friend_panel_dynamic_data_hooks(self) -> None:
        self.assertIn("refreshFriendData", self.js)
        self.assertIn("qq7-friend-list", self.js)
        self.assertIn("qq7-friend-list", self.css)
        self.assertIn("448px 32px", self.css)

    def test_friend_panel_collapse_selector_scoped(self) -> None:
        self.assertRegex(
            self.css,
            r"body\.qq7-friend-collapsed\s+#qq7-root\s+\.qq7-friend-head\s+\.qq7-friend-tab",
        )

    def test_friend_collapse_keyboard_and_labels(self) -> None:
        self.assertIn('setAttribute("role", "button")', self.js)
        self.assertIn('setAttribute("tabindex", "0")', self.js)
        self.assertIn('setAttribute("aria-controls", "qq7-friend-panel")', self.js)
        self.assertIn('"aria-expanded"', self.js)
        self.assertIn('"展开好友面板"', self.js)
        self.assertIn("#qq7-root .qq7-friend-collapse:focus-visible", self.css)
        self.assertIn('localStorage.getItem("qq7-friend-collapsed")', self.js)
        self.assertIn('localStorage.setItem("qq7-friend-collapsed"', self.js)

    def test_macos_titlebar_zone_exists(self) -> None:
        self.assertIn("qq7-titlebar-jszone", self.js)
        self.assertIn("qq7-titlebar-jszone", self.css)
        self.assertIn("--qq7-native-titlebar", self.css)

    def test_installers_detect_workbuddy_electron_process(self) -> None:
        common = COMMON_SH.read_text(encoding="utf-8")
        self.assertIn("Contents/MacOS/Electron", common)
        self.assertIn("Contents/MacOS/WorkBuddy", common)
        self.assertIn("Contents/Frameworks/WorkBuddy Helper", common)
        for path in (INSTALL_SH, UNINSTALL_SH):
            text = path.read_text(encoding="utf-8")
            self.assertIn("workbuddy_is_running", text, msg=str(path))

    def test_installer_launch_clears_node_mode(self) -> None:
        install = INSTALL_SH.read_text(encoding="utf-8")
        self.assertIn("env -u ELECTRON_RUN_AS_NODE", install)

    def test_account_logout_hook_exists(self) -> None:
        self.assertIn("accountMenuShowsLoggedOut", self.js)
        self.assertIn("user-menu-trigger--workbuddy", self.js)
        self.assertIn('querySelectorAll(".user-menu-trigger")', self.js)
        self.assertIn("getClientRects", self.js)
        self.assertIn("const visible = triggers.filter", self.js)

    def test_shell_variables_not_followed_by_multibyte(self) -> None:
        bad = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*(?=[^\x00-\x7f])")
        for directory in SHELL_DIRS:
            for path in sorted(directory.rglob("*.sh")):
                text = path.read_text(encoding="utf-8")
                self.assertIsNone(bad.search(text), msg=f"{path} 中变量紧邻非 ASCII 字符，请写成 ${{VAR}}")

    def test_gitee_release_script_has_target_commitish(self) -> None:
        script = (ROOT / "scripts" / "maintenance" / "create-gitee-release.sh").read_text(encoding="utf-8")
        self.assertIn("target_commitish", script)

    def test_docs_use_electron_process_and_guarded_launch(self) -> None:
        for rel in DOCS_WITH_LAUNCH:
            text = (ROOT / rel).read_text(encoding="utf-8")
            self.assertIn("env -u ELECTRON_RUN_AS_NODE", text, msg=rel)
            if rel != "README.md":
                self.assertIn("Contents/MacOS/Electron", text, msg=rel)


    # ------------------------------------------------------------------
    # QQ 2007 换肤（颜色编辑）回归
    # ------------------------------------------------------------------
    # 色相来自 QQ2007 正式版 QQ.exe 逆向：.rdata 常量表 55/127/202/274/346，
    # 210 为皮肤自身默认（天际蓝）。菜单文字来自 QQRes.dll 字符串表。
    EXPECTED_HUES = {
        "贵族紫": 274,
        "水晶蓝": 202,
        "天际蓝": 210,
        "苹果绿": 127,
        "沙漠黄": 55,
        "玫瑰红": 346,
    }

    def test_color_menu_presets_match_reversed_binary(self) -> None:
        """六种预设色相必须与 QQ2007 正式版逆向表一致。"""
        for label, hue in self.EXPECTED_HUES.items():
            self.assertIn(label, self.js, msg=f"缺少 QQ2007 原版配色项：{label}")
            self.assertRegex(
                self.js,
                rf'label:\s*"{re.escape(label)}",\s*hue:\s*(?:{hue}|HUE_BASE)\b',
                msg=f"{label} 的色相必须为 {hue}",
            )

    def test_color_menu_labels_are_original_wording(self) -> None:
        """菜单文字必须沿用 QQ2007 原版：颜色恢复 / 自定义。"""
        match = re.search(r"const COLOR_ITEMS = \[(.*?)\];", self.js, re.S)
        self.assertIsNotNone(match, msg="找不到 COLOR_ITEMS 配色表")
        block = match.group(1)
        self.assertIn('"颜色恢复"', block, msg="缺少原版「颜色恢复」项")
        self.assertIn('data-color="custom"', self.js, msg="缺少原版「自定义」取色入口")
        self.assertIn("<span>自定义</span>", self.js, msg="「自定义」必须是菜单项文案")
        self.assertIn("自定义", self.js, msg="缺少原版「自定义」文案")

    def test_skin_tokens_have_original_hex_fallback(self) -> None:
        """每个换肤令牌都必须带原始色值回退，引擎失效时界面与改造前一致。"""
        css_all = self.css + (ROOT / "theme" / "qq2008-skin.css").read_text(encoding="utf-8")
        css_all += (ROOT / "theme" / "qq2008-583-adapter.css").read_text(encoding="utf-8")
        tokens = re.findall(r"var\(--qq7-c-([0-9A-F]{6}), (#[0-9a-fA-F]{6})\)", css_all)
        self.assertGreater(len(tokens), 300, msg="皮肤色值令牌数量异常，换肤覆盖面不足")
        for name, fallback in tokens:
            self.assertEqual(
                "#" + name.lower(),
                fallback.lower(),
                msg=f"令牌 --qq7-c-{name} 的回退色必须等于令牌名",
            )

    def test_skin_tokens_in_js_cover_every_css_token(self) -> None:
        """JS 里的令牌表必须覆盖三张样式表出现的全部令牌，否则换色会漏色。"""
        css_all = self.css + (ROOT / "theme" / "qq2008-skin.css").read_text(encoding="utf-8")
        css_all += (ROOT / "theme" / "qq2008-583-adapter.css").read_text(encoding="utf-8")
        css_tokens = set(re.findall(r"var\(--qq7-c-([0-9A-F]{6}),", css_all))
        match = re.search(r"const SKIN_TOKENS = \[(.*?)\];", self.js, re.S)
        self.assertIsNotNone(match, msg="找不到 SKIN_TOKENS 令牌表")
        js_tokens = set(re.findall(r'"([0-9A-F]{6})"', match.group(1)))
        missing = css_tokens - js_tokens
        self.assertFalse(missing, msg=f"以下令牌未纳入换色表：{sorted(missing)[:10]}")

    def test_theme_settings_persist_and_reset(self) -> None:
        """配色写 localStorage；「颜色恢复」必须删除自选色。"""
        self.assertIn("WORKBUDDY_QQ7_SKIN_HUE", self.js)
        self.assertIn("WORKBUDDY_QQ7_SKIN_LIGHT", self.js)
        self.assertIn("removeItem(HUE_KEY)", self.js)
        self.assertIn("removeItem(LIGHT_KEY)", self.js)

    def test_color_button_hidden_when_skin_off(self) -> None:
        """皮肤关闭时配色令牌必须清空，原生界面不能被自选颜色污染。"""
        self.assertIn("if (!on) themeStyleEl.textContent = \"\"", self.js)
        self.assertIn("else if (themeStyleEl.textContent === \"\") applyTheme()", self.js)
        self.assertIn("body.qq7-off #qq7-root .qq7-colormenu { display: none !important; }", self.css)

    def test_theme_style_element_declared_before_sync_skin(self) -> None:
        """themeStyleEl 必须在 syncSkin 之前声明，否则触发 TDZ（同通知音事故）。"""
        decl = self.js.index("let themeStyleEl")
        first_sync_use = self.js.index("themeStyleEl.textContent")
        self.assertLess(decl, first_sync_use, msg="themeStyleEl 声明必须在首次使用之前")

    def test_cancel_restores_saved_theme(self) -> None:
        """自定义取色点「取消」必须退回已保存配色，不能留下未确认的预览。"""
        start = self.js.index('action.dataset.picker === "cancel"')
        end = self.js.index('action.dataset.picker === "ok"', start)
        self.assertIn("applyTheme()", self.js[start:end])

    def test_color_button_is_not_drag_region(self) -> None:
        """「+」按钮必须排除在拖拽 / 双击热区之外，否则点不动。"""
        self.assertIn(".qq7-colorbtn", self.js)
        self.assertIn('class="qq7-colorbtn"', self.js)
        self.assertIn("aria-haspopup=\"menu\"", self.js)


    # ------------------------------------------------------------------
    # 换肤菜单无障碍回归（与好友列表同一套键盘规范）
    # ------------------------------------------------------------------
    def test_color_button_keyboard_reachable(self) -> None:
        """「+」按钮必须能被 Tab 聚焦并用键盘打开，否则键盘用户完全用不了换肤。"""
        self.assertRegex(
            self.js,
            r'class="qq7-colorbtn"[^>]*tabindex="0"',
            msg="颜色按钮必须 tabindex=\"0\"，不能用 -1 把键盘用户挡在外面",
        )
        start = self.js.index("colorBtnEl.addEventListener(\"keydown\"")
        body = self.js[start : start + 500]
        for key in ("Enter", " ", "ArrowDown"):
            self.assertIn(f'"{key}"', body, msg=f"按钮键盘事件缺少 {key}")

    def test_color_menu_roving_tabindex(self) -> None:
        """菜单项用 roving tabindex：只有一项可 Tab，避免 Tab 穿透整屏。"""
        self.assertIn('role="menuitem" tabindex="-1"', self.js)
        # 打开时再置 0
        start = self.js.index("function openColorMenu")
        body = self.js[start : start + 900]
        self.assertIn("tabIndex = item === active ? 0 : -1", body)

    def test_color_menu_arrow_navigation(self) -> None:
        """方向键 / Home / End / Enter 都不能少，且 Escape 要归还焦点给按钮。"""
        start = self.js.index('case "ArrowDown":')
        body = self.js[start : start + 1200]
        for token in ("ArrowUp", "Home", "End", "Enter"):
            self.assertIn(token, body, msg=f"菜单键盘导航缺少 {token}")
        # 必须定位到颜色菜单自己的 Escape 处理（文件里还有好友列表的 Escape）
        menu_start = self.js.index('if (event.key === "Escape") {\n        event.preventDefault();\n        closeColorMenu();')
        esc = self.js[menu_start : menu_start + 300]
        self.assertIn("colorBtnEl.focus()", esc, msg="Escape 后必须把焦点还给按钮")

    def test_color_menu_has_visible_focus_style(self) -> None:
        """键盘焦点必须有可见样式，不能 outline: none。"""
        self.assertIn("#qq7-root .qq7-colorbtn:focus-visible", self.css)
        self.assertIn("#qq7-root .qq7-colormenu-item.is-current:focus-visible", self.css)
        # 不能在没有替代 outline 的情况下直接关掉焦点框
        start = self.css.index("#qq7-root .qq7-colormenu-item:focus-visible")
        block = self.css[start : start + 300]
        self.assertNotIn("outline: none", block)


if __name__ == "__main__":
    unittest.main()
