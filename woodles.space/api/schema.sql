-- Schema for /api/sync. Run once against the Neon database (Vercel ▸ Storage ▸
-- Neon ▸ SQL Editor, or `psql "$DATABASE_URL"`).
--
-- One row per app key. `app` is the natural primary key; `version` is the
-- compare-and-swap token the endpoint bumps on every successful write.

CREATE TABLE IF NOT EXISTS sync (
  app        text        PRIMARY KEY,
  blob       jsonb       NOT NULL,
  version    bigint      NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Schema for /api/public — the curated, unauthenticated read path (ROADMAP.md
-- week 1). Separate from `sync`: this table holds snapshots Z has explicitly
-- published for anyone to read; `sync` stays single-user and password-gated
-- on both read and write. Keyed `(app, slug)` so one app can publish more than
-- one named snapshot (e.g. bestiary's curated set, echoes' published letters).
-- `version` bumps on every republish but writes are a whole-snapshot upsert,
-- not a compare-and-swap — there's no concurrent editor to race against.

CREATE TABLE IF NOT EXISTS published (
  app          text        NOT NULL,
  slug         text        NOT NULL,
  blob         jsonb       NOT NULL,
  version      bigint      NOT NULL DEFAULT 1,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (app, slug)
);

-- Password-protected schedules are deliberately separate from /api/public.
CREATE TABLE IF NOT EXISTS schedule_publications (
  id text PRIMARY KEY,
  source_id text NOT NULL,
  payload jsonb NOT NULL,
  password_hash text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  access_version bigint NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schedule_revisions (
  publication_id text NOT NULL REFERENCES schedule_publications(id) ON DELETE CASCADE,
  version bigint NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publication_id, version)
);
CREATE TABLE IF NOT EXISTS schedule_sessions (
  token_hash text PRIMARY KEY,
  scope text NOT NULL,
  access_version bigint NOT NULL,
  publisher_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS schedule_attempts (
  key text NOT NULL,
  "window" bigint NOT NULL,
  attempts integer NOT NULL,
  PRIMARY KEY (key, "window")
);
CREATE INDEX IF NOT EXISTS schedule_publications_updated ON schedule_publications(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS schedule_publications_source ON schedule_publications(source_id);
CREATE INDEX IF NOT EXISTS schedule_sessions_expiry ON schedule_sessions(expires_at);
