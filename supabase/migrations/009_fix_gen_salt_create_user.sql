-- Migration 009: Fix pgcrypto function resolution, provider_id in auth.identities, & profile role constraints

-- 1. Ensure pgcrypto extension is installed in extensions & public schemas
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2. Safe handle_new_user trigger function in case an auth trigger exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'driver'::public.user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    role = COALESCE(public.profiles.role, EXCLUDED.role, 'driver'::public.user_role);
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update public.create_user_by_admin function
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
  new_email text,
  new_password text,
  new_full_name text,
  new_phone text,
  new_address text,
  new_language text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id uuid;
  encrypted_pw text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can create users';
  END IF;

  BEGIN
    encrypted_pw := extensions.crypt(new_password, extensions.gen_salt('bf'::text));
  EXCEPTION WHEN OTHERS THEN
    encrypted_pw := crypt(new_password, gen_salt('bf'::text));
  END;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', new_email, encrypted_pw, now(),
    null, null, '{"provider":"email","providers":["email"]}', format('{"role":"driver","full_name":"%s"}', new_full_name)::jsonb,
    now(), now(), '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email
  ) VALUES (
    gen_random_uuid(), new_user_id::text, new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id, new_email)::jsonb, 'email', null, now(), now(), new_email
  );

  INSERT INTO public.profiles (id, role, full_name, email, phone, address, preferred_language)
  VALUES (new_user_id, 'driver'::public.user_role, new_full_name, new_email, new_phone, new_address, COALESCE(new_language, 'English'))
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address,
    preferred_language = EXCLUDED.preferred_language;

  INSERT INTO public.drivers (user_id, status)
  VALUES (new_user_id, 'Not Started')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new_user_id;
END;
$$;
