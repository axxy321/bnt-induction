-- Production induction controls: remove client authority over completion evidence.

ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'hrwl_forklift';

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS verified_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "induction_progress_upsert" ON public.induction_progress;
DROP POLICY IF EXISTS "induction_progress_manage_admin" ON public.induction_progress;
CREATE POLICY "induction_progress_manage_admin"
ON public.induction_progress FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Audit entries are written by the authenticated API using the service role.
-- A driver must not be able to create arbitrary audit evidence for themselves.
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert"
ON public.audit_logs FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- Drivers receive questions through the authenticated API, which never returns
-- correct answers. Direct table reads would expose the answer key.
DROP POLICY IF EXISTS "quiz_questions_select" ON public.quiz_questions;
CREATE POLICY "quiz_questions_select" ON public.quiz_questions FOR SELECT
USING (public.is_admin(auth.uid()));
