#!/bin/bash
# 把 main 分支和所有 tag 同步推送到 GitHub（origin）与 Gitee（gitee），避免双仓库漂移。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

REMOTES=(origin gitee)

[ -z "$(git status --porcelain)" ] || { echo "工作区不干净，请先提交或清理后再推送。"; exit 1; }

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || { echo "当前分支是 $BRANCH，请切回 main 再执行。"; exit 1; }

for remote in "${REMOTES[@]}"; do
  git remote get-url "$remote" >/dev/null 2>&1 || { echo "缺少远端：$remote"; exit 1; }
done

git fetch --all --prune

for remote in "${REMOTES[@]}"; do
  echo "==> 推送到 $remote"
  git push "$remote" main
  git push "$remote" --tags
done

echo "✅ GitHub 与 Gitee 已同步（main + tags）"
