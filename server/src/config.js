function configuration(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const origin = new URL(env.ADMIN_ORIGIN || 'http://127.0.0.1:8002');
  if (origin.origin !== (env.ADMIN_ORIGIN || 'http://127.0.0.1:8002')) throw new Error('ADMIN_ORIGIN must be an origin without a trailing slash');
  if (production && origin.protocol !== 'https:') throw new Error('Production requires HTTPS ADMIN_ORIGIN');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  // Render generates 256-bit secrets as 44-character base64 strings.
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 43) throw new Error('SESSION_SECRET must contain at least 43 random characters (256-bit base64 or stronger)');
  const mode = env.INBOX_MODE || 'disabled';
  if (!['disabled', 'api'].includes(mode)) throw new Error('INBOX_MODE must be disabled or api');
  const formId = env.FORMSPREE_FORM_ID || 'mzeekake';
  if (!/^[a-zA-Z0-9]+$/.test(formId)) throw new Error('Invalid FORMSPREE_FORM_ID');
  return { production, origin: origin.origin, databaseUrl: env.DATABASE_URL, secret: env.SESSION_SECRET,
    mode, formId, apiToken: env.FORMSPREE_API_TOKEN || '', port: Number(env.PORT || 8002),
    sessionMs: 4 * 60 * 60 * 1000 };
}
module.exports = { configuration };
