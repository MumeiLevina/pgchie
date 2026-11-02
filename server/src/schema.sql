CREATE TABLE IF NOT EXISTS admin_users (
  id integer PRIMARY KEY CHECK (id = 1),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expire ON admin_sessions(expire);
CREATE TABLE IF NOT EXISTS login_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  resets_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  provider text NOT NULL DEFAULT 'formspree',
  provider_message_id text NOT NULL UNIQUE,
  content text NOT NULL,
  received_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_received ON messages(received_at DESC, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS messages_unread ON messages(is_read, received_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS messages_favorites ON messages(is_favorite) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS messages_archived ON messages(is_archived) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS integration_state (
  id integer PRIMARY KEY CHECK (id = 1),
  next_offset integer NOT NULL DEFAULT 0,
  last_sync timestamptz,
  locked_until timestamptz NOT NULL DEFAULT '1970-01-01'
);
INSERT INTO integration_state(id) VALUES (1) ON CONFLICT DO NOTHING;
