const { randomUUID, createHash } = require('node:crypto');
class Repository {
  constructor(pool) { this.pool = pool; }
  async admin() { return (await this.pool.query('SELECT * FROM admin_users WHERE id = 1')).rows[0]; }
  async throttle(key, limit, windowMs) {
    const result = await this.pool.query(`INSERT INTO login_limits(key,hits,resets_at) VALUES ($1,1,$2)
      ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN login_limits.resets_at < now() THEN 1 ELSE login_limits.hits + 1 END,
      resets_at = CASE WHEN login_limits.resets_at < now() THEN $2 ELSE login_limits.resets_at END
      RETURNING hits`, [key, new Date(Date.now() + windowMs)]);
    return result.rows[0].hits <= limit;
  }
  async overview() {
    return (await this.pool.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE NOT is_read)::int AS unread,
      count(*) FILTER (WHERE is_favorite)::int AS favorites,
      count(*) FILTER (WHERE received_at >= now() - interval '7 days')::int AS recent
      FROM messages WHERE deleted_at IS NULL`)).rows[0];
  }
  async list({ filter = 'inbox', search = '', page = 1, sort = 'newest' }) {
    const filters = { inbox: 'NOT is_archived', unread: 'NOT is_read AND NOT is_archived', favorites: 'is_favorite', archived: 'is_archived', overview: 'true' };
    if (typeof filter !== 'string' || !Object.hasOwn(filters, filter)) throw Object.assign(new Error('Invalid filter'), { status: 400 });
    const clause = filters[filter];
    const where = `deleted_at IS NULL AND ${clause} AND content ILIKE $1`;
    // Escape LIKE wildcards so search is literal; every user value is parameterized.
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    const count = await this.pool.query(`SELECT count(*)::int AS total FROM messages WHERE ${where}`, [pattern]);
    const direction = sort === 'oldest' ? 'ASC' : 'DESC';
    const rows = await this.pool.query(`SELECT id,content,received_at,is_read,is_favorite,is_archived FROM messages
      WHERE ${where} ORDER BY received_at ${direction}, id ${direction} LIMIT 20 OFFSET $2`, [pattern, (page - 1) * 20]);
    return { messages: rows.rows, total: count.rows[0].total, page, pageSize: 20 };
  }
  async update(id, changes) {
    const fields = Object.keys(changes);
    if (!fields.length || fields.some(k => !['is_read', 'is_favorite', 'is_archived'].includes(k) || typeof changes[k] !== 'boolean')) throw Object.assign(new Error('Invalid changes'), { status: 400 });
    const result = await this.pool.query(`UPDATE messages SET ${fields.map((f, i) => `${f}=$${i + 2}`).join(',')}
      WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [id, ...Object.values(changes)]);
    return result.rows.length > 0;
  }
  async delete(id) {
    // Keep a content-free tombstone so a future provider import cannot resurrect it.
    return (await this.pool.query("UPDATE messages SET content='', is_favorite=false, deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id", [id])).rows.length > 0;
  }
  async state() { return (await this.pool.query('SELECT next_offset,last_sync FROM integration_state WHERE id=1')).rows[0]; }
  async claimSync() {
    return (await this.pool.query("UPDATE integration_state SET locked_until=now() + interval '2 minutes' WHERE id=1 AND locked_until < now() RETURNING next_offset")).rows[0];
  }
  async releaseSync() { await this.pool.query("UPDATE integration_state SET locked_until='1970-01-01' WHERE id=1"); }
  async importPage(formId, submissions, offset, done) {
    // Validate an entire page before writing any of it.
    const rows = submissions.map(s => {
      if (!s || typeof s.message !== 'string' || !s.message.trim() || s.message.length > 10000 || typeof s._date !== 'string') throw Object.assign(new Error('Malformed provider payload'), { status: 502 });
      const date = /(?:Z|[+-]\d\d:\d\d)$/.test(s._date) ? s._date : `${s._date}Z`;
      const receivedAt = new Date(date);
      if (!Number.isFinite(receivedAt.getTime())) throw Object.assign(new Error('Malformed provider date'), { status: 502 });
      const identity = createHash('sha256').update(JSON.stringify([formId, s._date, s.message])).digest('hex');
      return [randomUUID(), identity, s.message, receivedAt];
    });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) await client.query(`INSERT INTO messages(id,provider_message_id,content,received_at)
        VALUES($1,$2,$3,$4) ON CONFLICT(provider_message_id) DO NOTHING`, row);
      await client.query('UPDATE integration_state SET next_offset=$1,last_sync=now() WHERE id=1', [done ? 0 : offset + submissions.length]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
module.exports = { Repository };
