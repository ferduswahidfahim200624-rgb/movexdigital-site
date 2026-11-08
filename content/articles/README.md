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

Unpublished drafts created in the admin editor are stored in the private Cloudflare D1 database. They are not added to this public repository until Publish is selected. Published articles are committed here by the authenticated Worker so the GitHub Pages build can prerender them for search engines. Never place API keys, passwords, private client data, or admin credentials in this public Git repository.

The build generates each article's canonical URL, Open Graph and Twitter metadata, `BlogPosting` structured data, sitemap entry, and RSS item from its front matter. Root-level pages also receive canonical and share metadata during the build.
