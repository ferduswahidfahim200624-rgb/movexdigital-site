# MoveX Digital website

MoveX Digital is a static multi-page site published with GitHub Pages. The public website does not use Supabase or a runtime database.

## How publishing works

1. Public pages and reusable assets live in the repository root and `assets/`.
2. Media articles are authored as Markdown files with TOML metadata in `content/articles/`.
3. On every push to `main` (or a manual workflow run), GitHub Actions builds standalone article pages, inserts article cards into Our Media, generates a fresh sitemap, and packages the complete static site.
4. GitHub Pages deploys the generated `dist/` output.

See [`content/articles/README.md`](content/articles/README.md) for the article format and publishing rules. A public static site cannot securely accept and store private leads or provide an authenticated live admin editor by itself. Current contact and newsletter forms use the existing email handoff. Do not put credentials, private client records, or unpublished drafts in this public repository.

## SEO publishing flow

Each article build includes a clean URL (`/insights/<slug>/`), canonical URL, description, Open Graph and Twitter metadata, `BlogPosting` structured data, visible published date, and sitemap entry. The workflow also publishes `robots.txt`. Search engines decide crawling, indexing, and ranking; publishing infrastructure helps them discover pages but does not guarantee rankings.

## Local preview

Install Python 3.11+ and run `python scripts/build_site.py`. Open `dist/index.html` in a browser to preview the generated site.
