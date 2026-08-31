-- ============================================================
-- BNT Induction Platform — Live Database Migration
-- Run this entire file in:
--   Supabase Dashboard → SQL Editor → Paste → Run
-- ============================================================

-- learning_sections: add missing columns for NHVR video tracking
ALTER TABLE public.learning_sections
  ADD COLUMN IF NOT EXISTS video_duration_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS require_full_watch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0';

-- quiz_questions: add missing columns for question categorisation
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS is_critical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correct_option integer;

-- Backfill correct_option from correct_answer for existing rows
UPDATE public.quiz_questions
  SET correct_option = correct_answer
  WHERE correct_option IS NULL;

-- Verify results
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('learning_sections', 'quiz_questions')
  AND column_name IN ('video_duration_seconds', 'require_full_watch', 'version', 'category', 'is_critical', 'correct_option')
ORDER BY table_name, column_name;
