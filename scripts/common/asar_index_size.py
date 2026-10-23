#!/usr/bin/env python3
"""Read the renderer/index.html size recorded in app.asar header."""
import json
import struct
import sys
from pathlib import Path


def main() -> int:
    asar = Path(sys.argv[1])
    with asar.open('rb') as f:
        f.seek(12)
        header_size = struct.unpack('<I', f.read(4))[0]
        f.seek(16)
        header = json.loads(f.read(header_size).decode('utf-8'))
    node = header
    for seg in ('renderer', 'index.html'):
        node = node['files'][seg]
    print(int(node['size']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
