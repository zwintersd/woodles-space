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
