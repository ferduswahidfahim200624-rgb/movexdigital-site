# MoveX Digital & AdsByFahim — Antigravity Agent Rules & Always-On Auto-Sync Protocol

These rules govern all AI agents working inside this workspace across Local PC (`E:\fahim website`, `E:\MoveX Digital`, `E:\work`), Google Drive, and GitHub (`adsbyfahim` & `movexdigital-site`).

---

## Rule 1: Mandatory Context Initialization
- Before starting **any** task, always read:
  1. `GEMINI.md` (Core Brand Knowledge & Persistent Ecosystem Memory)
  2. `MEMORY_LOG.md` (Chronological Change, Strategy & Skill Log)
  3. All skill files inside `.antigravity/skills/`
- Align every output, code change, design decision, and copywriting task with MoveX Digital (`movexdigital.site`) and Ferdous Wahid Fahim (`adsbyfahim.pages.dev`) brand identity, official color palette (`#008A2E`, `#FFA900`, `#FF4B0B`, `#07182F`, `#33485A`, `#FFFFFF`), and verified proof metrics.

---

## Rule 2: Always-On Memory & Skill Auto-Updater (Zero Manual Prompting Required)
You must automatically document, modularize into skills, and sync every new piece of knowledge or work **without waiting for the user to ask**:

### Trigger 1 — New Strategy / Business Info
- Whenever the user shares a new marketing strategy, offer, pricing tier, client case study, proof metric, or agency update in chat:
  1. Immediately append or update the relevant section in `GEMINI.md` across all active folders (`E:\fahim website`, `E:\MoveX Digital`, `E:\work`).
  2. Log the exact date, timestamp, and summary of the addition in `MEMORY_LOG.md`.

### Trigger 2 — Website / Code Changes
- Whenever we add or modify any page, section, service, or asset in `11 - Website/` (`movexdigital.site`) or `E:\fahim website` (`adsbyfahim.pages.dev`):
  1. Automatically extract the new details (such as new services, niche positioning, portfolio items, case studies, or CTAs).
  2. Update `GEMINI.md` and `MEMORY_LOG.md` so our backend brand knowledge always 100% matches our live websites.

### Trigger 3 — New Repeatable Workflow ➔ Auto-Skill Generation
- Whenever we complete a new type of repeatable task (e.g., Google Ads copywriting, GA4/GTM/Stape audit, SEO/GEO audit, client onboarding, Upwork proposal generation, landing page CRO review):
  1. Automatically create a new `.md` skill file (or refine the existing one) inside `.antigravity/skills/` with clear step-by-step instructions, checklists, and reusable templates.
  2. Record the new/updated skill in `MEMORY_LOG.md`.

### Trigger 4 — Immediate Tri-Sync Auto-Push
- Immediately after updating `GEMINI.md`, `MEMORY_LOG.md`, `.antigravity/skills/`, or website files:
  1. Replicate the updated memory/skill files across `E:\fahim website`, `E:\MoveX Digital`, and `E:\work` (which Google Drive backs up automatically).
  2. Automatically execute `scripts/sync-all.ps1` (or `scripts/sync-all.sh` / GitHub sync) so both GitHub repositories (`adsbyfahim` & `movexdigital-site`) stay 100% up-to-date alongside Google Drive.

---

## Rule 3: Git vs. Google Drive Asset Separation
- **Never commit heavy raw design or video files** (`*.psd`, `*.ai`, `*.mp4`, `*.mov`, `*.zip`) to GitHub.
- Keep heavy media files ignored in `.gitignore` so they remain tracked locally and synced via **Google Drive**, preventing Git bloat and file-lock conflicts.
- Keep all source code, HTML/CSS/JS, lightweight web images, `GEMINI.md`, `MEMORY_LOG.md`, `.antigravity/`, and `scripts/` tracked in **GitHub**.
