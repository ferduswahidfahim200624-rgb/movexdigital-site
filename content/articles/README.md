# Publishing MoveX Media articles

Add one UTF-8 Markdown file per public article in this directory. The GitHub Pages workflow builds each published article at `/insights/<slug>/`, adds its card to `insights.html`, and regenerates `sitemap.xml` and `feed.xml`.

Use this TOML front matter:

```toml
+++
title = "A useful, specific article title"
slug = "useful-specific-article-title"
date = "2026-11-08"
modified = "2026-11-08"
description = "A concise search snippet describing the practical answer in this article."
excerpt = "A reader-focused summary shown on the article and Media card."
category = "SEO & Local Visibility"
topic = "search"
read_minutes = 7
image = "assets/blog/article-cover.webp"
image_alt = "Clear description of what the article cover shows"
tags = ["Local SEO", "Google Business Profile", "Service businesses"]
status = "published"
+++
```

Write the article body in Markdown after the second `+++`. Use descriptive headings, original helpful content, internal links to relevant MoveX services, and image alt text. Put optimized public images in `assets/blog/`. Article URLs, titles, dates, excerpts, canonical tags, Open Graph metadata, BlogPosting JSON-LD, and sitemap entries are generated from these fields.

Only put material intended for immediate public release in this repository. GitHub Pages is a public static host: draft files committed to a public repository are still visible in the source even if the builder omits them. Keep unpublished drafts outside the repository and ask Codex to add them when ready to publish. Never place API keys, passwords, private client data, or admin credentials in the site repository.

The build generates each article's canonical URL, Open Graph and Twitter metadata, `BlogPosting` structured data, sitemap entry, and RSS item from its front matter. Root-level pages also receive canonical and share metadata during the build.
