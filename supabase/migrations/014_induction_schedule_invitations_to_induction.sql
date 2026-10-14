-- ============================================================
-- Migration 014: Fix Induction Schedules for Driver Induction
-- - Make course_id nullable (single driver induction, no course link needed)
-- - Add title column for custom item names (e.g., "Driver Induction")
-- - Add expiry_interval for recurring refresher logic
-- - Add driver-read RLS on induction_schedule_invitations
-- - Rewrite process_induction_schedule_invitations() with proper logic
-- ============================================================

-- 1. Make course_id nullable (driver portal uses single induction, not courses)
ALTER TABLE public.induction_schedule_items
  ALTER COLUMN course_id DROP NOT NULL;

-- 1b. Add updated_at on enrollments (referenced by the processor below)
ALTER TABLE public.induction_schedule_enrollments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2. Add title column for custom item names
ALTER TABLE public.induction_schedule_items
  ADD COLUMN IF NOT EXISTS title text;

-- 3. Add expiry_interval for recurring refresher (e.g., '1 year', '6 months')
ALTER TABLE public.induction_schedule_items
  ADD COLUMN IF NOT EXISTS expiry_interval interval;

-- 3b. Add trigger_type and trigger_config for fixed_date cron support
-- (already exists in migration 013, but ensure trigger_config exists)
ALTER TABLE public.induction_schedule_items
  ADD COLUMN IF NOT EXISTS trigger_config jsonb DEFAULT '{}'::jsonb;

-- 4. Add driver-read RLS on induction_schedule_invitations
-- Drivers can see their own invitations
ALTER TABLE public.induction_schedule_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "induction_schedule_invitations_driver_select" ON public.induction_schedule_invitations;
CREATE POLICY "induction_schedule_invitations_driver_select"
  ON public.induction_schedule_invitations FOR SELECT
  USING (
    enrollment_id IN (
      SELECT id FROM public.induction_schedule_enrollments
      WHERE driver_id = auth.uid()
    )
  );

-- 5. Rewrite process_induction_schedule_invitations() with proper logic
DROP FUNCTION IF EXISTS public.process_induction_schedule_invitations();
CREATE OR REPLACE FUNCTION public.process_induction_schedule_invitations()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  enrollment RECORD;
  schedule_item RECORD;
  existing_invitation RECORD;
  driver_email TEXT;
  driver_name TEXT;
  item_title TEXT;
  schedule_name TEXT;
  due_date TIMESTAMPTZ;
  last_completion TIMESTAMPTZ;
  invitations_created INT := 0;
BEGIN
  -- Loop through active enrollments
  FOR enrollment IN
    SELECT e.*, s.name AS schedule_name
    FROM public.induction_schedule_enrollments e
    JOIN public.induction_schedules s ON e.schedule_id = s.id
    WHERE e.status = 'active'
    AND s.is_active = true
  LOOP
    -- Get the next schedule item for this enrollment
    SELECT *
    INTO schedule_item
    FROM public.induction_schedule_items
    WHERE schedule_id = enrollment.schedule_id
    AND sequence_order = enrollment.current_item_index + 1
    ORDER BY sequence_order
    LIMIT 1;

    IF NOT FOUND THEN
      -- No more items in this schedule
      CONTINUE;
    END IF;

    -- Check if invitation already exists for this enrollment + item
    SELECT *
    INTO existing_invitation
    FROM public.induction_schedule_invitations
    WHERE enrollment_id = enrollment.id
    AND schedule_item_id = schedule_item.id
    AND status IN ('pending', 'sent', 'delivered', 'opened', 'clicked')
    LIMIT 1;

    IF FOUND THEN
      -- Already has a pending/active invitation for this item
      CONTINUE;
    END IF;

    -- Determine if it's time to send based on trigger_type
    CASE schedule_item.delay_type
      WHEN 'fixed_date' THEN
        -- Check cron-like schedule using trigger_config
        -- trigger_config should contain: { "cron": "0 9 * * 1" } for every Monday 9 AM
        -- For simplicity, we check if the fixed_date (next run) has passed
        IF schedule_item.fixed_date IS NOT NULL AND now() < schedule_item.fixed_date THEN
          CONTINUE; -- Not due yet
        END IF;
        due_date := COALESCE(schedule_item.fixed_date, now());

      WHEN 'after_enrollment' THEN
        -- Invite after X days from enrollment
        due_date := enrollment.enrolled_at + (schedule_item.delay_days || 0) * INTERVAL '1 day';
        IF now() < due_date THEN
          CONTINUE; -- Not due yet
        END IF;

      WHEN 'after_completion' THEN
        -- Invite after previous item completion
        IF enrollment.current_item_index > 0 THEN
          -- Check induction_progress for completion of previous step
          -- The previous item would be at sequence_order = current_item_index
          SELECT completed_at
          INTO last_completion
          FROM public.induction_progress
          WHERE user_id = enrollment.driver_id
          ORDER BY completed_at DESC
          LIMIT 1;

          IF last_completion IS NULL THEN
            CONTINUE; -- Previous not completed yet
          END IF;

          due_date := last_completion + (schedule_item.delay_days || 0) * INTERVAL '1 day';
          IF now() < due_date THEN
            CONTINUE; -- Delay period not passed
          END IF;
        ELSE
          -- First item - invite immediately after enrollment
          due_date := enrollment.enrolled_at;
          IF now() < due_date THEN
            CONTINUE;
          END IF;
        END IF;

      ELSE
        CONTINUE;
    END CASE;

    -- Check expiry_interval: only invite if never done OR last completion > expiry_interval ago
    IF schedule_item.expiry_interval IS NOT NULL THEN
      SELECT MAX(completed_at)
      INTO last_completion
      FROM public.induction_progress
      WHERE user_id = enrollment.driver_id;

      IF last_completion IS NOT NULL THEN
        -- Has completed before - check if expired
        IF (now() - last_completion) < schedule_item.expiry_interval THEN
          -- Still within expiry period, don't re-invite
          CONTINUE;
        END IF;
      END IF;
      -- Either never completed or expired - proceed to invite
    END IF;

    -- Get driver info
    SELECT email, full_name
    INTO driver_email, driver_name
    FROM public.profiles
    WHERE id = enrollment.driver_id;

    -- Get item title (use title column or fallback)
    item_title := COALESCE(schedule_item.title, 'Induction');

    -- Insert invitation record
    INSERT INTO public.induction_schedule_invitations (
      enrollment_id,
      schedule_item_id,
      delivery_method,
      status,
      metadata
    ) VALUES (
      enrollment.id,
      schedule_item.id,
      'in_app',
      'pending',
      jsonb_build_object(
        'driver_email', driver_email,
        'driver_name', driver_name,
        'item_title', item_title,
        'schedule_name', enrollment.schedule_name,
        'due_date', due_date,
        'expiry_interval', schedule_item.expiry_interval
      )
    );

    invitations_created := invitations_created + 1;

    -- Update enrollment to next item (will be processed on next cron run)
    UPDATE public.induction_schedule_enrollments
    SET current_item_index = enrollment.current_item_index + 1,
        updated_at = now()
    WHERE id = enrollment.id;

  END LOOP;

  RETURN invitations_created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_induction_schedule_invitations() TO authenticated;

-- ============================================================
-- END OF MIGRATION 014
-- ============================================================