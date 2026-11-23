# ═══════════════════════════════════════════════════════════════════
# MoveX Digital — Multi-Device Workspace & Agent Memory Auto-Sync
# File: scripts/sync-all.ps1 (Windows PowerShell)
# Usage: ./scripts/sync-all.ps1 [-Message "Custom commit message"]
# ═══════════════════════════════════════════════════════════════════

param(
    [string]$Message = "Auto-sync workspace & agent memory"
)

$ErrorActionPreference = "Stop"

# Move to workspace root (parent of scripts/)
$WorkspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $WorkspaceRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " MoveX Digital — Workspace & AI Memory Auto-Sync" -ForegroundColor Cyan
Write-Host " Workspace: $WorkspaceRoot" -ForegroundColor Gray
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Verify Git is installed
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git CLI is not installed or not in system PATH." -ForegroundColor Red
    Write-Host "Install Git from https://git-scm.com/download/win and re-run." -ForegroundColor Yellow
    exit 1
}

# 2. Initialize Git repository if not already initialized
if (-not (Test-Path ".git")) {
    Write-Host "[INIT] Initializing new Git repository on branch 'main'..." -ForegroundColor Yellow
    git init -b main
}

# 3. Check if 'origin' remote is configured
$remotes = git remote
if ($remotes -notcontains "origin") {
    Write-Host "[NOTICE] No 'origin' GitHub remote is linked yet." -ForegroundColor Yellow
    Write-Host "Link your GitHub repo using: git remote add origin <YOUR_GITHUB_REPO_URL>" -ForegroundColor Cyan
    git add .
    $status = git status --porcelain
    if ($status) {
        git commit -m $Message
        Write-Host "[COMMITTED] Local changes committed (`"$Message`"). Ready to push once 'origin' is added." -ForegroundColor Green
    } else {
        Write-Host "[CLEAN] No new local changes to commit." -ForegroundColor Green
    }
    exit 0
}

# 4. Determine current branch
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch -or $branch -eq "HEAD") {
    $branch = "main"
}

# 5. Stage & Commit local changes first (or stash if needed) before pulling
Write-Host "[1/4] Pulling latest updates from origin/$branch (--rebase)..." -ForegroundColor Cyan
try {
    git pull origin $branch --rebase --autostash
} catch {
    Write-Host "[INFO] Remote branch origin/$branch may not exist yet or needs initial push. Continuing..." -ForegroundColor Yellow
}

# 6. Stage all tracked & new files (respecting .gitignore)
Write-Host "[2/4] Staging workspace files, GEMINI.md & .antigravity/skills/..." -ForegroundColor Cyan
git add .

# 7. Commit if there are staged changes
$pendingChanges = git status --porcelain
if ($pendingChanges) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $fullMessage = "$Message ($timestamp)"
    Write-Host "[3/4] Committing changes: $fullMessage" -ForegroundColor Cyan
    git commit -m $fullMessage
} else {
    Write-Host "[3/4] No new file changes to commit." -ForegroundColor Gray
}

# 8. Push to GitHub
Write-Host "[4/4] Pushing workspace & agent memory to origin/$branch..." -ForegroundColor Cyan
git push -u origin $branch

Write-Host "======================================================" -ForegroundColor Green
Write-Host " [SUCCESS] MoveX Digital workspace synced to GitHub!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
