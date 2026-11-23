#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# MoveX Digital — Multi-Device Workspace & Agent Memory Auto-Sync
# File: scripts/sync-all.sh (macOS / Linux / Git Bash)
# Usage: ./scripts/sync-all.sh ["Custom commit message"]
# ═══════════════════════════════════════════════════════════════════

set -e

MESSAGE="${1:-Auto-sync workspace & agent memory}"

# Move to workspace root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WORKSPACE_ROOT"

echo "======================================================"
echo " MoveX Digital — Workspace & AI Memory Auto-Sync"
echo " Workspace: $WORKSPACE_ROOT"
echo "======================================================"

# 1. Verify Git is installed
if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] Git CLI is not installed or not in PATH."
  exit 1
fi

# 2. Initialize Git repository if not already initialized
if [ ! -d ".git" ]; then
  echo "[INIT] Initializing new Git repository on branch 'main'..."
  git init -b main
fi

# 3. Check if 'origin' remote is configured
if ! git remote | grep -q "^origin$"; then
  echo "[NOTICE] No 'origin' GitHub remote is linked yet."
  echo "Link your GitHub repo using: git remote add origin <YOUR_GITHUB_REPO_URL>"
  git add .
  if [ -n "$(git status --porcelain)" ]; then
    git commit -m "$MESSAGE"
    echo "[COMMITTED] Local changes committed (\"$MESSAGE\"). Ready to push once 'origin' is added."
  else
    echo "[CLEAN] No new local changes to commit."
  fi
  exit 0
fi

# 4. Determine current branch
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  BRANCH="main"
fi

# 5. Pull latest changes with rebase & autostash
echo "[1/4] Pulling latest updates from origin/$BRANCH (--rebase)..."
git pull origin "$BRANCH" --rebase --autostash || echo "[INFO] Remote branch origin/$BRANCH not found yet. Proceeding to push..."

# 6. Stage all changes (respecting .gitignore)
echo "[2/4] Staging workspace files, GEMINI.md & .antigravity/skills/..."
git add .

# 7. Commit if there are staged changes
if [ -n "$(git status --porcelain)" ]; then
  TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"
  FULL_MSG="$MESSAGE ($TIMESTAMP)"
  echo "[3/4] Committing changes: $FULL_MSG"
  git commit -m "$FULL_MSG"
else
  echo "[3/4] No new file changes to commit."
fi

# 8. Push to GitHub
echo "[4/4] Pushing workspace & agent memory to origin/$BRANCH..."
git push -u origin "$BRANCH"

echo "======================================================"
echo " [SUCCESS] MoveX Digital workspace synced to GitHub!"
echo "======================================================"
