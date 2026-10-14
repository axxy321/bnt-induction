// Vercel serverless API for the Driver Induction System.
// Web Standard handler (Node.js 18+ runtime). Mirrors the routes in apps/api/src/app.ts.
// Routes are matched against the path after "/api/".
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wbrculvtacfkjzqhhoue.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicmN1bHZ0YWNma2p6cWhob3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1MDg0OCwiZXhwIjoyMTAwMjI2ODQ4fQ.EkMtjAbpdPVrlrR5n0Py-5x-sD36WN2UDOMGheUQpR0";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicmN1bHZ0YWNma2p6cWhob3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTA4NDgsImV4cCI6MjEwMDIyNjg0OH0.vxmD4mpvPaG0IhlS7i8FisLXRy6CZdq48ur_4Fr8KN4";
const APP_URL = process.env.APP_URL || "https://driver-induction-platform.vercel.app";
const ORGANIZATION_NAME = process.env.ORGANIZATION_NAME ?? "BNT Logistics";
const ORGANIZATION_LOGO_URL = process.env.ORGANIZATION_LOGO_URL ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "";
const ALLOW_SELF_REGISTRATION = process.env.ALLOW_SELF_REGISTRATION === "true";

const DEFAULT_BRANDING = {
  id: "default",
  company_name: "BNT Logistics",
  logo_path: null as string | null,
  primary_color: "#1e3a5f",
  welcome_text: "Welcome to the driver induction portal",
  updated_at: null as string | null
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ message }, status);
}

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function getSupabaseAnon() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function requireConfig(): Response | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse("Server misconfiguration: Supabase credentials are not set.", 500);
  }
  return null;
}

async function logAuditEntry(userId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin()
    .from("audit_logs")
    .insert({ user_id: userId, action, metadata, created_at: new Date().toISOString() });
  if (error) {
    console.error("[AUDIT] Failed to write audit log:", action, error.message);
  }
}

// --- Rate limiter (in-memory; the quiz attempt limit is enforced in the DB) ---
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX_STORE_SIZE = 10_000;

function rateLimitCheck(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    if (rateLimitStore.size >= RATE_LIMIT_MAX_STORE_SIZE) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (now > v.resetAt) rateLimitStore.delete(k);
        if (rateLimitStore.size < RATE_LIMIT_MAX_STORE_SIZE) break;
      }
    }
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// --- Auth guards ---

async function requireDriver(request: Request): Promise<{ userId: string } | { response: Response }> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { response: errorResponse("Authentication required.", 401) };
  }
  const token = header.slice("Bearer ".length);
  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return { response: errorResponse("Invalid session.", 401) };
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (profileError || profile?.role !== "driver") {
    return { response: errorResponse("Driver access is required.", 403) };
  }
  const mustChange = (authData.user.user_metadata as Record<string, unknown> | null)?.must_change_password === true;
  if (mustChange) {
    return {
      response: jsonResponse(
        { code: "PASSWORD_RESET_REQUIRED", message: "Password change is required before starting your induction." },
        403
      )
    };
  }
  return { userId: authData.user.id };
}

async function requireAdmin(request: Request): Promise<{ adminId: string } | { response: Response }> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { response: errorResponse("Admin access required.", 401) };
  }
  const token = header.slice("Bearer ".length);
  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return { response: errorResponse("Admin access required.", 401) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (profile?.role !== "admin") {
    return { response: errorResponse("Admin access required.", 401) };
  }
  return { adminId: authData.user.id };
}

// --- Misc helpers ---

function uuidV4(): string {
  const g = globalThis.crypto;
  if (g && typeof g.randomUUID === "function") return g.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sendEmailViaResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn(`[EMAIL] RESEND_API_KEY not set. Email NOT sent to ${to}.`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to,
        subject,
        html
      })
    });
    if (!res.ok) {
      console.error("[EMAIL] Resend dispatch failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err: any) {
    console.error("[EMAIL] Resend dispatch error:", err?.message);
  }
}

function renderVerificationPage(payload: {
  organizationName: string;
  certificate: { completionId: string; verificationCode: string; verificationUrl: string; issuedAt: string };
  driver: { fullName: string };
}, logoUrl: string): string {
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="${payload.organizationName} logo" style="height:56px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-weight:700;font-size:18px;">${payload.organizationName}</div>`;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Certificate Verification</title>
      <style>
        body{margin:0;font-family:Inter,system-ui,sans-serif;background:linear-gradient(180deg,#eef4ff,#dbeafe);color:#10213a}
        .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
        .card{max-width:760px;width:100%;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);border:1px solid rgba(148,163,184,.22);border-radius:28px;padding:32px;box-shadow:0 24px 60px rgba(37,99,235,.14)}
        .badge{display:inline-flex;padding:8px 12px;border-radius:999px;background:rgba(34,197,94,.14);color:#166534;font-weight:700;margin-bottom:16px}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:24px}
        .item{padding:16px;border-radius:18px;background:rgba(239,246,255,.9);border:1px solid rgba(148,163,184,.18)}
        small{color:#5b6b84;display:block;margin-top:6px}
        a{color:#2563eb;text-decoration:none}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          ${logo}
          <div class="badge">Certificate verified</div>
          <h1 style="margin:0 0 8px;">Driver induction completed</h1>
          <p style="margin:0;color:#5b6b84;">This certificate is valid and was issued by ${payload.organizationName}.</p>
          <div class="grid">
            <div class="item"><strong>Driver</strong><small>${payload.driver.fullName}</small></div>
            <div class="item"><strong>Verification ID</strong><small>${payload.certificate.completionId}</small></div>
            <div class="item"><strong>Verification code</strong><small>${payload.certificate.verificationCode}</small></div>
            <div class="item"><strong>Issued</strong><small>${new Date(payload.certificate.issuedAt).toLocaleString()}</small></div>
          </div>
          <p style="margin-top:24px;"><a href="${payload.certificate.verificationUrl}">Open verification link</a></p>
        </div>
      </div>
    </body>
  </html>`;
}

function renderVerificationErrorPage(organizationName: string, logoUrl: string): string {
  const logo = logoUrl
    ? `<img src="${logoUrl}" alt="${organizationName} logo" style="height:56px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-weight:700;font-size:18px;">${organizationName}</div>`;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Certificate Not Found</title>
      <style>
        body{margin:0;font-family:Inter,system-ui,sans-serif;background:linear-gradient(180deg,#eef4ff,#dbeafe);color:#10213a}
        .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
        .card{max-width:760px;width:100%;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);border:1px solid rgba(148,163,184,.22);border-radius:28px;padding:32px;box-shadow:0 24px 60px rgba(37,99,235,.14)}
        .badge{display:inline-flex;padding:8px 12px;border-radius:999px;background:rgba(239,68,68,.12);color:#991b1b;font-weight:700;margin-bottom:16px}
        p{color:#5b6b84}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          ${logo}
          <div class="badge">Verification failed</div>
          <h1 style="margin:0 0 8px;">Certificate not found</h1>
          <p>The verification code is invalid, missing, or no longer linked to a certificate record.</p>
        </div>
      </div>
    </body>
  </html>`;
}

// --- Route handlers ---

async function handleHealth(): Promise<Response> {
  return jsonResponse({
    status: "ok",
    service: "driver-induction-api-vercel",
    organizationName: ORGANIZATION_NAME,
    timestamp: new Date().toISOString()
  });
}

// --- Branding (public read, admin update) ---

async function handleGetBranding(): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("branding")
    .select("id, company_name, logo_path, primary_color, welcome_text, updated_at")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return jsonResponse({ branding: data ?? DEFAULT_BRANDING });
}

async function handleUpdateBranding(request: Request, adminId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const schema = z.object({
    company_name: z.string().min(1).max(100),
    logo_path: z.string().max(500).nullable().optional(),
    primary_color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Primary colour must be a hex value like #1e3a5f"),
    welcome_text: z.string().max(500)
  });
  const payload = schema.parse(await request.json());

  const { data: updated, error: updateError } = await supabase
    .from("branding")
    .upsert(
      {
        id: "default",
        ...payload,
        updated_by: adminId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    )
    .select("id, company_name, logo_path, primary_color, welcome_text, updated_at")
    .maybeSingle();
  if (updateError) throw updateError;

  await logAuditEntry(adminId, "admin_branding_updated", {
    companyName: payload.company_name,
    hasLogo: Boolean(payload.logo_path)
  });

  return jsonResponse({ message: "Branding updated.", branding: updated });
}

async function handleSelfRegisterDriver(request: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const registerSchema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(5),
    address: z.string().min(5),
    preferredLanguage: z.string().min(2).default("English"),
    password: z.string().min(8),
    depotCode: z.string().optional()
  });

  const payload = registerSchema.parse(await request.json());
  const emailLower = payload.email.toLowerCase().trim();

  const { data: createdUser, error: authErr } = await supabase.auth.admin.createUser({
    email: emailLower,
    password: payload.password,
    email_confirm: true,
    user_metadata: { role: "driver", must_change_password: false, depot_code: payload.depotCode }
  });

  if (authErr || !createdUser.user) {
    return errorResponse(authErr?.message ?? "Registration failed", 400);
  }

  const userId = createdUser.user.id;
  const now = new Date().toISOString();

  const [profileRes, driverRes, progressRes] = await Promise.allSettled([
    supabase.from("profiles").insert({
      id: userId, role: "driver", email: emailLower, full_name: payload.fullName,
      phone: payload.phone, address: payload.address, preferred_language: payload.preferredLanguage,
      created_at: now, updated_at: now
    }),
    supabase.from("drivers").insert({ user_id: userId, status: "Not Started", created_at: now }),
    supabase.from("induction_progress").insert({
      user_id: userId, current_step: 1, completion_percentage: 0, completed: false,
      completed_step_ids: [], updated_at: now
    })
  ]);

  const insertErrors: string[] = [];
  for (const res of [profileRes, driverRes, progressRes]) {
    if (res.status === "rejected") {
      insertErrors.push(res.reason?.message ?? "unknown");
    } else if (res.value && typeof res.value === "object" && "error" in res.value) {
      const err = (res.value as { error?: { message?: string } }).error;
      if (err) insertErrors.push(err.message ?? "unknown");
    }
  }

  if (insertErrors.length > 0) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    return errorResponse(`Registration failed: ${insertErrors.join("; ")}`, 500);
  }

  const { data: sections } = await supabase.from("learning_sections").select("id");
  if (sections?.length) {
    await supabase.from("learning_section_completions").insert(
      sections.map((sec: any) => ({ user_id: userId, section_id: sec.id, completed: false, updated_at: now }))
    );
  }

  await logAuditEntry(userId, "driver_self_registered", { email: emailLower, depotCode: payload.depotCode });
  return jsonResponse({ message: "Registration successful. You can now log in.", email: emailLower });
}

async function handleChangePassword(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) {
    return errorResponse("Missing session token.", 401);
  }

  const supabase = getSupabaseAdmin();
  const { data: authUser, error: tokenError } = await supabase.auth.getUser(token);
  if (tokenError || !authUser.user) {
    return errorResponse("Invalid or expired session token.", 401);
  }

  const schema = z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(8) });
  const { currentPassword, newPassword } = schema.parse(await request.json());

  if (currentPassword) {
    if (!SUPABASE_ANON_KEY) {
      return errorResponse("Server misconfiguration: SUPABASE_ANON_KEY is not set.", 500);
    }
    const tempClient = getSupabaseAnon();
    const { error: signInErr } = await tempClient.auth.signInWithPassword({
      email: authUser.user.email!,
      password: currentPassword
    });
    if (signInErr) {
      return errorResponse("Incorrect current password.", 401);
    }
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(authUser.user.id, {
    password: newPassword,
    user_metadata: { ...(authUser.user.user_metadata as object), must_change_password: false }
  });
  if (updateErr) throw updateErr;

  await supabase.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", authUser.user.id);
  await logAuditEntry(authUser.user.id, "user_changed_password", { email: authUser.user.email });

  return jsonResponse({ message: "Password updated successfully." });
}

async function handleGetQuizQuestions(userId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("quiz_questions").select("*");
  if (error) throw error;

  // Server-side Fisher-Yates random shuffle of question bank
  const questions = [...(data ?? [])];
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  const mapped = questions.map((q: any) => ({
    id: q.id,
    question: q.question ?? q.question_text,
    options: q.options,
    sort_order: q.sort_order,
    category: q.category || "General",
    is_critical: Boolean(q.is_critical)
  }));

  return jsonResponse(mapped);
}

async function handleStartSection(userId: string, request: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const schema = z.object({ sectionId: z.string() });
  const { sectionId } = schema.parse(await request.json());

  const { data: existing, error: existingError } = await supabase
    .from("learning_section_completions")
    .select("section_started_at")
    .eq("user_id", userId)
    .eq("section_id", sectionId)
    .eq("section_version", "1.0")
    .maybeSingle();
  if (existingError) throw existingError;

  // Playback events fire more than once (for example after a pause). Keep
  // the first recorded start time so resuming a video cannot restart the
  // server-side minimum-duration check.
  if (existing?.section_started_at) {
    return jsonResponse({ message: "Section already started." });
  }

  const { error } = existing
    ? await supabase
        .from("learning_section_completions")
        .update({ section_started_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("section_id", sectionId)
        .eq("section_version", "1.0")
    : await supabase
        .from("learning_section_completions")
        .insert({
          user_id: userId,
          section_id: sectionId,
          section_version: "1.0",
          section_started_at: new Date().toISOString()
        });

  if (error) throw error;
  return jsonResponse({ message: "Section started." });
}

async function handleSaveStep(userId: string, request: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const schema = z.object({
    step: z.number().int().min(1).max(6),
    payload: z.record(z.string(), z.unknown())
  });
  const { step, payload } = schema.parse(await request.json());

  const { data: current, error: progressError } = await supabase
    .from("induction_progress")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (progressError) throw progressError;

  const { data: activeVersion } = await supabase
    .from("induction_versions")
    .select("id, version_label")
    .eq("is_current", true)
    .maybeSingle();

  const activeVersionId = activeVersion?.id ?? null;
  let isNewVersionReinduction = false;

  if (activeVersionId && current.induction_version_id && current.induction_version_id !== activeVersionId) {
    const { data: oldVer } = await supabase
      .from("induction_versions")
      .select("version_label")
      .eq("id", current.induction_version_id)
      .maybeSingle();
    if (oldVer && oldVer.version_label !== activeVersion?.version_label) {
      isNewVersionReinduction = true;
    }
  }

  if (current.completed && !isNewVersionReinduction) {
    return errorResponse("Induction is already completed.", 400);
  }

  if (step === 1) {
    if (payload.fullName || payload.phone || payload.address) {
      const updateData: Record<string, unknown> = {};
      if (payload.fullName) updateData.full_name = String(payload.fullName).trim();
      if (payload.phone) updateData.phone = String(payload.phone).trim();
      if (payload.address) updateData.address = String(payload.address).trim();
      if (payload.preferredLanguage) updateData.preferred_language = String(payload.preferredLanguage).trim();
      if (payload.licenceClass) updateData.licence_class = String(payload.licenceClass).trim();
      if (payload.issuingState) updateData.issuing_state = String(payload.issuingState).trim();
      if (payload.licenceNumber) updateData.licence_number = String(payload.licenceNumber).trim();
      if (payload.depotLocation) updateData.depot_location = String(payload.depotLocation).trim();

      if (Object.keys(updateData).length > 0) {
        // Contact and licence details belong to the profile record.
        // Handle schemas where extended columns (licence_class, depot_location, etc.) are omitted.
        const baseProfileData: Record<string, unknown> = {};
        if (updateData.full_name) baseProfileData.full_name = updateData.full_name;
        if (updateData.phone) baseProfileData.phone = updateData.phone;
        if (updateData.address) baseProfileData.address = updateData.address;
        if (updateData.preferred_language) baseProfileData.preferred_language = updateData.preferred_language;

        // Attempt full update first; fall back to base profile fields if extended columns are absent from schema cache
        const { error: fullUpdateErr } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", userId);

        if (fullUpdateErr) {
          const { error: baseErr } = await supabase
            .from("profiles")
            .update(baseProfileData)
            .eq("id", userId);
          if (baseErr) throw baseErr;
        }
      }
    }

    if (isNewVersionReinduction || !current.induction_version_id) {
      if (activeVersionId) {
        await supabase
          .from("induction_progress")
          .update({
            induction_version_id: activeVersionId,
            current_step: 1,
            completion_percentage: 16,
            completed: false,
            completed_step_ids: [1],
            quiz_score: null,
            completed_at: null,
            declaration_accepted: false,
            declaration_agreed_at: null,
            signature: null,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);
        current.induction_version_id = activeVersionId;
        current.completed = false;
        current.completed_step_ids = [1];
      }
    }
  }

  const completed = new Set<number>(current.completed_step_ids ?? []);
  const missingSteps = Array.from({ length: step - 1 }, (_, i) => i + 1).filter((s) => !completed.has(s));
  if (step > 1 && missingSteps.length > 0) {
    return errorResponse(`Complete all preceding steps before continuing. Missing step(s): ${missingSteps.join(", ")}.`, 400);
  }

  if (step === 2) {
    const { data: docs, error: docsError } = await supabase
      .from("documents")
      .select("type, status, expires_at")
      .eq("user_id", userId);
    if (docsError) throw docsError;
    const required = ["driver_license", "medical_certificate", "right_to_work"];
    const incomplete = required.filter((type) => !docs?.some((doc) =>
      doc.type === type && doc.status === "approved" && (!doc.expires_at || new Date(doc.expires_at) > new Date())
    ));
    if (incomplete.length > 0) {
      return errorResponse(`All required documents must be approved and current before continuing. Outstanding: ${incomplete.join(", ")}.`, 400);
    }
  }

  if (step === 3) {
    const sectionsPayload = (payload.sections as Array<{ sectionId: string; completed: boolean }> | undefined) ?? [];

    const { data: dbSections } = await supabase.from("learning_sections").select("id, video_duration_seconds, require_full_watch");

    // Upsert completions securely from backend
    for (const sec of sectionsPayload) {
      if (sec.completed) {
        const sectionDef = dbSections?.find(s => s.id === sec.sectionId);
        if (sectionDef) {
          const { data: dbComp } = await supabase.from("learning_section_completions")
            .select("section_started_at, completed")
            .eq("user_id", userId)
            .eq("section_id", sec.sectionId)
            .maybeSingle();

          if (!dbComp?.completed) {
            if (!dbComp?.section_started_at) {
              return errorResponse("Video section was not started properly.", 400);
            }
            const isRequiredWatch = Boolean(sectionDef.require_full_watch);
            const videoDurationMs = (sectionDef.video_duration_seconds || 0) * 1000;
            if (isRequiredWatch && videoDurationMs > 0) {
              const started = new Date(dbComp.section_started_at).getTime();
              const now = Date.now();
              const minDurationMs = Math.max(0, videoDurationMs - 10000); // 10s buffer for network latency
              if (now - started < minDurationMs) {
                return errorResponse("Video was marked complete too quickly.", 400);
              }
            }
          }
        }
      }

      await supabase
        .from("learning_section_completions")
        .upsert({
          user_id: userId,
          section_id: sec.sectionId,
          section_version: "1.0",
          completed: sec.completed,
          completed_at: sec.completed ? new Date().toISOString() : null
        }, { onConflict: "user_id,section_id,section_version" });
    }

    if (payload.allowPartial) {
      // Just return early with a success response, we don't mark step 3 complete yet
      return jsonResponse({ message: "Partial progress saved." });
    }

    const { data: completions } = await supabase.from("learning_section_completions").select("section_id, completed").eq("user_id", userId);

    const allCompleted = dbSections?.every(sec =>
      completions?.some(comp => comp.section_id === sec.id && comp.completed)
    );
    if (!allCompleted) {
      return errorResponse("All required learning modules must be completed.", 400);
    }
  }

  if (step === 4) {
    return errorResponse("Step 4 is completed via quiz submission.", 400);
  }

  completed.add(step);

  let nextStep = step >= 5 ? 6 : Math.max(current.current_step, step + 1);
  let completionPercentage = Math.round((completed.size / 6) * 100);

  if (step === 5) {
    const accepted = payload.accepted !== undefined ? Boolean(payload.accepted) : true;
    const rawSignature = String(payload.signature ?? "").trim();
    const PLACEHOLDER_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    if (rawSignature.length < 2 || rawSignature === PLACEHOLDER_SIGNATURE) {
      return errorResponse("Please draw your signature before submitting the declaration.", 400);
    }
    if (!accepted) {
      return errorResponse("Please accept the declaration.", 400);
    }

    let signaturePath = rawSignature;
    if (rawSignature.startsWith("data:image/png;base64,")) {
      const base64Data = rawSignature.replace(/^data:image\/png;base64,/, "");
      const bytes = base64ToBytes(base64Data);
      const fileName = `${userId}/signature.png`;
      const { error: uploadError } = await supabaseAdminStorageUpload(supabase, fileName, bytes);
      if (uploadError) console.warn("Signature upload storage warning:", uploadError.message);
      signaturePath = fileName;
    }

    nextStep = 6;
    completionPercentage = Math.round((completed.size / 6) * 100);
    await supabase.from("induction_progress").update({
      declaration_accepted: true,
      declaration_agreed_at: new Date().toISOString(),
      signature: signaturePath
    }).eq("user_id", userId);
  }

  const completedArray = Array.from(completed).sort((a, b) => a - b);
  const { error: updateError } = await supabase.from("induction_progress").update({
    current_step: nextStep,
    completion_percentage: completionPercentage,
    completed_step_ids: completedArray,
    updated_at: new Date().toISOString()
  }).eq("user_id", userId);

  if (updateError) throw updateError;

  await logAuditEntry(userId, "step_completed", { step, completionPercentage, currentStep: nextStep });
  return jsonResponse({ message: "Step saved." });
}

async function supabaseAdminStorageUpload(supabase: any, fileName: string, bytes: Uint8Array) {
  return supabase.storage
    .from("driver-documents")
    .upload(fileName, bytes, { contentType: "image/png", upsert: true });
}

async function handleSubmitQuiz(userId: string, request: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const schema = z.object({
    answers: z.record(z.string(), z.coerce.number())
  });
  const { answers } = schema.parse(await request.json());

  const { data: current, error: progressError } = await supabase
    .from("induction_progress")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (progressError || current.completed) {
    return errorResponse("Induction is locked.", 400);
  }

  // Attempt limit: at most QUIZ_MAX_ATTEMPTS attempts within a rolling
  // QUIZ_WINDOW_HOURS window. Stops brute-forcing a pass while still
  // allowing a retake once the oldest attempt slides out of the window.
  const QUIZ_MAX_ATTEMPTS = Number(process.env.QUIZ_MAX_ATTEMPTS || 3);
  const QUIZ_WINDOW_MS = Number(process.env.QUIZ_WINDOW_HOURS || 24) * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - QUIZ_WINDOW_MS).toISOString();
  const { data: recentAttempts } = await supabase
    .from("quiz_attempts")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true });
  if ((recentAttempts?.length ?? 0) >= QUIZ_MAX_ATTEMPTS) {
    const oldest = new Date(recentAttempts![0].created_at).getTime();
    const retryAt = new Date(oldest + QUIZ_WINDOW_MS);
    return jsonResponse(
      {
        message: `Maximum quiz attempts reached. Please try again after ${retryAt.toLocaleString("en-AU")}.`,
        retryAt: retryAt.toISOString()
      },
      429
    );
  }

  const { data: questions, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;

  let correctCount = 0;
  let failedCritical = false;
  let criticalQuestionsAsked = 0;

  const categoryStats: Record<string, { total: number; correct: number }> = {};
  const rawResults: Array<{
    id: any;
    category: string;
    isCritical: boolean;
    correct: boolean;
    correctAnswer: any;
    explanation: any;
  }> = [];

  for (const q of (questions ?? []) as any[]) {
    const driverAnswer = answers[String(q.id)] ?? answers[q.id];

    const category = q.category || "General";
    const isCritical = Boolean(q.is_critical);

    if (!categoryStats[category]) {
      categoryStats[category] = { total: 0, correct: 0 };
    }
    categoryStats[category].total += 1;

    if (isCritical) {
      criticalQuestionsAsked += 1;
    }

    const isCorrect = driverAnswer === q.correct_answer;
    if (isCorrect) {
      correctCount += 1;
      categoryStats[category].correct += 1;
    } else {
      if (isCritical) {
        failedCritical = true;
      }
    }

    rawResults.push({
      id: q.id,
      category,
      isCritical,
      correct: isCorrect,
      correctAnswer: q.correct_answer,
      explanation: q.explanation
    });
  }

  const totalQuestions = Math.max(1, (questions ?? []).length);
  const score = Math.round((correctCount / totalQuestions) * 100);

  const categoryScores: Record<string, number> = {};
  for (const [cat, stats] of Object.entries(categoryStats)) {
    categoryScores[cat] = Math.round((stats.correct / Math.max(1, stats.total)) * 100);
  }

  // Pass threshold is >= 70% AND zero critical question failures
  const passed = score >= 70 && !failedCritical;

  let failedCriticalReason: string | undefined;
  if (failedCritical) {
    failedCriticalReason = "You answered a critical safety question incorrectly. A 100% pass is required on all critical safety questions.";
  }

  // Reveal correct answers/explanations only when the driver passed,
  // so a failed attempt never leaks the answer key.
  const results = rawResults.map((r) =>
    passed
      ? {
          id: r.id,
          category: r.category,
          isCritical: r.isCritical,
          correct: r.correct,
          correctAnswer: r.correctAnswer,
          explanation: r.explanation
        }
      : {
          id: r.id,
          category: r.category,
          isCritical: r.isCritical,
          correct: r.correct
        }
  );

  const { data: attempts } = await supabase.from("quiz_attempts").select("id").eq("user_id", userId);
  const attemptNumber = (attempts?.length ?? 0) + 1;

  // Try full insert, fallback to base columns if new columns don't exist
  const fullAttempt = {
    user_id: userId,
    score,
    passed,
    attempt_number: attemptNumber,
    answers,
    category_scores: categoryScores,
    failed_critical: failedCritical,
    critical_questions_asked: criticalQuestionsAsked
  };
  const { error: attemptErr } = await supabase.from("quiz_attempts").insert(fullAttempt);
  if (attemptErr) {
    // Fallback to base columns
    await supabase.from("quiz_attempts").insert({
      user_id: userId,
      score,
      passed,
      answers
    });
  }

  const completed = new Set<number>(current.completed_step_ids ?? []);
  if (passed) completed.add(4);

  await supabase.from("induction_progress").update({
    quiz_score: score,
    current_step: passed ? 5 : 4,
    completion_percentage: Math.round((completed.size / 6) * 100),
    completed_step_ids: Array.from(completed).sort((a, b) => a - b),
    updated_at: new Date().toISOString()
  }).eq("user_id", userId);

  await logAuditEntry(userId, "quiz_submitted", {
    score,
    passed,
    failedCritical,
    attemptNumber,
    categoryScores
  });

  return jsonResponse({
    score,
    passed,
    categoryScores,
    failedCritical,
    failedCriticalReason,
    results
  });
}

async function handleIssueCertificate(userId: string, request?: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const reqOrigin = request ? new URL(request.url, APP_URL).origin : (APP_URL || "https://driver-induction-platform.vercel.app");

  const { data: progress } = await supabase
    .from("induction_progress")
    .select("*")
    .eq("user_id", userId)
    .single();

  const currentVersionId = progress?.induction_version_id ?? null;
  let existingQuery = supabase.from("certificates").select("*").eq("user_id", userId);
  if (currentVersionId) {
    existingQuery = existingQuery.eq("induction_version_id", currentVersionId);
  }
  const { data: existingArray } = await existingQuery.order("issued_at", { ascending: false }).limit(1);
  const existing = existingArray?.[0] ?? null;

  if (existing) {
    const rawVerifyUrl = existing.verification_url || `${reqOrigin}/certificate/verify/${existing.verification_code}`;
    const normalizedVerifyUrl = rawVerifyUrl.replace(/https?:\/\/localhost(:\d+)?/, reqOrigin);
    return jsonResponse({
      message: "Certificate already generated for this version.",
      certificate: {
        completionId: existing.completion_id,
        verificationCode: existing.verification_code,
        verificationUrl: normalizedVerifyUrl,
        issuedAt: existing.issued_at,
        expiresAt: existing.expires_at
      }
    });
  }

  if (!progress || ![1, 2, 3, 4, 5].every(step => progress.completed_step_ids?.includes(step))) {
    const missing = [1, 2, 3, 4, 5].filter(s => !progress?.completed_step_ids?.includes(s));
    return errorResponse(`Complete all steps first. Missing step(s): ${missing.join(", ")}.`, 400);
  }

  // A certificate is evidence of a completed company control, so only issue it
  // after each mandatory document has an active administrative approval.
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("type, status, expires_at")
    .eq("user_id", userId);
  if (docsError) throw docsError;
  const required = ["driver_license", "medical_certificate", "right_to_work"];
  const incomplete = required.filter((type) => !docs?.some((doc) =>
    doc.type === type && doc.status === "approved" && (!doc.expires_at || new Date(doc.expires_at) > new Date())
  ));
  if (incomplete.length > 0) {
    return errorResponse(`Required documents must be approved and current before a certificate can be issued. Outstanding: ${incomplete.join(", ")}.`, 400);
  }

  const verificationCode = `VERIFY-${userId.slice(0, 8)}-${uuidV4().slice(0, 6)}`;
  const completionId = `COMP-${userId.slice(0, 8).toUpperCase()}-${uuidV4().slice(0, 6).toUpperCase()}`;
  const verificationUrl = `${reqOrigin}/certificate/verify/${verificationCode}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { error: insertError } = await supabase
    .from("certificates")
    .insert({
      user_id: userId,
      completion_id: completionId,
      verification_code: verificationCode,
      verification_url: verificationUrl,
      issued_at: issuedAt,
      expires_at: expiresAt.toISOString(),
      induction_version_id: currentVersionId
    });
  if (insertError) throw insertError;

  const completed = new Set<number>(progress.completed_step_ids ?? []);
  completed.add(6);
  await supabase.from("induction_progress").update({
    current_step: 6,
    completion_percentage: 100,
    completed: true,
    completed_step_ids: Array.from(completed).sort((a, b) => a - b),
    completed_at: issuedAt,
    updated_at: issuedAt
  }).eq("user_id", userId);

  await supabase.from("drivers").update({ status: "Completed" }).eq("user_id", userId);
  await logAuditEntry(userId, "certificate_generated", { completionId, verificationCode, issuedAt });

  // Dispatch completion email to driver (non-blocking)
  const { data: driverProfile } = await supabase.from("profiles").select("email, full_name").eq("id", userId).single();
  if (driverProfile?.email) {
    const expiry = expiresAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#1e3a5f">Congratulations, ${driverProfile.full_name ?? "Driver"}!</h2>
      <p>You have successfully completed the <strong>${ORGANIZATION_NAME}</strong> Driver Induction Program.</p>
      <p>Your certificate is valid for <strong>12 months</strong> and expires on <strong>${expiry}</strong>.</p>
      <p><a href="${verificationUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">View Certificate</a></p>
    </div>`;
    void sendEmailViaResend(driverProfile.email, `Induction Complete — Certificate Issued by ${ORGANIZATION_NAME}`, html);
  }

  return jsonResponse({
    message: "Certificate generated.",
    certificate: {
      completionId,
      verificationCode,
      verificationUrl,
      issuedAt,
      expiresAt: expiresAt.toISOString()
    }
  });
}

async function handleVerifyCertificate(code: string, request: Request): Promise<Response> {
  const supabase = getSupabaseAdmin();

  // Accept either the verification code (VERIFY-…) or the completion id
  // (COMP-…) that is printed as the "Verification ID" on the certificate.
  if (!code || !/^[A-Za-z0-9-]+$/.test(code)) {
    if (request.headers.get("accept")?.includes("text/html")) {
      return htmlResponse(renderVerificationErrorPage(ORGANIZATION_NAME, ORGANIZATION_LOGO_URL), 404);
    }
    return errorResponse("Invalid verification code.", 400);
  }

  const { data: certificate, error: certificateError } = await supabase
    .from("certificates")
    .select("*")
    .or(`verification_code.eq.${code},completion_id.eq.${code}`)
    .maybeSingle();
  if (certificateError || !certificate) {
    if (request.headers.get("accept")?.includes("text/html")) {
      return htmlResponse(renderVerificationErrorPage(ORGANIZATION_NAME, ORGANIZATION_LOGO_URL), 404);
    }
    return errorResponse("Certificate not found.", 404);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, licence_class, issuing_state, depot_location")
    .eq("id", certificate.user_id)
    .single();
  if (profileError) throw profileError;

  const reqOrigin = request ? new URL(request.url, APP_URL).origin : (APP_URL || "https://driver-induction-platform.vercel.app");
  const payload = {
    verified: true,
    organizationName: ORGANIZATION_NAME,
    certificate: {
      completionId: certificate.completion_id,
      verificationCode: certificate.verification_code,
      verificationUrl: `${reqOrigin}/certificate/verify/${certificate.verification_code}`,
      issuedAt: certificate.issued_at,
      expiresAt: certificate.expires_at
    },
    driver: {
      fullName: profile?.full_name ?? ""
    },
    licenceClass: profile?.licence_class ?? null,
    issuingState: profile?.issuing_state ?? null,
    depotLocation: profile?.depot_location ?? null
  };

  if (request.headers.get("accept")?.includes("text/html")) {
    return htmlResponse(
      renderVerificationPage(
        {
          organizationName: ORGANIZATION_NAME,
          certificate: {
            completionId: certificate.completion_id,
            verificationCode: certificate.verification_code,
            verificationUrl: `${reqOrigin}/certificate/verify/${certificate.verification_code}`,
            issuedAt: certificate.issued_at
          },
          driver: { fullName: profile?.full_name ?? "" }
        },
        ORGANIZATION_LOGO_URL
      ),
      200
    );
  }

  return jsonResponse(payload);
}

async function handleVerifyVehiclePass(passCode: string): Promise<Response> {
  const supabase = getSupabaseAdmin();

  if (!passCode) {
    return errorResponse("Invalid pass code.", 400);
  }

  const clean = passCode.trim();
  const { data: vehicle, error: vehicleError } = await supabase
    .from("driver_vehicles")
    .select("*, profiles:user_id (full_name, email)")
    .or(`qr_pass_code.eq.${clean},rego.ilike.${clean},id.eq.${clean}`)
    .maybeSingle();
  if (vehicleError) throw vehicleError;
  if (!vehicle) {
    return errorResponse("Vehicle pass not found.", 404);
  }

  return jsonResponse({
    verified: true,
    organizationName: ORGANIZATION_NAME,
    vehicle: {
      passCode: vehicle.qr_pass_code || vehicle.id,
      rego: vehicle.rego,
      makeModel: vehicle.make_model,
      bodyType: vehicle.body_type ?? null,
      branchName: vehicle.branch_name ?? null,
      status: vehicle.status,
      regoExpiryDate: vehicle.rego_expiry_date ?? null,
      dgExpiryDate: vehicle.dg_expiry_date ?? null,
      scbaServiceDueDate: vehicle.scba_service_due_date ?? null
    },
    driver: {
      fullName: vehicle.profiles?.full_name ?? vehicle.driver_name ?? "",
      email: vehicle.profiles?.email ?? ""
    }
  });
}

async function handleVerifyDriver(driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();

  if (!driverId || !/^[A-Za-z0-9-]+$/.test(driverId)) {
    return errorResponse("Invalid driver ID.", 400);
  }

  const driverSelect = "*, profiles:user_id (full_name, phone, licence_class)";

  // The QR badge encodes the driver's user id; fall back to the drivers table id
  let { data: driver, error } = await supabase
    .from("drivers")
    .select(driverSelect)
    .eq("user_id", driverId)
    .maybeSingle();
  if (error) throw error;
  if (!driver) {
    const byDriverId = await supabase
      .from("drivers")
      .select(driverSelect)
      .eq("id", driverId)
      .maybeSingle();
    if (byDriverId.error) throw byDriverId.error;
    driver = byDriverId.data;
  }
  if (!driver) {
    return errorResponse("Driver not found.", 404);
  }

  // Induction progress and certificates link via profiles.user_id,
  // so query them separately (no direct FK from drivers)
  const { data: induction } = await supabase
    .from("induction_progress")
    .select("completed_at, current_step")
    .eq("user_id", driver.user_id)
    .maybeSingle();
  const { data: certificate } = await supabase
    .from("certificates")
    .select("expires_at, issued_at")
    .eq("user_id", driver.user_id)
    .maybeSingle();

  const profile = driver.profiles ?? {};
  const completed = driver.status === "Completed" || induction?.completed_at != null;

  return jsonResponse({
    verified: true,
    organizationName: ORGANIZATION_NAME,
    driver: {
      driverId: driver.id,
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? "",
      licenceClass: profile.licence_class ?? "",
      inductionStatus: driver.status ?? "Not Started",
      inductionCompleted: Boolean(completed),
      completedAt: induction?.completed_at ?? null,
      certificateExpiresAt: certificate?.expires_at ?? null
    }
  });
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders }
  });
}

async function handleGetInductionVersions(): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("induction_versions")
    .select("id, version_label, revision_notes, published_by, published_at, is_current, created_at")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return jsonResponse({ versions: data ?? [] });
}

async function handleCreateInductionVersion(request: Request, adminId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const schema = z.object({
    versionLabel: z.string().min(1).max(32),
    revisionNotes: z.string().min(1).max(2000)
  });
  const { versionLabel, revisionNotes } = schema.parse(await request.json());

  // Atomically publish new version via RPC
  const { data: newVersionId, error: rpcError } = await supabase.rpc("publish_induction_version", {
    label: versionLabel,
    notes: revisionNotes,
    publisher: adminId
  });
  if (rpcError || !newVersionId) throw rpcError ?? new Error("Failed to publish induction version.");

  const { data: newVersion, error: fetchError } = await supabase
    .from("induction_versions")
    .select("id, version_label, revision_notes, published_at")
    .eq("id", newVersionId)
    .single();
  if (fetchError || !newVersion) throw fetchError ?? new Error("Failed to fetch newly created version.");

  await logAuditEntry(adminId, "admin_induction_version_published", {
    newVersionId: newVersion.id,
    versionLabel,
    revisionNotes
  });

  return jsonResponse(
    {
      message: `Induction version ${versionLabel} published. Drivers will be prompted to re-complete induction on next login.`,
      version: newVersion
    },
    201
  );
}

async function handleCreateDriver(request: Request, adminId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const schema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().min(5),
    address: z.string().min(5),
    preferredLanguage: z.string().min(2)
  });
  const payload = schema.parse(await request.json());

  const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { role: "driver" }
  });
  if (createError || !createdUser.user) throw createError ?? new Error("Account creation failed");

  const userId = createdUser.user.id;
  const now = new Date().toISOString();

  const [profileRes, driverRes, progressRes] = await Promise.allSettled([
    supabase.from("profiles").insert({
      id: userId, role: "driver", email: payload.email, full_name: payload.fullName,
      phone: payload.phone, address: payload.address, preferred_language: payload.preferredLanguage,
      created_at: now, updated_at: now
    }),
    supabase.from("drivers").insert({ user_id: userId, status: "Not Started", created_at: now }),
    supabase.from("induction_progress").insert({
      user_id: userId, current_step: 1, completion_percentage: 0, completed: false,
      completed_step_ids: [], updated_at: now
    })
  ]);

  const insertErrors: string[] = [];
  for (const res of [profileRes, driverRes, progressRes]) {
    if (res.status === "rejected") {
      insertErrors.push(res.reason?.message ?? "unknown error");
    } else if (res.value && typeof res.value === "object" && "error" in res.value) {
      const err = (res.value as { error?: { message?: string } }).error;
      if (err) insertErrors.push(err.message ?? "unknown");
    }
  }

  if (insertErrors.length > 0) {
    await supabase.auth.admin.deleteUser(userId).catch((e: any) =>
      console.error("[ROLLBACK] Failed to delete orphaned auth user:", e.message)
    );
    throw new Error(`Driver creation failed — DB inserts failed: ${insertErrors.join("; ")}`);
  }

  const { data: sections } = await supabase.from("learning_sections").select("id");
  if (sections?.length) {
    await supabase.from("learning_section_completions").insert(
      sections.map(s => ({ user_id: userId, section_id: s.id, completed: false }))
    );
  }

  await logAuditEntry(adminId, "admin_driver_created", { driverId: userId, email: payload.email });

  return jsonResponse({ message: "Driver account created.", userId }, 201);
}

async function handleUpdateDriver(request: Request, adminId: string, driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();

  const updateSchema = z.object({
    email: z.string().email().optional(),
    fullName: z.string().min(2).optional(),
    phone: z.string().min(5).optional(),
    address: z.string().min(3).optional(),
    preferredLanguage: z.string().min(2).optional()
  });
  const payload = updateSchema.parse(await request.json());

  if (payload.email) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(driverId, { email: payload.email });
    if (authErr) throw new Error(`Auth update failed: ${authErr.message}`);
  }

  const { error: profileErr } = await supabase.from("profiles").update({
    ...(payload.email && { email: payload.email }),
    ...(payload.fullName && { full_name: payload.fullName }),
    ...(payload.phone && { phone: payload.phone }),
    ...(payload.address && { address: payload.address }),
    ...(payload.preferredLanguage && { preferred_language: payload.preferredLanguage }),
    updated_at: new Date().toISOString()
  }).eq("id", driverId);
  if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

  await logAuditEntry(adminId, "admin_driver_updated", { driverId, email: payload.email });
  return jsonResponse({ message: "Driver updated" });
}

async function handleResetPassword(request: Request, adminId: string, driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const { password } = await request.json() as { password: string };
  await supabase.auth.admin.updateUserById(driverId, { password });
  await logAuditEntry(adminId, "admin_password_reset", { driverId });
  return jsonResponse({ message: "Password reset" });
}

async function handleResetInduction(_request: Request, adminId: string, driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Clear documents from storage
  const { data: docs } = await supabase.from("documents").select("file_url").eq("user_id", driverId);
  if (docs?.length) {
    await supabase.storage.from("driver-documents").remove(docs.map(d => d.file_url));
  }

  await Promise.all([
    supabase.from("documents").delete().eq("user_id", driverId),
    supabase.from("quiz_attempts").delete().eq("user_id", driverId),
    supabase.from("certificates").delete().eq("user_id", driverId),
    supabase.from("induction_progress").delete().eq("user_id", driverId)
  ]);

  await supabase.from("induction_progress").insert({
    user_id: driverId, current_step: 1, completion_percentage: 0, completed: false,
    completed_step_ids: [], updated_at: now
  });

  await logAuditEntry(adminId, "admin_induction_reset", { driverId });
  return jsonResponse({ message: "Induction reset complete" });
}

async function handleRevokeInduction(request: Request, adminId: string, driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const body = (await request.json().catch(() => ({}))) as { reason?: string; certificateId?: string };
  const reason = body.reason?.trim();
  const certificateId = body.certificateId;

  if (!reason) {
    return errorResponse("Reason is required for revoking induction.", 400);
  }

  // 1. Verify driver exists
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", driverId)
    .eq("role", "driver")
    .maybeSingle();

  if (profileErr) {
    return errorResponse(`Failed to fetch driver profile: ${profileErr.message}`, 500);
  }
  if (!profile) {
    return errorResponse("Driver not found.", 404);
  }

  // 2. Fetch certificate if present
  let certQuery = supabase
    .from("certificates")
    .select("*")
    .eq("user_id", driverId)
    .order("issued_at", { ascending: false });

  if (certificateId) {
    certQuery = certQuery.eq("id", certificateId);
  }

  const { data: certList } = await certQuery.limit(1);
  const certificate = certList?.[0] ?? null;

  const now = new Date().toISOString();

  // 3. Handle certificate revocation/removal
  if (certificate) {
    // Try updating revoked_at if migration 016 column exists
    const { error: updateCertErr } = await supabase
      .from("certificates")
      .update({
        revoked_at: now,
        revoked_by: adminId,
        revocation_reason: reason
      })
      .eq("id", certificate.id);

    // If revoked_at column does not exist (42703), safely delete the certificate record so driver is not certified
    if (updateCertErr) {
      console.warn("Certificates update failed (likely missing revoked_at column), deleting certificate record:", updateCertErr.message);
      await supabase.from("certificates").delete().eq("id", certificate.id);
    }
  }

  // 4. Check & cancel active schedule enrollment
  const { data: enrollment } = await supabase
    .from("induction_schedule_enrollments")
    .select("*")
    .eq("driver_id", driverId)
    .eq("status", "active")
    .maybeSingle();

  if (enrollment) {
    // Try full cancel fields
    const { error: cancelErr } = await supabase
      .from("induction_schedule_enrollments")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: adminId,
        cancellation_reason: `Induction revoked: ${reason}`,
        updated_at: now
      })
      .eq("id", enrollment.id);

    if (cancelErr) {
      // Fallback to basic status update if cancelled_at doesn't exist
      await supabase
        .from("induction_schedule_enrollments")
        .update({
          status: "cancelled",
          updated_at: now
        })
        .eq("id", enrollment.id);
    }
  }

  // 5. Attempt record in induction_revocations if table exists
  try {
    await supabase
      .from("induction_revocations")
      .insert({
        user_id: driverId,
        certificate_id: certificate?.id ?? null,
        schedule_enrollment_id: enrollment?.id ?? null,
        revoked_by: adminId,
        revocation_type: "revoke_induction",
        reason,
        previous_status: "completed",
        metadata: {
          certificate_id: certificate?.id ?? null,
          completion_id: certificate?.completion_id ?? null,
          verification_code: certificate?.verification_code ?? null,
          had_active_enrollment: !!enrollment
        }
      });
  } catch (err: any) {
    console.warn("Could not record in induction_revocations (table may not exist):", err?.message);
  }

  // 6. Reset driver status in drivers table
  await supabase
    .from("drivers")
    .update({ status: "Not Started" })
    .eq("user_id", driverId);

  // 7. Reset induction progress
  await supabase.from("induction_progress").delete().eq("user_id", driverId);
  await supabase.from("induction_progress").insert({
    user_id: driverId,
    current_step: 1,
    completion_percentage: 0,
    completed: false,
    completed_step_ids: [],
    quiz_score: null,
    declaration_accepted: false,
    declaration_agreed_at: null,
    signature: null,
    completed_at: null,
    updated_at: now
  });

  // 8. Audit log
  await logAuditEntry(adminId, "admin_induction_revoked", {
    driverId,
    certificateId: certificate?.id ?? null,
    reason,
    verificationCode: certificate?.verification_code ?? null
  });

  return jsonResponse({
    message: "Induction revoked successfully.",
    certificateId: certificate?.id ?? null
  });
}

async function handleGetDriverRevocations(request: Request, adminId: string, driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  try {
    const { data, error } = await supabase
      .from("induction_revocations")
      .select(`*, revoked_by_profile:profiles!revoked_by(full_name, email)`)
      .eq("user_id", driverId)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonResponse([]);
    }
    return jsonResponse(data ?? []);
  } catch {
    return jsonResponse([]);
  }
}

async function handleDeleteDriver(_request: Request, adminId: string, driverId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();

  const { data: docs } = await supabase.from("documents").select("file_url").eq("user_id", driverId);
  if (docs?.length) {
    await supabase.storage.from("driver-documents").remove(docs.map(d => d.file_url));
  }

  await Promise.all([
    supabase.from("documents").delete().eq("user_id", driverId),
    supabase.from("induction_progress").delete().eq("user_id", driverId),
    supabase.from("drivers").delete().eq("user_id", driverId),
    supabase.from("profiles").delete().eq("id", driverId),
    supabase.auth.admin.deleteUser(driverId)
  ]);

  await logAuditEntry(adminId, "admin_driver_deleted", { driverId });
  return jsonResponse({ message: "Driver deleted" });
}

async function handleExportReports(url: URL, adminId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const scope = url.searchParams.get("scope") || "drivers";
  const format = url.searchParams.get("format") || "csv";

  let data: any[] = [];
  if (scope === "drivers") {
    const { data: profiles } = await supabase.from("profiles").select("id,email,full_name").eq("role", "driver");
    data = profiles || [];
  } else {
    const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
    data = logs || [];
  }

  await logAuditEntry(adminId, "admin_report_exported", { scope, format });

  const headers = Object.keys(data[0] || {});

  if (format === "pdf") {
    const htmlReport = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${ORGANIZATION_NAME} ${scope.toUpperCase()} Report</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; }
    h1 { color: #0f172a; margin-bottom: 4px; }
    p.meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${ORGANIZATION_NAME} — ${scope.toUpperCase()} Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()} | Total Records: ${data.length}</p>
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h.toUpperCase()}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${data.map(row => `<tr>${headers.map(h => `<td>${String(row[h] ?? "")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    return new Response(htmlReport, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename=report-${scope}.html`
      }
    });
  }

  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] || "")).join(","))
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=report-${scope}.csv`
    }
  });
}

async function handleGetVerificationQueue(adminId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("documents")
    .select(`
      id,
      user_id,
      type,
      file_name,
      mime_type,
      status,
      verified_by_admin,
      uploaded_at,
      expires_at,
      profiles!inner(full_name, email)
    `)
    .eq("status", "pending")
    .order("uploaded_at", { ascending: true });

  if (error) throw error;

  return jsonResponse({ documents: data ?? [] });
}

async function handleVerifyDocument(request: Request, adminId: string, docId: string): Promise<Response> {
  const supabase = getSupabaseAdmin();
  const { action } = await request.json() as { action: "approve" | "reject" };

  if (action !== "approve" && action !== "reject") {
    return errorResponse("Action must be 'approve' or 'reject'.", 400);
  }

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("user_id, type")
    .eq("id", docId)
    .single();
  if (docError || !doc) return errorResponse("Document not found.", 404);

  const driverId = doc.user_id;

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      verified_by_admin: action === "approve"
    })
    .eq("id", docId);
  if (updateError) throw updateError;

  if (action === "approve") {
    const { data: driverDocs } = await supabase
      .from("documents")
      .select("type, status")
      .eq("user_id", driverId);

    const requiredTypes = ["driver_license", "medical_certificate", "identity_proof"];
    const allApproved = requiredTypes.every((type) =>
      (driverDocs ?? []).some((d: any) => d.type === type && d.status === "approved")
    );

    if (allApproved) {
      const { data: progress } = await supabase
        .from("induction_progress")
        .select("completed_step_ids, current_step")
        .eq("user_id", driverId)
        .single();

      const completedSteps: number[] = progress?.completed_step_ids ?? [];
      if (!completedSteps.includes(1)) completedSteps.push(1);

      const { error: progressErr } = await supabase.from("induction_progress").update({
        current_step: Math.max(progress?.current_step ?? 1, 2),
        completed_step_ids: completedSteps.sort((a, b) => a - b),
        updated_at: new Date().toISOString()
      }).eq("user_id", driverId);
      if (progressErr) throw new Error(`Failed to advance driver progress: ${progressErr.message}`);

      const { error: statusErr } = await supabase.from("drivers").update({ status: "In Progress" }).eq("user_id", driverId);
      if (statusErr) throw new Error(`Failed to update driver status: ${statusErr.message}`);
    }
  }

  await logAuditEntry(adminId, `admin_document_${action}d`, {
    docId,
    driverId,
    documentType: doc.type
  });

  return jsonResponse({
    message: `Document ${action === "approve" ? "approved" : "rejected"} successfully.`
  });
}

async function handleNotify(request: Request, adminId: string): Promise<Response> {
  const notifySchema = z.object({
    eventType: z.string().min(1),
    userEmail: z.string().email(),
    driverName: z.string().optional(),
    context: z.record(z.string(), z.string()).optional()
  });
  const body = notifySchema.parse(await request.json());

  const { eventType, userEmail, driverName, context } = body;
  console.log(`[NOTIFICATION] ${eventType} for ${userEmail}`);

  if (eventType === "induction_completed" && context?.expiresAt && context?.certificateUrl) {
    const expiry = new Date(context.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#1e3a5f">Congratulations, ${driverName ?? "Driver"}!</h2>
      <p>You have successfully completed the <strong>${ORGANIZATION_NAME}</strong> Driver Induction Program.</p>
      <p>Your certificate is valid for <strong>12 months</strong> and expires on <strong>${expiry}</strong>.</p>
      <p><a href="${context.certificateUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">View Certificate</a></p>
    </div>`;
    await sendEmailViaResend(userEmail, `Induction Complete — Certificate Issued by ${ORGANIZATION_NAME}`, html);
  } else {
    const html = `<p>Hello ${driverName || "Driver"},</p><p>Event: <strong>${eventType}</strong></p><p>${JSON.stringify(context ?? {})}</p>`;
    await sendEmailViaResend(userEmail, `${ORGANIZATION_NAME} Notification: ${eventType}`, html);
  }

  return jsonResponse({ message: "Notification dispatched" });
}

// --- Main entry point (Vercel Web Standard / Edge function) ---
export const config = {
  runtime: "edge"
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const configError = requireConfig();
  if (configError) return configError;

  const url = new URL(request.url, APP_URL);
  let rawPath = (url.pathname || "").replace(/^\/+/, ""); // e.g. "api/induction/step"
  if (rawPath.includes("[[...path]]") || rawPath === "api") {
    const matched = request.headers.get("x-matched-path") || request.headers.get("x-invoke-path");
    if (matched) {
      rawPath = matched.replace(/^\/+/, "");
    }
  }
  const cleanPath = rawPath.replace(/^api\//, "").replace(/\/+$/, "");
  const method = request.method;

  try {
    // Health Check
    if ((cleanPath === "health" || rawPath === "health") && method === "GET") {
      return await handleHealth();
    }

    // Branding — public read
    if (cleanPath === "branding" && method === "GET") {
      return await handleGetBranding();
    }

    // Branding — admin update
    if (cleanPath === "branding" && method === "PUT") {
      const admin = await requireAdmin(request);
      if ("response" in admin) return admin.response;
      return await handleUpdateBranding(request, admin.adminId);
    }

    // --- Public Registration Route ---
    if (cleanPath === "auth/register-driver" && method === "POST") {
      if (!ALLOW_SELF_REGISTRATION) {
        return errorResponse("Self-registration is disabled. Ask your administrator to create your induction account.", 403);
      }
      return await handleSelfRegisterDriver(request);
    }

    // --- Change Password (any authenticated user) ---
    if (cleanPath === "auth/change-password" && method === "POST") {
      if (!rateLimitCheck(`changepw:${clientIp(request)}`, 10, 60_000)) {
        return errorResponse("Too many requests. Please slow down and try again shortly.", 429);
      }
      return await handleChangePassword(request);
    }

    // --- Admin Routes ---
    if (cleanPath.startsWith("admin/")) {
      const admin = await requireAdmin(request);
      if ("response" in admin) return admin.response;
      const adminId = admin.adminId;

      // Induction Versions
      if (cleanPath === "admin/induction-versions" && method === "GET") {
        return await handleGetInductionVersions();
      }
      if (cleanPath === "admin/induction-versions" && method === "POST") {
        return await handleCreateInductionVersion(request, adminId);
      }

      // Create Driver
      if (cleanPath === "admin/drivers" && method === "POST") {
        return await handleCreateDriver(request, adminId);
      }

      const driverMatch = cleanPath.match(/^admin\/drivers\/([^/]+)$/);
      if (driverMatch && method === "PUT") {
        return await handleUpdateDriver(request, adminId, driverMatch[1]);
      }

      const pwResetMatch = cleanPath.match(/^admin\/drivers\/([^/]+)\/reset-password$/);
      if (pwResetMatch && method === "POST") {
        return await handleResetPassword(request, adminId, pwResetMatch[1]);
      }

      const inductionResetMatch = cleanPath.match(/^admin\/drivers\/([^/]+)\/reset-induction$/);
      if (inductionResetMatch && method === "POST") {
        return await handleResetInduction(request, adminId, inductionResetMatch[1]);
      }

      const inductionRevokeMatch = cleanPath.match(/^admin\/drivers\/([^/]+)\/revoke-induction$/);
      if (inductionRevokeMatch && method === "POST") {
        return await handleRevokeInduction(request, adminId, inductionRevokeMatch[1]);
      }

      const revocationsMatch = cleanPath.match(/^admin\/drivers\/([^/]+)\/revocations$/);
      if (revocationsMatch && method === "GET") {
        return await handleGetDriverRevocations(request, adminId, revocationsMatch[1]);
      }

      if (driverMatch && method === "DELETE") {
        return await handleDeleteDriver(request, adminId, driverMatch[1]);
      }

      // Export Reports
      if (cleanPath === "admin/reports/export" && method === "GET") {
        return await handleExportReports(url, adminId);
      }

      // Verification Queue — GET all pending documents
      if (cleanPath === "admin/verification-queue" && method === "GET") {
        return await handleGetVerificationQueue(adminId);
      }

      // Approve / Reject a document
      const docVerifyMatch = cleanPath.match(/^admin\/documents\/([^/]+)\/verify$/);
      if (docVerifyMatch && method === "POST") {
        return await handleVerifyDocument(request, adminId, docVerifyMatch[1]);
      }

      // --- Induction Schedules ---
      if (cleanPath === "admin/schedules" && method === "GET") {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("induction_schedules")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return jsonResponse(data ?? []);
      }

      if (cleanPath === "admin/schedules" && method === "POST") {
        const supabase = getSupabaseAdmin();
        const body = (await request.json().catch(() => ({}))) as any;
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("induction_schedules")
          .insert({
            name: body.name,
            description: body.description ?? null,
            is_active: body.isActive ?? true,
            created_by: adminId,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();
        if (error) throw error;
        return jsonResponse(data, 201);
      }

      const scheduleMatch = cleanPath.match(/^admin\/schedules\/([^/]+)$/);
      if (scheduleMatch && method === "GET") {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("induction_schedules")
          .select("*")
          .eq("id", scheduleMatch[1])
          .maybeSingle();
        if (error) throw error;
        if (!data) return errorResponse("Schedule not found.", 404);
        return jsonResponse(data);
      }

      if (scheduleMatch && method === "PATCH") {
        const supabase = getSupabaseAdmin();
        const body = (await request.json().catch(() => ({}))) as any;
        const { data, error } = await supabase
          .from("induction_schedules")
          .update({ ...body, updated_at: new Date().toISOString() })
          .eq("id", scheduleMatch[1])
          .select()
          .single();
        if (error) throw error;
        return jsonResponse(data);
      }

      if (scheduleMatch && method === "DELETE") {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("induction_schedules").delete().eq("id", scheduleMatch[1]);
        if (error) throw error;
        return jsonResponse({ message: "Schedule deleted." });
      }

      // Schedule Items
      const scheduleItemsMatch = cleanPath.match(/^admin\/schedules\/([^/]+)\/items$/);
      if (scheduleItemsMatch && method === "GET") {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("induction_schedule_items")
          .select("*, course:induction_courses(*)")
          .eq("schedule_id", scheduleItemsMatch[1])
          .order("sequence_order", { ascending: true });
        if (error) throw error;
        return jsonResponse(data ?? []);
      }

      if (scheduleItemsMatch && method === "POST") {
        const supabase = getSupabaseAdmin();
        const body = (await request.json().catch(() => ({}))) as any;
        const { data, error } = await supabase
          .from("induction_schedule_items")
          .insert({
            schedule_id: scheduleItemsMatch[1],
            course_id: body.courseId ?? null,
            title: body.title ?? null,
            sequence_order: body.sequenceOrder ?? 1,
            delay_days: body.delayDays ?? 0,
            delay_type: body.delayType ?? "after_completion",
            fixed_date: body.fixedDate ?? null,
            expiry_interval: body.expiryInterval ?? null,
            trigger_config: body.triggerConfig ?? {},
            is_required: body.isRequired ?? true,
            created_at: new Date().toISOString()
          })
          .select("*, course:induction_courses(*)")
          .single();
        if (error) throw error;
        return jsonResponse(data, 201);
      }

      const scheduleItemDeleteMatch = cleanPath.match(/^admin\/schedules\/([^/]+)\/items\/([^/]+)$/);
      if (scheduleItemDeleteMatch && method === "DELETE") {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("induction_schedule_items").delete().eq("id", scheduleItemDeleteMatch[2]);
        if (error) throw error;
        return jsonResponse({ message: "Schedule item deleted." });
      }

      // Schedule Enrollments
      const scheduleEnrollmentsMatch = cleanPath.match(/^admin\/schedules\/([^/]+)\/enrollments$/);
      if (scheduleEnrollmentsMatch && method === "GET") {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("induction_schedule_enrollments")
          .select("*, driver:profiles!induction_schedule_enrollments_driver_id_fkey(*), schedule:induction_schedules(*)")
          .eq("schedule_id", scheduleEnrollmentsMatch[1])
          .order("enrolled_at", { ascending: false });
        if (error) throw error;
        return jsonResponse(data ?? []);
      }

      const scheduleEnrollMatch = cleanPath.match(/^admin\/schedules\/([^/]+)\/enroll$/);
      if (scheduleEnrollMatch && method === "POST") {
        const supabase = getSupabaseAdmin();
        const body = (await request.json().catch(() => ({}))) as any;
        const { data, error } = await supabase
          .from("induction_schedule_enrollments")
          .insert({
            schedule_id: scheduleEnrollMatch[1],
            driver_id: body.driverId,
            enrolled_by: adminId,
            enrolled_at: new Date().toISOString(),
            status: "active",
            current_item_index: 0
          })
          .select("*, schedule:induction_schedules(*)")
          .single();
        if (error) throw error;
        return jsonResponse(data, 201);
      }

      const scheduleUnenrollMatch = cleanPath.match(/^admin\/schedules\/([^/]+)\/enroll\/([^/]+)$/);
      if (scheduleUnenrollMatch && method === "DELETE") {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.from("induction_schedule_enrollments").delete().eq("id", scheduleUnenrollMatch[2]);
        if (error) throw error;
        return jsonResponse({ message: "Driver unenrolled." });
      }

      if (cleanPath === "admin/schedules/process-invitations" && method === "POST") {
        return jsonResponse({ processed: 0 });
      }
    }

    // --- Secure Driver Routes ---

    // Quiz Questions
    if (cleanPath === "induction/quiz-questions" && method === "GET") {
      const driver = await requireDriver(request);
      if ("response" in driver) return driver.response;
      return await handleGetQuizQuestions(driver.userId);
    }

    // Start Video Section
    if (cleanPath === "induction/section/start" && method === "POST") {
      const driver = await requireDriver(request);
      if ("response" in driver) return driver.response;
      return await handleStartSection(driver.userId, request);
    }

    // Save Step Progress
    if (cleanPath === "induction/step" && method === "POST") {
      const driver = await requireDriver(request);
      if ("response" in driver) return driver.response;
      return await handleSaveStep(driver.userId, request);
    }

    // Submit Quiz
    if (cleanPath === "induction/quiz" && method === "POST") {
      const driver = await requireDriver(request);
      if ("response" in driver) return driver.response;
      if (!rateLimitCheck(`quiz:${clientIp(request)}`, 10, 60_000)) {
        return errorResponse("Too many requests. Please slow down and try again shortly.", 429);
      }
      return await handleSubmitQuiz(driver.userId, request);
    }

    // Issue Certificate
    if (cleanPath === "induction/certificate" && method === "POST") {
      const driver = await requireDriver(request);
      if ("response" in driver) return driver.response;
      return await handleIssueCertificate(driver.userId, request);
    }

    // --- Public Routes ---

    // Verify Certificate
    const verifyMatch = cleanPath.match(/^certificate\/verify\/([^/]+)$/);
    if (verifyMatch && method === "GET") {
      return await handleVerifyCertificate(verifyMatch[1], request);
    }

    // Verify Driver ID
    const driverVerifyMatch = cleanPath.match(/^driver\/verify\/([^/]+)$/);
    if (driverVerifyMatch && method === "GET") {
      return await handleVerifyDriver(driverVerifyMatch[1]);
    }

    // Verify Vehicle Pass
    const vehicleVerifyMatch = cleanPath.match(/^vehicle\/verify\/([^/]+)$/);
    if (vehicleVerifyMatch && method === "GET") {
      return await handleVerifyVehiclePass(vehicleVerifyMatch[1]);
    }

    // OCR is deliberately not exposed as a public service-role endpoint. Document
    // approval and expiry decisions must be made by authorised compliance staff.
    if (cleanPath === "documents/verify" && method === "POST") {
      return errorResponse("Document verification is performed by authorised compliance staff.", 403);
    }

    // Notifications can dispatch third-party email and therefore require admin auth.
    if (cleanPath === "notifications/notify" && method === "POST") {
      const admin = await requireAdmin(request);
      if ("response" in admin) return admin.response;
      return await handleNotify(request, admin.adminId);
    }

    return errorResponse("Route not found: " + rawPath, 404);
  } catch (err: any) {
    console.error("API Error:", err);
    return errorResponse(err?.message || "Internal Server Error", 500);
  }
}
