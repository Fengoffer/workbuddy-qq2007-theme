#!/bin/bash
# 用 Gitee OpenAPI 创建发行版（Release）。
#
# 用法:
#   bash scripts/maintenance/create-gitee-release.sh v1.0.0 /tmp/release-notes.md
#
# token 获取顺序：
#   1. 环境变量 GITEE_TOKEN；
#   2. macOS Keychain 中 gitee.com 的 git 凭据（HTTPS push 用过的私人令牌）。
# 需要 Gitee「私人令牌」，并具备 projects 权限。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

TAG="${1:-}"
NOTES_FILE="${2:-}"

if [ -z "$TAG" ] || [ -z "$NOTES_FILE" ]; then
  echo "用法: create-gitee-release.sh <tag> <release-notes-file>"
  exit 1
fi
[ -f "$NOTES_FILE" ] || { echo "找不到发行说明文件：$NOTES_FILE"; exit 1; }

REPO="${GITEE_REPO:-fengoffer/workbuddy-qq2007-theme}"
TITLE="${GITEE_RELEASE_TITLE:-WorkBuddy QQ 2007 主题 $TAG}"
TARGET="${GITEE_RELEASE_TARGET:-main}"

TOKEN="${GITEE_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(printf 'protocol=https\nhost=gitee.com\n\n' | GIT_TERMINAL_PROMPT=0 git credential fill 2>/dev/null | sed -n 's/^password=//p' || true)"
fi
if [ -z "$TOKEN" ]; then
  echo "没有找到 Gitee token：请设置 GITEE_TOKEN，或先让 git 缓存 gitee.com 的私人令牌。"
  exit 1
fi

# token 写入 600 权限的临时文件，避免出现在 curl 的进程参数里
TOKEN_FILE="$(mktemp)"
RESPONSE="$(mktemp)"
chmod 600 "$TOKEN_FILE"
printf '%s' "$TOKEN" > "$TOKEN_FILE"
trap 'rm -f "$TOKEN_FILE" "$RESPONSE"' EXIT

HTTP_CODE="$(curl -sS -o "$RESPONSE" -w '%{http_code}' --max-time 60 -X POST \
  "https://gitee.com/api/v5/repos/$REPO/releases" \
  --data-urlencode "access_token@$TOKEN_FILE" \
  --data-urlencode "tag_name=$TAG" \
  --data-urlencode "name=$TITLE" \
  --data-urlencode "body@$NOTES_FILE" \
  --data-urlencode "prerelease=false" \
  --data-urlencode "target_commitish=$TARGET")"

if [ "$HTTP_CODE" != "201" ]; then
  echo "创建 Gitee 发行版失败（HTTP ${HTTP_CODE}）："
  python3 - "$RESPONSE" <<'PY' || cat "$RESPONSE"
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = json.load(handle)
    print(data.get("message") or data.get("error") or data)
except Exception:
    with open(sys.argv[1], encoding="utf-8") as handle:
        print(handle.read()[:500])
PY
  exit 1
fi

python3 - "$RESPONSE" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
print(f"✅ Gitee 发行版已创建：{data.get('tag_name')}（id {data.get('id')}）")
PY
