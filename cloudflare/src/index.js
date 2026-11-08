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
    'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
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

async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 12000) throw new Error('payload_too_large');
  return request.json();
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
