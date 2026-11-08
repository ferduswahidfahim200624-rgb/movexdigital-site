# MoveX Digital website

MoveX is a GitHub-first, content-driven website. Public content is authored in the repository and GitHub Actions rebuilds and publishes the site to GitHub Pages whenever `main` changes. The deployed pages are prebuilt HTML for fast delivery and SEO; GitHub Pages itself does not run a database or server-side application. No Supabase is used.

## How publishing works

1. Public pages and reusable assets live in the repository root and `assets/`.
2. Media articles are authored as Markdown files with TOML metadata in `content/articles/`.
3. On every push to `main` (or a manual workflow run), GitHub Actions builds standalone article pages, inserts article cards into Our Media, adds canonical/share metadata, generates a fresh sitemap and RSS feed, and packages the complete site.
4. GitHub Pages deploys the generated `dist/` output.

See [`content/articles/README.md`](content/articles/README.md) for the article format and publishing rules. A public static site cannot securely accept and store private leads or provide an authenticated live admin editor by itself. Current contact and newsletter forms use the existing email handoff. Do not put credentials, private client records, or unpublished drafts in this public repository.

## SEO publishing flow

Each article build includes a clean URL (`/insights/<slug>/`), canonical URL, description, Open Graph and Twitter metadata, `BlogPosting` structured data, visible published date, and sitemap/RSS entries. The build also gives every root page a self-canonical URL and publishes `robots.txt`. Search engines decide crawling, indexing, and ranking; publishing infrastructure helps them discover pages but does not guarantee rankings.

## Publish a new article

1. Add a public article Markdown file in `content/articles/` using [`article-template.md.example`](content/articles/article-template.md.example).
2. Add its original cover image under `assets/blog/` and use that path in the article metadata.
3. Commit and push to `main`. GitHub Actions builds the article, adds its card to Our Media, and refreshes `sitemap.xml` and `feed.xml`.
4. Check the Actions run and then the deployed URL. Submit `https://www.movexdigital.site/sitemap.xml` in Google Search Console so Google can discover the pages.

The repository is the editing source: use GitHub's file editor or ask Codex to draft and update the Markdown. This is publish-on-commit content management, not an authenticated live admin/database. Keep drafts and private customer information outside the public repository.

## Local preview

Install Python 3.11+ and run `python scripts/build_site.py`. Open `dist/index.html` in a browser to preview the generated site.
