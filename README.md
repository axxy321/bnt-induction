# Driver Induction System

An internal driver induction application for one transport organization, backed by Supabase.

The system is designed for two everyday users:

- `admin`: creates driver accounts, tracks progress, resets induction for testing or retraining, exports reports, and verifies certificates
- `driver`: signs in, completes the induction in order, uploads documents, passes the quiz, signs the declaration, and downloads the certificate

## Project Structure

- [apps/web](/Users/ankur/Documents/Induction/apps/web): React + Vite frontend
- [apps/api](/Users/ankur/Documents/Induction/apps/api): Express backend for admin-only actions that require the Supabase service role key
- [supabase/schema.sql](/Users/ankur/Documents/Induction/supabase/schema.sql): database schema, storage rules, RLS policies, audit logging, seeded learning content, and quiz setup

## Main Features

- simple email and password login
- driver induction flow with autosave and step locking
- document upload to Supabase Storage
- quiz scoring with attempt history
- digital declaration with timestamp
- certificate generation and verification
- audit logs for important actions
- admin reporting, audit export, and driver timeline review
- reset induction action for safe end-to-end testing
- optional driver feedback after completion
- admin insight cards for trends, follow-up risk, and completion timing

## Setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](/Users/ankur/Documents/Induction/supabase/schema.sql) in the Supabase SQL editor.
3. Copy [apps/web/.env.example](/Users/ankur/Documents/Induction/apps/web/.env.example) to `apps/web/.env.local`.
4. Copy [apps/api/.env.example](/Users/ankur/Documents/Induction/apps/api/.env.example) to `apps/api/.env`.
5. Fill in the environment variables shown below.
6. Create your first admin user in Supabase Auth.
7. Insert a matching row into `public.profiles` for that user with `role = 'admin'`.

## Environment Variables

Frontend in `apps/web/.env.local`:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_BASE_URL=http://localhost:4000
VITE_ORGANIZATION_NAME=Your Transport Company
VITE_ORGANIZATION_LOGO_URL=https://your-company.example/logo.png
```

Backend in `apps/api/.env`:

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
APP_URL=http://localhost:5173
ORGANIZATION_NAME=Your Transport Company
ORGANIZATION_LOGO_URL=https://your-company.example/logo.png
PORT=4000
```

## Run Locally

```bash
npm install
cd apps/api && npm run dev
cd apps/web && npm run dev
```

Suggested local ports:

- frontend: `5173`
- backend: `4000`

## Admin Guide

After signing in as an admin, you can:

- create a new driver account manually
- click `Use Test Details` to prefill a safe sample driver for testing
- edit driver contact details
- reset a driver password
- reset a driver induction back to step 1 for testing or retraining
- delete a driver account
- export driver reports and audit logs
- open a driver row to review timeline history, uploaded documents, and certificate details
- verify a certificate by pasting the verification code

## Driver Guide

After signing in as a driver, the process is:

1. Confirm personal details.
2. Upload licence, medical certificate, and ID.
3. Read the training modules and mark each one complete.
4. Pass the quiz with at least 70 percent.
5. Accept the declaration and type a digital signature.
6. Download the certificate.

The system saves progress automatically, so drivers can close the browser and return later.

## Testing Checklist

These flows are worth checking before rollout:

- sign in as a driver and resume from the saved step
- upload an invalid file and confirm the error message is clear
- fail the quiz, retry it, and confirm attempt history updates
- disconnect the network during a save and confirm the retry messaging appears
- reset a driver induction from the admin dashboard and confirm the flow starts from step 1
- delete a driver and confirm the account is removed while audit logs remain
- verify a generated certificate from the admin dashboard

## Security Notes

- the frontend uses only the Supabase anon key
- the service role key stays in the backend only
- row level security is enabled across the main tables
- storage access is limited to the user’s folder unless the viewer is an admin
- audit logs are immutable and completed induction records are locked

## Deployment

Frontend:

- deploy `apps/web` to Vercel
- add the frontend environment variables in the Vercel project settings

Backend:

- deploy `apps/api` to any Node.js host
- add the backend environment variables on the server
- make sure `APP_URL` points to the deployed frontend

Supabase:

- keep RLS enabled
- do not expose the service role key in the browser
- apply schema changes from [supabase/schema.sql](/Users/ankur/Documents/Induction/supabase/schema.sql) whenever the project is updated

## Backup And Recovery

- enable automated backups or point-in-time recovery in Supabase before production rollout
- keep a secure copy of [supabase/schema.sql](/Users/ankur/Documents/Induction/supabase/schema.sql) with your deployment notes
- export critical tables regularly: `profiles`, `drivers`, `induction_progress`, `certificates`, `audit_logs`, and `driver_feedback`
- if recovery is needed, restore the database backup in Supabase first, then restart the API and frontend with the same environment variables
