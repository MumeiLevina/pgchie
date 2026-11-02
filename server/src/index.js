const { Pool } = require('pg');
const { configuration } = require('./config');
const { migrate } = require('./migrate');
const { createApp } = require('./app');
async function start() {
  const config = configuration();
  const pool = new Pool({ connectionString: config.databaseUrl, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  pool.on('error', () => console.error('Database connection unavailable.'));
  await migrate(pool);
  const app = await createApp({ config, pool });
  const server = app.listen(config.port, '0.0.0.0', () => console.log(`Private mailbox listening on port ${config.port}.`));
  let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    if (stopping) return; stopping = true;
    const timer = setTimeout(() => process.exit(1), 10000); timer.unref();
    server.close(() => pool.end().then(() => process.exit(0)));
  });
  // Expire unused sessions and throttle buckets without storing request content.
  setInterval(() => pool.query('DELETE FROM admin_sessions WHERE expire < now(); DELETE FROM login_limits WHERE resets_at < now()')
    .catch(() => console.error('Database housekeeping unavailable.')), 15 * 60000).unref();
}
start().catch(() => { console.error('Mailbox startup failed. Check required environment variables and database availability.'); process.exit(1); });
