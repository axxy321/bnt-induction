-- Migration 007: Australian Freight Compliance & Extended Document Types
-- Extends document types, profiles, and verification meta for AU Heavy Vehicle Operations

-- 1. Extend document_type enum / check constraints if present
DO $$
BEGIN
  -- Add values to enum if enum exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    BEGIN
      ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'right_to_work';
      ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'nhvas_bfm_certificate';
      ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'dangerous_goods_license';
      ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'hrwl_forklift';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END $$;

-- 2. Add extended profile & compliance metadata columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS licence_class text DEFAULT 'HC';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS issuing_state text DEFAULT 'VIC';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS licence_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS depot_location text DEFAULT 'Melbourne Hub';

-- 3. Add document metadata columns
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS licence_number text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS issuing_state text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 4. Audit Log index enhancement
CREATE INDEX IF NOT EXISTS documents_expires_at_idx ON public.documents (expires_at) WHERE expires_at IS NOT NULL;
