#!/usr/bin/env python3
"""Build MoveX's static GitHub Pages site and Markdown insights."""

from __future__ import annotations

import html
import json
import re
import shutil
import tomllib
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import xml.etree.ElementTree as ET



ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
CONTENT = ROOT / "content" / "articles"
ORIGIN = "https://www.movexdigital.site/"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"


def fail(message: str) -> None:
    raise SystemExit(f"Build error: {message}")


def load_posts() -> list[dict]:
    posts: list[dict] = []
    CONTENT.mkdir(parents=True, exist_ok=True)
    for path in CONTENT.glob("*.md"):
        if path.name.lower() == "readme.md":
            continue
        raw = path.read_text(encoding="utf-8")
        match = re.match(r"\A\+\+\+\s*\n(.*?)\n\+\+\+\s*\n(.*)\Z", raw, re.S)
        if not match:
            fail(f"{path.relative_to(ROOT)} needs TOML front matter between +++ lines")
        try:
            meta = tomllib.loads(match.group(1))
        except tomllib.TOMLDecodeError as exc:
            fail(f"invalid TOML in {path.name}: {exc}")
        if meta.get("status", "published") != "published":
            continue
        required = ("title", "slug", "date", "description", "excerpt", "category", "image", "image_alt")
        missing = [key for key in required if not meta.get(key)]
        if missing:
            fail(f"{path.name} is missing: {', '.join(missing)}")
        slug = str(meta["slug"])
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            fail(f"{path.name}: slug must use lowercase letters, numbers, and hyphens")
        try:
            published = date.fromisoformat(str(meta["date"]))
        except ValueError:
            fail(f"{path.name}: date must use YYYY-MM-DD")
        image = str(meta["image"])
        if not image.startswith(("https://", "http://")):
            image_path = ROOT / image
            if not image_path.is_file():
                fail(f"{path.name}: image not found: {image}")
        posts.append({**meta, "slug": slug, "published": published, "body": match.group(2), "source": path})
    slugs = [post["slug"] for post in posts]
    if len(slugs) != len(set(slugs)):
        fail("published article slugs must be unique")
    return sorted(posts, key=lambda post: (post["published"], post["slug"]), reverse=True)


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def inline_markdown(text: str) -> str:
    """Render common inline Markdown without external packages."""
    safe = html.escape(text, quote=False)
    safe = re.sub(r"`([^`]+)`", r"<code>\1</code>", safe)
    def link(match: re.Match[str]) -> str:
        label, destination = match.group(1), match.group(2)
        if destination.lower().startswith(("javascript:", "data:", "vbscript:")):
            return label
        external = destination.startswith(("https://", "http://"))
        rel = ' rel="noopener noreferrer"' if external else ""
        return f'<a href="{destination}"{rel}>{label}</a>'

    safe = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, safe)
    safe = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", safe)
    safe = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", safe)
    return safe


def render_markdown(source: str) -> str:
    """Dependency-free Markdown renderer for authored MoveX Media posts."""
    lines = source.strip().splitlines()
    out: list[str] = []
    paragraph: list[str] = []
    list_kind: str | None = None
    code_lines: list[str] | None = None

    def close_paragraph() -> None:
        if paragraph:
            out.append(f"<p>{inline_markdown(' '.join(x.strip() for x in paragraph))}</p>")
            paragraph.clear()

    def close_list() -> None:
        nonlocal list_kind
        if list_kind:
            out.append(f"</{list_kind}>")
            list_kind = None

    for line in lines:
        value = line.strip()
        if value.startswith("```"):
            close_paragraph(); close_list()
            if code_lines is None:
                code_lines = []
            else:
                out.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
                code_lines = None
            continue
        if code_lines is not None:
            code_lines.append(line); continue
        if not value:
            close_paragraph(); close_list(); continue
        heading = re.match(r"^(#{1,3})\s+(.+?)\s*#*$", value)
        if heading:
            close_paragraph(); close_list()
            level, title = len(heading.group(1)), heading.group(2)
            anchor = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            out.append(f'<h{level} id="{esc(anchor)}">{inline_markdown(title)}</h{level}>'); continue
        if value in {"---", "***", "___"}:
            close_paragraph(); close_list(); out.append("<hr>"); continue
        quote = re.match(r"^>\s?(.*)$", value)
        if quote:
            close_paragraph(); close_list()
            out.append(f'<blockquote class="post-quote">{inline_markdown(quote.group(1))}</blockquote>'); continue
        item = re.match(r"^(?:[-*+]\s+|\d+[.)]\s+)(.+)$", value)
        if item:
            close_paragraph()
            kind = "ol" if re.match(r"^\d", value) else "ul"
            if list_kind != kind:
                close_list(); out.append(f"<{kind}>"); list_kind = kind
            out.append(f"<li>{inline_markdown(item.group(1))}</li>"); continue
        close_list(); paragraph.append(value)
    close_paragraph(); close_list()
    if code_lines is not None:
        out.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
    return "\n".join(out)


def render_post(post: dict, header: str, footer: str) -> str:
    slug = post["slug"]
    canonical = urljoin(ORIGIN, f"insights/{slug}/")
    image = str(post["image"])
    image_url = image if image.startswith(("https://", "http://")) else urljoin(ORIGIN, image)
    published = post["published"].isoformat()
    modified = str(post.get("modified", published))
    tags = post.get("tags", [])
    body_html = render_markdown(post["body"])
    article_schema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["title"],
        "description": post["description"],
        "datePublished": published,
        "dateModified": modified,
        "author": {"@type": "Organization", "name": "MoveX Digital"},
        "publisher": {"@type": "Organization", "name": "MoveX Digital", "url": ORIGIN},
        "mainEntityOfPage": canonical,
        "image": image_url,
        "keywords": tags,
    }
    escaped_schema = json.dumps(article_schema, ensure_ascii=False).replace("</", "<\\/")
    tag_html = "".join(f'<span class="post-topic-tag">{esc(tag)}</span>' for tag in tags)
    return f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base href="/">
<meta name="theme-color" content="#fbfaf7">
<title>{esc(post['title'])} | MoveX Media</title>
<meta name="description" content="{esc(post['description'])}">
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="MoveX Digital">
<meta property="og:title" content="{esc(post['title'])}"><meta property="og:description" content="{esc(post['description'])}">
<meta property="og:url" content="{esc(canonical)}"><meta property="og:image" content="{esc(image_url)}">
<meta property="article:published_time" content="{published}"><meta property="article:modified_time" content="{esc(modified)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="48x48" href="assets/movex-x-mark-48.png">
<link rel="stylesheet" href="assets/movex-header.css"><link rel="stylesheet" href="assets/movex-footer.css">
<link rel="stylesheet" href="assets/movex-mobile.css"><link rel="stylesheet" href="assets/movex-article.css">
<style>.post-topic-tags{{display:flex;gap:7px;flex-wrap:wrap;margin-top:17px}}.post-topic-tag{{padding:6px 10px;border-radius:999px;background:#edf3ed;color:#176b40;font-size:10px;font-weight:800}}.post-cover{{min-height:clamp(250px,38vw,470px)}}.post-cover>img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}.post-cover:after{{position:absolute;inset:45% 0 0;background:linear-gradient(transparent,#07152d55);content:""}}</style>
<script type="application/ld+json">{escaped_schema}</script>
</head><body class="mx-article-page">
<div class="reading-progress" role="progressbar" aria-label="Article reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
{header}
<main>
<header class="post-shell post-top"><nav class="post-breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="insights.html">MoveX Media</a><span aria-hidden="true">/</span><span>{esc(post['category'])}</span></nav>
<span class="post-label">{esc(post['category'])} · MoveX Media</span><h1 class="post-title">{esc(post['title'])}</h1>
<p class="post-deck">{esc(post['excerpt'])}</p><div class="post-meta"><span class="post-author"><span class="post-author-mark">MX</span> MoveX Digital</span><i class="post-meta-dot"></i><time datetime="{published}">{post['published'].strftime('%B %d, %Y').replace(' 0', ' ')}</time><i class="post-meta-dot"></i><span>{int(post.get('read_minutes', 6))} min read</span></div><div class="post-topic-tags">{tag_html}</div></header>
<figure class="post-shell post-cover"><img src="{esc(image)}" alt="{esc(post['image_alt'])}" loading="eager"><figcaption>{esc(post['image_alt'])}</figcaption></figure>
<div class="post-shell post-layout"><article class="post-content"><p class="post-intro">{esc(post['excerpt'])}</p>{body_html}
<section class="post-end-cta"><div><h2>Put the next move into practice.</h2><p>Tell MoveX what you want to improve and we’ll help you choose a practical next step.</p></div><a href="index.html#contact">Talk with MoveX ↗</a></section>
<a class="post-back-link" href="insights.html">← Explore more MoveX insights</a></article><aside class="post-toc"><b>Keep exploring</b><a href="services.html">Explore our services</a><a href="work.html">See selected work</a><a class="toc-service" href="index.html#contact">Discuss your next move ↗</a></aside></div>
</main>{footer}<script src="assets/movex-header.js" defer></script><script src="assets/movex-footer.js" defer></script><script src="assets/movex-article.js" defer></script>
</body></html>'''


def article_card(post: dict, is_latest: bool) -> str:
    slug = post["slug"]
    title = esc(post["title"])
    excerpt = esc(post["excerpt"])
    category = esc(post["category"])
    image = esc(post["image"])
    alt = esc(post["image_alt"])
    published = post["published"].isoformat()
    latest = f'<span class="media-latest-badge"><i aria-hidden="true"></i> LATEST · {post["published"].strftime("%b %d, %Y").upper()}</span>' if is_latest else ""
    topic = esc(str(post.get("topic", "all")))
    search_terms = esc(" ".join([title, excerpt, category, *post.get("tags", [])]))
    return f'''<a class="article-card media-feature-card generated-article-card{' media-latest-card' if is_latest else ''}" data-topic="{topic}" data-search="{search_terms}" href="insights/{esc(slug)}/" aria-label="Read: {title}"><div class="media-card-visual"><img src="{image}" alt="{alt}" loading="lazy">{latest}</div><div class="media-card-copy"><span>{category.upper()} · {int(post.get('read_minutes', 6))} MIN READ · <time datetime="{published}">{post['published'].strftime('%B %d, %Y').upper()}</time></span><h3>{title}</h3><p>{excerpt}</p><span class="generated-read-link">Read the article <span aria-hidden="true">↗</span></span></div></a>'''


def extract_shared_markup() -> tuple[str, str]:
    sample = (ROOT / "ai-search-readiness.html").read_text(encoding="utf-8")
    header_match = re.search(r'<header id="movex-global-header".*?</header>', sample, re.S)
    footer_match = re.search(r'<footer id="movex-global-footer".*?</footer>', sample, re.S)
    if not header_match or not footer_match:
        fail("could not find the current shared header/footer in ai-search-readiness.html")
    return header_match.group(0), footer_match.group(0)


def build() -> None:
    posts = load_posts()
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    for page in ROOT.glob("*.html"):
        if page.name in {"article.html", "portfolio-item.html"}:
            continue
        shutil.copy2(page, DIST / page.name)
    shutil.copytree(ROOT / "assets", DIST / "assets")
    legacy_origin = "https://ferduswahidfahim200624-rgb.github.io/movexdigital-site/"
    for page in DIST.glob("*.html"):
        content = page.read_text(encoding="utf-8")
        if legacy_origin in content:
            content = content.replace(legacy_origin, ORIGIN)
            page.write_text(content, encoding="utf-8")
    for public_file in ("robots.txt",):
        source = ROOT / public_file
        if source.exists():
            shutil.copy2(source, DIST / source.name)
    if (ROOT / "CNAME").exists():
        shutil.copy2(ROOT / "CNAME", DIST / "CNAME")

    header, footer = extract_shared_markup()
    for post in posts:
        out = DIST / "insights" / post["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render_post(post, header, footer), encoding="utf-8")

    insights = DIST / "insights.html"
    page_html = insights.read_text(encoding="utf-8")
    marker = "<!-- GENERATED_ARTICLE_CARDS -->"
    if marker not in page_html:
        fail("insights.html is missing the <!-- GENERATED_ARTICLE_CARDS --> marker inside its article grid")
    cards = "\n".join(article_card(post, index == 0) for index, post in enumerate(posts))
    page_html = re.sub(r'<span class="media-latest-badge"[^>]*>.*?</span>', '', page_html, flags=re.S)
    page_html = page_html.replace(marker, cards)
    insights.write_text(page_html, encoding="utf-8")

    urls: dict[str, str | None] = {}
    for page in sorted(DIST.glob("*.html")):
        if page.name == "index.html":
            location = ORIGIN
        else:
            location = urljoin(ORIGIN, page.name)
        urls[location] = None
    for post in posts:
        urls[urljoin(ORIGIN, f"insights/{post['slug']}/")] = post.get("modified", post["published"].isoformat())
    urlset = ET.Element(f"{{{SITEMAP_NS}}}urlset")
    for location, lastmod in sorted(urls.items()):
        url = ET.SubElement(urlset, f"{{{SITEMAP_NS}}}url")
        ET.SubElement(url, f"{{{SITEMAP_NS}}}loc").text = location
        if lastmod:
            ET.SubElement(url, f"{{{SITEMAP_NS}}}lastmod").text = str(lastmod)
    ET.indent(urlset, space="  ")
    (DIST / "sitemap.xml").write_bytes(ET.tostring(urlset, encoding="utf-8", xml_declaration=True))
    (DIST / ".nojekyll").touch()
    print(f"Built {len(list(DIST.glob('*.html')))} static pages and {len(posts)} published articles into {DIST}")


if __name__ == "__main__":
    build()
