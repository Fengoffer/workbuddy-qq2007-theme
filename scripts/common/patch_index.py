#!/usr/bin/env python3
"""Safely inject / strip the QQ 2007 theme in WorkBuddy's unpacked index.html.

WorkBuddy marks renderer/index.html as unpacked in app.asar, but Electron
still truncates the external file to the size recorded in the asar header.
Therefore the final byte count MUST stay exactly equal to that recorded size.
"""
import argparse
import re
import sys
from pathlib import Path

LINK_RE = re.compile(rb'[ \t]*<link[^>]*qq2008-skin\.css[^>]*>\r?\n?')
SCRIPT_RE = re.compile(rb'[ \t]*<script[^>]*qq2008-notify\.js[^>]*>\s*</script>\r?\n?')
PAD_RE = re.compile(rb'<!--QQ2007-THEME-PAD[\s\S]*?-->')
HEAD = b'</head>'
ROOT = b'<div id="root"></div>'
PAD_PREFIX = b'<!--QQ2007-THEME-PAD '
PAD_SUFFIX = b'-->'


def clean(data: bytes) -> bytes:
    data = LINK_RE.sub(b'', data)
    data = SCRIPT_RE.sub(b'', data)
    data = PAD_RE.sub(b'', data)
    return data


def fit_to_size(data: bytes, target: int) -> bytes:
    delta = len(data) - target
    if delta == 0:
        return data
    if delta > 0:
        # remove the requested number of bytes from a single HTML comment
        candidates = [m for m in re.finditer(rb'<!--[\s\S]*?-->', data) if len(m.group(0)) >= delta + 7]
        candidates.sort(key=lambda m: len(m.group(0)))
        for m in candidates:
            length = len(m.group(0))
            if length - delta >= 7:
                replacement = b'<!--' + b' ' * (length - delta - 7) + b'-->'
                return data[:m.start()] + replacement + data[m.end():]
        raise SystemExit(
            f'index.html 需要缩减 {delta} 字节，但找不到可压缩的注释；为安全起见中止安装。'
        )
    need = -delta
    if need < len(PAD_PREFIX) + len(PAD_SUFFIX):
        raise SystemExit(f'index.html 需要填充 {need} 字节，数值过小；中止安装。')
    pad = PAD_PREFIX + b' ' * (need - len(PAD_PREFIX) - len(PAD_SUFFIX)) + PAD_SUFFIX
    if HEAD not in data:
        raise SystemExit('index.html 中找不到 </head>；中止安装。')
    return data.replace(HEAD, pad + HEAD, 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', required=True)
    ap.add_argument('--target', required=True, type=int)
    ap.add_argument('--assets-rel', default='../../app.asar.unpacked/renderer/assets/')
    ap.add_argument('--strip-only', action='store_true')
    args = ap.parse_args()

    path = Path(args.index)
    data = path.read_bytes()
    if ROOT not in data:
        raise SystemExit('自检失败：index.html 缺少 <div id="root"></div>，中止以免损坏应用。')

    data = clean(data)
    if not args.strip_only:
        rel = args.assets_rel if args.assets_rel.endswith('/') else args.assets_rel + '/'
        block = (
            f'  <link rel="stylesheet" href="{rel}qq2008-skin.css">\n'
            f'  <script defer src="{rel}qq2008-notify.js"></script>\n'
        ).encode('utf-8')
        if HEAD not in data:
            raise SystemExit('index.html 中找不到 </head>；中止安装。')
        data = data.replace(HEAD, block + HEAD, 1)

    data = fit_to_size(data, args.target)
    if len(data) != args.target:
        raise SystemExit(f'字节数对齐失败：{len(data)} != {args.target}')
    if ROOT not in data:
        raise SystemExit('自检失败：注入后 index.html 缺少 #root，中止以免损坏应用。')

    tmp = path.with_name(path.name + '.qq7tmp')
    tmp.write_bytes(data)
    tmp.replace(path)
    print(f'{"清理" if args.strip_only else "注入"}完成：{path} ({len(data)} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
