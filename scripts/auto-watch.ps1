# ═══════════════════════════════════════════════════════════════════
# MoveX Digital & AdsByFahim — Background Auto-Sync Watcher
# File: scripts/auto-watch.ps1 (Windows PowerShell)
# Purpose:
#   Watches the workspace folder every 5 minutes (300 seconds).
#   Whenever file changes are detected (including manual edits made
#   outside chat), it automatically:
#     1. Syncs core memory files (GEMINI.md, MEMORY_LOG.md, .antigravity/)
#        across all 3 local folders (E:\fahim website, E:\MoveX Digital, E:\work).
#     2. Runs git add . && git commit -m "Auto-update knowledge, skills & site" && git push
#        so GitHub and Google Drive stay 100% in sync automatically.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\auto-watch.ps1
# ═══════════════════════════════════════════════════════════════════

param(
    [int]$IntervalSeconds = 300
)

$WorkspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $WorkspaceRoot

$PeerFolders = @(
    "E:\fahim website",
    "E:\MoveX Digital",
    "E:\work"
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " MoveX Digital — Background Auto-Sync Watcher ACTIVE" -ForegroundColor Cyan
Write-Host " Watching: $WorkspaceRoot" -ForegroundColor Gray
Write-Host " Check Interval: Every $IntervalSeconds seconds (5 mins)" -ForegroundColor Gray
Write-Host " Press Ctrl+C to stop watching." -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan

# Track last snapshot hash of tracked files so we detect changes even if Git isn't initialized yet
function Get-WorkspaceStateHash {
    param([string]$Root)
    $files = Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $_.FullName -notmatch "\\(\.git|node_modules|dist|build)\\" -and
        $_.Extension -notin @(".psd", ".psb", ".ai", ".mp4", ".mov", ".zip", ".rar", ".7z", ".exe", ".tmp")
    }
    $manifest = ($files | Sort-Object FullName | ForEach-Object {
        "$($_.FullName)|$($_.Length)|$($_.LastWriteTimeUtc.Ticks)"
    }) -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($manifest)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha.ComputeHash($bytes)
    return ([BitConverter]::ToString($hashBytes) -replace "-", "")
}

function Sync-MemoryAcrossLocalFolders {
    param([string]$SourceRoot)
    foreach ($target in $PeerFolders) {
        if ((Test-Path $target) -and ($target.ToLower() -ne $SourceRoot.ToLower())) {
            try {
                New-Item -ItemType Directory -Force -Path "$target\.antigravity\skills" | Out-Null
                New-Item -ItemType Directory -Force -Path "$target\scripts" | Out-Null

                foreach ($rootFile in @("GEMINI.md", "MEMORY_LOG.md", ".gitignore")) {
                    if (Test-Path "$SourceRoot\$rootFile") {
                        Copy-Item "$SourceRoot\$rootFile" -Destination "$target\$rootFile" -Force
                    }
                }
                if (Test-Path "$SourceRoot\.antigravity\rules.md") {
                    Copy-Item "$SourceRoot\.antigravity\rules.md" -Destination "$target\.antigravity\rules.md" -Force
                }
                if (Test-Path "$SourceRoot\.antigravity\skills\*.md") {
                    Copy-Item "$SourceRoot\.antigravity\skills\*.md" -Destination "$target\.antigravity\skills\" -Force
                }
            } catch {
                Write-Host "[WARN] Could not replicate to $target : $_" -ForegroundColor Yellow
            }
        }
    }
}

$lastHash = Get-WorkspaceStateHash -Root $WorkspaceRoot

while ($true) {
    Start-Sleep -Seconds $IntervalSeconds
    $currentHash = Get-WorkspaceStateHash -Root $WorkspaceRoot
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    if ($currentHash -ne $lastHash) {
        Write-Host "[$ts] Change detected in workspace! Replicating memory & syncing to GitHub..." -ForegroundColor Green

        # 1. Replicate core AI memory & skills across all 3 PC folders (backed up by Google Drive)
        Sync-MemoryAcrossLocalFolders -SourceRoot $WorkspaceRoot

        # 2. Commit & Push to GitHub if Git is available
        if (Get-Command git -ErrorAction SilentlyContinue) {
            if (-not (Test-Path "$WorkspaceRoot\.git")) {
                git init -b main | Out-Null
            }
            git add .
            $pending = git status --porcelain
            if ($pending) {
                git commit -m "Auto-update knowledge, skills & site ($ts)"
                $remotes = git remote
                if ($remotes -contains "origin") {
                    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
                    if (-not $branch -or $branch -eq "HEAD") { $branch = "main" }
                    git pull origin $branch --rebase --autostash
                    git push -u origin $branch
                    Write-Host "[$ts] Successfully pushed updates to GitHub (origin/$branch)." -ForegroundColor Cyan
                } else {
                    Write-Host "[$ts] Changes committed locally (awaiting 'origin' remote link)." -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "[$ts] Memory & skills synced across all 3 local/Google Drive folders." -ForegroundColor Cyan
        }

        $lastHash = Get-WorkspaceStateHash -Root $WorkspaceRoot
    }
}
