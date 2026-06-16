-- ============================================================
-- MIGRATION: add_client_profiles
-- Phase 4: Client profile / onboarding
--
-- Creates client_profiles table (one row per auth user) with
-- safe RLS policies — users can only read/write their own row.
-- Does NOT touch any existing order, admin, or sequence tables.
-- ============================================================

-- -----------------------------------------------------------
-- TABLE: client_profiles
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name   TEXT,
  last_name    TEXT,
  full_name    TEXT,
  company_name TEXT,
  phone        TEXT,
  country      TEXT,
  industry     TEXT,
  how_found_us TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT client_profiles_user_id_unique UNIQUE (user_id)
);

-- -----------------------------------------------------------
-- INDEX
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_client_profiles_user_id
  ON client_profiles (user_id);

-- -----------------------------------------------------------
-- TRIGGER: keep updated_at current
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_client_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_profiles_updated_at ON client_profiles;
CREATE TRIGGER client_profiles_updated_at
  BEFORE UPDATE ON client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_client_profile_updated_at();

-- -----------------------------------------------------------
-- RLS
-- -----------------------------------------------------------
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read their own row only
DROP POLICY IF EXISTS "client_profiles_select_own" ON client_profiles;
CREATE POLICY "client_profiles_select_own"
  ON client_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: users can insert their own row only
DROP POLICY IF EXISTS "client_profiles_insert_own" ON client_profiles;
CREATE POLICY "client_profiles_insert_own"
  ON client_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: users can update their own row only
DROP POLICY IF EXISTS "client_profiles_update_own" ON client_profiles;
CREATE POLICY "client_profiles_update_own"
  ON client_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No DELETE policy — clients cannot delete their own profile row.
-- No public/anon access — only authenticated users via the policies above.
