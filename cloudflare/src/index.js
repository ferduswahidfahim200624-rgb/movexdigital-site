const TOKEN_COOKIE_NAME = 'movex_admin';
const LEAD_STATUSES = new Set(['new', 'in_progress', 'qualified', 'closed', 'spam']);

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!allowedOrigins(env).includes(origin)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function withCors(response, headers) {
  if (!headers) return response;
  const merged = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeBase64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function opaqueIpKey(ip, env) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.ADMIN_JWT_SECRET), new TextEncoder().encode(`login-ip:${ip}`));
  return base64url(new Uint8Array(signature));
}

async function issueToken(email, env) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.min(Math.max(Number(env.TOKEN_TTL_SECONDS || 43200), 900), 86400);
  const head = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(new TextEncoder().encode(JSON.stringify({ sub: email, iat: now, exp: now + ttl })));
  const unsigned = `${head}.${body}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(env.ADMIN_JWT_SECRET), new TextEncoder().encode(unsigned));
  return { token: `${unsigned}.${base64url(new Uint8Array(signature))}`, ttl };
}

async function verifyToken(token, env) {
  try {
    const [head, body, signature, extra] = token.split('.');
    if (!head || !body || !signature || extra) return null;
    const unsigned = `${head}.${body}`;
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(env.ADMIN_JWT_SECRET), decodeBase64url(signature), new TextEncoder().encode(unsigned));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(body)));
    if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) diff |= (left[i % (left.length || 1)] || 0) ^ (right[i % (right.length || 1)] || 0);
  return diff === 0;
}

function clean(value, max) {
  return String(value || '').trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function readJson(request, maxBytes = 12000) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBytes) throw new Error('payload_too_large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new Error('payload_too_large');
  return JSON.parse(raw);
}

function articleInput(input) {
  const slug = clean(input.slug, 90).toLowerCase();
  const tags = Array.isArray(input.tags) ? input.tags.slice(0, 12).map((tag) => clean(tag, 50)).filter(Boolean) : [];
  const article = {
    slug,
    title: clean(input.title, 180),
    date: clean(input.date, 10),
    description: clean(input.description, 220),
    excerpt: clean(input.excerpt, 360),
    category: clean(input.category, 80),
    topic: clean(input.topic, 40).toLowerCase() || 'strategy',
    read_minutes: Math.min(Math.max(Number(input.read_minutes) || 6, 1), 60),
    image: clean(input.image, 500),
    image_alt: clean(input.image_alt, 240),
    tags_json: JSON.stringify(tags),
    body_md: String(input.body_md || '').slice(0, 80000),
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { error: 'invalid_slug' };
  if (!article.title || !/^\d{4}-\d{2}-\d{2}$/.test(article.date) || !article.description || !article.excerpt || !article.category || !article.image || !article.image_alt || !article.body_md.trim()) return { error: 'required_article_fields_missing' };
  return article;
}

function tomlString(value) { return JSON.stringify(String(value)); }

function articleMarkdown(article) {
  const tags = JSON.parse(article.tags_json || '[]');
  return [
    '+++',
    `title = ${tomlString(article.title)}`,
    `slug = ${tomlString(article.slug)}`,
    `date = ${tomlString(article.date)}`,
    `modified = ${tomlString(String(article.updated_at || '').slice(0, 10) || article.date)}`,
    `description = ${tomlString(article.description)}`,
    `excerpt = ${tomlString(article.excerpt)}`,
    `category = ${tomlString(article.category)}`,
    `topic = ${tomlString(article.topic)}`,
    `read_minutes = ${Number(article.read_minutes) || 6}`,
    `image = ${tomlString(article.image)}`,
    `image_alt = ${tomlString(article.image_alt)}`,
    `tags = ${JSON.stringify(tags)}`,
    'status = "published"',
    '+++',
    '',
    article.body_md.trim(),
    '',
  ].join('\n');
}

function base64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function githubRequest(path, env, options = {}) {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_CONTENTS_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'MoveX-Digital-CMS',
      ...(options.headers || {}),
    },
  });
}

async function saveArticle(request, env, user, id = null) {
  let input;
  try { input = await readJson(request, 100000); } catch (_) { return json({ error: 'invalid_request' }, 400); }
  const article = articleInput(input);
  if (article.error) return json({ error: article.error }, 400);
  const duplicate = await env.DB.prepare('SELECT id,status FROM media_articles WHERE slug = ?').bind(article.slug).first();
  if (duplicate && Number(duplicate.id) !== Number(id || 0)) return json({ error: 'slug_already_exists' }, 409);
  if (id) {
    const previous = await env.DB.prepare('SELECT slug,status FROM media_articles WHERE id = ?').bind(id).first();
    if (!previous) return json({ error: 'not_found' }, 404);
    if (previous.status === 'published' && previous.slug !== article.slug) return json({ error: 'published_slug_locked' }, 409);
    await env.DB.prepare(`UPDATE media_articles SET slug=?,title=?,date=?,description=?,excerpt=?,category=?,topic=?,read_minutes=?,image=?,image_alt=?,tags_json=?,body_md=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
      .bind(article.slug, article.title, article.date, article.description, article.excerpt, article.category, article.topic, article.read_minutes, article.image, article.image_alt, article.tags_json, article.body_md, id).run();
    const saved = await env.DB.prepare('SELECT * FROM media_articles WHERE id = ?').bind(id).first();
    return json({ item: saved }, 200);
  }
  const result = await env.DB.prepare(`INSERT INTO media_articles (slug,title,date,description,excerpt,category,topic,read_minutes,image,image_alt,tags_json,body_md,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(article.slug, article.title, article.date, article.description, article.excerpt, article.category, article.topic, article.read_minutes, article.image, article.image_alt, article.tags_json, article.body_md, user.sub).run();
  const saved = await env.DB.prepare('SELECT * FROM media_articles WHERE id = ?').bind(result.meta.last_row_id).first();
  return json({ item: saved }, 201);
}

async function publishArticle(id, env) {
  if (!env.GITHUB_REPOSITORY || !env.GITHUB_CONTENTS_TOKEN) return json({ error: 'github_publisher_not_configured' }, 503);
  const article = await env.DB.prepare('SELECT * FROM media_articles WHERE id = ?').bind(id).first();
  if (!article) return json({ error: 'not_found' }, 404);
  const path = `/contents/content/articles/${article.slug}.md`;
  const existing = await githubRequest(path, env, { method: 'GET' });
  let existingSha = '';
  if (existing.ok) existingSha = (await existing.json()).sha || '';
  else if (existing.status !== 404) return json({ error: 'github_read_failed' }, 502);
  const response = await githubRequest(path, env, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `${existingSha ? 'Update' : 'Publish'} MoveX Media: ${article.title}`,
      content: base64Utf8(articleMarkdown(article)),
      branch: env.GITHUB_BRANCH || 'main',
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: response.status === 409 ? 'github_content_conflict' : 'github_publish_failed' }, 502);
  await env.DB.prepare(`UPDATE media_articles SET status='published',github_sha=?,published_at=COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`)
    .bind(result.content?.sha || '', id).run();
  return json({ ok: true, url: `https://www.movexdigital.site/insights/${article.slug}/`, commit: result.commit?.html_url || '' }, 200);
}

async function login(request, env, cors) {
  if (!env.ADMIN_USERS_JSON || !env.ADMIN_JWT_SECRET) return json({ error: 'admin_not_configured' }, 503);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE window_started < ?').bind(now - 86400).run();
  const ipHash = await opaqueIpKey(request.headers.get('CF-Connecting-IP') || 'unknown', env);
  const attempts = await env.DB.prepare('SELECT attempt_count,window_started FROM admin_login_attempts WHERE ip_hash = ?').bind(ipHash).first();
  if (attempts && now - Number(attempts.window_started) < 3600 && Number(attempts.attempt_count) >= 10) {
    return json({ error: 'login_rate_limited' }, 429, cors);
  }
  let input;
  try { input = await readJson(request); } catch (_) { return json({ error: 'invalid_request' }, 400); }
  const email = clean(input.email, 254).toLowerCase();
  const password = String(input.password || '').slice(0, 512);
  let admins = [];
  try { admins = JSON.parse(env.ADMIN_USERS_JSON); } catch (_) { return json({ error: 'admin_not_configured' }, 503); }
  let matched = null;
  for (const admin of Array.isArray(admins) ? admins : []) {
    const emailMatch = timingSafeEqual(email, String(admin.email || '').toLowerCase());
    const passwordMatch = timingSafeEqual(password, String(admin.password || ''));
    if (emailMatch && passwordMatch) matched = String(admin.email).toLowerCase();
  }
  if (!matched) {
    if (attempts && now - Number(attempts.window_started) < 3600) {
      await env.DB.prepare('UPDATE admin_login_attempts SET attempt_count = attempt_count + 1 WHERE ip_hash = ?').bind(ipHash).run();
    } else {
      await env.DB.prepare('INSERT INTO admin_login_attempts (ip_hash,attempt_count,window_started) VALUES (?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempt_count=1,window_started=excluded.window_started').bind(ipHash, now).run();
    }
    return json({ error: 'invalid_credentials' }, 401, cors);
  }
  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash = ?').bind(ipHash).run();
  const session = await issueToken(matched, env);
  return json({ token: session.token, expiresIn: session.ttl, email: matched }, 200, cors);
}

async function requireAdmin(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const payload = await verifyToken(authorization.slice(7), env);
  if (!payload) return null;
  let admins = [];
  try { admins = JSON.parse(env.ADMIN_USERS_JSON || '[]'); } catch (_) { return null; }
  return (Array.isArray(admins) && admins.some((admin) => String(admin.email || '').toLowerCase() === String(payload.sub).toLowerCase())) ? payload : null;
}

async function submitLead(request, env, cors) {
  let input;
  try { input = await readJson(request); } catch (_) { return json({ error: 'invalid_request' }, 400, cors); }
  if (clean(input.website, 200)) return json({ ok: true }, 202, cors);
  const firstName = clean(input.firstName, 100);
  const lastName = clean(input.lastName, 100);
  const email = clean(input.email, 254).toLowerCase();
  const service = clean(input.service, 120);
  const project = clean(input.project, 5000);
  const sourcePage = clean(input.sourcePage, 300);
  if (!firstName || !validEmail(email) || input.consent !== true) return json({ error: 'invalid_or_missing_fields' }, 400, cors);
  const recent = await env.DB.prepare("SELECT id FROM leads WHERE email = ? AND datetime(created_at) > datetime('now', '-45 seconds') LIMIT 1").bind(email).first();
  if (recent) return json({ error: 'please_wait_before_resubmitting' }, 429, cors);
  await env.DB.prepare('INSERT INTO leads (first_name,last_name,email,service,project,source_page) VALUES (?,?,?,?,?,?)')
    .bind(firstName, lastName, email, service, project, sourcePage).run();
  return json({ ok: true, message: 'Thanks — your enquiry has been received.' }, 201, cors);
}

async function submitNewsletter(request, env, cors) {
  let input;
  try { input = await readJson(request); } catch (_) { return json({ error: 'invalid_request' }, 400, cors); }
  if (clean(input.website, 200)) return json({ ok: true }, 202, cors);
  const email = clean(input.email, 254).toLowerCase();
  const sourcePage = clean(input.sourcePage, 300);
  if (!validEmail(email) || input.consent !== true) return json({ error: 'valid_email_and_consent_required' }, 400, cors);
  await env.DB.prepare("INSERT INTO newsletter_subscribers (email,source_page) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET status='subscribed', source_page=excluded.source_page, consented_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    .bind(email, sourcePage).run();
  return json({ ok: true, message: 'You’re on the list. Watch your inbox for MoveX updates.' }, 201, cors);
}

async function adminRoute(request, env, url, cors) {
  const user = await requireAdmin(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401, cors);
  if (url.pathname === '/api/admin/leads' && request.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 500);
    const rows = await env.DB.prepare('SELECT id,first_name,last_name,email,service,project,source_page,status,created_at FROM leads ORDER BY id DESC LIMIT ?').bind(limit).all();
    return json({ items: rows.results || [] }, 200, cors);
  }
  if (url.pathname === '/api/admin/newsletter' && request.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 500), 1), 1000);
    const rows = await env.DB.prepare('SELECT id,email,source_page,consented_at,status FROM newsletter_subscribers ORDER BY id DESC LIMIT ?').bind(limit).all();
    return json({ items: rows.results || [] }, 200, cors);
  }
  if (url.pathname === '/api/admin/articles' && request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT id,slug,title,date,category,status,updated_at,published_at FROM media_articles ORDER BY updated_at DESC LIMIT 200').all();
    return json({ items: rows.results || [] }, 200, cors);
  }
  if (url.pathname === '/api/admin/articles' && request.method === 'POST') return saveArticle(request, env, user);
  const articlePublishMatch = url.pathname.match(/^\/api\/admin\/articles\/(\d+)\/publish$/);
  if (articlePublishMatch && request.method === 'POST') return publishArticle(Number(articlePublishMatch[1]), env);
  const articleMatch = url.pathname.match(/^\/api\/admin\/articles\/(\d+)$/);
  if (articleMatch && request.method === 'GET') {
    const item = await env.DB.prepare('SELECT * FROM media_articles WHERE id = ?').bind(Number(articleMatch[1])).first();
    return item ? json({ item }, 200, cors) : json({ error: 'not_found' }, 404, cors);
  }
  if (articleMatch && request.method === 'PUT') return saveArticle(request, env, user, Number(articleMatch[1]));
  if (articleMatch && request.method === 'DELETE') {
    const result = await env.DB.prepare("DELETE FROM media_articles WHERE id = ? AND status = 'draft'").bind(Number(articleMatch[1])).run();
    return result.meta?.changes ? json({ ok: true }, 200, cors) : json({ error: 'draft_not_found' }, 404, cors);
  }
  const statusMatch = url.pathname.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (statusMatch && request.method === 'PATCH') {
    let input;
    try { input = await readJson(request); } catch (_) { return json({ error: 'invalid_request' }, 400, cors); }
    const status = clean(input.status, 30);
    if (!LEAD_STATUSES.has(status)) return json({ error: 'invalid_status' }, 400, cors);
    const result = await env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, Number(statusMatch[1])).run();
    return result.meta?.changes ? json({ ok: true }, 200, cors) : json({ error: 'not_found' }, 404, cors);
  }
  return json({ error: 'not_found' }, 404, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    const origin = request.headers.get('Origin');
    if (origin && !cors) return json({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors || {} });
    try {
      let response;
      if (url.pathname === '/api/health' && request.method === 'GET') response = json({ ok: true, service: 'MoveX private inbox' }, 200, cors);
      else if (url.pathname === '/api/leads' && request.method === 'POST') response = await submitLead(request, env, cors);
      else if (url.pathname === '/api/newsletter' && request.method === 'POST') response = await submitNewsletter(request, env, cors);
      else if (url.pathname === '/api/admin/login' && request.method === 'POST') response = await login(request, env, cors);
      else if (url.pathname.startsWith('/api/admin/')) response = await adminRoute(request, env, url, cors);
      else response = json({ error: 'not_found' }, 404, cors);
      return withCors(response, cors);
    } catch (_) {
      return withCors(json({ error: 'server_error' }, 500), cors);
    }
  },
};
