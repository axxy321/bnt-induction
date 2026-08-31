-- Migration 006: Security Hardening
-- Fixes:
--   C-3: publish_induction_version SECURITY DEFINER had no admin role check
--   M-1: reset_expired_inductions had no admin check (any user could DoS)
--   H-5: audit_logs.user_id missing FK → profiles(id)

-- ── C-3 Fix: Add admin guard to publish_induction_version ──────────────────
CREATE OR REPLACE FUNCTION publish_induction_version(label text, notes text, publisher uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  caller_role text;
BEGIN
  -- Authorization guard: only admin profiles may publish versions
  SELECT role INTO caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin role required to publish induction versions';
  END IF;

  -- De-activate the current version
  UPDATE induction_versions
  SET is_current = false
  WHERE is_current = true;

  -- Insert the new version and mark it as current
  INSERT INTO induction_versions (version_label, revision_notes, published_by, is_current)
  VALUES (label, notes, publisher, true)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- ── M-1 Fix: Add admin guard to reset_expired_inductions ───────────────────
-- Only allow admin callers to invoke this expensive batch operation
CREATE OR REPLACE FUNCTION reset_expired_inductions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Authorization guard: only admin profiles may trigger bulk resets
  SELECT role INTO caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: admin role required to reset expired inductions';
  END IF;

  -- Mark expired inductions as needing reset (drivers with old version certificates)
  UPDATE induction_progress ip
  SET completed = false,
      current_step = 1,
      completion_percentage = 0,
      updated_at = now()
  FROM certificates c
  JOIN induction_versions iv ON iv.id = c.induction_version_id
  WHERE ip.user_id = c.user_id
    AND iv.is_current = false
    AND ip.completed = true;
END;
$$;

-- ── H-5 Fix: Add FK constraint on audit_logs.user_id ──────────────────────
-- Use ON DELETE SET NULL so audit records survive profile deletions
-- (compliance audit trail stays intact even if the driver is removed)
DO $$
BEGIN
  -- Only add if not already present
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_user_id_fkey'
      AND table_name = 'audit_logs'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
