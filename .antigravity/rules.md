# MoveX Digital — Antigravity Agent Rules & Auto-Sync Protocol

These rules govern all AI agents working inside this workspace across Local PC, Google Drive, and GitHub.

## Rule 1: Mandatory Context Initialization
- Before starting **any** task, always read:
  1. `GEMINI.md` (Core Brand Knowledge & Persistent Memory)
  2. All skill files inside `.antigravity/skills/`
- Align every output, code change, design decision, and copywriting task with MoveX Digital's brand voice, official color palette (`#008A2E`, `#FFA900`, `#FF4B0B`, `#07182F`, `#33485A`, `#FFFFFF`), and service positioning.

## Rule 2: Continuous Self-Updating Memory
- Whenever we:
  - Create or refine a workflow,
  - Learn a new client or founder preference,
  - Update project specifications, deliverables, or case study numbers,
- You **must automatically update `GEMINI.md`** or create/update a dedicated `.md` skill file inside `.antigravity/skills/` so that our institutional memory persists seamlessly across all devices.

## Rule 3: Git vs. Google Drive Asset Separation
- **Never commit heavy raw design or video files** (`*.psd`, `*.ai`, `*.mp4`, `*.mov`, `*.zip`) to GitHub.
- Keep heavy media files ignored in `.gitignore` so they remain tracked locally and synced via **Google Drive**, preventing Git bloat and file-lock conflicts.
- Keep all source code, HTML/CSS/JS, lightweight web images, `GEMINI.md`, `.antigravity/`, and `scripts/` tracked in **GitHub**.

## Rule 4: Automated GitHub Workspace Sync
- At the end of any major task, or whenever the user says **"sync all"**, execute the workspace auto-sync script:
  - **Windows (PowerShell):** `./scripts/sync-all.ps1`
  - **macOS / Linux (Bash):** `./scripts/sync-all.sh`
- This ensures all code, brand memory (`GEMINI.md`), and custom skills (`.antigravity/skills/`) are immediately pushed to GitHub.
