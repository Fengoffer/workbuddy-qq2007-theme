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


if __name__ == "__main__":
    unittest.main()
