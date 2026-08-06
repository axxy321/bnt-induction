# BNT Driver Induction System: Architecture & Workflow

This document provides a comprehensive breakdown of the BNT Logistics Driver Induction System. It covers the technical architecture, deployment model, and detailed step-by-step workflows for both Drivers and Administrators.

---

## 1. Technical Architecture

### 1.1 Frontend (Client-Side)
- **Framework**: React 18 built with Vite.
- **Language**: TypeScript for strict type safety and data modeling.
- **State Management**: 
  - Zustand (`src/store`) for global application state (Authentication, Driver Data, Admin Overview).
  - Local component state within `App.tsx` (Form inputs, UI toggles, Upload progress).
- **Styling**: Vanilla CSS (`index.css`) utilizing CSS variables for consistent theming and a custom design system.
- **Routing**: The application operates as a pure Single Page Application (SPA). Instead of using a traditional router like `react-router-dom`, views are conditionally rendered within `App.tsx` based on the user's authentication state (`session.user.role`).
- **PWA Capabilities**: Configured with `vite-plugin-pwa` to support offline caching and home-screen installation.

### 1.2 Backend (Database & Services)
The system operates on a serverless backend powered by **Supabase**.
- **Database**: PostgreSQL with Row Level Security (RLS) ensuring strict access control.
- **Authentication**: Supabase Auth (Email/Password).
- **Storage**: Supabase Storage (`driver-documents` bucket) for handling secure file uploads (Licenses, Visas, Medical Certificates).
- **Serverless Operations**: Since the frontend is hosted statically, complex operations that normally require a backend (like Bulk Import and User Deletion) are handled securely via custom **PostgreSQL RPCs (Remote Procedure Calls)** (e.g., `create_user_by_admin`, `delete_user_by_admin`) written in PL/pgSQL.

### 1.3 Deployment Model
- **Frontend Hosting**: Deployed as a static application on **Vercel**.
- **Backend Hosting**: Managed by **Supabase** (Database, Auth, Storage).

---

## 2. Database Schema Overview

The core data models are heavily interrelated and enforce referential integrity:

1. **`auth.users`** (Supabase native): Handles core authentication credentials.
2. **`public.profiles`**: Extended user data (Full name, phone, role: `admin` or `driver`).
3. **`public.drivers`**: Driver-specific data (Overall status: `Not Started`, `In Progress`, `Completed`).
4. **`public.documents`**: Tracks uploaded files, their approval status (`pending`, `approved`, `rejected`), and expiry dates.
5. **`public.induction_progress`**: Real-time tracking of the driver's current induction step, completion percentage, and quiz scores.
6. **`public.learning_sections`**: The curriculum content (Videos, Summaries, Sort Order).
7. **`public.learning_section_completions`**: Tracks which modules a driver has completely watched/read.
8. **`public.quiz_questions` & `public.quiz_attempts`**: The quiz engine tracking questions, user answers, scores, and pass/fail status.
9. **`public.certificates`**: Secure, verifiable records of successfully completed inductions.
10. **`public.audit_logs`**: Immutable record of admin actions (Approving documents, deleting users, etc.).

---

## 3. The Driver Workflow

When a new driver is created by an Admin, they undergo the following pipeline:

### Step 1: Initial Login & Password Reset
1. The driver receives their login credentials (Email + Temporary Password).
2. Upon first successful login, the system detects `must_change_password = true`.
3. The driver is forced to set a new, secure password before accessing the dashboard.

### Step 2: Document Uploads
1. The driver is presented with a list of required compliance documents (e.g., Driver's License, Right to Work, Medical Certificate).
2. The driver uploads these files directly to the Supabase `driver-documents` bucket.
3. The database marks these documents as `status = 'pending'`.
4. *The driver cannot proceed to the learning modules until an Admin approves these documents.*

### Step 3: Learning Modules (Induction Content)
1. Once documents are approved, the learning modules unlock.
2. The driver proceeds through sequential `learning_sections`.
3. If a section contains a video with `require_full_watch = true`, the "Next" button is disabled until the video completes.
4. Progress is saved to `learning_section_completions` to allow resuming later.

### Step 4: The Final Quiz
1. After all modules are completed, the driver takes a randomized/sequential quiz.
2. The system grades the quiz instantly upon submission.
3. If the score meets the minimum passing threshold, they proceed. Otherwise, a new `quiz_attempt` is recorded, and they must retry.

### Step 5: Declaration & Certification
1. The driver reads and digitally signs a legally binding declaration (stored in `induction_progress`).
2. Upon submission, the frontend utilizes `jsPDF` to dynamically generate a branded **PDF Certificate**.
3. A unique `verification_code` is generated and saved in the `certificates` table.
4. The driver is prompted to leave a 1-5 star feedback rating regarding the induction process.

---

## 4. The Admin Workflow

Administrators have access to a distinct Dashboard designed for oversight and compliance management.

### 4.1 Dashboard Overview
- Real-time metrics display the total number of drivers, certificates issued, overall completion rates, and average quiz scores.

### 4.2 Driver Management (CRUD)
- **Create**: Admins can manually create a single driver. This triggers the `create_user_by_admin` SQL RPC, safely bypassing frontend Auth restrictions.
- **Bulk Import**: Admins can upload a CSV of drivers. The frontend parses the CSV and loops through the RPC to batch-create accounts.
- **Update**: Resetting passwords, updating phone numbers, or fixing typos in names.
- **Delete**: Admins can remove drivers. If the hard delete RPC fails, a **Soft-Delete Fallback** triggers, renaming the profile to `[DELETED]` and hiding them from views.

### 4.3 Document Verification
- Admins see a queue of `pending` documents uploaded by drivers.
- They can preview the documents securely.
- **Approve**: Unlocks the learning modules for that driver. Logs the action in `audit_logs`.
- **Reject**: Admin provides a rejection reason. The driver is notified on their dashboard to re-upload the document.

### 4.4 Reporting & Exports
- **Export CSV**: The frontend pulls all driver records from the database, formats them into a comma-separated string, and triggers a browser download.
- **Export Audit Log**: Generates a CSV of all admin actions for compliance auditing.
- **Verify Certificate**: Admins can enter a Certificate ID into the system to verify its authenticity against the `certificates` table.

---

## 5. Security & Edge Cases

1. **Row Level Security (RLS)**: Drivers can only `SELECT` and `UPDATE` their own rows. They cannot view other drivers' data. Admins bypass these checks via the `is_admin()` SQL function.
2. **Vercel Static Hosting Limitations**: Because Vercel serves the app statically, traditional API routes (`/api/...`) do not exist. To circumvent this, complex admin tasks that require elevated privileges (which would normally live on a Node.js server) have been strategically pushed down to the Database layer as **PostgreSQL Functions (RPCs)** using `security definer`.
3. **Offline Resilience**: Network state is tracked (`navigator.onLine`). If a driver loses connection during a quiz or upload, the UI prevents submission and queues retries to prevent data corruption.
