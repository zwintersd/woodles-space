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
