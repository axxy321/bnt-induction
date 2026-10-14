-- ============================================================================
--  RUN THIS IN SUPABASE  (SQL Editor -> New query -> paste -> Run)
--
--  FIXES THESE ERRORS:
--    42703  column "slide_type" does not exist           (induction_slides)
--    42703  column quiz_questions.slide_id does not exist
--    PGRST204 'content_json' / 'audio_url' / 'forced_wait_seconds' in schema cache
--    PGRST204 'verified_at' column of 'documents' in schema cache
--
--  CAUSE
--    Migration 012_slide_course_builder.sql has never been applied. It declared
--    these columns inside `create table if not exists`, which does NOTHING when
--    the table already exists — so your induction_slides table is missing them.
--    The documents table is also missing verified_at from migration 007/008.
--    This script adds them explicitly instead.
--
--  SAFE
--    Pure `add column if not exists`. Nothing is dropped, altered or deleted.
--    Columns are added nullable (or with defaults) so existing rows survive.
--    Safe to run more than once. Does not touch learning_sections, profiles,
--    drivers, progress, certificates or documents (only adds columns to documents).
-- ============================================================================

-- 1. induction_slides: the slide-builder columns (from migration 012)
alter table public.induction_slides
  add column if not exists course_id uuid references public.induction_courses(id) on delete cascade,
  add column if not exists slide_order int,
  add column if not exists slide_type text,
  add column if not exists title text,
  add column if not exists content_json jsonb not null default '{}'::jsonb,
  add column if not exists video_url text,
  add column if not exists audio_url text,
  add column if not exists forced_wait_seconds int not null default 0,
  add column if not exists estimated_duration_seconds int not null default 0,
  add column if not exists trigger_config jsonb not null default '{}'::jsonb,   -- migration 014
  add column if not exists site_tag text not null default 'global';             -- migration 015

-- 2. quiz_questions: slide-linked questions, multi-select and free-text answers
alter table public.quiz_questions
  add column if not exists question_type text not null default 'single_choice',
  add column if not exists slide_id uuid references public.induction_slides(id) on delete set null,
  add column if not exists placement text not null default 'separate_page',
  add column if not exists correct_answers jsonb not null default '[]'::jsonb,  -- migration 015
  add column if not exists accepted_answers jsonb not null default '[]'::jsonb; -- migration 015

-- 3. Documents table: add verified_at and verified_by_user_id columns
alter table public.documents
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by_user_id uuid references public.profiles(id) on delete set null;

-- 4. Reload PostgREST's schema cache so the new columns are actually served
notify pgrst, 'reload schema';


-- ============================================================================
--  VERIFY — run this afterwards. It should list slide_type, content_json,
--  audio_url, forced_wait_seconds, trigger_config and site_tag.
--
--    select column_name, data_type
--    from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'induction_slides'
--    order by ordinal_position;
--
--  And this should work without a 42703 / PGRST204 error:
--
--    select id, title, slide_type, audio_url, content_json
--    from public.induction_slides
--    limit 5;
-- ============================================================================
