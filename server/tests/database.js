// TEST ONLY: PostgreSQL WASM engine. Production always uses pg.Pool and DATABASE_URL.
const { PGlite } = require('@electric-sql/pglite');
async function testDatabase(directory) {
  const db = new PGlite(directory); await db.waitReady;
  let pending = Promise.resolve();
  async function connect() {
    const previous = pending; let unlock;
    pending = new Promise(resolve => { unlock = resolve; }); await previous;
    return { async query(sql, parameters = []) {
      if (!parameters.length && sql.includes(';')) {
        const results = await db.exec(sql); const last = results.at(-1); return { rows: last?.rows || [], rowCount: last?.affectedRows || 0 };
      }
      const values = parameters.map(v => v instanceof Date ? v.toISOString() : v && typeof v === 'object' ? JSON.stringify(v) : v);
      const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows };
    }, release: unlock };
  }
  return { connect, async query(sql, params) { const client = await connect(); try { return await client.query(sql, params); } finally { client.release(); } }, async end() { await pending; await db.close(); } };
}
module.exports = { testDatabase };
