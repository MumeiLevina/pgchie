const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY)');
    // Serialize concurrent startup migrations using a dedicated database lock.
    await client.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
    const existing = await client.query('SELECT version FROM schema_migrations WHERE version = 1');
    if (!existing.rows.length) {
      await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES (1)');
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  migrate(pool).then(() => console.log('Database schema ready.')).catch(() => { console.error('Migration failed; inspect database configuration.'); process.exitCode = 1; }).finally(() => pool.end());
}
module.exports = { migrate };
