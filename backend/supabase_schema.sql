-- ============================================================
-- Cloud Text Expander — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. CANS TABLE ────────────────────────────────────────────
-- Stores both PERSONAL and ORGANIZATION cans.
CREATE TABLE IF NOT EXISTS cans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  shortcut    TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  scope       TEXT        NOT NULL DEFAULT 'PERSONAL'   CHECK (scope IN ('PERSONAL', 'ORGANIZATION')),
  status      TEXT        NOT NULL DEFAULT 'DRAFT'      CHECK (status IN ('DRAFT', 'PUBLISHED')),
  "ownerName" TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cans_updated_at ON cans;
CREATE TRIGGER cans_updated_at
  BEFORE UPDATE ON cans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_cans_scope      ON cans (scope);
CREATE INDEX IF NOT EXISTS idx_cans_owner      ON cans ("ownerName");
CREATE INDEX IF NOT EXISTS idx_cans_status     ON cans (status);
CREATE INDEX IF NOT EXISTS idx_cans_shortcut   ON cans (shortcut);


-- ── 2. NOTIFICATIONS TABLE ───────────────────────────────────
-- Stores notifications pushed when org cans are published/updated.
-- readBy: array of user names who have dismissed this notification.
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL CHECK (type IN ('CAN_PUBLISHED', 'CAN_UPDATED')),
  message    TEXT        NOT NULL,
  "canId"    UUID        REFERENCES cans(id) ON DELETE SET NULL,
  "readBy"   TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);


-- Option A: Disable RLS (Recommended when backend handles authorization)
ALTER TABLE cans          DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Option B: If RLS remains enabled in your Supabase project, grant full access to the API key:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cans' AND policyname = 'Allow API cans access'
  ) THEN
    CREATE POLICY "Allow API cans access" ON cans FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Allow API notifications access'
  ) THEN
    CREATE POLICY "Allow API notifications access" ON notifications FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── DONE ─────────────────────────────────────────────────────
-- Run the above SQL, then paste your SUPABASE_URL and SUPABASE_KEY
-- (found in Supabase Dashboard → Project Settings → API) into:
--   d:/Text-expander/backend/.env
