-- Add video_duration_seconds to learning_sections
ALTER TABLE public.learning_sections 
ADD COLUMN IF NOT EXISTS video_duration_seconds int DEFAULT 0;

-- Add section_started_at to learning_section_completions
ALTER TABLE public.learning_section_completions 
ADD COLUMN IF NOT EXISTS section_started_at timestamptz;
