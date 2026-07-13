-- Run this once against the cisodashboard central database to align
-- org_users with SoneTenancy's schema.

-- 1. Unique constraint: prevent duplicate email in the same org
ALTER TABLE org_users
  ADD CONSTRAINT IF NOT EXISTS uq_org_users_email_org UNIQUE (email, org_id);

-- 2. updated_at auto-update trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_users_updated_at ON org_users;
CREATE TRIGGER trg_org_users_updated_at
  BEFORE UPDATE ON org_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Index for fast per-org lookups (safe to run if already exists)
CREATE INDEX IF NOT EXISTS idx_org_users_org_id ON org_users(org_id);
CREATE INDEX IF NOT EXISTS idx_org_users_email  ON org_users(email);
