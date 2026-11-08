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
CF_WEB_ANALYTICS = "<!-- Cloudflare Web Analytics --><script defer src=\"https://static.cloudflareinsights.com/beacon.min.js\" data-cf-beacon='{" + '"token":"bbc7071c8c9485b8334cd715a3158927"' + "}'></script><!-- End Cloudflare Web Analytics -->"
CONTENT = ROOT / "content" / "articles"
ORIGIN = "https://www.movexdigital.site/"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ROUTE_ALIASES = {"about": "about-us", "services": "what-we-do", "insights": "our-media"}


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
<header class="post-shell post-top"><nav class="post-breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/our-media/">MoveX Media</a><span aria-hidden="true">/</span><span>{esc(post['category'])}</span></nav>
<span class="post-label">{esc(post['category'])} · MoveX Media</span><h1 class="post-title">{esc(post['title'])}</h1>
<p class="post-deck">{esc(post['excerpt'])}</p><div class="post-meta"><span class="post-author"><span class="post-author-mark">MX</span> MoveX Digital</span><i class="post-meta-dot"></i><time datetime="{published}">{post['published'].strftime('%B %d, %Y').replace(' 0', ' ')}</time><i class="post-meta-dot"></i><span>{int(post.get('read_minutes', 6))} min read</span></div><div class="post-topic-tags">{tag_html}</div></header>
<figure class="post-shell post-cover"><img src="{esc(image)}" alt="{esc(post['image_alt'])}" loading="eager"><figcaption>{esc(post['image_alt'])}</figcaption></figure>
<div class="post-shell post-layout"><article class="post-content"><p class="post-intro">{esc(post['excerpt'])}</p>{body_html}
<section class="post-end-cta"><div><h2>Put the next move into practice.</h2><p>Tell MoveX what you want to improve and we’ll help you choose a practical next step.</p></div><a href="/#contact">Talk with MoveX ↗</a></section>
<a class="post-back-link" href="/our-media/">← Explore more MoveX insights</a></article><aside class="post-toc"><b>Keep exploring</b><a href="/what-we-do/">Explore our services</a><a href="/work/">See selected work</a><a class="toc-service" href="/#contact">Discuss your next move ↗</a></aside></div>
</main>{footer}<script src="assets/movex-header.js" defer></script><script src="assets/movex-inbox-config.js"></script><script src="assets/movex-footer.js" defer></script><script src="assets/movex-article.js" defer></script>
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


def pretty_slug(path: Path) -> str:
    return ROUTE_ALIASES.get(path.stem, path.stem)


def pretty_url(path: Path) -> str:
    return ORIGIN if path.name == "index.html" else urljoin(ORIGIN, f"{pretty_slug(path)}/")


def rewrite_pretty_urls(content: str) -> str:
    """Point local pages and assets at clean, root-based URLs."""
    for source in sorted(ROOT.glob("*.html"), key=lambda item: len(item.name), reverse=True):
        destination = "/" if source.name == "index.html" else f"/{pretty_slug(source)}/"
        content = re.sub(
            rf"(?<![A-Za-z0-9_./-]){re.escape(source.name)}(?=([?#\"'<>\s]|$))",
            destination,
            content,
            flags=re.I,
        )
    return re.sub(r'(["\'(])assets/', r'\1/assets/', content)


def legacy_redirect(path: Path) -> str:
    target = f"/{pretty_slug(path)}/"
    canonical = urljoin(ORIGIN, f"{pretty_slug(path)}/")
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="canonical" href="{esc(canonical)}"><meta http-equiv="refresh" content="0;url={target}"><title>Page moved | MoveX Digital</title><script>location.replace({json.dumps(target)}+location.search+location.hash)</script></head><body><p>This page has moved. <a href="{target}">Continue to MoveX Digital</a>.</p></body></html>'''


def ensure_page_metadata(path: Path, content: str, canonical: str | None = None) -> str:
    """Give every root-level public HTML page a self-canonical and share metadata."""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", content, re.I | re.S)
    title = html.unescape(re.sub(r"\s+", " ", title_match.group(1)).strip()) if title_match else f"{path.stem.replace('-', ' ').title()} | MoveX Digital"
    description_match = re.search(r'<meta\b(?=[^>]*\bname=["\']description["\'])(?=[^>]*\bcontent=["\'](.*?)["\'])[^>]*>', content, re.I | re.S)
    description = html.unescape(description_match.group(1).strip()) if description_match else f"Explore {title.removesuffix(' | MoveX Digital')} from MoveX Digital. Practical digital strategy, services, and guidance for business growth."
    description = re.sub(r"\s+", " ", description).strip()
    canonical = canonical or pretty_url(path)

    # Replace any stale/duplicate canonical so every page has exactly one URL.
    content = re.sub(r"\s*<link\b(?=[^>]*\brel=[\"']canonical[\"'])[^>]*>", "", content, flags=re.I)
    additions = [f'<link rel="canonical" href="{esc(canonical)}">']
    if not description_match:
        additions.append(f'<meta name="description" content="{esc(description)}">')
    defaults = [
        ("og:type", "website"),
        ("og:site_name", "MoveX Digital"),
        ("og:title", title),
        ("og:description", description),
        ("og:url", canonical),
    ]
    for key, value in defaults:
        if not re.search(rf'<meta\b(?=[^>]*\bproperty=["\']{re.escape(key)}["\'])', content, re.I):
            additions.append(f'<meta property="{esc(key)}" content="{esc(value)}">')
    if not re.search(r'<meta\b(?=[^>]*\bname=["\']twitter:card["\'])', content, re.I):
        additions.append('<meta name="twitter:card" content="summary_large_image">')

    if path.name == "insights.html" and not re.search(r'<link\b(?=[^>]*\btype=["\']application/rss\+xml["\'])', content, re.I):
        additions.append('<link rel="alternate" type="application/rss+xml" title="MoveX Media" href="feed.xml">')
    head_close = re.search(r"</head\s*>", content, re.I)
    if head_close:
        content = content[:head_close.start()] + "\n".join(additions) + "\n" + content[head_close.start():]
    return content


def generate_rss(posts: list[dict]) -> bytes:
    """Create a standard RSS feed for public articles authored in GitHub."""
    rss = ET.Element("rss", {"version": "2.0", "xmlns:atom": "http://www.w3.org/2005/Atom"})
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "MoveX Media"
    ET.SubElement(channel, "link").text = urljoin(ORIGIN, "our-media/")
    ET.SubElement(channel, "description").text = "Practical business strategies, SEO and AI search guidance, paid media insights, platform updates, and automation playbooks from MoveX Digital."
    ET.SubElement(channel, "language").text = "en"
    ET.SubElement(channel, "lastBuildDate").text = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    ET.SubElement(channel, "{http://www.w3.org/2005/Atom}link", {"href": urljoin(ORIGIN, "feed.xml"), "rel": "self", "type": "application/rss+xml"})
    for post in posts:
        item = ET.SubElement(channel, "item")
        canonical = urljoin(ORIGIN, f"insights/{post['slug']}/")
        ET.SubElement(item, "title").text = str(post["title"])
        ET.SubElement(item, "link").text = canonical
        ET.SubElement(item, "guid", {"isPermaLink": "true"}).text = canonical
        ET.SubElement(item, "description").text = str(post["excerpt"])
        ET.SubElement(item, "category").text = str(post["category"])
        ET.SubElement(item, "pubDate").text = datetime.combine(post["published"], datetime.min.time(), tzinfo=timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    ET.indent(rss, space="  ")
    return ET.tostring(rss, encoding="utf-8", xml_declaration=True)


def extract_shared_markup() -> tuple[str, str]:
    sample = (ROOT / "ai-search-readiness.html").read_text(encoding="utf-8")
    header_match = re.search(r'<header id="movex-global-header".*?</header>', sample, re.S)
    footer_match = re.search(r'<footer id="movex-global-footer".*?</footer>', sample, re.S)
    if not header_match or not footer_match:
        fail("could not find the current shared header/footer in ai-search-readiness.html")
    return header_match.group(0), footer_match.group(0)


def render_thank_you(header: str, footer: str) -> str:
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f5f8f5"><meta name="robots" content="noindex,follow">
<title>Thank you | MoveX Digital</title><meta name="description" content="Your message has reached MoveX Digital.">
<link rel="stylesheet" href="/assets/movex-header.css"><link rel="stylesheet" href="/assets/movex-footer.css"><link rel="stylesheet" href="/assets/movex-mobile.css">
<style>
body.mx-thank-you{{background:#f5f8f5;color:#0a1932}}.thanks-main{{min-height:58vh;display:grid;place-items:center;padding:72px 24px 88px;background:radial-gradient(ellipse at 78% 15%,#dcefe3 0,transparent 42%),linear-gradient(135deg,#f8faf7,#eef5ef)}}
.thanks-card{{width:min(760px,100%);padding:clamp(30px,6vw,68px);background:#fff;border:1px solid #dce7df;border-radius:30px;box-shadow:0 24px 70px #0a193211;text-align:center;position:relative;overflow:hidden}}
.thanks-card:before{{content:"";position:absolute;inset:0 0 auto;height:6px;background:linear-gradient(90deg,#16844d 0 58%,#ff9f13 58% 78%,#0a1932 78%)}}
.thanks-mark{{width:76px;height:76px;margin:0 auto 25px;display:grid;place-items:center;border-radius:50%;background:#e9f5ed;color:#13844b;font-size:38px;font-weight:800;box-shadow:0 0 0 9px #f5faf6}}
.thanks-kicker{{font-size:12px;letter-spacing:.16em;font-weight:800;color:#16844d;text-transform:uppercase}}.thanks-card h1{{font-size:clamp(38px,6vw,62px);letter-spacing:-.055em;line-height:1.02;margin:14px 0 18px}}.thanks-card p{{max-width:560px;margin:0 auto;color:#596b83;font-size:18px;line-height:1.65}}
.thanks-actions{{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:30px}}.thanks-actions a{{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 23px;border-radius:999px;text-decoration:none;font-weight:750}}.thanks-primary{{background:#13844b;color:white}}.thanks-secondary{{border:1px solid #dbe4de;color:#0a1932;background:#fff}}
.thanks-note{{margin-top:25px!important;font-size:13px!important}}
@media(max-width:600px){{.thanks-main{{min-height:54vh;padding:38px 18px 55px}}.thanks-card{{border-radius:23px}}.thanks-card p{{font-size:16px}}}}
</style></head><body class="mx-thank-you">{header}<main class="thanks-main"><section class="thanks-card" aria-live="polite"><div class="thanks-mark" aria-hidden="true">✓</div><span class="thanks-kicker">Message received</span><h1 id="thanks-title">Thank you for reaching out.</h1><p id="thanks-copy">Your message is safely with the MoveX team. We’ll review the details and follow up using the contact information you shared.</p><div class="thanks-actions"><a class="thanks-primary" href="/#top">Back to MoveX <span aria-hidden="true">&nbsp;↗</span></a><a class="thanks-secondary" href="/our-media/">Explore our insights</a></div><p class="thanks-note">Need to add something? Email <a href="mailto:ferdouswahidfahim24@gmail.com">ferdouswahidfahim24@gmail.com</a>.</p></section></main>{footer}<script>
const submissionType=new URLSearchParams(location.search).get('type');
if(submissionType==='newsletter'){{document.getElementById('thanks-title').textContent='You’re on the list.';document.getElementById('thanks-copy').textContent='Thanks for subscribing to MoveX Media. Look out for practical strategies, platform updates, and useful ideas in your inbox.';document.querySelector('.thanks-kicker').textContent='Subscription confirmed';}}
</script></body></html>'''


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
    admin_source = ROOT / "admin"
    if admin_source.is_dir():
        shutil.copytree(admin_source, DIST / "admin")
    legacy_origin = "https://ferduswahidfahim200624-rgb.github.io/movexdigital-site/"
    for page in DIST.glob("*.html"):
        content = page.read_text(encoding="utf-8")
        if legacy_origin in content:
            content = content.replace(legacy_origin, ORIGIN)
        content = content.replace(
            '<script src="assets/movex-footer.js"',
            '<script src="assets/movex-inbox-config.js"></script><script src="assets/movex-footer.js"',
        )
        content = rewrite_pretty_urls(content)
        content = ensure_page_metadata(page, content, pretty_url(page))
        page.write_text(content, encoding="utf-8")

    # Publish public pages on clean folder routes; preserve old .html URLs as
    # redirects so bookmarks and search results continue to resolve.
    for page in list(DIST.glob("*.html")):
        if page.name == "index.html":
            continue
        route = DIST / pretty_slug(page) / "index.html"
        route.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(page, route)
        page.write_text(legacy_redirect(page), encoding="utf-8")
    for public_file in ("robots.txt",):
        source = ROOT / public_file
        if source.exists():
            shutil.copy2(source, DIST / source.name)
    if (ROOT / "CNAME").exists():
        shutil.copy2(ROOT / "CNAME", DIST / "CNAME")

    header, footer = extract_shared_markup()
    thank_you = rewrite_pretty_urls(render_thank_you(header, footer))
    thank_you = thank_you.replace(
        '<script src="assets/movex-footer.js"',
        '<script src="assets/movex-inbox-config.js"></script><script src="assets/movex-footer.js"',
    )
    thank_you = ensure_page_metadata(Path("thank-you.html"), thank_you, urljoin(ORIGIN, "thank-you/"))
    thank_you_path = DIST / "thank-you" / "index.html"
    thank_you_path.parent.mkdir(parents=True, exist_ok=True)
    thank_you_path.write_text(thank_you, encoding="utf-8")
    for post in posts:
        out = DIST / "insights" / post["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(rewrite_pretty_urls(render_post(post, header, footer)), encoding="utf-8")

    insights = DIST / pretty_slug(ROOT / "insights.html") / "index.html"
    page_html = insights.read_text(encoding="utf-8")
    marker = "<!-- GENERATED_ARTICLE_CARDS -->"
    if marker not in page_html:
        fail("insights.html is missing the <!-- GENERATED_ARTICLE_CARDS --> marker inside its article grid")
    cards = "\n".join(article_card(post, index == 0) for index, post in enumerate(posts))
    page_html = re.sub(r'<span class="media-latest-badge"[^>]*>.*?</span>', '', page_html, flags=re.S)
    page_html = page_html.replace(marker, cards)
    insights.write_text(page_html, encoding="utf-8")

    # Add Cloudflare's privacy-friendly Web Analytics beacon to all public
    # rendered pages. Keep the authenticated admin area out of public analytics.
    for page in DIST.rglob("*.html"):
        if "admin" in page.relative_to(DIST).parts:
            continue
        content = page.read_text(encoding="utf-8")
        if "static.cloudflareinsights.com/beacon.min.js" not in content:
            content = content.replace("</body>", f"{CF_WEB_ANALYTICS}</body>")
            page.write_text(content, encoding="utf-8")

    urls: dict[str, str | None] = {ORIGIN: None}
    for page in sorted(ROOT.glob("*.html")):
        if page.name in {"index.html", "thank-you.html"}:
            continue
        urls[pretty_url(page)] = None
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
    (DIST / "feed.xml").write_bytes(generate_rss(posts))
    (DIST / ".nojekyll").touch()
    print(f"Built clean-route pages and {len(posts)} published articles into {DIST}")


if __name__ == "__main__":
    build()
