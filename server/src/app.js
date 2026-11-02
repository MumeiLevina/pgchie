const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgStore = require('connect-pg-simple')(session);
const argon2 = require('argon2');
const { rateLimit } = require('express-rate-limit');
const { Repository } = require('./storage');
const { Formspree } = require('./formspree');
const adminDir = path.resolve(__dirname, '../../admin');
const fail = (status, code) => Object.assign(new Error(code), { status, code });
const csrfToken = () => randomBytes(32).toString('hex');
function equalToken(a, b) {
  return typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
async function createApp({ config, pool, repository = new Repository(pool), provider = new Formspree(config) }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1); // Exactly one Render reverse proxy; never trust arbitrary chains.
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"], formAction: ["'self'"], baseUri: ["'none'"], frameAncestors: ["'none'"], upgradeInsecureRequests: config.production ? [] : null } } }));
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'X-Robots-Tag': 'noindex, nofollow' });
    // Same-origin service; the public website does not need access to this API.
    if (req.headers.origin && req.headers.origin !== config.origin) return res.status(403).json({ error: 'origin_denied' });
    next();
  });
  app.get('/healthz', async (_req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  });
  const store = new PgStore({ pool, tableName: 'admin_sessions', createTableIfMissing: false, pruneSessionInterval: false });
  const cookieName = config.production ? '__Host-chie.sid' : 'chie.sid';
  app.use(session({ name: cookieName, secret: config.secret, store, resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: config.production, sameSite: 'strict', maxAge: config.sessionMs, path: '/' } }));
  app.use(express.json({ limit: '16kb', strict: true }));
  const dummyHash = await argon2.hash(randomBytes(32), { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  const authorized = async (req, res, next) => {
    if (req.session?.adminId === 1 && req.session.expiresAt > Date.now()) return next();
    if (req.session?.adminId) await new Promise(resolve => req.session.destroy(resolve));
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'authentication_required' });
    res.redirect('/login');
  };
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.headers.origin !== config.origin || !req.is('application/json') || !equalToken(req.get('x-csrf-token'), req.session?.csrf)) return res.status(403).json({ error: 'csrf_failed' });
    next();
  });
  app.get('/api/auth/csrf', rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }), (req, res) => {
    req.session.csrf ||= csrfToken(); res.json({ csrf: req.session.csrf });
  });
  app.post('/api/auth/login', async (req, res) => {
    const allowed = await repository.throttle(`login:${req.ip}`, 5, 15 * 60 * 1000);
    if (!allowed) { res.set('Retry-After', '900'); return res.status(429).json({ error: 'login_rate_limited' }); }
    const { email, password } = req.body || {};
    const admin = await repository.admin();
    const candidate = typeof password === 'string' && password.length <= 1024 ? password : '';
    const valid = await argon2.verify(admin?.password_hash || dummyHash, candidate);
    if (!valid || typeof email !== 'string' || email.toLowerCase() !== admin?.email) return res.status(401).json({ error: 'invalid_credentials' });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.adminId = 1; req.session.expiresAt = Date.now() + config.sessionMs; req.session.csrf = csrfToken();
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ csrf: req.session.csrf });
  });
  app.post('/api/auth/logout', authorized, async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(cookieName, { path: '/', secure: config.production, httpOnly: true, sameSite: 'strict' }); res.json({ ok: true });
  });
  app.use('/api', authorized);
  app.get('/api/session', (req, res) => res.json({ csrf: req.session.csrf }));
  app.get('/api/overview', async (_req, res) => res.json(await repository.overview()));
  app.get('/api/integration', async (_req, res) => res.json({ configured: provider.configured, mode: config.mode, formId: config.formId,
    status: provider.configured ? 'awaiting_verification' : 'integration_not_configured', ...(await repository.state()) }));
  app.post('/api/sync', async (_req, res) => {
    if (!provider.configured) throw fail(503, 'integration_not_configured');
    if (!await repository.throttle('sync', 10, 60000)) throw Object.assign(fail(429, 'sync_rate_limited'), { retryAfter: 60 });
    const lease = await repository.claimSync();
    if (!lease) throw fail(409, 'sync_in_progress');
    try {
      const submissions = await provider.page(lease.next_offset);
      const done = submissions.length < 100;
      await repository.importPage(config.formId, submissions, lease.next_offset, done);
      res.json({ scanned: submissions.length, complete: done });
    } finally { await repository.releaseSync(); }
  });
  app.get('/api/messages', async (req, res) => {
    const page = Number(req.query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || (req.query.search && (typeof req.query.search !== 'string' || req.query.search.length > 200)) ||
      (req.query.sort && !['oldest', 'newest'].includes(req.query.sort))) throw fail(400, 'invalid_query');
    res.json(await repository.list({ filter: req.query.filter || 'inbox', search: req.query.search || '', page, sort: req.query.sort || 'newest' }));
  });
  app.param('id', (req, _res, next, id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? next() : next(fail(400, 'invalid_id')));
  app.patch('/api/messages/:id', async (req, res) => {
    if (!req.body || Array.isArray(req.body)) throw fail(400, 'invalid_changes');
    if (!await repository.update(req.params.id, req.body)) throw fail(404, 'message_not_found');
    res.json({ ok: true });
  });
  app.delete('/api/messages/:id', async (req, res) => {
    if (req.body?.confirm !== true) throw fail(400, 'confirmation_required');
    if (!await repository.delete(req.params.id)) throw fail(404, 'message_not_found');
    res.json({ ok: true, scope: 'local_copy_only' });
  });
  app.get('/login', (_req, res) => res.sendFile(path.join(adminDir, 'login.html')));
  for (const file of ['admin.css', 'admin.js', 'login.js']) app.get(`/assets/${file}`, (_req, res) => res.sendFile(path.join(adminDir, file)));
  app.get(['/', '/admin', '/admin/'], authorized, (_req, res) => res.sendFile(path.join(adminDir, 'index.html')));
  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => {
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    const status = error.status || 503;
    // Never log requests, provider responses, credentials, session IDs, queries or message bodies.
    res.status(status >= 400 && status <= 599 ? status : 503).json({ error: error.code && /^[a-z_]+$/.test(error.code) ? error.code : status === 400 ? 'invalid_request' : 'backend_unavailable' });
  });
  return app;
}
module.exports = { createApp };
