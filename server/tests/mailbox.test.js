const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const request = require('supertest');
const argon2 = require('argon2');
const { testDatabase } = require('./database');
const { migrate } = require('../src/migrate');
const { createApp } = require('../src/app');
const { Repository } = require('../src/storage');
const { Formspree } = require('../src/formspree');
const { configuration } = require('../src/config');
const config = { origin: 'http://127.0.0.1:8002', production: false, secret: 'test-only-session-secret-'.repeat(3), mode: 'disabled', formId: 'mzeekake', apiToken: '', sessionMs: 14400000 };
const password = 'TEST-ONLY strong password 123';
let pool, repo, app, hash;
before(async () => { pool = await testDatabase(); await migrate(pool); repo = new Repository(pool); hash = await argon2.hash(password); app = await createApp({ config, pool }); });
after(async () => pool?.end());
beforeEach(async () => {
  await pool.query('TRUNCATE admin_users,admin_sessions,login_limits,messages');
  await pool.query("UPDATE integration_state SET next_offset=0,last_sync=NULL,locked_until='1970-01-01'");
  await pool.query('INSERT INTO admin_users(id,email,password_hash) VALUES(1,$1,$2)', ['test@example.com', hash]);
});
async function login(application = app, candidate = password) {
  const agent = request.agent(application);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrf;
  const response = await agent.post('/api/auth/login').set('Origin', config.origin).set('X-CSRF-Token', csrf).send({ email: 'test@example.com', password: candidate });
  return { agent, csrf: response.body.csrf, response };
}
function mutate(auth, method, url, data) { return auth.agent[method](url).set('Origin', config.origin).set('X-CSRF-Token', auth.csrf).send(data); }
async function seed(count = 1) {
  await repo.importPage(config.formId, Array.from({ length: count }, (_, i) => ({ _date: new Date(Date.now() - i * 60000).toISOString(), message: `[TEST FIXTURE] letter ${i} ${i === 0 ? '<img src=x onerror=alert(1)>' : ''}` })), 0, true);
  return (await repo.list({})).messages;
}
test('authentication: unauthorized API and HTML, valid login, cookie flags, fixation, logout', async () => {
  await request(app).get('/api/messages').expect(401);
  await request(app).get('/admin/').expect(302).expect('Location', '/login');
  const auth = await login(); assert.equal(auth.response.status, 200);
  const cookie = auth.response.headers['set-cookie'][0]; assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  const rows = (await pool.query('SELECT sess FROM admin_sessions')).rows; assert.equal(rows.length, 1); assert.equal(rows[0].sess.adminId, 1);
  await auth.agent.get('/api/messages').expect(200).expect('Cache-Control', 'no-store, private');
  await mutate(auth, 'post', '/api/auth/logout', {}).expect(200);
  await request(app).get('/api/messages').set('Cookie', cookie.split(';')[0]).expect(401);
});
test('authentication: wrong password and unknown email return identical error, persistent brute-force limits', async () => {
  const agent = request.agent(app); const csrf = (await agent.get('/api/auth/csrf')).body.csrf;
  const a = await agent.post('/api/auth/login').set('Origin', config.origin).set('X-CSRF-Token', csrf).send({ email: 'test@example.com', password: 'wrong' }).expect(401);
  const b = await agent.post('/api/auth/login').set('Origin', config.origin).set('X-CSRF-Token', csrf).send({ email: 'missing@example.com', password: password }).expect(401);
  assert.deepEqual(a.body, b.body);
  for (let i = 0; i < 3; i++) await agent.post('/api/auth/login').set('Origin', config.origin).set('X-CSRF-Token', csrf).send({ email: 'test@example.com', password: 'wrong' }).expect(401);
  const restarted = await createApp({ config, pool });
  // A fresh session still shares the database-backed IP limit.
  const blocked = await login(restarted); assert.equal(blocked.response.status, 429); assert.equal(blocked.response.headers['retry-after'], '900');
});
test('authentication: database expiry and absolute session expiry are enforced', async () => {
  const auth = await login();
  await pool.query("UPDATE admin_sessions SET sess=jsonb_set(sess::jsonb,'{expiresAt}','0'::jsonb)::json");
  await auth.agent.get('/api/messages').expect(401);
  const other = await login(); await pool.query("UPDATE admin_sessions SET expire='2000-01-01'"); await other.agent.get('/api/messages').expect(401);
});
test('security: CSRF, same-origin/CORS, security headers and invalid JSON', async () => {
  const auth = await login();
  await auth.agent.post('/api/sync').set('Origin', config.origin).send({}).expect(403);
  await auth.agent.post('/api/sync').set('Origin', config.origin).set('X-CSRF-Token', 'é'.repeat(64)).send({}).expect(403);
  await auth.agent.post('/api/sync').set('X-CSRF-Token', auth.csrf).send({}).expect(403);
  await auth.agent.post('/api/sync').set('Origin', 'https://attacker.example').set('X-CSRF-Token', auth.csrf).send({}).expect(403);
  await auth.agent.get('/api/messages').set('Origin', 'https://attacker.example').expect(403);
  const headers = (await auth.agent.get('/admin/').expect(200)).headers;
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/); assert.equal(headers['x-content-type-options'], 'nosniff'); assert.equal(headers['access-control-allow-origin'], undefined);
  await auth.agent.patch(`/api/messages/${randomUUID()}`).set('Origin', config.origin).set('X-CSRF-Token', auth.csrf).set('Content-Type', 'application/json').send('{bad').expect(400);
});
test('production: Secure host-only cookie, session regeneration and no cross-origin login', async () => {
  const production = await createApp({ config: { ...config, production: true, origin: 'https://admin.example.test' }, pool });
  const bootstrap = await request(production).get('/api/auth/csrf').set('X-Forwarded-Proto', 'https');
  const anonymousCookie = bootstrap.headers['set-cookie'][0].split(';')[0];
  const response = await request(production).post('/api/auth/login').set('X-Forwarded-Proto', 'https').set('Origin', 'https://admin.example.test')
    .set('Cookie', anonymousCookie).set('X-CSRF-Token', bootstrap.body.csrf).send({ email: 'test@example.com', password }).expect(200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /^__Host-chie.sid=/); assert.match(cookie, /; Secure/); assert.match(cookie, /; HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.ok(!cookie.includes('Domain='));
  assert.notEqual(cookie.split(';')[0], anonymousCookie);
  await request(production).get('/api/messages').set('Cookie', anonymousCookie).set('X-Forwarded-Proto', 'https').expect(401);
  await request(production).get('/api/messages').set('Cookie', cookie.split(';')[0]).set('X-Forwarded-Proto', 'https').expect(200);
});
test('inbox: list, deterministic pagination, literal search, sort and SQL injection', async () => {
  await seed(25); const auth = await login();
  const first = (await auth.agent.get('/api/messages')).body; assert.equal(first.total, 25); assert.equal(first.messages.length, 20);
  const second = (await auth.agent.get('/api/messages?page=2')).body; assert.equal(second.messages.length, 5); assert.ok(!second.messages.some(m => first.messages.some(f => f.id === m.id)));
  const search = (await auth.agent.get('/api/messages').query({ search: 'letter 24' })).body; assert.equal(search.total, 1);
  assert.equal((await auth.agent.get('/api/messages').query({ search: "' OR 1=1 --" })).body.total, 0);
  assert.equal((await auth.agent.get('/api/messages').query({ search: '%' })).body.total, 0);
  const oldest = (await auth.agent.get('/api/messages?sort=oldest')).body; assert.match(oldest.messages[0].content, /letter 24/);
  await auth.agent.get('/api/messages?page=-1').expect(400); await auth.agent.get('/api/messages?filter=not-valid').expect(400);
  await auth.agent.get('/api/messages?filter=toString').expect(400);
  await auth.agent.patch('/api/messages/bad-id').set('Origin', config.origin).set('X-CSRF-Token', auth.csrf).send({ is_read: true }).expect(400);
});
test('inbox: read/unread, favorite/unfavorite, archive/unarchive, counts, local deletion confirmation and tombstone', async () => {
  const [message] = await seed(); const auth = await login();
  for (const field of ['is_read', 'is_favorite', 'is_archived']) {
    await mutate(auth, 'patch', `/api/messages/${message.id}`, { [field]: true }).expect(200);
    assert.equal((await pool.query('SELECT * FROM messages WHERE id=$1', [message.id])).rows[0][field], true);
    await mutate(auth, 'patch', `/api/messages/${message.id}`, { [field]: false }).expect(200);
  }
  await mutate(auth, 'patch', `/api/messages/${message.id}`, { is_favorite: true, is_archived: true }).expect(200);
  assert.equal((await auth.agent.get('/api/messages?filter=inbox')).body.total, 0);
  assert.equal((await auth.agent.get('/api/messages?filter=archived')).body.total, 1);
  assert.equal((await auth.agent.get('/api/messages?filter=favorites')).body.total, 1);
  assert.deepEqual((await auth.agent.get('/api/overview')).body, { total: 1, unread: 1, favorites: 1, recent: 1 });
  await mutate(auth, 'patch', `/api/messages/${message.id}`, { password_hash: 'x' }).expect(400);
  await mutate(auth, 'delete', `/api/messages/${message.id}`, {}).expect(400);
  await mutate(auth, 'delete', `/api/messages/${message.id}`, { confirm: true }).expect(200);
  assert.equal((await pool.query('SELECT content FROM messages')).rows[0].content, '');
  await repo.importPage(config.formId, [{ _date: new Date(message.received_at).toISOString(), message: message.content }], 0, true);
  assert.equal((await repo.overview()).total, 0);
});
test('integration: missing credentials fail closed, no fake live messages, no webhook ingress', async () => {
  const auth = await login(); assert.equal((await auth.agent.get('/api/integration')).body.configured, false);
  await mutate(auth, 'post', '/api/sync', {}).expect(503);
  assert.equal((await auth.agent.get('/api/messages')).body.total, 0);
  const missing = new Formspree({ ...config, mode: 'api' }); await assert.rejects(missing.page(0), { code: 'integration_not_configured' });
  await request(app).post('/webhooks/formspree').send({ submission: {} }).expect(404);
});
test('integration: documented URL, Bearer auth, pagination, outage, invalid data and 429', async () => {
  const liveConfig = { ...config, mode: 'api', apiToken: 'TEST-ONLY-PROVIDER-KEY' };
  let observed;
  const provider = new Formspree(liveConfig, async (url, options) => { observed = { url, options }; return new Response(JSON.stringify({ submissions: [{ message: 'hello', _date: '2026-11-02T00:00:00' }] })); });
  assert.equal((await provider.page(100)).length, 1);
  assert.equal(observed.url.origin, 'https://formspree.io'); assert.equal(observed.url.pathname, '/api/0/forms/mzeekake/submissions'); assert.equal(observed.url.searchParams.get('offset'), '100'); assert.equal(observed.options.headers.Authorization, 'Bearer TEST-ONLY-PROVIDER-KEY');
  for (const status of [401, 403, 429, 500]) {
    const p = new Formspree(liveConfig, async () => new Response('sensitive provider details', { status, headers: { 'Retry-After': '120' } }));
    await assert.rejects(p.page(0), error => error.status === (status === 429 ? 429 : 502) && !error.message.includes('sensitive'));
  }
  await assert.rejects(new Formspree(liveConfig, async () => { throw new Error('outage'); }).page(0), { code: 'provider_unavailable' });
  await assert.rejects(new Formspree(liveConfig, async () => new Response('{oops')).page(0), { code: 'provider_invalid_response' });
  await assert.rejects(new Formspree(liveConfig, async () => new Response('{}')).page(0), { code: 'provider_invalid_response' });
});
test('integration: authenticated synchronization, continuation, concurrent lease, duplicates and malformed payload transaction', async () => {
  const fixtures = Array.from({ length: 100 }, (_, i) => ({ _date: `2026-11-02T00:00:${String(i % 60).padStart(2, '0')}`, message: `[TEST FIXTURE] sync ${i}` }));
  let cursor = -1;
  const provider = { configured: true, async page(offset) { cursor = offset; return offset ? [] : fixtures; } };
  const live = await createApp({ config: { ...config, mode: 'api' }, pool, provider }); const auth = await login(live);
  assert.equal((await mutate(auth, 'post', '/api/sync', {}).expect(200)).body.complete, false); assert.equal(cursor, 0);
  assert.equal((await mutate(auth, 'post', '/api/sync', {}).expect(200)).body.complete, true); assert.equal(cursor, 100);
  await mutate(auth, 'post', '/api/sync', {}).expect(200); assert.equal((await repo.overview()).total, 100);
  assert.ok(await repo.claimSync()); await mutate(auth, 'post', '/api/sync', {}).expect(409); await repo.releaseSync();
  await assert.rejects(repo.importPage(config.formId, [{ message: 'valid', _date: '2026-11-01T00:00:00' }, { message: null, _date: 'bad' }], 100, false));
  assert.equal((await repo.overview()).total, 100);
  assert.equal((await repo.state()).next_offset, 100);
});
test('security: private source denied, public bundle allowlist, no exposed secrets or private content in error bodies', async () => {
  const auth = await login(); await seed();
  for (const route of ['/src/app.js', '/server/src/config.js', '/.env', '/assets/../src/app.js', '/admin/index.html']) await request(app).get(route).expect(404);
  const response = await auth.agent.get('/api/messages'); assert.ok(response.body.messages[0].content.includes('<img'));
  const publicConfig = await fs.readFile(path.resolve(__dirname, '../../config.js'), 'utf8'); assert.ok(!publicConfig.includes(config.secret));
  const broken = await createApp({ config, pool, repository: { async overview() { throw new Error('SECRET MESSAGE AND TOKEN'); } } });
  const failure = await request(broken).get('/api/overview').set('Cookie', auth.response.headers['set-cookie'][0].split(';')[0]).expect(503);
  assert.equal(failure.text.includes('SECRET'), false);
  execFileSync(process.execPath, [path.resolve(__dirname, '../../scripts/build-public.js')]);
  const output = path.resolve(__dirname, '../../dist');
  assert.deepEqual((await fs.readdir(output)).sort(), ['assets', 'config.js', 'index.html', 'music.css', 'music.js', 'script.js', 'style.css']);
  assert.ok(!(await fs.readFile(path.join(output, 'config.js'), 'utf8')).includes(config.secret));
});
test('storage: safe repeated migrations and durable messages, metadata and sessions across engine reopen', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chie-postgres-test-'));
  let disk;
  try {
    disk = await testDatabase(directory); await migrate(disk); await migrate(disk);
    const storage = new Repository(disk); await storage.importPage(config.formId, [{ _date: '2026-11-02T00:00:00', message: '[TEST FIXTURE] persistence' }], 0, true);
    const [message] = (await storage.list({})).messages; await storage.update(message.id, { is_read: true, is_favorite: true, is_archived: true });
    await disk.query("INSERT INTO admin_sessions(sid,sess,expire) VALUES('test-session',$1,'2099-01-01')", [{ adminId: 1 }]);
    await disk.end(); disk = await testDatabase(directory);
    const reopened = new Repository(disk); const saved = (await reopened.list({ filter: 'archived' })).messages[0];
    assert.equal(saved.content, '[TEST FIXTURE] persistence'); assert.equal(saved.is_read, true); assert.equal(saved.is_favorite, true);
    assert.equal((await disk.query('SELECT sess FROM admin_sessions')).rows[0].sess.adminId, 1);
  } finally { await disk?.end(); await fs.rm(directory, { recursive: true, force: true }); }
});
test('startup: missing required configuration and insecure production origins rejected', () => {
  assert.throws(() => configuration({}), /DATABASE_URL/);
  assert.throws(() => configuration({ DATABASE_URL: 'postgres://test', SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.throws(() => configuration({ DATABASE_URL: 'postgres://test', SESSION_SECRET: config.secret, NODE_ENV: 'production', ADMIN_ORIGIN: config.origin }), /HTTPS/);
});
