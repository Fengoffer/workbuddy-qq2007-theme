#!/bin/bash
# 用 Gitee OpenAPI 创建发行版（Release）。
#
# 用法:
#   bash scripts/maintenance/create-gitee-release.sh vX.Y.Z /tmp/release-notes.md
#   bash scripts/maintenance/create-gitee-release.sh --update vX.Y.Z /tmp/release-notes.md
#     → 已存在则更新说明与 target_commitish（tag 被移动后用它刷新）
#
# token 获取顺序：
#   1. 环境变量 GITEE_TOKEN；
#   2. macOS Keychain 中 gitee.com 的 git 凭据（HTTPS push 用过的私人令牌）。
# 需要 Gitee「私人令牌」，并具备 projects 权限。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

MODE="create"
if [ "${1:-}" = "--update" ]; then
  MODE="update"; shift
fi

TAG="${1:-}"
NOTES_FILE="${2:-}"

if [ -z "$TAG" ] || [ -z "$NOTES_FILE" ]; then
  echo "用法: create-gitee-release.sh [--update] <tag> <release-notes-file>"
  exit 1
fi
[ -f "$NOTES_FILE" ] || { echo "找不到发行说明文件：$NOTES_FILE"; exit 1; }

REPO="${GITEE_REPO:-fengoffer/workbuddy-qq2007-theme}"
TITLE="${GITEE_RELEASE_TITLE:-WorkBuddy QQ 2007 主题 $TAG}"
TARGET="${GITEE_RELEASE_TARGET:-$(git rev-parse "$TAG^{commit}" 2>/dev/null || echo main)}"

TOKEN="${GITEE_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  TOKEN="$(printf 'protocol=https\nhost=gitee.com\n\n' | GIT_TERMINAL_PROMPT=0 git credential fill 2>/dev/null | sed -n 's/^password=//p' || true)"
fi
if [ -z "$TOKEN" ]; then
  echo "没有找到 Gitee token：请设置 GITEE_TOKEN，或先让 git 缓存 gitee.com 的私人令牌。"
  exit 1
fi

# token 写入 600 权限的临时文件，避免出现在 curl 的进程参数里；
# trap 紧跟 TOKEN_FILE 创建，保证后续任何一步失败都不会留下 token 文件
TOKEN_FILE="$(mktemp)"
trap 'rm -f "${TOKEN_FILE:-}" "${RESPONSE:-}"' EXIT
RESPONSE="$(mktemp)"
chmod 600 "$TOKEN_FILE"
printf '%s' "$TOKEN" > "$TOKEN_FILE"

RELEASE_ID=""
if [ "$MODE" = "update" ]; then
  # 先按 tag 查已有 release 的 id（Gitee 列表接口按 tag 过滤不支持，故本地过滤）
  LIST_CODE="$(curl -sS -o "$RESPONSE" -w '%{http_code}' --max-time 60 \
    "https://gitee.com/api/v5/repos/$REPO/releases?access_token=$TOKEN&per_page=100&page=1")"
  if [ "$LIST_CODE" = "200" ]; then
    RELEASE_ID="$(python3 - "$RESPONSE" "$TAG" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception:
    print(""); raise SystemExit
for r in data if isinstance(data, list) else []:
    if r.get("tag_name") == sys.argv[2]:
        print(r.get("id", "")); break
PY
)"
  fi
  if [ -z "$RELEASE_ID" ]; then
    echo "未找到 tag 为 $TAG 的既有发行版，改为创建。"
    MODE="create"
  fi
fi

if [ "$MODE" = "update" ]; then
  HTTP_CODE="$(curl -sS -o "$RESPONSE" -w '%{http_code}' --max-time 60 -X PATCH \
    "https://gitee.com/api/v5/repos/$REPO/releases/$RELEASE_ID" \
    --data-urlencode "access_token@$TOKEN_FILE" \
    --data-urlencode "tag_name=$TAG" \
    --data-urlencode "name=$TITLE" \
    --data-urlencode "body@$NOTES_FILE" \
    --data-urlencode "target_commitish=$TARGET")"
  EXPECTED="200"
else
  HTTP_CODE="$(curl -sS -o "$RESPONSE" -w '%{http_code}' --max-time 60 -X POST \
    "https://gitee.com/api/v5/repos/$REPO/releases" \
    --data-urlencode "access_token@$TOKEN_FILE" \
    --data-urlencode "tag_name=$TAG" \
    --data-urlencode "name=$TITLE" \
    --data-urlencode "body@$NOTES_FILE" \
    --data-urlencode "prerelease=false" \
    --data-urlencode "target_commitish=$TARGET")"
  EXPECTED="201"
fi

if [ "$HTTP_CODE" != "$EXPECTED" ]; then
  echo "${MODE} Gitee 发行版失败（HTTP ${HTTP_CODE}）："
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

GITEE_MODE="$MODE" python3 - "$RESPONSE" <<'PY'
import json
import os
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
print(f"✅ Gitee 发行版已{'更新' if os.environ.get('GITEE_MODE')=='update' else '创建'}：{data.get('tag_name')}（id {data.get('id')}）")
PY
