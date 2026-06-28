-- ============================================================
-- CISO Dashboard — per-organisation schema
-- Runs against each per-org database (e.g. ciso_org_1, ciso_org_2).
-- No org_id columns — the database itself represents the org.
--
-- IMPORTANT: this schema is fully idempotent. It is applied to every
-- per-org database on EVERY server start (server.js -> ensureOrgDatabases).
-- Therefore it MUST NOT drop existing tables or fail on existing objects.
-- Use CREATE TABLE IF NOT EXISTS, never DROP.
-- ============================================================

-- API tokens configured for this organisation.
-- Preserves tokens added via the UI across server restarts.
CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  api_name VARCHAR(100) NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cached API responses for this organisation.
-- Preserves responses (and seeded dummy data) across server restarts.
CREATE TABLE IF NOT EXISTS api_responses (
  id SERIAL PRIMARY KEY,
  api_name VARCHAR(100) NOT NULL,
  response_data JSONB,
  fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_responses_api ON api_responses(api_name, fetched_at DESC);

-- Migration guards. These are flag tables (just one row = "yes, done").
-- They MUST persist across restarts so we don't re-migrate / re-seed on
-- every startup and create duplicate rows.
CREATE TABLE IF NOT EXISTS _migration_done (
  id SERIAL PRIMARY KEY,
  done_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS _seed_done (
  id SERIAL PRIMARY KEY,
  done_at TIMESTAMP DEFAULT NOW()
);
