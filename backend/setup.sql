-- ============================================================
-- CISO Dashboard — SINGLE FILE COMPLETE SETUP
-- ============================================================
-- Run from the command line (not pgAdmin):
--
--   "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"
--
-- It will ask for the postgres password. After it finishes, the
-- central database (cisodashboard) is ready with 5 organisations
-- and 7 users.
--
-- Then start the backend:
--   cd C:\Shubham\Tehsec\CISO\backend
--   npm run dev
--
-- It will auto-create ciso_org_<id> databases and seed dummy data.
-- ============================================================

-- ============================================================
-- PHASE 1: Wipe every existing database, then recreate cisodashboard
-- (runs against the `postgres` maintenance DB)
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT datname FROM pg_database WHERE datname LIKE 'ciso_org_%'
  LOOP
    EXECUTE format(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %L',
      r.datname
    );
    EXECUTE format('DROP DATABASE IF EXISTS %I', r.datname);
    RAISE NOTICE 'Dropped database: %', r.datname;
  END LOOP;

  EXECUTE 'DROP DATABASE IF EXISTS cisodashboard';
  RAISE NOTICE 'Dropped database: cisodashboard';
END
$$;

CREATE DATABASE cisodashboard;

-- Switch to the freshly-created cisodashboard for the rest of the script.
-- This psql meta-command reconnects and the rest of the file runs against
-- cisodashboard automatically.
\c cisodashboard

-- ============================================================
-- PHASE 2: Create tables and seed data
-- (runs against cisodashboard)
-- ============================================================

DROP TABLE IF EXISTS api_responses CASCADE;
DROP TABLE IF EXISTS api_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organisations CASCADE;
DROP TABLE IF EXISTS super_admin CASCADE;

CREATE TABLE super_admin (
  id SERIAL PRIMARY KEY,
  role VARCHAR(50) DEFAULT 'superAdmin',
  org_ids INTEGER[]
);

CREATE TABLE organisations (
  id          SERIAL       PRIMARY KEY,
  org_name    VARCHAR(100) NOT NULL,
  address     TEXT,
  mobile_no   VARCHAR(20),
  slug        VARCHAR(100) UNIQUE,
  is_active   BOOLEAN      DEFAULT TRUE,
  email       VARCHAR(255),
  website     VARCHAR(255),
  industry    VARCHAR(100),
  plan        VARCHAR(50)  DEFAULT 'free',
  color       VARCHAR(20),
  description TEXT
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  org_ids INTEGER[]
);

CREATE TABLE api_tokens (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  api_name VARCHAR(100) NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE api_responses (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organisations(id) ON DELETE CASCADE,
  api_name VARCHAR(100) NOT NULL,
  response_data JSONB,
  fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_responses_org_api ON api_responses(org_id, api_name, fetched_at DESC);

-- Org-level members (non-super-admin users belonging to specific orgs)
CREATE TABLE org_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        INTEGER     NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password      VARCHAR(255),
  role          VARCHAR(50) NOT NULL DEFAULT 'org_user',
  department    VARCHAR(100),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  allowed_pages TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, org_id)
);
CREATE INDEX IF NOT EXISTS idx_org_users_org_id ON org_users(org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_email  ON org_users(email);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_org_users_updated_at
  BEFORE UPDATE ON org_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cron sharding configuration
CREATE TABLE cron_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO cron_config (key, value) VALUES ('total_shards', '1');

-- ============================================================
-- SEED DATA
-- ============================================================

-- 5 organisations
INSERT INTO organisations (org_name, address, mobile_no) VALUES
('Techsec Global Private Ltd', 'Mumbai, MH',     '022-11110000'),
('PCPL Construction',           'Pune, MH',       '020-22220000'),
('Acme Cyber Defense',          'Bangalore, KA',  '080-33330000'),
('Northwind Logistics',         'Delhi, DL',      '011-44440000'),
('BlueShield Healthcare',       'Chennai, TN',    '044-55550000');

-- 7 users with REAL bcrypt password hashes (cost 10)
INSERT INTO users (username, password, role, org_ids) VALUES
('Radhesh', '$2b$10$ij5fm1V4Je4XdszZYxe.qejgZm1dUT00QUSWiqu60dGm86T6snuIm', 'member',     ARRAY[1]),
('Ramesh',  '$2b$10$2tPIscmvkAyA2UDPDf7auuWMCOlbd/WRz3X5iLOjyJxV.0bsQSlBG', 'admin',      ARRAY[1,2]),
('Raju',    '$2b$10$6kDbdUa51QkzjDGpdBNegeFdkcDl3giQVxLO5BceuROACDgfo7xc.', 'member',     ARRAY[2]),
('Shubham', '$2b$10$aLIQUYdvwCbrD6pZyCGPFeAlMQ2lhHLbxk3aVIgbkK4b6G2vIYCPi', 'superAdmin', ARRAY[1,2,3,4,5]),
('Priya',   '$2b$10$B9rqc7BvA8N8n4.eJ77l/.vIpJnMhNawaYEgd15h/7ffBxKEc/aK2', 'admin',      ARRAY[3]),
('Karan',   '$2b$10$ji19lQ2vyN9fIXK.ex.nbeKUDWFQ7nnFxS2S0BTGAbJkcprCWAMtm', 'admin',      ARRAY[4]),
('Anita',   '$2b$10$ZujRaLJAWA6m1Mii3qdVWeoA3uL5GBISoM5cD0PvzvuLzozimqVPK', 'admin',      ARRAY[5]);

-- 4 legacy tokens (used as source for migrate.js to populate ciso_org_<id>)
INSERT INTO api_tokens (org_id, api_name, token) VALUES
(1, 'SentinelOne', 'token_s1_org1_demo_xxxxxxxxxxxx'),
(1, 'Firewall',    'token_fw_org1_demo_xxxxxxxxxxxx'),
(2, 'SentinelOne', 'token_s1_org2_demo_xxxxxxxxxxxx'),
(2, 'Checkpoint',  'token_cp_org2_demo_xxxxxxxxxxxx');

-- ============================================================
-- DONE. Login credentials:
--   Radhesh  -> Radhesh@123   (member,     org 1)
--   Ramesh   -> Ramesh@123    (admin,      orgs 1, 2)
--   Raju     -> Raju@123      (member,     org 2)
--   Shubham  -> Shubham@123   (superAdmin, orgs 1, 2, 3, 4, 5)
--   Priya    -> Priya@123     (admin,      org 3)
--   Karan    -> Karan@123     (admin,      org 4)
--   Anita    -> Anita@123     (admin,      org 5)
-- ============================================================
