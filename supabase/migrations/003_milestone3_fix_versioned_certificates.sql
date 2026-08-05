-- Migration 003: Version-Aware Certificate Schema Fix
-- Remove single-column unique constraint on certificates(user_id)
-- Replace with composite unique constraint on (user_id, induction_version_id)
-- to allow multi-version certificate issuance per driver.

ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_user_id_key;
DROP INDEX IF EXISTS public.certificates_user_id_key;

-- Ensure induction_version_id column exists
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS induction_version_id uuid REFERENCES public.induction_versions(id);

-- Create composite unique index so a driver can hold 1 certificate per induction version
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_version_idx 
ON public.certificates (user_id, induction_version_id);
