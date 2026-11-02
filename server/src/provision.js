// Run interactively in a trusted terminal/Render shell. Never put a password in argv or Git.
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const argon2 = require('argon2');
const { Pool } = require('pg');
const { migrate } = require('./migrate');
async function provision() {
  if (!process.stdin.isTTY) throw new Error('An interactive trusted terminal is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(pool);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const email = (await rl.question('Admin email: ')).trim().toLowerCase(); rl.close();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid email');
    process.stdout.write('New password (minimum 14 characters; hidden): ');
    const hidden = readline.createInterface({ input: process.stdin, output: new Writable({ write(_c, _e, cb) { cb(); } }), terminal: true });
    const password = await hidden.question(''); hidden.close(); process.stdout.write('\n');
    if (password.length < 14 || password.length > 1024) throw new Error('Password must contain 14–1024 characters');
    const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO admin_users(id,email,password_hash) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET email=$1,password_hash=$2', [email, hash]);
      await client.query('DELETE FROM admin_sessions');
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    console.log('Admin provisioned; previous sessions invalidated.');
  } finally { await pool.end(); }
}
provision().catch(() => { console.error('Provisioning failed. Use a trusted interactive terminal, valid email and a 14–1024 character password; check database access.'); process.exitCode = 1; });
