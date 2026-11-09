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

SERVICE_ENQUIRIES = {
    "ai-ads.html": ("AI & ChatGPT Ads", "AI advertising readiness review", ["Channel and audience-fit review", "Offer and landing-page alignment", "Creative and message testing plan", "Measurement and ongoing review"]),
    "ai-search-geo.html": ("AI Search & GEO", "AI search visibility review", ["Search and answer-engine visibility audit", "Clear, expert-led page structure", "Structured data and source checks", "Content and authority priorities"]),
    "analytics-tracking.html": ("Web Analytics & Conversion Tracking", "Measurement and tracking review", ["GA4 and Google Tag Manager review", "Key events and conversion definitions", "Consent-aware implementation plan", "Reporting and data-quality checks"]),
    "business-automation.html": ("Business Automation", "Workflow and automation review", ["Enquiry and handoff mapping", "CRM and pipeline workflow design", "Follow-up and notification automation", "Testing, documentation, and refinement"]),
    "ecommerce-seo.html": ("Ecommerce SEO", "Ecommerce search opportunity review", ["Product and category architecture review", "Technical crawl and indexation checks", "Product content and internal-link priorities", "Search visibility measurement"]),
    "google-ads.html": ("Google Ads", "Google Ads account review", ["Account and campaign audit", "Search, Shopping, P-Max, or Demand Gen planning", "Conversion tracking and lead-quality checks", "Ongoing optimization and reporting"]),
    "growth-build.html": ("Growth & Build", "Customer journey and growth review", ["Content and email opportunity mapping", "Conversion journey review", "Analytics and tracking priorities", "A practical improvement roadmap"]),
    "linkedin-ads.html": ("LinkedIn Ads", "B2B campaign opportunity review", ["Audience and decision-maker planning", "Campaign and offer alignment", "Lead form and landing-page review", "Measurement and optimization priorities"]),
    "local-seo.html": ("Local SEO", "Local visibility review", ["Google Business Profile and local signals", "Service-area and location-page review", "Local content and citation priorities", "Calls, enquiries, and visibility tracking"]),
    "paid-social.html": ("Meta & Instagram Ads", "Paid social account review", ["Meta account and campaign audit", "Audience, offer, and creative planning", "Pixel and conversion-event checks", "Testing and ongoing optimization"]),
    "seo.html": ("SEO", "SEO audit and opportunity review", ["Technical and indexability review", "On-page, content, and internal-link priorities", "Off-page and authority considerations", "Search visibility and useful-action measurement"]),
    "web-design.html": ("Web Design", "Website and customer-journey review", ["Audience, offer, and page-structure discovery", "Responsive design and development scope", "Accessibility, speed, and SEO foundations", "Analytics, QA, and launch handover"]),
}

MARKETS = [
    ("ireland", "Ireland", "Ireland-based businesses", "Plan around the way your customers search, compare providers, and make decisions in Ireland. We work remotely and scope every project around the audience, offer, and evidence available—without implying a local office or guaranteed rankings."),
    ("australia", "Australia", "Australian businesses", "Build a practical digital plan for Australian customers, from first discovery through enquiry or purchase. MoveX works remotely and aligns delivery with your audience, business goals, and measurement setup."),
    ("canada", "Canada", "Canadian businesses", "Connect search visibility, paid campaigns, customer journeys, and measurement for Canadian audiences. Work is scoped remotely around the market and the service areas or products you actually support."),
    ("united-states", "United States", "US businesses", "Bring acquisition channels and customer experience into one clear plan for the audiences your business serves across the United States. Scope, priorities, and reporting are agreed before implementation."),
    ("germany", "Germany", "Germany-based businesses", "Plan around the language, audience, offer, and customer journey relevant to your German market. MoveX provides remote-first digital support; localization and implementation needs are agreed with you."),
    ("united-arab-emirates", "United Arab Emirates", "UAE businesses", "Coordinate digital growth work for the audiences and locations your UAE business serves. We begin with the offer, customer journey, and measurement requirements, then define a practical remote scope."),
]

MARKET_SERVICES = [
    ("SEO", "seo/", "Organic visibility, technical foundations, and useful search-led content."),
    ("Local SEO", "local-seo/", "Help customers discover the service areas and locations your business genuinely supports."),
    ("Ecommerce SEO", "ecommerce-seo/", "Improve organic discovery across product, collection, and category journeys."),
    ("Google Ads", "google-ads/", "Search and campaign management shaped around your offer and conversion data."),
    ("AI Search & GEO", "ai-search-geo/", "Make your expertise easier to understand and cite in AI-assisted discovery."),
    ("AI & ChatGPT Ads", "ai-ads/", "Review emerging AI advertising opportunities and plan around audience fit."),
    ("Meta & Instagram Ads", "paid-social/", "Paid social planning, creative testing, and lead or sales measurement."),
    ("LinkedIn Ads", "linkedin-ads/", "Reach relevant professional audiences with a considered B2B campaign plan."),
    ("Web Design", "web-design/", "Clear, responsive websites that help visitors understand and take the next step."),
    ("Business Automation", "business-automation/", "Connect enquiry handling, CRM updates, and follow-up workflows."),
    ("Analytics & Tracking", "analytics-tracking/", "GA4, GTM, conversion events, and reporting foundations."),
    ("Growth & Build", "growth-build/", "Connect content, email, conversion improvement, and customer experience."),
]

MARKET_CONTEXT = {
    "ireland": ("Start with how Irish customers describe the problem, compare providers, and decide to make contact. We’ll agree the locations, search language, and conversion actions that genuinely fit your business.", ["Customer language and search intent", "The towns or service areas you actually cover", "A useful enquiry, booking, or purchase action"]),
    "australia": ("Plan around the Australian audiences and service areas you actually support. Campaign structure, search language, customer journey, and reporting are agreed to fit the business rather than copied from another market.", ["State, city, or service-area boundaries", "Customer intent and offer fit", "Calls, bookings, sales, and lead quality"]),
    "canada": ("Shape the work around your actual Canadian customer groups and coverage. Where language or regional differences matter, confirm them with your team before publishing or launching campaigns.", ["Province and service-area coverage", "Language and customer-intent needs", "Lead quality and conversion definitions"]),
    "united-states": ("Build the plan around the specific audiences, locations, and offers your US business serves. A focused scope helps avoid treating a broad country as one uniform customer market.", ["State or local coverage and exclusions", "Audience, offer, and campaign fit", "Conversion actions and reporting ownership"]),
    "germany": ("Agree the audience, language, terminology, and implementation needs for your German market before pages or campaigns go live. Translation and local review requirements are scoped with your team.", ["German or English audience requirements", "Relevant regional and service coverage", "Reviewed content and measurable customer actions"]),
    "united-arab-emirates": ("Scope around the customer groups and locations your UAE business serves. Language choices, campaign coverage, and any local review requirements are confirmed with your team rather than assumed.", ["Audience and language requirements", "Emirate or service-area coverage", "Lead handling and conversion measurement"]),
}


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


def matching_section_end(content: str, start: int) -> int:
    """Return the end offset of the section beginning at start, including nested sections."""
    token_re = re.compile(r"</?section\b[^>]*>", re.I)
    depth = 0
    for match in token_re.finditer(content, start):
        if match.group(0).startswith("</"):
            depth -= 1
            if depth == 0:
                return match.end()
        else:
            depth += 1
    return -1


def service_enquiry_markup(filename: str) -> str:
    service, review, items = SERVICE_ENQUIRIES[filename]
    market_links = " ".join(
        f'<a href="/{slug}/">{name}</a>' for slug, name, _audience, _copy in MARKETS
    )
    included = "".join(f"<li>{esc(item)}</li>" for item in items)
    safe_service = esc(service)
    safe_review = esc(review)
    return f'''<section class="mx-service-enquiry" aria-labelledby="mx-service-enquiry-title"><div class="mx-service-enquiry-inner">
<div class="mx-service-included"><span class="mx-service-kicker">WHAT’S INCLUDED · {safe_service.upper()}</span><h2 id="mx-service-enquiry-title">A clear scope. Work you can review.</h2><p>We agree the priorities, access, deliverables, and reporting before work begins. The exact scope is tailored to your goals and current setup.</p><ul class="mx-service-deliverables">{included}</ul><div class="mx-market-links"><b>Explore service support by market</b><nav aria-label="MoveX service markets">{market_links}</nav></div></div>
<div class="mx-service-form-card"><span class="mx-service-kicker">START HERE · {safe_review.upper()}</span><h2>Let’s discuss {safe_service}.</h2><p>Share a little about your business. We’ll review your goals and suggest a sensible next step.</p>
<form class="mx-service-form" data-mx-lead-form><input type="hidden" name="service" value="{safe_service}">
<label>First name<input name="firstName" autocomplete="given-name" required></label><label>Last name<input name="lastName" autocomplete="family-name"></label>
<label class="mx-form-wide">Work email<input name="email" type="email" autocomplete="email" placeholder="you@company.com" required></label>
<label class="mx-form-wide">What would you like help with?<textarea name="project" placeholder="Your goal, current challenge, or what you’d like to improve…" required></textarea></label>
<button type="submit">Send a {safe_service} enquiry <span aria-hidden="true">↗</span></button><small>We’ll only use these details to respond to your enquiry.</small></form></div></div></section>'''


def add_service_enquiries(filename: str, content: str) -> str:
    if filename not in SERVICE_ENQUIRIES or 'data-mx-lead-form' in content:
        return content
    main = re.search(r"<main\b[^>]*>", content, re.I)
    if not main:
        fail(f"{filename} has no main element for service enquiry insert")
    hero = re.search(r"<section\b[^>]*class=[\"'][^\"']*\bhero\b[^\"']*[\"'][^>]*>", content[main.end():], re.I)
    if not hero:
        fail(f"{filename} has no hero section for service enquiry insert")
    hero_start = main.end() + hero.start()
    hero_end = matching_section_end(content, hero_start)
    if hero_end < 0:
        fail(f"could not find the end of the hero section in {filename}")
    insertion = hero_end
    following = re.match(r"\s*<section\b[^>]*class=[\"'][^\"']*\btrust\b[^\"']*[\"'][^>]*>", content[insertion:], re.I)
    if following:
        trust_start = insertion + following.start()
        trust_end = matching_section_end(content, trust_start)
        if trust_end > 0:
            insertion = trust_end
    stylesheet = '<link rel="stylesheet" href="assets/movex-service-enquiry.css">'
    head = re.search(r"</head\s*>", content, re.I)
    if head and "movex-service-enquiry.css" not in content:
        content = content[:head.start()] + stylesheet + "\n" + content[head.start():]
        if insertion >= head.start():
            insertion += len(stylesheet) + 1
    return content[:insertion] + "\n" + service_enquiry_markup(filename) + "\n" + content[insertion:]


def render_market_page(market: tuple[str, str, str, str], header: str, footer: str) -> str:
    slug, country, audience, intro = market
    market_context, market_checks = MARKET_CONTEXT[slug]
    check_items = "".join(f"<li>{esc(item)}</li>" for item in market_checks)
    cards = "".join(
        f'<a class="market-service-card" href="/{path}"><span> MOVEX SERVICE</span><h3>{esc(name)} for {esc(country)}</h3><p>{esc(description)}</p><b>Explore service ↗</b></a>'
        for name, path, description in MARKET_SERVICES
    )
    schema = {
        "@context": "https://schema.org", "@type": "Service",
        "name": f"Digital marketing services for businesses in {country}",
        "provider": {"@type": "Organization", "name": "MoveX Digital", "url": ORIGIN},
        "areaServed": {"@type": "Country", "name": country},
        "description": intro,
    }
    schema_text = json.dumps(schema, ensure_ascii=False).replace("</", "<\\/")
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f5f8f5"><base href="/"><title>SEO, Google Ads &amp; Digital Marketing for {esc(audience)} | MoveX Digital</title><meta name="description" content="Remote SEO, Google Ads, AI search, web design, analytics, and automation support for {esc(audience)}. Explore services and request a tailored plan."><link rel="canonical" href="{ORIGIN}{slug}/"><link rel="stylesheet" href="assets/movex-header.css"><link rel="stylesheet" href="assets/movex-footer.css"><link rel="stylesheet" href="assets/movex-mobile.css"><link rel="stylesheet" href="assets/movex-service-enquiry.css"><style>
body.mx-market-page{{margin:0;background:#f7f8f5;color:#10203a;font:16px/1.65 "Segoe UI Variable",Aptos,Arial,sans-serif}}.market-main{{padding-bottom:70px}}.market-hero{{padding:clamp(50px,7vw,84px) 0 48px;background:radial-gradient(ellipse at 84% 14%,#dcefe2 0,transparent 40%),linear-gradient(130deg,#f5f8f5,#edf4ef)}}.market-shell{{width:min(1160px,calc(100% - 44px));margin:auto}}.market-kicker{{color:#147b49;font-size:10px;font-weight:850;letter-spacing:.15em;text-transform:uppercase}}.market-hero h1{{max-width:850px;margin:16px 0;color:#07152d;font-size:clamp(42px,7vw,76px);line-height:.98;letter-spacing:-.065em}}.market-hero h1 em{{color:#168447;font-style:normal}}.market-hero p{{max-width:760px;margin:0;color:#536579;font-size:18px;line-height:1.7}}.market-actions{{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}}.market-actions a{{display:inline-flex;align-items:center;min-height:46px;padding:0 18px;border-radius:999px;background:#14834b;color:#fff;font-size:12px;font-weight:850}}.market-actions a+ a{{border:1px solid #dbe5dd;background:#fff;color:#10203a}}.market-note{{margin-top:26px;padding:13px 16px;border:1px solid #dce7df;border-radius:12px;background:#ffffffa8;color:#526579;font-size:12px}}.market-services{{padding:56px 0 20px}}.market-heading{{display:flex;align-items:end;justify-content:space-between;gap:25px;margin-bottom:22px}}.market-heading h2{{margin:8px 0 0;color:#07152d;font-size:clamp(30px,4vw,46px);line-height:1.05;letter-spacing:-.05em}}.market-heading p{{max-width:440px;margin:0;color:#607087;font-size:14px}}.market-service-grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}}.market-service-card{{display:flex;flex-direction:column;min-height:195px;padding:20px;border:1px solid #dfe8e1;border-radius:16px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 12px 30px #07152d08;transition:transform .18s,border-color .18s,box-shadow .18s}}.market-service-card:hover{{transform:translateY(-3px);border-color:#a7cdb1;box-shadow:0 18px 34px #07152d12}}.market-service-card span{{color:#14834b;font-size:9px;font-weight:850;letter-spacing:.12em}}.market-service-card h3{{margin:10px 0 7px;color:#0a1932;font-size:18px;line-height:1.2;letter-spacing:-.025em}}.market-service-card p{{margin:0 0 15px;color:#607087;font-size:12px;line-height:1.55}}.market-service-card b{{margin-top:auto;color:#117545;font-size:11px}}.market-next{{margin-top:24px;padding:23px;border-radius:17px;background:#0a1a33;color:#fff}}.market-next h2{{margin:0 0 6px;font-size:24px;letter-spacing:-.035em}}.market-next p{{margin:0;color:#c7d2dc;font-size:13px}}.market-next a{{display:inline-flex;margin-top:14px;color:#a7e0b9;font-weight:800}}@media(max-width:760px){{.market-shell{{width:calc(100% - 30px)}}.market-hero{{padding:43px 0 32px}}.market-hero p{{font-size:16px}}.market-services{{padding-top:38px}}.market-heading{{display:block}}.market-heading p{{margin-top:10px}}.market-service-grid{{grid-template-columns:1fr 1fr;gap:9px}}.market-service-card{{min-height:180px;padding:15px}}}}@media(max-width:480px){{.market-service-grid{{grid-template-columns:1fr}}.market-service-card{{min-height:0}}}}
</style><script type="application/ld+json">{schema_text}</script></head><body class="mx-market-page">{header}<main class="market-main"><section class="market-hero"><div class="market-shell"><span class="market-kicker">MOVEX DIGITAL · REMOTE SERVICE SUPPORT · {esc(country.upper())}</span><h1>SEO, Google Ads &amp; digital growth for <em>{esc(audience)}.</em></h1><p>{esc(intro)}</p><div class="market-actions"><a href="#market-services">Explore the service mix ↓</a><a href="/#contact">Discuss your business ↗</a></div><div class="market-note"><b>Remote-first delivery:</b> MoveX does not imply a local office in {esc(country)}. We agree service area, language and implementation scope with each business before work starts. Rankings, lead volume, and advertising returns are not guaranteed.</div></div></section><section id="market-services" class="market-services"><div class="market-shell"><header class="market-heading"><div><span class="market-kicker">ONE CONNECTED PLAN</span><h2>Choose the work that fits your next move.</h2></div><p>Start with the channel or customer-journey challenge that matters now. Each service page explains the scope, fit, and practical starting point.</p></header><div class="market-service-grid">{cards}</div><section class="market-context"><div><span class="market-kicker">HOW WE SCOPE {esc(country.upper())} WORK</span><h2>Useful local context comes before channel selection.</h2><p>{esc(market_context)} You stay involved in reviewing market wording, service coverage, offer details, and any claims before launch.</p></div><ul>{check_items}</ul></section><section class="market-next"><h2>Not sure where to begin?</h2><p>Tell us what you want to improve. We’ll help you decide which service deserves attention first.</p><a href="/#contact">Talk through your goals ↗</a></section></div></section></main>{footer}<script src="assets/movex-header.js" defer></script><script src="assets/movex-inbox-config.js"></script><script src="assets/movex-footer.js" defer></script></body></html>'''


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
        content = add_service_enquiries(page.name, content)
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
    for market in MARKETS:
        market_html = render_market_page(market, header, footer)
        market_path = DIST / market[0] / "index.html"
        market_path.parent.mkdir(parents=True, exist_ok=True)
        market_path.write_text(ensure_page_metadata(Path(market[0] + ".html"), market_html, urljoin(ORIGIN, market[0] + "/")), encoding="utf-8")
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
    for slug, _country, _audience, _intro in MARKETS:
        urls[urljoin(ORIGIN, slug + "/")] = None
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
