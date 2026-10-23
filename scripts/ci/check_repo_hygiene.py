#!/usr/bin/env python3
"""仓库卫生检查（CI 与本地都可运行）。

检查项：
1. 必需文件存在（README / 安装脚本 / 主题资源 / 文档）；
2. 单个跟踪文件与仓库总体积上限（防止把大 wasm、视频之类误提交）；
3. 不跟踪垃圾文件（.DS_Store、*.log、*.qq7tmp 等）；
4. 文本文件中没有明显的凭据 / 私钥；
5. 主题版本号一致：CHANGELOG 最新版本 == 安装器 metadata 的 themeVersion；
6. 主题资源与安装器复制清单互相对齐（新增资源不会漏装）。

用法：
    python3 scripts/ci/check_repo_hygiene.py
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

MAX_FILE_BYTES = 20 * 1024 * 1024  # 单个文件 20 MiB（Ruffle wasm 约 14 MiB）
MAX_TOTAL_BYTES = 100 * 1024 * 1024  # 跟踪文件总计 100 MiB
MAX_SCAN_BYTES = 1024 * 1024  # 只对 1 MiB 以内的文本做凭据扫描

REQUIRED_PATHS = (
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
    "AI_INSTALL.md",
    "THIRD_PARTY_NOTICES.md",
    "theme/qq2008-skin.css",
    "theme/qq2008-583-adapter.css",
    "theme/qq2007-chrome.css",
    "theme/qq2007-chrome.js",
    "theme/qq2008-notify.js",
    "theme/qq7pet/ruffle.js",
    "scripts/common/patch_index.py",
    "scripts/common/asar_index_size.py",
    "scripts/macos/common.sh",
    "scripts/macos/install.sh",
    "scripts/macos/uninstall.sh",
    "scripts/windows/install.ps1",
    "scripts/windows/uninstall.ps1",
    "docs/SAFETY.md",
    "docs/TROUBLESHOOTING.md",
    "docs/INSTALL_MACOS.md",
    "docs/INSTALL_WINDOWS.md",
    "docs/MAINTAINING.md",
    "docs/COMPATIBILITY.md",
)

INSTALLERS = ("scripts/macos/install.sh", "scripts/windows/install.ps1")

JUNK_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
JUNK_SUFFIXES = (".log", ".tmp", ".qq7tmp", ".swp")

TEXT_SUFFIXES = {
    ".md",
    ".sh",
    ".ps1",
    ".py",
    ".js",
    ".css",
    ".html",
    ".yml",
    ".yaml",
    ".json",
    ".txt",
}

SECRET_PATTERNS = (
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "私钥"),
    (r"\bghp_[A-Za-z0-9]{36}\b", "GitHub personal access token"),
    (r"\bgithub_pat_[A-Za-z0-9_]{20,}\b", "GitHub fine-grained token"),
    (r"\bAKIA[0-9A-Z]{16}\b", "AWS access key"),
)

# 安装器里出现的主题资源名，例如 qq2007-chrome.css
THEME_REF_RE = re.compile(r"\b(qq[0-9A-Za-z_.-]+\.(?:css|js|png|wav))\b")


def tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [p for p in result.stdout.decode("utf-8", "replace").split("\0") if p]


def main() -> int:
    errors: list[str] = []

    files = tracked_files()

    # 1. 必需文件
    for rel in REQUIRED_PATHS:
        if not (ROOT / rel).is_file():
            errors.append(f"缺少必需文件：{rel}")

    # 2. 体积
    total = 0
    sizes: list[tuple[int, str]] = []
    for rel in files:
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"跟踪了不存在的文件：{rel}")
            continue
        size = path.stat().st_size
        total += size
        sizes.append((size, rel))
        if size > MAX_FILE_BYTES:
            errors.append(
                f"文件过大：{rel}（{size / 1024 / 1024:.1f} MiB > {MAX_FILE_BYTES / 1024 / 1024:.0f} MiB）"
            )
    if total > MAX_TOTAL_BYTES:
        errors.append(
            f"仓库跟踪文件总计 {total / 1024 / 1024:.1f} MiB，超过 {MAX_TOTAL_BYTES / 1024 / 1024:.0f} MiB 上限"
        )

    # 3. 垃圾文件
    for rel in files:
        name = Path(rel).name
        if name in JUNK_NAMES or name.endswith(JUNK_SUFFIXES):
            errors.append(f"不该跟踪的临时文件：{rel}")

    # 4. 凭据扫描
    for rel in files:
        path = ROOT / rel
        if path.suffix.lower() not in TEXT_SUFFIXES or not path.is_file():
            continue
        if path.stat().st_size > MAX_SCAN_BYTES:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern, label in SECRET_PATTERNS:
            if re.search(pattern, text):
                errors.append(f"{rel} 疑似包含{label}")

    # 5. 版本一致性
    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    version_match = re.search(r"^##\s+(\d+\.\d+\.\d+)", changelog, re.MULTILINE)
    latest_version = version_match.group(1) if version_match else None
    # 版本标题必须严格是 `## X.Y.Z (YYYY-MM-DD)`，防止 1.0.5 (date) (date) 这类笔误
    for heading in re.finditer(r"^##\s+(\d+\.\d+\.\d+)(.*)$", changelog, re.MULTILINE):
        if not re.fullmatch(r" \(\d{4}-\d{2}-\d{2}\)", heading.group(2).rstrip()):
            line = changelog[: heading.start()].count("\n") + 1
            errors.append(
                f"CHANGELOG.md 第 {line} 行版本标题格式应为 `## X.Y.Z (YYYY-MM-DD)`：{heading.group(0).strip()}"
            )
    if latest_version is None:
        errors.append("CHANGELOG.md 中找不到形如 `## 1.2.3` 的最新版本标题")
    else:
        for rel in INSTALLERS:
            text = (ROOT / rel).read_text(encoding="utf-8")
            match = re.search(r'themeVersion"?\s*[:=]\s*"([0-9]+\.[0-9]+\.[0-9]+)"', text)
            if not match:
                errors.append(f"{rel} 中找不到 themeVersion 版本号")
            elif match.group(1) != latest_version:
                errors.append(
                    f"版本不一致：{rel} 的 themeVersion={match.group(1)}，CHANGELOG 最新版本={latest_version}"
                )

    # 6. 主题资源与安装器复制清单对齐
    theme_dir = ROOT / "theme"
    theme_assets = sorted(p.name for p in theme_dir.iterdir() if p.is_file())
    installer_text = {rel: (ROOT / rel).read_text(encoding="utf-8") for rel in INSTALLERS}
    for name in theme_assets:
        for rel, text in installer_text.items():
            if name not in text:
                errors.append(f"安装器 {rel} 没有复制主题资源：theme/{name}")
    for rel, text in installer_text.items():
        for name in sorted(set(THEME_REF_RE.findall(text))):
            if not (theme_dir / name).is_file():
                errors.append(f"安装器 {rel} 引用了不存在的资源：theme/{name}")
    swf_files = list((theme_dir / "qq7pet").glob("*.swf"))
    if not swf_files:
        errors.append("theme/qq7pet 下没有任何宠物动作 SWF")
    if not (theme_dir / "qq7pet" / "ruffle.js").is_file():
        errors.append("缺少 theme/qq7pet/ruffle.js")
    if not list((theme_dir / "qq7pet").glob("core.ruffle.*.js")):
        errors.append("缺少 Ruffle 的 core.ruffle.*.js（wasm 加载器）")

    # 汇总
    sizes.sort(reverse=True)
    print(f"跟踪文件：{len(files)} 个，总计 {total / 1024 / 1024:.1f} MiB")
    print("最大的 5 个文件：")
    for size, rel in sizes[:5]:
        print(f"  {size / 1024 / 1024:6.2f} MiB  {rel}")

    if errors:
        print("\n发现 %d 个问题：" % len(errors))
        for message in errors:
            print(f"  ❌ {message}")
        return 1

    print("\n✅ 仓库卫生检查通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
