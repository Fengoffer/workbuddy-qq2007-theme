#!/usr/bin/env python3
"""注入/清理工具的单元测试。

覆盖 scripts/common/patch_index.py 的注入、清理、字节数对齐与幂等性，
以及 scripts/common/asar_index_size.py 的 asar 头部读取逻辑。

运行：
    python3 -m unittest discover -s tests -v
"""
from __future__ import annotations

import importlib.util
import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMMON = ROOT / "scripts" / "common"


def _load(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, COMMON / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


patch_index = _load("patch_index", "patch_index.py")

ROOT_DIV = b'<div id="root"></div>'
# 一段足够大的注释，供 fit_to_size 在需要缩减时压缩。
BIG_COMMENT = b"<!--" + b" " * 400 + b"-->"
SAMPLE = (
    b'<!doctype html><html><head><meta charset="utf-8">'
    b"<title>WorkBuddy</title>" + BIG_COMMENT + b"</head><body>"
    + ROOT_DIV
    + b'<script src="/assets/index-abc123.js"></script></body></html>'
)


def _run_cli(index: Path, target: int, *extra: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [
            sys.executable,
            str(COMMON / "patch_index.py"),
            "--index",
            str(index),
            "--target",
            str(target),
            *extra,
        ],
        capture_output=True,
        text=True,
        check=False,
    )


class FitToSizeTests(unittest.TestCase):
    def test_grow_pads_before_head(self) -> None:
        data = b"<html><head></head><body>" + ROOT_DIV + b"</body></html>"
        target = len(data) + 120
        out = patch_index.fit_to_size(data, target)
        self.assertEqual(len(out), target)
        self.assertIn(b"<!--QQ2007-THEME-PAD ", out)
        self.assertIn(b"</head>", out)

    def test_shrink_compresses_comment(self) -> None:
        data = b"<html><head>" + BIG_COMMENT + b"</head><body>" + ROOT_DIV + b"</body></html>"
        target = len(data) - 100
        out = patch_index.fit_to_size(data, target)
        self.assertEqual(len(out), target)
        self.assertIn(b"</head>", out)

    def test_shrink_without_comment_aborts(self) -> None:
        data = b"<html><head></head><body>" + ROOT_DIV + b"</body></html>"
        with self.assertRaises(SystemExit):
            patch_index.fit_to_size(data, len(data) - 50)


class CleanTests(unittest.TestCase):
    def test_clean_removes_injected_markers(self) -> None:
        injected = (
            b"<html><head>"
            b'  <link rel="stylesheet" href="../../app.asar.unpacked/renderer/assets/qq2008-skin.css">\n'
            b'  <script defer src="../../app.asar.unpacked/renderer/assets/qq2008-notify.js"></script>\n'
            b"<!--QQ2007-THEME-PAD          -->"
            b"</head><body>" + ROOT_DIV + b"</body></html>"
        )
        out = patch_index.clean(injected)
        self.assertNotIn(b"qq2008-skin.css", out)
        self.assertNotIn(b"qq2008-notify.js", out)
        self.assertNotIn(b"QQ2007-THEME-PAD", out)
        self.assertIn(ROOT_DIV, out)


class CliInjectionTests(unittest.TestCase):
    def _write_sample(self, directory: str) -> Path:
        index = Path(directory) / "index.html"
        index.write_bytes(SAMPLE)
        return index

    def test_inject_keeps_exact_byte_size(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            index = self._write_sample(tmp)
            target = len(SAMPLE)
            result = _run_cli(index, target)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = index.read_bytes()
            self.assertEqual(len(data), target)
            self.assertIn(b"qq2008-skin.css", data)
            self.assertIn(b"qq2008-notify.js", data)
            self.assertIn(ROOT_DIV, data)
            self.assertFalse((Path(tmp) / "index.html.qq7tmp").exists())

    def test_inject_is_idempotent(self) -> None:
        # 缩减（target 与原始文件同大）和填充（target 更大）两条路径都应幂等。
        for extra in (0, 400):
            with self.subTest(extra=extra), tempfile.TemporaryDirectory() as tmp:
                index = self._write_sample(tmp)
                target = len(SAMPLE) + extra
                self.assertEqual(_run_cli(index, target).returncode, 0)
                first = index.read_bytes()
                self.assertEqual(_run_cli(index, target).returncode, 0)
                second = index.read_bytes()
                self.assertEqual(first, second)
                self.assertEqual(len(second), target)
                self.assertEqual(second.count(b"qq2008-skin.css"), 1)

    def test_strip_only_restores_clean_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            index = self._write_sample(tmp)
            target = len(SAMPLE)
            self.assertEqual(_run_cli(index, target).returncode, 0)
            result = _run_cli(index, target, "--strip-only")
            self.assertEqual(result.returncode, 0, result.stderr)
            data = index.read_bytes()
            self.assertEqual(len(data), target)
            self.assertNotIn(b"qq2008-skin.css", data)
            self.assertNotIn(b"qq2008-notify.js", data)
            self.assertIn(ROOT_DIV, data)

    def test_missing_root_aborts_without_change(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "index.html"
            original = b"<html><head></head><body>no root</body></html>"
            index.write_bytes(original)
            result = _run_cli(index, len(original))
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(index.read_bytes(), original)

    def test_missing_head_aborts_without_change(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            index = Path(tmp) / "index.html"
            original = b"<html><body>" + ROOT_DIV + b"</body></html>"
            index.write_bytes(original)
            result = _run_cli(index, len(original))
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(index.read_bytes(), original)


class AsarIndexSizeTests(unittest.TestCase):
    def test_reads_recorded_index_size(self) -> None:
        header = {"files": {"renderer": {"files": {"index.html": {"size": 123456}}}}}
        encoded = json.dumps(header).encode("utf-8")
        # 与 asar_index_size.py 的读取方式保持一致：
        # offset 12 起是 header 长度（uint32），offset 16 起是 header JSON。
        blob = b"\x00" * 12 + struct.pack("<I", len(encoded)) + encoded
        with tempfile.TemporaryDirectory() as tmp:
            asar = Path(tmp) / "app.asar"
            asar.write_bytes(blob)
            result = subprocess.run(
                [sys.executable, str(COMMON / "asar_index_size.py"), str(asar)],
                capture_output=True,
                text=True,
                check=False,
            )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "123456")


if __name__ == "__main__":
    unittest.main()
