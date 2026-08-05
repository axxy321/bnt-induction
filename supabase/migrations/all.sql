-- ============================================================
-- Milestone 1: Workflow State Machine & Versioned Inductions
-- Additive migration — no existing tables or data are modified
-- ============================================================

-- Track induction content versions published by admins
create table if not exists public.induction_versions (
  id            uuid primary key default gen_random_uuid(),
  version_label text not null,               -- e.g. "2.0", "2024-Q2"
  revision_notes text not null default '',   -- what changed in this version
  published_by  uuid references public.profiles(id) on delete set null,
  published_at  timestamptz not null default now(),
  is_current    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Ensure only one version is marked current at any time
create unique index if not exists induction_versions_current_idx
  on public.induction_versions (is_current)
  where is_current = true;

-- Soft-link induction_progress to the version it was started against
-- NULL means pre-versioning (legacy / original induction)
alter table public.induction_progress
  add column if not exists induction_version_id uuid
    references public.induction_versions(id) on delete set null;

-- Soft-link certificates to the version under which they were issued
alter table public.certificates
  add column if not exists induction_version_id uuid
    references public.induction_versions(id) on delete set null;

-- Index for fast lookups of progress by version
create index if not exists induction_progress_version_idx
  on public.induction_progress (induction_version_id);

-- Index for fast lookups of certificates by version
create index if not exists certificates_version_idx
  on public.certificates (induction_version_id);

-- RLS: Admins can manage all versions; drivers can only read the current version
alter table public.induction_versions enable row level security;

drop policy if exists "induction_versions_select" on public.induction_versions;
create policy "induction_versions_select"
  on public.induction_versions for select
  using (true);  -- any authenticated user can read version info

drop policy if exists "induction_versions_admin_manage" on public.induction_versions;
create policy "induction_versions_admin_manage"
  on public.induction_versions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Seed the first version record representing the existing induction content
-- This links all existing records (pre-versioning) to a baseline "1.0" version
insert into public.induction_versions (version_label, revision_notes, is_current, created_at)
values ('1.0', 'Initial induction content — Chain of Responsibility, Fatigue Management, Load Restraint, Speed & Compliance, Vehicle Checks, Site Safety, Incident Reporting, Mass/Dimension, WHS & PPE, Drug & Alcohol, HVNL Overview.', true, now())
on conflict do nothing;

-- ============================================================
-- END OF MILESTONE 1 MIGRATION
-- ============================================================
-- ============================================================
-- Milestone 2: Randomised Question Bank, Critical Questions, Category Scoring
-- Additive migration — no existing columns or tables destroyed
-- ============================================================

-- 1. Add category and is_critical columns to quiz_questions
alter table public.quiz_questions
  add column if not exists category text not null default 'General',
  add column if not exists is_critical boolean not null default false;

-- 2. Add category_scores, failed_critical, and critical_questions_asked columns to quiz_attempts
alter table public.quiz_attempts
  add column if not exists category_scores jsonb not null default '{}'::jsonb,
  add column if not exists failed_critical boolean not null default false,
  add column if not exists critical_questions_asked integer not null default 0;

-- Index for category queries
create index if not exists quiz_questions_category_idx on public.quiz_questions (category);
create index if not exists quiz_questions_critical_idx on public.quiz_questions (is_critical);

-- Update existing 11 questions with categories & critical flags
update public.quiz_questions set category = 'Chain of Responsibility', is_critical = true where sort_order = 1;
update public.quiz_questions set category = 'Fatigue Management', is_critical = true where sort_order = 2;
update public.quiz_questions set category = 'Load Restraint', is_critical = false where sort_order = 3;
update public.quiz_questions set category = 'Speed & Compliance', is_critical = false where sort_order = 4;
update public.quiz_questions set category = 'Vehicle Checks & Defects', is_critical = true where sort_order = 5;
update public.quiz_questions set category = 'Site Safety & Loading Zones', is_critical = false where sort_order = 6;
update public.quiz_questions set category = 'Incident Reporting', is_critical = false where sort_order = 7;
update public.quiz_questions set category = 'Mass & Dimension', is_critical = false where sort_order = 8;
update public.quiz_questions set category = 'WHS & PPE', is_critical = false where sort_order = 9;
update public.quiz_questions set category = 'Drug & Alcohol', is_critical = true where sort_order = 10;
update public.quiz_questions set category = 'HVNL Law', is_critical = false where sort_order = 11;

-- Expand Question Bank Pool with additional heavy vehicle compliance questions
insert into public.quiz_questions (question, options, correct_answer, explanation, sort_order, category, is_critical)
values
  (
    'What is the maximum allowed driving hours in a standard 24-hour period under standard fatigue management rules?',
    '["12 hours","14 hours","16 hours","8 hours"]'::jsonb,
    0,
    'Under standard fatigue management rules, a solo driver must not exceed 12 hours of work/driving time in any 24-hour period.',
    12,
    'Fatigue Management',
    true
  ),
  (
    'What must a driver do if a load shifts during transit and threatens vehicle stability?',
    '["Continue at reduced speed","Stop in a safe place immediately and rectify the load restraint","Drive to the nearest customer","Ignore it if destination is near"]'::jsonb,
    1,
    'Unstable or shifted loads pose an immediate rollover hazard. Drivers must safely pull over and rectify restraint immediately.',
    13,
    'Load Restraint',
    true
  ),
  (
    'Under HVNL, who can be prosecuted if a driver is pressured to exceed legal mass limits?',
    '["Only the driver","Only the fleet owner","Both the driver and the scheduler/customer under Chain of Responsibility","Nobody if the delivery was completed"]'::jsonb,
    2,
    'Chain of Responsibility extends legal liability to all parties including schedulers, loaders, and customers who influence mass compliance.',
    14,
    'Chain of Responsibility',
    true
  ),
  (
    'What action is required if a random drug test returns a positive result at a logistics depot?',
    '["Driver is immediately stood down from driving duties","Driver is allowed to finish the day","Driver receives a verbal warning only","Driver can drive if feeling fine"]'::jsonb,
    0,
    'Heavy vehicle drivers must maintain zero drug and alcohol presence. A positive test mandates immediate stand-down.',
    15,
    'Drug & Alcohol',
    true
  ),
  (
    'When reversing a heavy vehicle in a crowded depot loading area, what is the safest practice?',
    '["Reverse quickly to avoid blocking traffic","Use a spotter or walk around the rear before reversing if view is obstructed","Rely solely on side mirrors","Honk horn and reverse without stopping"]'::jsonb,
    1,
    'Obstructed rear views cause severe depot accidents. Always walk around or use a trained spotter before reversing.',
    16,
    'Site Safety & Loading Zones',
    false
  ),
  (
    'What is the correct procedure when discovering a major brake line air leak during a daily pre-start check?',
    '["Drive carefully to a workshop","Tag out the vehicle, log defect, and do not drive until repaired","Fill air tanks and drive fast","Request permission from customer to drive"]'::jsonb,
    1,
    'Major defects like brake leaks render a heavy vehicle unroadworthy and strictly prohibited from operation.',
    17,
    'Vehicle Checks & Defects',
    true
  ),
  (
    'If an injury occurs on site during freight loading, within what timeframe must the incident be reported to the site safety officer?',
    '["Immediately","Within 24 hours","At the end of the week","Only if hospitalization occurs"]'::jsonb,
    0,
    'All workplace injuries must be reported immediately to ensure emergency assistance and WHS hazard containment.',
    18,
    'Incident Reporting',
    false
  ),
  (
    'What is the primary danger of driving a heavy vehicle with uneven lateral weight distribution?',
    '["Increased fuel consumption","Increased risk of rollover on curves or roundabouts","Slower acceleration","Uneven tire wear only"]'::jsonb,
    1,
    'Lateral imbalance drastically lowers the rollover threshold of heavy vehicles during turns.',
    19,
    'Mass & Dimension',
    false
  ),
  (
    'What safety equipment must be carried in all heavy transport vehicles operating under BNT Logistics WHS rules?',
    '["High-vis vest, safety boots, warning triangles, fire extinguisher, first aid kit","Only a spare tire","Sunglasses and gloves","None unless carrying dangerous goods"]'::jsonb,
    0,
    'Standard heavy vehicle safety kits include PPE, emergency warning triangles, fire extinguisher, and a first aid kit.',
    20,
    'WHS & PPE',
    false
  )
on conflict do nothing;

-- ============================================================
-- END OF MILESTONE 2 MIGRATION
-- ============================================================
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
-- F-06: Atomic publish of induction versions to avoid TOCTOU window
CREATE OR REPLACE FUNCTION publish_induction_version(label text, notes text, publisher uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
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
-- Add video_duration_seconds to learning_sections
ALTER TABLE public.learning_sections 
ADD COLUMN IF NOT EXISTS video_duration_seconds int DEFAULT 0;

-- Add section_started_at to learning_section_completions
ALTER TABLE public.learning_section_completions 
ADD COLUMN IF NOT EXISTS section_started_at timestamptz;
