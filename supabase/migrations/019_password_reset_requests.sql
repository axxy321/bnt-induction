-- Drivers can ask an administrator for password reset help without exposing
-- whether an email address exists. Requests are managed through the API only.
CREATE TABLE IF NOT EXISTS public.driver_password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'handled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS driver_password_reset_requests_status_created_idx
  ON public.driver_password_reset_requests (status, created_at DESC);

ALTER TABLE public.driver_password_reset_requests ENABLE ROW LEVEL SECURITY;

-- The application uses the service role for these routes. No direct client
-- access is granted to anonymous, driver, or admin sessions.
