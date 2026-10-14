-- ============================================================
-- Migration 015: Module Extras + Real Templates + Site Tags
-- Additive only — no existing column is altered, dropped or retyped.
--
-- 1. learning_sections.media_json   -> new optional content blocks
--                                     (images, documents, voiceover, warning,
--                                      inline questions, dwell lock, text size)
-- 2. learning_sections.site_tag     -> which depot a module belongs to
-- 3. learning_sections.source_slide_id -> lets a re-publish update in place
-- 4. induction_courses.is_template  -> real, working templates
-- 5. induction_courses.site_tag     -> which site a course variant is for
-- 6. induction_slides.site_tag      -> carried through the clone
-- 7. profiles.site_tag              -> each driver's depot
--
-- Defaults restore today's behaviour exactly:
--   media_json = '{}'      -> renders nothing
--   site_tag  = 'global'   -> visible to every driver, as now
-- ============================================================

-- 1–3. learning_sections extensions
alter table public.learning_sections
  add column if not exists media_json jsonb not null default '{}'::jsonb,
  add column if not exists site_tag text not null default 'global',
  add column if not exists source_slide_id uuid;

-- Drivers filter by site; keep this ordered for the Step 3 module list
create index if not exists learning_sections_site_order_idx
  on public.learning_sections (site_tag, sort_order);

-- Keep a published slide addressable so re-publishing updates instead of duplicating
create unique index if not exists learning_sections_source_slide_idx
  on public.learning_sections (source_slide_id)
  where source_slide_id is not null;

-- 4–5. induction_courses extensions
alter table public.induction_courses
  add column if not exists is_template boolean not null default false,
  add column if not exists site_tag text not null default 'global';

-- Templates are blueprints; each site keeps one live course
create index if not exists induction_courses_template_idx
  on public.induction_courses (is_template);

create index if not exists induction_courses_site_idx
  on public.induction_courses (site_tag);

-- 6. induction_slides extension — survives the clone so a copied slide
--    still knows which site it belongs to
alter table public.induction_slides
  add column if not exists site_tag text not null default 'global';

create index if not exists induction_slides_site_idx
  on public.induction_slides (site_tag);

-- 7. profiles extension — the driver's depot.
--    Defaults to 'global' so every existing driver keeps seeing the current
--    shared modules and nothing disappears from their induction.
alter table public.profiles
  add column if not exists site_tag text not null default 'global';

-- 8. quiz_questions: multiple-choice answers and accepted free-text answers.
--    `correct_answer` remains the single-choice key; these two columns are
--    additive, so every existing question keeps working untouched.
alter table public.quiz_questions
  add column if not exists correct_answers jsonb not null default '[]'::jsonb,
  add column if not exists accepted_answers jsonb not null default '[]'::jsonb;

-- Refresh RLS: rows are readable by any authenticated user (as before),
-- and the new columns inherit those same policies — no policy change needed.
-- Drivers only ever see rows their filter allows them to; `is_template`
-- rows are excluded at query time, never by RLS, so an admin can still
-- open a template to edit it.

-- ============================================================
-- END OF MIGRATION 015
-- ============================================================
