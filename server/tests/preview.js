// TEST FIXTURE SERVER ONLY. No real Formspree calls, never used by Render.
const argon2 = require('argon2');
const { testDatabase } = require('./database');
const { migrate } = require('../src/migrate');
const { Repository } = require('../src/storage');
const { createApp } = require('../src/app');
async function start() {
  const pool = await testDatabase(); await migrate(pool);
  await pool.query('INSERT INTO admin_users(id,email,password_hash) VALUES(1,$1,$2)', ['fixture@example.test', await argon2.hash('TEST-FIXTURE-PASSWORD-ONLY')]);
  const repo = new Repository(pool);
  await repo.importPage('mzeekake', Array.from({ length: 25 }, (_, i) => ({ _date: new Date(Date.now() - i * 60000).toISOString(), message: i === 0 ? '[TEST FIXTURE] <img src=x onerror="window.xss=true"> Chúc Chie một ngày thật dịu dàng ♡' : `[TEST FIXTURE] Lá thư thử nghiệm số ${i}. Đây là dữ liệu kiểm thử, không phải lời nhắn từ Formspree.` })), 0, true);
  const app = await createApp({ pool, config: { origin: 'http://127.0.0.1:8002', secret: 'TEST-FIXTURE-SESSION-SECRET-'.repeat(3), mode: 'disabled', formId: 'mzeekake', sessionMs: 14400000 } });
  const server = app.listen(8002, '127.0.0.1', () => console.log('TEST FIXTURE mailbox on http://127.0.0.1:8002'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => pool.end().then(() => process.exit(0))));
}
start().catch(error => { console.error(error.message); process.exit(1); });
