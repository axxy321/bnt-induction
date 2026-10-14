import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { resolve } from "path";
import WebSocket from "ws";
import { z } from "zod";
import nodemailer from "nodemailer";
import { generateReportPdfBuffer } from "./pdf-generator.js";

(global as any).WebSocket = WebSocket;

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../../.env") });

const app = express();
app.set("trust proxy", 1);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? "http://localhost:5173";
const organizationName = process.env.ORGANIZATION_NAME ?? "BNT Logistics";
const organizationLogoUrl = process.env.ORGANIZATION_LOGO_URL ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

// --- Rate Limiter (no external deps) ---
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX_STORE_SIZE = 10_000; // H-1 FIX: cap to prevent OOM from IP-spoofed floods
function rateLimit(maxRequests: number, windowMs: number) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const ip = String(request.ip ?? request.socket.remoteAddress ?? "unknown");
    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    if (!entry || now > entry.resetAt) {
      // H-1 FIX: Evict oldest expired entries if store is at capacity
      if (rateLimitStore.size >= RATE_LIMIT_MAX_STORE_SIZE) {
        for (const [key, val] of rateLimitStore.entries()) {
          if (now > val.resetAt) rateLimitStore.delete(key);
          if (rateLimitStore.size < RATE_LIMIT_MAX_STORE_SIZE) break;
        }
      }
      rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > maxRequests) {
      response.status(429).json({ message: "Too many requests. Please slow down and try again shortly." });
      return;
    }
    next();
  };
}
// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 10 * 60 * 1000);

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// CORS allowlist — set ALLOWED_ORIGINS="https://yourdomain.com" in production .env
const rawOrigins = process.env.ALLOWED_ORIGINS ?? "";
const allowedOrigins = rawOrigins
  ? rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and any explicitly listed origin
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json({ limit: "2mb" }));

interface AdminRequest extends express.Request {
  authUserId?: string;
  userRole?: "driver" | "admin";
}

async function logAuditEntry(userId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    user_id: userId,
    action,
    metadata,
    created_at: new Date().toISOString()
  });

  if (error && process.env.NODE_ENV !== "production") {
    console.error("audit log failed", action, error);
  }
}

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "driver-induction-api",
    organizationName,
    timestamp: new Date().toISOString()
  });
});

async function requireAdmin(request: AdminRequest, response: express.Response, next: express.NextFunction) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  const token = header.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    response.status(401).json({ message: "Invalid session." });
    return;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin") {
    response.status(403).json({ message: "Admin access is required." });
    return;
  }

  request.authUserId = authData.user.id;
  request.userRole = "admin";
  next();
}

async function requireDriver(request: AdminRequest, response: express.Response, next: express.NextFunction) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  const token = header.slice("Bearer ".length);
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) {
    response.status(401).json({ message: "Invalid session." });
    return;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "driver") {
    response.status(403).json({ message: "Driver access is required." });
    return;
  }

  const mustChange = authData.user.user_metadata?.must_change_password === true;
  if (mustChange) {
    response.status(403).json({
      code: "PASSWORD_RESET_REQUIRED",
      message: "Password change is required before starting your induction."
    });
    return;
  }

  request.authUserId = authData.user.id;
  request.userRole = "driver";
  next();
}

// ============================================================
// Branding: public read, admin-managed appearance settings
// (company name, logo path, primary colour, welcome text)
// ============================================================

const DEFAULT_BRANDING = {
  id: "default",
  company_name: organizationName,
  logo_path: null as string | null,
  primary_color: "#1e3a5f",
  welcome_text: "",
  updated_at: null as string | null
};

/**
 * GET /api/branding
 * Public. Returns the branding row so the login page can show
 * the company logo, name and welcome text before sign-in.
 */
app.get("/api/branding", async (_request, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("branding")
      .select("id, company_name, logo_path, primary_color, welcome_text, updated_at")
      .eq("id", "default")
      .maybeSingle();
    if (error) throw error;
    response.json({ branding: data ?? DEFAULT_BRANDING });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/branding
 * Admin only. Upserts the single branding row and records
 * an audit entry.
 */
app.put("/api/branding", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      company_name: z.string().min(1).max(100),
      logo_path: z.string().max(500).nullable().optional(),
      primary_color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Primary colour must be a hex value like #1e3a5f"),
      welcome_text: z.string().max(500)
    });
    const payload = schema.parse(request.body);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("branding")
      .upsert(
        {
          id: "default",
          ...payload,
          updated_by: request.authUserId ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      )
      .select("id, company_name, logo_path, primary_color, welcome_text, updated_at")
      .maybeSingle();
    if (updateError) throw updateError;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_branding_updated", {
        companyName: payload.company_name,
        hasLogo: Boolean(payload.logo_path)
      }).catch(() => {});
    }

    response.json({ message: "Branding updated.", branding: updated });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// MILESTONE 1: Versioned Inductions — Read current version (public)
// ============================================================

/**
 * GET /api/induction/version
 * Driver-facing. Returns the currently active induction version.
 * Drivers call this to detect if a newer version requires re-completion.
 */
app.get(["/api/induction/version", "/api/induction/status"], requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const { data: currentVersion, error } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label, revision_notes, published_at")
      .eq("is_current", true)
      .maybeSingle();

    if (error || !currentVersion) {
      response.json({ id: null, versionLabel: "1.0", revisionNotes: "", publishedAt: null, hasPendingVersion: false });
      return;
    }

    const { data: cert } = await supabaseAdmin
      .from("certificates")
      .select("induction_version_id")
      .eq("user_id", userId)
      // H-2 FIX: .maybeSingle() throws PostgrestError when user has >1 certificate.
      // Use .order().limit(1) to always get the latest certificate safely.
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: progress } = await supabaseAdmin
      .from("induction_progress")
      .select("induction_version_id, completed")
      .eq("user_id", userId)
      .maybeSingle();

    const driverVersionId = cert?.induction_version_id || progress?.induction_version_id;
    let hasPendingVersion = false;

    if ((cert || progress?.completed) && driverVersionId) {
      if (driverVersionId !== currentVersion.id) {
        // Fetch the old version's label to compare semantically
        const { data: oldVer } = await supabaseAdmin
          .from("induction_versions")
          .select("version_label")
          .eq("id", driverVersionId)
          .maybeSingle();
        
        if (oldVer && oldVer.version_label !== currentVersion.version_label) {
          hasPendingVersion = true;
        }
      }
    }

    response.json({
      id: currentVersion.id,
      versionLabel: currentVersion.version_label,
      revisionNotes: currentVersion.revision_notes,
      publishedAt: currentVersion.published_at,
      hasPendingVersion
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/induction-versions
 * Admin-facing. Lists all published induction versions, newest first.
 */
app.get("/api/admin/induction-versions", requireAdmin, async (_request, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label, revision_notes, published_by, published_at, is_current, created_at")
      .order("published_at", { ascending: false });

    if (error) throw error;
    response.json({ versions: data ?? [] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/induction-versions
 * Admin-facing. Publishes a new induction version.
 * Sets is_current = true on the new version, false on all others.
 * Drivers whose induction_progress.induction_version_id points to an older version
 * will be detected by GET /api/induction/version on next login.
 */
app.post("/api/admin/induction-versions", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      versionLabel: z.string().min(1).max(32),
      revisionNotes: z.string().min(1).max(2000)
    });
    const { versionLabel, revisionNotes } = schema.parse(request.body);

    // Step 1 & 2: Atomically publish new version via RPC
    const { data: newVersionId, error: rpcError } = await supabaseAdmin.rpc("publish_induction_version", {
      label: versionLabel,
      notes: revisionNotes,
      publisher: request.authUserId ?? null
    });
    if (rpcError || !newVersionId) throw rpcError ?? new Error("Failed to publish induction version.");

    // Fetch the inserted row to return matching the previous structure
    const { data: newVersion, error: fetchError } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label, revision_notes, published_at")
      .eq("id", newVersionId)
      .single();
    if (fetchError || !newVersion) throw fetchError ?? new Error("Failed to fetch newly created version.");

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_induction_version_published", {
        newVersionId: newVersion.id,
        versionLabel,
        revisionNotes
      });
    }

    response.status(201).json({
      message: `Induction version ${versionLabel} published. Drivers will be prompted to re-complete induction on next login.`,
      version: newVersion
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// END OF MILESTONE 1: Versioned Inductions Routes
// ============================================================

app.post("/api/admin/drivers", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      phone: z.string().min(5),
      address: z.string().min(5),
      preferredLanguage: z.string().min(2),
      licenceClass: z.string().optional(),
      issuingState: z.string().optional(),
      licenceNumber: z.string().trim().regex(/^[A-Za-z0-9]{8}$/, "Licence number must be exactly 8 letters or numbers."),
      depotLocation: z.string().optional()
    });
    const payload = schema.parse(request.body);

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        role: "driver",
        must_change_password: false,
        licenceClass: payload.licenceClass || "HC",
        issuingState: payload.issuingState || "VIC",
        licenceNumber: payload.licenceNumber.toUpperCase(),
        depotLocation: payload.depotLocation || "Melbourne Hub"
      }
    });
    if (createError || !createdUser.user) throw createError ?? new Error("Unable to create driver account.");

    const userId = createdUser.user.id;
    const createdAt = new Date().toISOString();

    try {
      const fullProfile = {
        id: userId,
        role: "driver",
        email: payload.email,
        full_name: payload.fullName,
        phone: payload.phone,
        address: payload.address,
        preferred_language: payload.preferredLanguage,
        licence_class: payload.licenceClass || "HC",
        issuing_state: payload.issuingState || "VIC",
        licence_number: payload.licenceNumber.toUpperCase(),
        depot_location: payload.depotLocation || "Melbourne Hub",
        created_at: createdAt,
        updated_at: createdAt
      };
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(fullProfile);
      if (profileError) {
        // Fallback to base columns if extended columns do not exist
        const { error: fallbackErr } = await supabaseAdmin.from("profiles").upsert({
          id: userId,
          role: "driver",
          email: payload.email,
          full_name: payload.fullName,
          phone: payload.phone,
          address: payload.address,
          preferred_language: payload.preferredLanguage,
          created_at: createdAt,
          updated_at: createdAt
        });
        if (fallbackErr) throw fallbackErr;
      }

      const { error: driverError } = await supabaseAdmin.from("drivers").upsert({
        user_id: userId,
        status: "Not Started",
        created_at: createdAt
      });
      if (driverError) throw driverError;

      const { error: progressError } = await supabaseAdmin.from("induction_progress").upsert({
        user_id: userId,
        current_step: 1,
        completion_percentage: 0,
        completed: false,
        completed_step_ids: [],
        updated_at: createdAt
      });
      if (progressError) throw progressError;

      const { data: sections } = await supabaseAdmin.from("learning_sections").select("id");
      if (sections?.length) {
        const completionRows = sections.map((section) => ({
          user_id: userId,
          section_id: section.id,
          section_version: "1.0",
          completed: false,
          completed_at: null
        }));
        const { error: completionError } = await supabaseAdmin.from("learning_section_completions").insert(completionRows);
        if (completionError) throw completionError;
      }
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw err;
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_driver_created", {
        driverId: userId,
        email: payload.email
      });
    }

    // Email delivery is independent of account creation. Report its result so
    // the admin can tell whether provider credentials need configuring.
    let emailSent = false;
    try {
      emailSent = await sendNotificationService({
        eventType: "driver_created",
        userEmail: payload.email,
        driverName: payload.fullName,
        context: { temporaryPassword: payload.password }
      });
    } catch (emailError) {
      console.error("[EMAIL] Welcome email failed:", emailError instanceof Error ? emailError.message : emailError);
    }

    response.status(201).json({
      message: emailSent ? "Driver account created and welcome email sent." : "Driver account created, but the welcome email was not sent. Configure an email provider on the API server.",
      emailSent,
      userId
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/drivers/:driverId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(5),
      address: z.string().min(3),
      preferredLanguage: z.string().min(2),
      licenceClass: z.string().optional(),
      issuingState: z.string().optional(),
      licenceNumber: z.string().trim().regex(/^[A-Za-z0-9]{8}$/, "Licence number must be exactly 8 letters or numbers."),
      depotLocation: z.string().optional()
    });
    const payload = schema.parse(request.body);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(driverId, {
      email: payload.email,
      user_metadata: { role: "driver" }
    });
    if (authError) throw authError;

    const fullUpdate: Record<string, any> = {
      email: payload.email,
      full_name: payload.fullName,
      phone: payload.phone,
      address: payload.address,
      preferred_language: payload.preferredLanguage,
      updated_at: new Date().toISOString()
    };
    if (payload.licenceClass) fullUpdate.licence_class = payload.licenceClass;
    if (payload.issuingState) fullUpdate.issuing_state = payload.issuingState;
    if (payload.licenceNumber) fullUpdate.licence_number = payload.licenceNumber.toUpperCase();
    if (payload.depotLocation) fullUpdate.depot_location = payload.depotLocation;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(fullUpdate)
      .eq("id", driverId);
    
    if (profileError) {
      // Fallback to base columns if extended columns do not exist
      await supabaseAdmin
        .from("profiles")
        .update({
          email: payload.email,
          full_name: payload.fullName,
          phone: payload.phone,
          address: payload.address,
          preferred_language: payload.preferredLanguage,
          updated_at: new Date().toISOString()
        })
        .eq("id", driverId);
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_driver_updated", {
        driverId,
        email: payload.email
      });
    }

    response.json({ message: "Driver updated." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/drivers/:driverId/reset-password", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);
    const schema = z.object({
      password: z.string().min(8)
    });
    const payload = schema.parse(request.body);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(driverId, {
      password: payload.password,
      user_metadata: { must_change_password: false }
    });
    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_password_reset", {
        driverId
      });
    }

    // Report email delivery separately; the password reset itself has already
    // succeeded even when email credentials are missing.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", driverId)
      .single();
    let emailSent = false;
    if (profile?.email) {
      try {
        emailSent = await sendNotificationService({
          eventType: "password_reset",
          userEmail: profile.email,
          driverName: profile.full_name,
          context: { temporaryPassword: payload.password }
        });
      } catch (emailError) {
        console.error("[EMAIL] Password reset email failed:", emailError instanceof Error ? emailError.message : emailError);
      }
    }

    response.json({
      emailSent,
      message: emailSent
        ? "Temporary password set and emailed to the driver."
        : "Temporary password was changed, but the email was not sent. Configure an email provider on the API server."
    });
  } catch (error) {
    next(error);
  }
});

// Driver password help requests are stored for admins in the portal. Keep the
// public response identical for known and unknown email addresses.
app.post("/api/auth/password-reset-request", rateLimit(5, 60_000), async (request, response, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    const normalizedEmail = email.trim().toLowerCase();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .ilike("email", normalizedEmail)
      .eq("role", "driver")
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile) {
      const { data: existingRequest, error: existingError } = await supabaseAdmin
        .from("driver_password_reset_requests")
        .select("id")
        .eq("driver_id", profile.id)
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existingRequest) {
        const { error: insertError } = await supabaseAdmin
          .from("driver_password_reset_requests")
          .insert({ driver_id: profile.id, email: normalizedEmail });
        if (insertError) throw insertError;
      }
    }

    response.status(202).json({
      message: "If this email belongs to a driver account, an administrator will review the password help request."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/password-reset-requests", requireAdmin, async (_request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("driver_password_reset_requests")
      .select("*, driver:profiles!driver_password_reset_requests_driver_id_fkey(full_name, phone)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/password-reset-requests/:requestId/handled", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const requestId = z.string().uuid().parse(request.params.requestId);
    const handledAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("driver_password_reset_requests")
      .update({ status: "handled", handled_at: handledAt, handled_by: request.authUserId })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      response.status(404).json({ message: "Pending password help request not found." });
      return;
    }
    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "driver_password_help_request_handled", { requestId });
    }
    response.json({ message: "Password help request marked as handled." });
  } catch (error) {
    next(error);
  }
});

// Bulk Driver Onboarding Endpoint
app.post("/api/admin/drivers/bulk", requireAdmin, rateLimit(10, 60_000), async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      drivers: z.array(z.object({
        fullName: z.string().min(2),
        email: z.string().email(),
        phone: z.string().min(5),
        address: z.string().optional(),
        preferredLanguage: z.string().optional(),
        password: z.string().min(8)
      })).min(1).max(100)
    });
    const { drivers } = schema.parse(request.body);

    const createdList: Array<{ id: string; email: string; fullName: string; emailSent: boolean }> = [];
    const errorsList: Array<{ email: string; reason: string }> = [];

    for (const driverItem of drivers) {
      try {
        const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: driverItem.email,
          password: driverItem.password,
          email_confirm: true,
          user_metadata: { role: "driver" }
        });
        if (createError || !createdUser.user) throw createError ?? new Error("Creation failed.");

        const userId = createdUser.user.id;
        const now = new Date().toISOString();

        try {
          await supabaseAdmin.from("profiles").upsert({
            id: userId,
            role: "driver",
            email: driverItem.email,
            full_name: driverItem.fullName,
            phone: driverItem.phone,
            address: driverItem.address ?? "Address Pending",
            preferred_language: driverItem.preferredLanguage ?? "en",
            created_at: now,
            updated_at: now
          });

          await supabaseAdmin.from("drivers").upsert({ user_id: userId, status: "Not Started", created_at: now });
          await supabaseAdmin.from("induction_progress").upsert({ user_id: userId, current_step: 1, completion_percentage: 0, completed: false, completed_step_ids: [], updated_at: now });

          const { data: sections } = await supabaseAdmin.from("learning_sections").select("id");
          if (sections?.length) {
            const completionRows = sections.map((sec) => ({ user_id: userId, section_id: sec.id, section_version: "1.0", completed: false, completed_at: null }));
            await supabaseAdmin.from("learning_section_completions").upsert(completionRows);
          }
        } catch (dbErr) {
          await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
          throw dbErr;
        }

        let emailSent = false;
        try {
          emailSent = await sendNotificationService({
            eventType: "driver_created",
            userEmail: driverItem.email,
            driverName: driverItem.fullName,
            context: { temporaryPassword: driverItem.password }
          });
        } catch (emailError) {
          console.error("[BULK EMAIL FAIL]", emailError instanceof Error ? emailError.message : emailError);
        }

        createdList.push({ id: userId, email: driverItem.email, fullName: driverItem.fullName, emailSent });
      } catch (err: unknown) {
        errorsList.push({ email: driverItem.email, reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_bulk_drivers_imported", {
        requestedCount: drivers.length,
        createdCount: createdList.length,
        errorCount: errorsList.length
      });
    }

    response.json({ message: `Imported ${createdList.length} drivers.`, created: createdList, errors: errorsList });
  } catch (error) {
    next(error);
  }
});

// Admin Document Approval & Rejection Endpoints
app.post("/api/admin/documents/:documentId/approve", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const documentId = String(request.params.documentId);
    const now = new Date().toISOString();

    const { data: doc, error: fetchErr } = await supabaseAdmin.from("documents").select("id, user_id, type").eq("id", documentId).single();
    if (fetchErr || !doc) throw fetchErr ?? new Error("Document not found.");

    const { error } = await supabaseAdmin.from("documents").update({
      status: "approved",
      verified_by_admin: true,
      verified_at: now,
      verified_by_user_id: request.authUserId ?? null,
      rejection_reason: null
    }).eq("id", documentId);
    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_document_approved", { documentId, driverId: doc.user_id, documentType: doc.type });
    }

    response.json({ message: "Document approved successfully." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/documents/:documentId/reject", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const documentId = String(request.params.documentId);
    const schema = z.object({ reason: z.string().min(3) });
    const { reason } = schema.parse(request.body);
    const now = new Date().toISOString();

    const { data: doc, error: fetchErr } = await supabaseAdmin.from("documents").select("id, user_id, type").eq("id", documentId).single();
    if (fetchErr || !doc) throw fetchErr ?? new Error("Document not found.");

    const { error } = await supabaseAdmin.from("documents").update({
      status: "rejected",
      verified_by_admin: false,
      verified_at: now,
      verified_by_user_id: request.authUserId ?? null,
      rejection_reason: reason
    }).eq("id", documentId);
    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_document_rejected", { documentId, driverId: doc.user_id, documentType: doc.type, reason });
    }

    response.json({ message: "Document rejected." });
  } catch (error) {
    next(error);
  }
});

// Verification Queue Endpoints
app.get("/api/admin/verification-queue", requireAdmin, async (_request, response, next) => {
  try {
    const { data: documents, error } = await supabaseAdmin
      .from("documents")
      .select("id, user_id, type, file_name, mime_type, status, uploaded_at, expires_at, profiles!inner(full_name, email)")
      .eq("status", "pending")
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    response.json({ documents: documents ?? [] });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/documents/:documentId/verify", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const documentId = String(request.params.documentId);
    const schema = z.object({
      action: z.enum(["approve", "reject"]),
      reason: z.string().trim().min(3).optional(),
      expiresAt: z.string().datetime().optional()
    });
    const { action, reason, expiresAt } = schema.parse(request.body);
    if (action === "reject" && !reason) {
      response.status(400).json({ message: "A rejection reason is required." });
      return;
    }
    const now = new Date().toISOString();

    const { data: doc, error: fetchErr } = await supabaseAdmin.from("documents").select("id, user_id, type").eq("id", documentId).single();
    if (fetchErr || !doc) throw fetchErr ?? new Error("Document not found.");

    const isApprove = action === "approve";
    const { error } = await supabaseAdmin.from("documents").update({
      status: isApprove ? "approved" : "rejected",
      verified_by_admin: isApprove,
      verified_at: now,
      verified_by_user_id: request.authUserId ?? null,
      rejection_reason: isApprove ? null : reason ?? null,
      ...(isApprove && expiresAt ? { expires_at: expiresAt } : {})
    }).eq("id", documentId);
    if (error) throw error;

    if (request.authUserId) {
      try {
        await logAuditEntry(request.authUserId, isApprove ? "admin_document_approved" : "admin_document_rejected", {
          documentId,
          driverId: doc.user_id,
          documentType: doc.type,
          reason: isApprove ? null : reason
        });
      } catch (auditErr) {
        console.warn("[AUDIT LOG] Document action audit log failed:", auditErr);
      }
    }

    response.json({ message: isApprove ? "Document approved successfully." : "Document rejected." });
  } catch (error) {
    next(error);
  }
});

// Self-Service Driver Registration Endpoint (Public + Rate Limited)
app.post("/api/auth/register-driver", rateLimit(10, 60_000), async (request, response, next) => {
  try {
    // Driver accounts are an employment/compliance control. Keep public enrolment
    // disabled unless the operator has deliberately enabled an invite-free flow.
    if (process.env.ALLOW_SELF_REGISTRATION !== "true") {
      response.status(403).json({ message: "Self-registration is disabled. Ask your administrator to create your induction account." });
      return;
    }
    const schema = z.object({
      fullName: z.string().min(2, "Full name must be at least 2 characters."),
      email: z.string().email("Please enter a valid email address."),
      phone: z.string().min(5, "Please enter a valid phone number."),
      address: z.string().min(5, "Please enter your address."),
      preferredLanguage: z.string().min(2).default("English"),
      password: z.string().min(8, "Password must be at least 8 characters long."),
      depotCode: z.string().optional(),
      licenceClass: z.string().optional(),
      issuingState: z.string().optional(),
      licenceNumber: z.string().trim().regex(/^[A-Za-z0-9]{8}$/, "Licence number must be exactly 8 letters or numbers.")
    });

    const payload = schema.parse(request.body);
    const emailLower = payload.email.toLowerCase().trim();

    // Create confirmed user in Supabase Auth.
    // Supabase enforces email uniqueness at the DB level — no need for a manual
    // listUsers() pre-check (which only reads the first 50 users and would miss
    // existing accounts in larger deployments).
    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: payload.password,
      email_confirm: true,
      user_metadata: { role: "driver", must_change_password: false, depot_code: payload.depotCode }
    });

    if (authError || !authResult.user) {
      // Map Supabase's duplicate-email error to a user-friendly 409
      const isDuplicate = authError?.message?.toLowerCase().includes("already") ||
        authError?.message?.toLowerCase().includes("registered");
      response
        .status(isDuplicate ? 409 : 400)
        .json({ message: isDuplicate
          ? "An account with this email address already exists. Please log in instead."
          : (authError?.message ?? "Failed to create account.") });
      return;
    }

    const userId = authResult.user.id;
    const now = new Date().toISOString();

    // 1. Insert profile & driver first to establish foreign key parent records
    let profileRes = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      role: "driver",
      email: emailLower,
      full_name: payload.fullName.trim(),
      phone: payload.phone.trim(),
      address: payload.address.trim(),
      preferred_language: payload.preferredLanguage,
      licence_class: payload.licenceClass ?? "HC",
      issuing_state: payload.issuingState ?? "VIC",
      licence_number: payload.licenceNumber.toUpperCase(),
      depot_location: payload.depotCode ?? "Melbourne Hub",
      created_at: now,
      updated_at: now
    });

    if (profileRes.error && profileRes.error.message.toLowerCase().includes("column")) {
      // Schema fallback if DB table does not yet have extended columns
      profileRes = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        role: "driver",
        email: emailLower,
        full_name: payload.fullName.trim(),
        phone: payload.phone.trim(),
        address: payload.address.trim(),
        preferred_language: payload.preferredLanguage,
        created_at: now,
        updated_at: now
      });
    }

    const driverRes = await supabaseAdmin.from("drivers").upsert({
      user_id: userId,
      status: "Not Started",
      created_at: now
    });

    if (profileRes.error || driverRes.error) {
      const errMsg = profileRes.error?.message ?? driverRes.error?.message ?? "Profile setup failed";
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      response.status(500).json({ message: `Registration failed: ${errMsg}` });
      return;
    }

    // 2. Insert induction_progress now that parent profile exists
    const progressRes = await supabaseAdmin.from("induction_progress").upsert({
      user_id: userId,
      current_step: 1,
      completion_percentage: 0,
      completed: false,
      completed_step_ids: [],
      updated_at: now
    });

    if (progressRes.error) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      response.status(500).json({ message: `Registration progress setup failed: ${progressRes.error.message}` });
      return;
    }

    // Initial Section completions
    const { data: sections } = await supabaseAdmin.from("learning_sections").select("id");
    if (sections?.length) {
      await supabaseAdmin.from("learning_section_completions").upsert(
        sections.map((sec) => ({
          user_id: userId,
          section_id: sec.id,
          completed: false,
          updated_at: now
        }))
      );
    }

    await logAuditEntry(userId, "driver_self_registered", { email: emailLower, depotCode: payload.depotCode });

    response.json({ message: "Registration successful. You can now log in.", email: emailLower });
  } catch (error) {
    next(error);
  }
});

// Driver Change Password Endpoint

app.post("/api/auth/change-password", rateLimit(10, 60_000), async (request, response, next) => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!token) {
      response.status(401).json({ message: "Missing session token." });
      return;
    }

    const { data: authUser, error: tokenError } = await supabaseAdmin.auth.getUser(token);
    if (tokenError || !authUser.user) {
      response.status(401).json({ message: "Invalid or expired session token." });
      return;
    }

    const schema = z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(8) });
    const { currentPassword, newPassword } = schema.parse(request.body);

    // Verify current password if provided
    if (currentPassword) {
      const anonKey = process.env.SUPABASE_ANON_KEY;
      if (!anonKey) {
        response.status(500).json({ message: "Server misconfiguration: SUPABASE_ANON_KEY is not set." });
        return;
      }
      const tempClient = createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const { error: signInErr } = await tempClient.auth.signInWithPassword({
        email: authUser.user.email!,
        password: currentPassword
      });
      if (signInErr) {
        response.status(401).json({ message: "Incorrect current password." });
        return;
      }
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.user.id, {
      password: newPassword,
      user_metadata: { ...authUser.user.user_metadata, must_change_password: false }
    });
    if (updateErr) throw updateErr;

    await supabaseAdmin.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", authUser.user.id);
    await logAuditEntry(authUser.user.id, "user_changed_password", { email: authUser.user.email });

    response.json({ message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
});

// Auto Confirm Email Endpoint (for unconfirmed auth users) — Admin only
app.post("/api/auth/auto-confirm", requireAdmin, rateLimit(20, 60_000), async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(request.body);

    // Paginate through all users to avoid the 50-user default limit
    let found = false;
    let page = 1;
    const perPage = 1000;
    while (!found) {
      const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listErr) throw listErr;
      const user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email_confirm: true
        });
        if (updateErr) throw updateErr;
        response.json({ message: "Email confirmed successfully." });
        found = true;
        return;
      }
      // No more pages
      if (usersData.users.length < perPage) break;
      page++;
    }

    if (!found) {
      response.json({ message: "User not found." });
    }
  } catch (error) {
    next(error);
  }
});


// Note: Email auto-confirmation is handled per-user at account creation time
// via email_confirm: true in createUser(). A startup sweep is not needed and
// would silently miss users beyond Supabase's 50-user default page limit.


app.post("/api/admin/drivers/:driverId/reset-induction", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);
    const resetAt = new Date().toISOString();

    const { data: documents, error: documentsError } = await supabaseAdmin
      .from("documents")
      .select("file_url")
      .eq("user_id", driverId);
    if (documentsError) throw documentsError;

    await supabaseAdmin.from("documents").delete().eq("user_id", driverId);
    await supabaseAdmin.from("quiz_attempts").delete().eq("user_id", driverId);
    await supabaseAdmin.from("certificates").delete().eq("user_id", driverId);
    await supabaseAdmin.from("driver_feedback").delete().eq("user_id", driverId);
    await supabaseAdmin.from("learning_section_completions").delete().eq("user_id", driverId);

    if (documents?.length) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("driver-documents")
        .remove(documents.map((document) => document.file_url));
      if (storageError) throw storageError;
    }

    const { data: sections, error: sectionsError } = await supabaseAdmin.from("learning_sections").select("id");
    if (sectionsError) throw sectionsError;

    if (sections?.length) {
      const { error: completionError } = await supabaseAdmin.from("learning_section_completions").insert(
        sections.map((section) => ({
          user_id: driverId,
          section_id: section.id,
          completed: false,
          completed_at: null
        }))
      );
      if (completionError) throw completionError;
    }

    const { error: deleteProgressError } = await supabaseAdmin.from("induction_progress").delete().eq("user_id", driverId);
    if (deleteProgressError) throw deleteProgressError;

    const { error: progressError } = await supabaseAdmin.from("induction_progress").insert({
      user_id: driverId,
      current_step: 1,
      completion_percentage: 0,
      quiz_score: null,
      completed: false,
      completed_step_ids: [],
      declaration_accepted: false,
      declaration_agreed_at: null,
      signature: null,
      completed_at: null,
      updated_at: resetAt
    });
    if (progressError) throw progressError;

    const { error: driverError } = await supabaseAdmin.from("drivers").update({ status: "Not Started" }).eq("user_id", driverId);
    if (driverError) throw driverError;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_induction_reset", {
        driverId,
        resetAt
      });
    }

    response.json({ message: "Induction progress reset." });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/drivers/:driverId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);

    const { data: documents } = await supabaseAdmin
      .from("documents")
      .select("file_url")
      .eq("user_id", driverId);

    await supabaseAdmin.from("documents").delete().eq("user_id", driverId);
    await supabaseAdmin.from("learning_section_completions").delete().eq("user_id", driverId);
    await supabaseAdmin.from("quiz_attempts").delete().eq("user_id", driverId);
    await supabaseAdmin.from("certificates").delete().eq("user_id", driverId);
    await supabaseAdmin.from("driver_feedback").delete().eq("user_id", driverId);
    // Keep audit records. The FK uses ON DELETE SET NULL so evidence survives
    // account removal without retaining the driver's profile.
    await supabaseAdmin.from("induction_progress").delete().eq("user_id", driverId);
    await supabaseAdmin.from("drivers").delete().eq("user_id", driverId);
    await supabaseAdmin.from("profiles").delete().eq("id", driverId);

    if (documents?.length) {
      await supabaseAdmin.storage
        .from("driver-documents")
        .remove(documents.map((document) => document.file_url))
        .catch(() => {});
    }

    await supabaseAdmin.auth.admin.deleteUser(driverId).catch(() => {});

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_driver_deleted", {
        driverId
      });
    }

    response.json({ message: "Driver removed." });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/cms/questions/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const questionId = String(request.params.id);
    const schema = z.object({
      question: z.string().min(1),
      options: z.array(z.string()).min(2),
      correct_answer: z.number().int().min(0),
      explanation: z.string(),
      category: z.string(),
      is_critical: z.boolean().optional()
    });
    const parsed = schema.parse(request.body);

    const { error } = await supabaseAdmin.from("quiz_questions").update(parsed).eq("id", questionId);
    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_updated_question", { questionId });
    }
    response.json({ message: "Question updated." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/cms/questions", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      id: z.string().uuid().optional(),
      question: z.string().trim().min(1),
      options: z.array(z.string().trim().min(1)).min(2),
      correct_answer: z.number().int().min(0),
      explanation: z.string().default(""),
      sort_order: z.coerce.number().optional(),
      category: z.string().default("General"),
      is_critical: z.boolean().optional()
    });
    const input = schema.parse(request.body);
    if (input.correct_answer >= input.options.length) {
      return response.status(400).json({ message: "Select a correct answer from the available options." });
    }
    const id = input.id ?? crypto.randomUUID();
    const { error } = await supabaseAdmin.from("quiz_questions").insert({
      ...input,
      id,
      sort_order: input.sort_order ?? 0,
      is_critical: input.is_critical ?? false
    });
    if (error) throw error;
    if (request.authUserId) await logAuditEntry(request.authUserId, "admin_created_question", { questionId: id });
    response.status(201).json({ id, message: "Quiz question added." });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/cms/questions/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const questionId = String(request.params.id);
    const { error } = await supabaseAdmin.from("quiz_questions").delete().eq("id", questionId);
    if (error) throw error;
    if (request.authUserId) await logAuditEntry(request.authUserId, "admin_deleted_question", { questionId });
    response.json({ message: "Question deleted." });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/cms/sections/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const sectionId = String(request.params.id);
    const schema = z.object({
      title: z.string().optional(),
      summary: z.string(),
      format: z.string(),
      video_url: z.string().nullable().optional(),
      video_duration_seconds: z.coerce.number().optional(),
      require_full_watch: z.boolean().optional(),
      media_json: z.record(z.unknown()).optional()
    });
    const parsed = schema.parse(request.body);

    const { error } = await supabaseAdmin.from("learning_sections").update(parsed).eq("id", sectionId);
    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_updated_section", { sectionId });
    }
    response.json({ message: "Section updated." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/cms/sections", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      id: z.string().uuid().optional(),
      title: z.string().trim().min(1),
      summary: z.string().default(""),
      format: z.string().default("Video + Text"),
      sort_order: z.coerce.number().optional(),
      video_url: z.string().nullable().optional(),
      video_duration_seconds: z.coerce.number().optional(),
      require_full_watch: z.boolean().optional()
    });
    const input = schema.parse(request.body);
    const id = input.id ?? crypto.randomUUID();
    const payload = {
      id,
      title: input.title,
      summary: input.summary,
      format: input.format,
      sort_order: input.sort_order ?? 1,
      video_url: input.video_url ?? null,
      video_duration_seconds: input.video_duration_seconds ?? 0,
      require_full_watch: input.require_full_watch ?? false,
      created_at: new Date().toISOString()
    };
    const { error } = await writeWithFallback("learning_sections", "insert", payload, undefined, { selectResult: false });
    if (error) throw error;
    if (request.authUserId) await logAuditEntry(request.authUserId, "admin_created_section", { sectionId: id });
    response.status(201).json({ id, message: "Module created." });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Module Extras + Templates + Publish to Drivers
// ============================================================

const MIGRATION_015_MESSAGE =
  "Migration 015 has not been applied to this database. Run supabase/migrations/015_module_extras_and_templates.sql (or the SQL in the README) first.";

// Columns that only exist once migration 015 has run.
const MIGRATION_015_ONLY_KEYS = [
  "is_template",
  "site_tag",
  "media_json",
  "source_slide_id",
  "correct_answers",
  "accepted_answers"
];

// PostgREST reports a missing column as 42703 (Postgres undefined_column) or
// PGRST204 ("could not find the X column in the schema cache").
function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  if (code === "42703" || code === "PGRST204") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache");
}

// Strips the migration-015-only columns so a request still succeeds against a
// database that has not had that migration applied.
function withoutNewColumns(payload: Record<string, any>): Record<string, any> {
  const cleaned = { ...payload };
  for (const key of MIGRATION_015_ONLY_KEYS) delete cleaned[key];
  return cleaned;
}

// Tries a write with the full payload, and retries without the new columns when
// the database reports one of them missing. Returns the row plus a flag.
async function writeWithFallback(
  table: string,
  mode: "insert" | "update",
  payload: Record<string, any>,
  match?: Record<string, any>,
  options?: { selectResult?: boolean }
): Promise<{ data: any; error: any; degraded: boolean }> {
  const wantRow = options?.selectResult !== false;

  const run = (body: Record<string, any>) => {
    let query = mode === "insert"
      ? supabaseAdmin.from(table).insert(body)
      : supabaseAdmin.from(table).update(body);

    for (const [key, value] of Object.entries(match ?? {})) {
      query = (query as any).eq(key, value);
    }

    // For updates, the row must exist - use .single() to catch missing rows
    // For inserts, .maybeSingle() is fine (returns the new row)
    return wantRow
      ? query.select()[mode === "update" ? "single" : "maybeSingle"]()
      : query;
  };

  const first = await run(payload);
  if (!first.error) return { data: first.data ?? null, error: null, degraded: false };
  // If update affects 0 rows (PGRST116), treat as "not found" rather than retry
  if (mode === "update" && first.error?.code === "PGRST116") {
    return { data: null, error: { ...first.error, message: "Row not found" }, degraded: false };
  }
  if (!isMissingColumnError(first.error)) return { data: null, error: first.error, degraded: false };

  // One of the new columns is absent — retry without any of them.
  const retryPayload = withoutNewColumns(payload);
  if (Object.keys(retryPayload).length === 0) {
    return { data: null, error: first.error, degraded: true };
  }

  const second = await run(retryPayload);
  return { data: second.data ?? null, error: second.error, degraded: true };
}

// ============================================================================
// Course / Slide / Question routes
//
// These back the Site Inductions course builder and were never registered, so
// every call fell through to a "Cannot PATCH/GET …" 404 before dropping back to
// a direct Supabase query. Registering them makes the API path authoritative
// (service-role, so RLS can never block an admin) and stops the log noise.
//
// All of them are additive — no existing route is replaced.
// ============================================================================

// ---------------------------- Courses ----------------------------

app.get("/api/admin/cms/courses", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("induction_courses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/cms/courses", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const body = request.body ?? {};
    const now = new Date().toISOString();

    if (!String(body.title ?? "").trim()) {
      response.status(400).json({ message: "A course title is required." });
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      title: String(body.title),
      description: String(body.description ?? ""),
      template_id: body.templateId ?? null,
      version_label: String(body.versionLabel ?? "1.0"),
      revision_notes: String(body.revisionNotes ?? "Initial draft"),
      is_template: Boolean(body.isTemplate),
      site_tag: String(body.siteTag ?? "global"),
      created_by: request.authUserId ?? null,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await writeWithFallback("induction_courses", "insert", payload);
    if (error) throw error;
    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/cms/courses/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);
    const body = request.body ?? {};

    const payload = {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.description !== undefined ? { description: String(body.description) } : {}),
      ...(body.versionLabel !== undefined ? { version_label: String(body.versionLabel) } : {}),
      ...(body.revisionNotes !== undefined ? { revision_notes: String(body.revisionNotes) } : {}),
      ...(body.isCurrent !== undefined ? { is_current: Boolean(body.isCurrent) } : {}),
      ...(body.isTemplate !== undefined ? { is_template: Boolean(body.isTemplate) } : {}),
      ...(body.siteTag !== undefined ? { site_tag: String(body.siteTag) } : {}),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await writeWithFallback(
      "induction_courses",
      "update",
      payload,
      { id: courseId }
    );
    if (error) throw error;
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/cms/courses/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);

    // quiz_questions has no cascade in the schema, so remove a slide's
    // questions before the slide itself.
    const { data: slides } = await supabaseAdmin
      .from("induction_slides")
      .select("id")
      .eq("course_id", courseId);

    for (const slide of slides ?? []) {
      const { error: qError } = await supabaseAdmin.from("quiz_questions").delete().eq("slide_id", slide.id);
      if (qError) throw qError;
    }

    const { error: slideError } = await supabaseAdmin.from("induction_slides").delete().eq("course_id", courseId);
    if (slideError) throw slideError;

    const { error } = await supabaseAdmin.from("induction_courses").delete().eq("id", courseId);
    if (error) throw error;

    response.json({ message: "Course deleted." });
  } catch (error) {
    next(error);
  }
});

// ----------------------------- Slides -----------------------------

app.get("/api/admin/cms/courses/:id/slides", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);
    const { data, error } = await supabaseAdmin
      .from("induction_slides")
      .select("*")
      .eq("course_id", courseId)
      .order("slide_order", { ascending: true });
    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/cms/courses/:id/slides", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);
    const body = request.body ?? {};
    const now = new Date().toISOString();

    if (body.slideOrder === undefined) {
      const { data: last } = await supabaseAdmin
        .from("induction_slides")
        .select("slide_order")
        .eq("course_id", courseId)
        .order("slide_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      body.slideOrder = Number(last?.slide_order ?? 0) + 1;
    }

    const payload = {
      id: crypto.randomUUID(),
      course_id: courseId,
      slide_order: Number(body.slideOrder) || 1,
      slide_type: String(body.slideType ?? "text"),
      title: String(body.title ?? "New Slide"),
      content_json: body.contentJson ?? {},
      site_tag: String(body.siteTag ?? "global"),
      video_url: body.videoUrl ?? null,
      audio_url: body.audioUrl ?? null,
      forced_wait_seconds: Number(body.forcedWaitSeconds ?? 0),
      estimated_duration_seconds: Number(body.estimatedDurationSeconds ?? 0),
      trigger_config: body.triggerConfig ?? {},
      created_at: now,
      updated_at: now
    };

    const { data, error } = await writeWithFallback("induction_slides", "insert", payload);
    if (error) {
      if (String(error.code) === "23502" && String(error.message).includes("section_id")) {
        response.status(409).json({
          message: "The database still requires induction_slides.section_id. Apply migration 017_allow_course_induction_slides.sql, then retry."
        });
        return;
      }
      throw error;
    }
    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/cms/courses/:id/slides/:slideId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const slideId = String(request.params.slideId);
    const body = request.body ?? {};

    const payload = {
      ...(body.title !== undefined ? { title: String(body.title) } : {}),
      ...(body.slideType !== undefined ? { slide_type: String(body.slideType) } : {}),
      ...(body.contentJson !== undefined ? { content_json: body.contentJson } : {}),
      ...(body.slideOrder !== undefined ? { slide_order: Number(body.slideOrder) } : {}),
      ...(body.videoUrl !== undefined ? { video_url: body.videoUrl ?? null } : {}),
      ...(body.audioUrl !== undefined ? { audio_url: body.audioUrl ?? null } : {}),
      ...(body.forcedWaitSeconds !== undefined ? { forced_wait_seconds: Number(body.forcedWaitSeconds) } : {}),
      ...(body.estimatedDurationSeconds !== undefined ? { estimated_duration_seconds: Number(body.estimatedDurationSeconds) } : {}),
      ...(body.triggerConfig !== undefined ? { trigger_config: body.triggerConfig } : {}),
      ...(body.siteTag !== undefined ? { site_tag: String(body.siteTag) } : {}),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await writeWithFallback(
      "induction_slides",
      "update",
      payload,
      { id: slideId }
    );
    if (error) throw error;
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/cms/courses/:id/slides/:slideId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const slideId = String(request.params.slideId);

    const { error: qError } = await supabaseAdmin.from("quiz_questions").delete().eq("slide_id", slideId);
    if (qError) throw qError;

    const { error } = await supabaseAdmin.from("induction_slides").delete().eq("id", slideId);
    if (error) throw error;

    response.json({ message: "Slide deleted." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/cms/courses/:id/slides/reorder", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);
    const orders: Array<{ slideId: string; slideOrder: number }> = Array.isArray(request.body?.orders)
      ? request.body.orders
      : [];

    if (orders.length === 0) {
      response.status(400).json({ message: "No reorder instructions supplied." });
      return;
    }

    const now = new Date().toISOString();
    for (const item of orders) {
      const { error } = await supabaseAdmin
        .from("induction_slides")
        .update({ slide_order: Number(item.slideOrder), updated_at: now })
        .eq("id", String(item.slideId))
        .eq("course_id", courseId);
      if (error) throw error;
    }

    response.json({ message: "Slide order updated." });
  } catch (error) {
    next(error);
  }
});

// ------------------------ Slide questions ------------------------

app.get("/api/admin/cms/slides/:slideId/questions", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const slideId = String(request.params.slideId);
    const { data, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("*")
      .eq("slide_id", slideId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/cms/slides/:slideId/questions", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const slideId = String(request.params.slideId);
    const body = request.body ?? {};
    const now = new Date().toISOString();

    if (!String(body.question ?? "").trim()) {
      response.status(400).json({ message: "Question text is required." });
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      slide_id: slideId,
      question: String(body.question),
      options: Array.isArray(body.options) ? body.options.map(String) : [],
      correct_answer: Number(body.correctAnswer ?? 0),
      correct_answers: Array.isArray(body.correctAnswers)
        ? body.correctAnswers.map(Number)
        : [Number(body.correctAnswer ?? 0)],
      accepted_answers: Array.isArray(body.acceptedAnswers) ? body.acceptedAnswers.map(String) : [],
      explanation: String(body.explanation ?? ""),
      category: String(body.category ?? "Site Rules"),
      is_critical: Boolean(body.isCritical),
      question_type: String(body.questionType ?? "single_choice"),
      placement: String(body.placement ?? "below_slide"),
      sort_order: Number(body.sortOrder ?? 1),
      created_at: now
    };

    const { data, error } = await writeWithFallback("quiz_questions", "insert", payload);
    if (error) throw error;
    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/cms/slides/:slideId/questions/:questionId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const questionId = String(request.params.questionId);
    const body = request.body ?? {};

    const payload = {
      ...(body.question !== undefined ? { question: String(body.question) } : {}),
      ...(body.options !== undefined ? { options: Array.isArray(body.options) ? body.options.map(String) : [] } : {}),
      ...(body.correctAnswer !== undefined ? { correct_answer: Number(body.correctAnswer) } : {}),
      ...(body.correctAnswers !== undefined ? { correct_answers: body.correctAnswers.map(Number) } : {}),
      ...(body.acceptedAnswers !== undefined ? { accepted_answers: body.acceptedAnswers.map(String) } : {}),
      ...(body.explanation !== undefined ? { explanation: String(body.explanation) } : {}),
      ...(body.category !== undefined ? { category: String(body.category) } : {}),
      ...(body.isCritical !== undefined ? { is_critical: Boolean(body.isCritical) } : {}),
      ...(body.questionType !== undefined ? { question_type: String(body.questionType) } : {}),
      ...(body.placement !== undefined ? { placement: String(body.placement) } : {}),
      ...(body.sortOrder !== undefined ? { sort_order: Number(body.sortOrder) } : {})
    };

    const { data, error } = await writeWithFallback(
      "quiz_questions",
      "update",
      payload,
      { id: questionId }
    );
    if (error) throw error;
    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/cms/slides/:slideId/questions/:questionId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const questionId = String(request.params.questionId);
    const { error } = await supabaseAdmin.from("quiz_questions").delete().eq("id", questionId);
    if (error) throw error;
    response.json({ message: "Question deleted." });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/cms/templates - list courses flagged as reusable templates
app.get("/api/admin/cms/templates", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("induction_courses")
      .select("id, title, description, site_tag, version_label, updated_at")
      .eq("is_template", true)
      .order("updated_at", { ascending: false });

    // The filter column only exists after migration 015. Until then there are no
    // templates to report, so answer with an empty list rather than failing.
    if (error) {
      if (isMissingColumnError(error)) {
        response.json([]);
        return;
      }
      throw error;
    }
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/cms/courses/:id/mark-template - flag / unflag a course as a master blueprint
app.post("/api/admin/cms/courses/:id/mark-template", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);
    const schema = z.object({ isTemplate: z.boolean().optional().default(true) });
    const { isTemplate } = schema.parse(request.body ?? {});

    const { error } = await supabaseAdmin
      .from("induction_courses")
      .update({ is_template: isTemplate, updated_at: new Date().toISOString() })
      .eq("id", courseId);
    if (error) {
      if (isMissingColumnError(error)) {
        response.status(400).json({ message: MIGRATION_015_MESSAGE });
        return;
      }
      throw error;
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_course_marked_template", { courseId, isTemplate });
    }
    response.json({ message: isTemplate ? "Course marked as template." : "Template flag removed." });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/cms/courses/:id/clone - deep-copy a template into a new site variant
// Copies every slide in order, plus each slide's media and questions.
// Videos, images, PDFs and voiceovers are reused by URL — nothing is re-uploaded.
app.post("/api/admin/cms/courses/:id/clone", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const sourceCourseId = String(request.params.id);
    const schema = z.object({
      title: z.string().min(1),
      siteTag: z.string().min(1).default("global")
    });
    const parsed = schema.parse(request.body);
    const now = new Date().toISOString();

    const { data: sourceCourse, error: courseError } = await supabaseAdmin
      .from("induction_courses")
      .select("*")
      .eq("id", sourceCourseId)
      .single();
    if (courseError) throw courseError;

    const newCourseId = crypto.randomUUID();
    const { data: newCourse, error: insertError } = await supabaseAdmin
      .from("induction_courses")
      .insert({
        id: newCourseId,
        title: parsed.title,
        description: sourceCourse.description || "",
        template_id: sourceCourseId,
        site_tag: parsed.siteTag,
        version_label: "1.0",
        revision_notes: `Cloned from ${sourceCourse.title}`,
        is_template: false,
        is_current: false,
        created_by: request.authUserId ?? null,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    if (insertError) throw insertError;

    const { data: sourceSlides, error: slidesError } = await supabaseAdmin
      .from("induction_slides")
      .select("*")
      .eq("course_id", sourceCourseId)
      .order("slide_order", { ascending: true });
    if (slidesError) throw slidesError;

    let slidesCopied = 0;
    let questionsCopied = 0;

    for (const slide of sourceSlides ?? []) {
      const newSlideId = crypto.randomUUID();
      const { error: slideInsertError } = await supabaseAdmin
        .from("induction_slides")
        .insert({
          id: newSlideId,
          course_id: newCourseId,
          slide_order: slide.slide_order,
          slide_type: slide.slide_type,
          title: slide.title,
          content_json: slide.content_json ?? {},
          site_tag: parsed.siteTag,
          video_url: slide.video_url ?? null,
          audio_url: slide.audio_url ?? null,
          forced_wait_seconds: slide.forced_wait_seconds ?? 0,
          estimated_duration_seconds: slide.estimated_duration_seconds ?? 0,
          trigger_config: slide.trigger_config ?? {},
          created_at: now,
          updated_at: now
        });
      if (slideInsertError) throw slideInsertError;
      slidesCopied += 1;

      const { data: sourceQuestions, error: qError } = await supabaseAdmin
        .from("quiz_questions")
        .select("*")
        .eq("slide_id", slide.id);
      if (qError) throw qError;

      for (const q of sourceQuestions ?? []) {
        const { error: qInsertError } = await supabaseAdmin.from("quiz_questions").insert({
          question: q.question,
          options: q.options ?? [],
          correct_answer: q.correct_answer ?? 0,
          explanation: q.explanation || "",
          category: q.category || "Site Rules",
          is_critical: q.is_critical ?? false,
          question_type: q.question_type || "single_choice",
          placement: q.placement || "below_slide",
          slide_id: newSlideId,
          sort_order: q.sort_order ?? 1,
          created_at: now
        });
        if (qInsertError) throw qInsertError;
        questionsCopied += 1;
      }
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_course_cloned", {
        sourceCourseId,
        newCourseId,
        siteTag: parsed.siteTag,
        slidesCopied,
        questionsCopied
      });
    }

    response.status(201).json({ course: newCourse, slidesCopied, questionsCopied });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/cms/courses/:id/publish - push a course's slides into the
// table drivers already read (learning_sections). Existing drivers keep working:
// - slides are matched by source_slide_id, so re-publishing updates in place
// - only this course's site_tag is written, so other sites are untouched
// - nothing is deleted
app.post("/api/admin/cms/courses/:id/publish", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const courseId = String(request.params.id);
    const now = new Date().toISOString();
    const body = request.body ?? {};

    const { data: course, error: courseError } = await supabaseAdmin
      .from("induction_courses")
      .select("*")
      .eq("id", courseId)
      .single();
    if (courseError) throw courseError;

    // The version fields in the publish dialog used to be ignored by the client,
    // leaving every published slide tagged with the original course version.
    if (body.versionLabel !== undefined || body.revisionNotes !== undefined) {
      const versionUpdate = {
        ...(body.versionLabel !== undefined ? { version_label: String(body.versionLabel).trim() || course.version_label || "1.0" } : {}),
        ...(body.revisionNotes !== undefined ? { revision_notes: String(body.revisionNotes) } : {}),
        updated_at: now
      };
      const { error } = await supabaseAdmin.from("induction_courses").update(versionUpdate).eq("id", courseId);
      if (error) throw error;
      Object.assign(course, versionUpdate);
    }

    const siteTag = String(course.site_tag || "global");

    const { data: slides, error: slidesError } = await supabaseAdmin
      .from("induction_slides")
      .select("*")
      .eq("course_id", courseId)
      .order("slide_order", { ascending: true });
    if (slidesError) throw slidesError;

    if (!slides || slides.length === 0) {
      return response.status(400).json({ message: "This course has no slides to publish." });
    }

    // Highest existing global order, so published slides append after the
    // shared modules instead of shuffling them.
    const { data: maxOrderRow } = await supabaseAdmin
      .from("learning_sections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextOrder = Number(maxOrderRow?.sort_order ?? 0) + 1;

    let published = 0;
    let updated = 0;

    for (const slide of slides) {
      // Slide questions live in quiz_questions, linked by slide_id.
      const { data: slideQuestions } = await supabaseAdmin
        .from("quiz_questions")
        .select("*")
        .eq("slide_id", slide.id)
        .order("sort_order", { ascending: true });

      const media = buildMediaJson(slide, slideQuestions ?? []);
      const summary = JSON.stringify({
        intro: slide.content_json?.body ?? "",
        bullets: [] as string[],
        scenario: slide.content_json?.scenario ?? ""
      });

      const payload = {
        title: slide.title,
        format: slide.slide_type,
        summary,
        sort_order: slide.slide_order + nextOrder,
        video_url: slide.video_url ?? null,
        video_duration_seconds: slide.estimated_duration_seconds ?? 0,
        require_full_watch: (slide.forced_wait_seconds ?? 0) > 0,
        media_json: media,
        site_tag: siteTag
      };

      // Match an existing published row so a re-publish is an update, not a duplicate.
      const { data: existing } = await supabaseAdmin
        .from("learning_sections")
        .select("id")
        .eq("source_slide_id", slide.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await writeWithFallback(
          "learning_sections",
          "update",
          { ...payload, updated_at: now },
          { id: existing.id },
          { selectResult: false }
        );
        if (error) throw error;
        updated += 1;
      } else {
        const { error } = await writeWithFallback(
          "learning_sections",
          "insert",
          {
            ...payload,
            id: crypto.randomUUID(),
            source_slide_id: slide.id,
            version: course.version_label || "1.0",
            effective_date: now,
            created_at: now
          },
          undefined,
          { selectResult: false }
        );
        if (error) throw error;
        published += 1;
      }
      nextOrder += 1;
    }

    // Mark the variant as the live one for its site.
    // Other courses sharing this site (or cloned from the same template) must be
    // demoted first, otherwise the "only one current course" unique index
    // (induction_courses_current_idx) rejects the update.
    const now2 = now;
    const { error: demoteError } = await supabaseAdmin
      .from("induction_courses")
      .update({ is_current: false, updated_at: now2 })
      .neq("id", courseId)
      .or(`site_tag.eq.${siteTag},template_id.eq.${courseId}`);
    if (demoteError) throw demoteError;

    const { error: courseUpdateError } = await supabaseAdmin
      .from("induction_courses")
      .update({
        is_current: true,
        published_at: now2,
        published_by: request.authUserId ?? null,
        updated_at: now2
      })
      .eq("id", courseId);
    if (courseUpdateError) throw courseUpdateError;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_course_published_to_drivers", {
        courseId,
        siteTag,
        published,
        updated
      });
    }

    response.json({
      message: `Published ${published + updated} slide(s) to the ${siteTag} site.`,
      published,
      updated,
      siteTag
    });
  } catch (error) {
    next(error);
  }
});

// Translate a slide row into the media_json the driver's ModuleExtras reads.
// `slideQuestions` is fetched from quiz_questions (where slide questions live),
// not from content_json.
function buildMediaJson(slide: Record<string, any>, slideQuestions: any[] = []) {
  const content = slide.content_json ?? {};

  const images: Array<{ url: string; caption?: string; alt?: string }> = [];
  if (content.imageUrl) {
    images.push({ url: String(content.imageUrl), caption: content.imageCaption ?? "", alt: String(slide.title ?? "") });
  }
  if (Array.isArray(content.images)) {
    for (const img of content.images) {
      if (img?.url) images.push({ url: String(img.url), caption: img.caption ?? "", alt: img.alt ?? "" });
    }
  }

  const documents: Array<{ url: string; name?: string; pages?: number; requireRead?: boolean }> = [];
  if (content.docUrl) {
    documents.push({
      url: String(content.docUrl),
      name: content.docName ?? String(slide.title ?? "Document"),
      pages: Number(content.docPages ?? 0) || undefined,
      requireRead: Boolean(content.requireRead)
    });
  }
  if (Array.isArray(content.documents)) {
    for (const doc of content.documents) {
      if (doc?.url) documents.push({ url: String(doc.url), name: doc.name, pages: doc.pages, requireRead: Boolean(doc.requireRead) });
    }
  }

  const voiceover = slide.audio_url
    ? { url: String(slide.audio_url), language: content.voiceoverLanguage ?? "en" }
    : null;

  const attachments: Array<{ url: string; name?: string }> = Array.isArray(content.attachments)
    ? content.attachments.filter((a: any) => a?.url).map((a: any) => ({ url: String(a.url), name: a.name }))
    : [];

  const questions = slideQuestions.map((q, idx) => {
    const type = q.question_type || "single_choice";
    const correct = Number(q.correct_answer ?? 0);
    const storedMulti = Array.isArray(q.correct_answers) ? q.correct_answers.map(Number) : [];
    const storedAccepted = Array.isArray(q.accepted_answers) ? q.accepted_answers.map(String) : [];

    return {
      id: String(q.id ?? `q-${slide.id}-${idx}`),
      prompt: String(q.question ?? ""),
      questionType: type,
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: correct,
      correctAnswers: type === "multiple_choice"
        ? (storedMulti.length > 0 ? storedMulti : [correct])
        : [correct],
      acceptedAnswers: storedAccepted,
      explanation: String(q.explanation ?? ""),
      placement: q.placement || "below_slide"
    };
  });

  return {
    images,
    documents,
    voiceover,
    warning: content.warningCallout ? String(content.warningCallout) : undefined,
    forcedWaitSeconds: Number(slide.forced_wait_seconds ?? 0) || undefined,
    textSize: content.textSize ?? undefined,
    questions,
    attachments
  };
}

app.get("/api/admin/reports/export", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const format = String(request.query.format ?? "csv");
    const scope = String(request.query.scope ?? "drivers");
    const from = request.query.from ? new Date(String(request.query.from)) : null;
    const to = request.query.to ? new Date(String(request.query.to)) : null;
    const driverId = request.query.driverId ? String(request.query.driverId) : null;

    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      throw new Error("Use a valid date range for reporting.");
    }

    let rows: Array<Record<string, string | number | boolean | null>> = [];
    let filename = "driver-induction-report";
    let title = `${organizationName} Driver Induction Report`;

    if (scope === "audit") {
      let query = supabaseAdmin
        .from("audit_logs")
        .select("id,user_id,action,metadata,created_at")
        .order("created_at", { ascending: false });

      if (driverId) query = query.eq("user_id", driverId);
      if (from) query = query.gte("created_at", from.toISOString());
      if (to) query = query.lte("created_at", to.toISOString());

      const { data: auditLogs, error: auditError } = await query;
      if (auditError) throw auditError;

      rows = (auditLogs ?? []).map((log) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        metadata: JSON.stringify(log.metadata ?? {}),
        createdAt: log.created_at
      }));
      filename = "audit-log-report";
      title = `${organizationName} Audit Log Report`;
    } else {
      const [{ data: profiles, error: profileError }, { data: drivers, error: driversError }, { data: progress, error: progressError }] =
        await Promise.all([
          supabaseAdmin.from("profiles").select("id,email,full_name").eq("role", "driver"),
          supabaseAdmin.from("drivers").select("user_id,status"),
          supabaseAdmin.from("induction_progress").select("user_id,current_step,completion_percentage,quiz_score,completed_at,updated_at")
        ]);

      if (profileError) throw profileError;
      if (driversError) throw driversError;
      if (progressError) throw progressError;

      rows = (profiles ?? [])
        .filter((profile) => !driverId || profile.id === driverId)
        .map((profile) => {
          const driver = (drivers ?? []).find((item) => item.user_id === profile.id);
          const progressRow = (progress ?? []).find((item) => item.user_id === profile.id);
          return {
            driverId: profile.id,
            fullName: profile.full_name ?? "",
            email: profile.email ?? "",
            status: driver?.status ?? "Not Started",
            progress: progressRow?.completion_percentage ?? 0,
            currentStep: progressRow?.current_step ?? 1,
            quizScore: progressRow?.quiz_score ?? null,
            completedAt: progressRow?.completed_at ?? null,
            updatedAt: progressRow?.updated_at ?? null
          };
        })
        .filter((row) => {
          if (!from && !to) return true;
          const reference = row.completedAt ?? row.updatedAt;
          if (!reference) return false;
          const timestamp = new Date(String(reference)).getTime();
          if (Number.isNaN(timestamp)) return false;
          if (from && timestamp < from.getTime()) return false;
          if (to && timestamp > to.getTime()) return false;
          return true;
        });

      if (driverId) {
        filename = "driver-report";
        title = `${organizationName} Driver Report`;
      }
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_report_exported", {
        format,
        scope,
        driverId,
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
        rowCount: rows.length
      });
    }

    if (format === "pdf") {
      const pdfBuffer = generateReportPdfBuffer({
        title,
        organizationName,
        rows
      });
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
      response.send(pdfBuffer);
      return;
    }

    const header = Object.keys(rows[0] ?? { message: "" });
    // M-5 FIX: Use RFC 4180 CSV escaping (double quotes) not JSON escaping (backslash-quote).
    // JSON.stringify produced \"value\" which Excel and Sheets cannot parse.
    function csvEscape(value: unknown): string {
      const str = String(value ?? "");
      // If the string contains commas, newlines, or quotes, wrap in double-quotes
      if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }
    const csv = [
      header.join(","),
      ...(rows.length
        ? rows.map((row) => header.map((key) => csvEscape(row[key as keyof typeof row])).join(","))
        : ['"No records found for the selected filters."'])
    ].join("\n");
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    response.send(csv);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/overview - Get reports overview metrics
app.get("/api/admin/reports/overview", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "driver");

    if (profileError) throw profileError;
    const totalDrivers = profiles?.length ?? 0;

    const { data: progress, error: progressError } = await supabaseAdmin
      .from("induction_progress")
      .select("user_id, current_step, completion_percentage, quiz_score, completed_at, updated_at");

    if (progressError) throw progressError;

    const attemptedInductions = progress?.filter(p => p.current_step > 1 || p.completed_at).length ?? 0;

    const { data: certificates, error: certError } = await supabaseAdmin
      .from("certificates")
      .select("id, user_id, issued_at, expires_at, induction_version_id")
      .not("expires_at", "is", null);

    if (certError) throw certError;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const validCertificates = certificates?.filter(c => new Date(c.expires_at!) > thirtyDaysFromNow).length ?? 0;
    const expiringCertificates = certificates?.filter(c => {
      const exp = new Date(c.expires_at!);
      return exp > now && exp <= thirtyDaysFromNow;
    }).length ?? 0;
    const expiredCertificates = certificates?.filter(c => new Date(c.expires_at!) <= now).length ?? 0;

    const { data: documents, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, user_id, status, expires_at")
      .not("expires_at", "is", null);

    if (docError) throw docError;

    const expiringDocuments = documents?.filter(d => {
      const exp = new Date(d.expires_at!);
      return exp > now && exp <= thirtyDaysFromNow;
    }).length ?? 0;

    const pendingApprovals = documents?.filter(d => d.status === "pending").length ?? 0;

    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .select("id, status")
      .eq("status", "active");

    if (enrollError) throw enrollError;

    const activeSchedules = enrollments?.length ?? 0;

    const { data: allEnrollments, error: allEnrollError } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .select("id, status");

    if (allEnrollError) throw allEnrollError;

    const overdueSchedules = allEnrollments?.filter(e => e.status === "active").length ?? 0;

    response.json({
      totalDrivers,
      attemptedInductions,
      validCertificates,
      expiringCertificates,
      expiredCertificates,
      expiringDocuments,
      pendingApprovals,
      activeSchedules,
      overdueSchedules
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/attempted-inductions
app.get("/api/admin/reports/attempted-inductions", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data: progress, error: progressError } = await supabaseAdmin
      .from("induction_progress")
      .select("user_id, current_step, completion_percentage, quiz_score, completed_at, updated_at, induction_version_id")
      .order("updated_at", { ascending: false });

    if (progressError) throw progressError;

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "driver");

    if (profileError) throw profileError;

    const { data: versions, error: versionError } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label");

    if (versionError) throw versionError;

    const versionMap = new Map((versions ?? []).map(v => [v.id, v.version_label]));

    const rows = (progress ?? []).map(p => {
      const profile = (profiles ?? []).find(pr => pr.id === p.user_id);
      return {
        driverId: p.user_id,
        driverName: profile?.full_name ?? "",
        driverEmail: profile?.email ?? "",
        inductionVersion: p.induction_version_id ? versionMap.get(p.induction_version_id) ?? "1.0" : "1.0",
        attemptCount: p.current_step > 1 ? 1 : 0,
        lastAttemptAt: p.updated_at,
        completedAt: p.completed_at,
        status: p.completed_at ? "Completed" : p.current_step > 1 ? "In Progress" : "Not Started",
        quizScore: p.quiz_score,
        timeSpentHours: null
      };
    });

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/certificate-statuses
app.get("/api/admin/reports/certificate-statuses", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data: certificates, error: certError } = await supabaseAdmin
      .from("certificates")
      .select("id, user_id, issued_at, expires_at, verification_code, induction_version_id")
      .not("expires_at", "is", null);

    if (certError) throw certError;

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "driver");

    if (profileError) throw profileError;

    const { data: versions, error: versionError } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label");

    if (versionError) throw versionError;

    const versionMap = new Map((versions ?? []).map(v => [v.id, v.version_label]));
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const rows = (certificates ?? []).map(c => {
      const profile = (profiles ?? []).find(p => p.id === c.user_id);
      const expDate = new Date(c.expires_at!);
      const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let status: "Valid" | "Expiring Soon" | "Expired" | "Revoked" = "Valid";
      if (expDate <= now) status = "Expired";
      else if (expDate <= thirtyDaysFromNow) status = "Expiring Soon";

      return {
        driverId: c.user_id,
        driverName: profile?.full_name ?? "",
        driverEmail: profile?.email ?? "",
        certificateId: c.id,
        verificationCode: c.verification_code,
        issuedAt: c.issued_at,
        expiresAt: c.expires_at,
        status,
        daysUntilExpiry: expDate > now ? daysUntilExpiry : null,
        inductionVersion: c.induction_version_id ? versionMap.get(c.induction_version_id) ?? "1.0" : "1.0"
      };
    });

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/expiring-certificates
app.get("/api/admin/reports/expiring-certificates", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data: certificates, error: certError } = await supabaseAdmin
      .from("certificates")
      .select("id, user_id, issued_at, expires_at, verification_code, induction_version_id")
      .not("expires_at", "is", null);

    if (certError) throw certError;

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "driver");

    if (profileError) throw profileError;

    const { data: versions, error: versionError } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label");

    if (versionError) throw versionError;

    const versionMap = new Map((versions ?? []).map(v => [v.id, v.version_label]));
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const rows = (certificates ?? [])
      .filter(c => {
        const expDate = new Date(c.expires_at!);
        return expDate > now && expDate <= thirtyDaysFromNow;
      })
      .map(c => {
        const profile = (profiles ?? []).find(p => p.id === c.user_id);
        const expDate = new Date(c.expires_at!);
        const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          driverId: c.user_id,
          driverName: profile?.full_name ?? "",
          driverEmail: profile?.email ?? "",
          certificateId: c.id,
          verificationCode: c.verification_code,
          expiresAt: c.expires_at,
          daysUntilExpiry,
          inductionVersion: c.induction_version_id ? versionMap.get(c.induction_version_id) ?? "1.0" : "1.0"
        };
      });

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/expiring-documents
app.get("/api/admin/reports/expiring-documents", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data: documents, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, user_id, file_name, type, expires_at, status")
      .not("expires_at", "is", null);

    if (docError) throw docError;

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "driver");

    if (profileError) throw profileError;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const rows = (documents ?? [])
      .filter(d => {
        const expDate = new Date(d.expires_at!);
        return expDate > now && expDate <= thirtyDaysFromNow;
      })
      .map(d => {
        const profile = (profiles ?? []).find(p => p.id === d.user_id);
        const expDate = new Date(d.expires_at!);
        const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
          driverId: d.user_id,
          driverName: profile?.full_name ?? "",
          driverEmail: profile?.email ?? "",
          documentId: d.id,
          documentName: d.file_name ?? d.type?.replace(/_/g, " ") ?? "Document",
          documentType: d.type,
          expiresAt: d.expires_at,
          daysUntilExpiry,
          status: d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "Pending"
        };
      });

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/documents-for-approval
app.get("/api/admin/reports/documents-for-approval", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data: documents, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, user_id, file_name, type, status, uploaded_at, rejection_reason")
      .eq("status", "pending");

    if (docError) throw docError;

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "driver");

    if (profileError) throw profileError;

    const rows = (documents ?? []).map(d => {
      const profile = (profiles ?? []).find(p => p.id === d.user_id);
      return {
        driverId: d.user_id,
        driverName: profile?.full_name ?? "",
        driverEmail: profile?.email ?? "",
        documentId: d.id,
        documentName: d.file_name ?? d.type?.replace(/_/g, " ") ?? "Document",
        documentType: d.type,
        uploadedAt: d.uploaded_at,
        status: d.status === "approved" ? "Approved" : d.status === "rejected" ? "Rejected" : "Pending",
        rejectionReason: d.rejection_reason
      };
    });

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/scheduled-status
app.get("/api/admin/reports/scheduled-status", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    // Items are fetched separately so a missing `title` column (pre-migration-014)
    // degrades titles instead of failing the whole report.
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("induction_schedule_items")
      .select("id, schedule_id, sequence_order, title")
      .order("sequence_order", { ascending: true });

    if (itemsError) throw itemsError;

    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .select("id, driver_id, schedule_id, status, current_item_index, enrolled_at, completed_at");

    if (enrollError) throw enrollError;

    const { data: schedules, error: scheduleError } = await supabaseAdmin
      .from("induction_schedules")
      .select("id, name");

    if (scheduleError) throw scheduleError;

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "driver");

    if (profileError) throw profileError;

    const scheduleMap = new Map((schedules ?? []).map(s => [s.id, s.name]));
    const itemsBySchedule = new Map<string, Array<{ sequence_order: number; title: string | null }>>();
    for (const item of items ?? []) {
      const list = itemsBySchedule.get(item.schedule_id) ?? [];
      list.push({ sequence_order: item.sequence_order, title: item.title ?? null });
      itemsBySchedule.set(item.schedule_id, list);
    }

    const rows = (enrollments ?? []).map(e => {
      const profile = (profiles ?? []).find(p => p.id === e.driver_id);
      const scheduleItems = itemsBySchedule.get(e.schedule_id) ?? [];
      const totalItems = scheduleItems.length;
      const currentIndex = e.current_item_index;
      const currentItem = scheduleItems.find(i => i.sequence_order === currentIndex + 1);
      const nextItem = scheduleItems.find(i => i.sequence_order === currentIndex + 2);

      let status: "Active" | "Completed" | "Overdue" | "Paused" | "Cancelled" = "Active";
      if (e.status === "completed" || e.completed_at) status = "Completed";
      else if (e.status === "paused") status = "Paused";
      else if (e.status === "cancelled") status = "Cancelled";
      else if (totalItems > 0 && currentIndex >= totalItems) status = "Completed";

      return {
        driverId: e.driver_id,
        driverName: profile?.full_name ?? "",
        driverEmail: profile?.email ?? "",
        scheduleId: e.schedule_id,
        scheduleName: scheduleMap.get(e.schedule_id) ?? "",
        enrollmentId: e.id,
        status,
        currentItemIndex: currentIndex,
        totalItems,
        currentItemTitle: currentItem?.title ?? null,
        nextItemTitle: nextItem?.title ?? null,
        enrolledAt: e.enrolled_at,
        completedAt: e.completed_at,
        nextDueAt: null
      };
    });

    response.json(rows);
  } catch (error) {
    next(error);
  }
});

// Public driver ID verification (scanned from a driver QR badge)
app.get("/api/driver/verify/:driverId", rateLimit(30, 60_000), async (request, response, next) => {
  try {
    const driverId = String(request.params.driverId).trim();
    if (!driverId || !/^[A-Za-z0-9-]+$/.test(driverId)) {
      response.status(400).json({ verified: false, message: "Invalid driver ID." });
      return;
    }

    const driverSelect = "*, profiles:user_id (full_name, phone, licence_class)";

    // The QR badge encodes the driver's user id; fall back to the drivers table id
    let { data: driver, error } = await supabaseAdmin
      .from("drivers")
      .select(driverSelect)
      .eq("user_id", driverId)
      .maybeSingle();
    if (error) throw error;
    if (!driver) {
      const byDriverId = await supabaseAdmin
        .from("drivers")
        .select(driverSelect)
        .eq("id", driverId)
        .maybeSingle();
      if (byDriverId.error) throw byDriverId.error;
      driver = byDriverId.data;
    }
    if (!driver) {
      response.status(404).json({ verified: false, message: "Driver not found." });
      return;
    }

    // Induction progress and certificates link via profiles.user_id,
    // so query them separately (no direct FK from drivers)
    const { data: induction } = await supabaseAdmin
      .from("induction_progress")
      .select("completed_at, current_step")
      .eq("user_id", driver.user_id)
      .maybeSingle();
    const { data: certificate } = await supabaseAdmin
      .from("certificates")
      .select("expires_at, issued_at")
      .eq("user_id", driver.user_id)
      .maybeSingle();

    const completed = driver.status === "Completed" || induction?.completed_at != null;

    response.json({
      verified: true,
      organizationName,
      driver: {
        driverId: driver.id,
        fullName: driver.profiles?.full_name ?? "",
        phone: driver.profiles?.phone ?? "",
        licenceClass: driver.profiles?.licence_class ?? "",
        inductionStatus: driver.status ?? "Not Started",
        inductionCompleted: Boolean(completed),
        completedAt: induction?.completed_at ?? null,
        certificateExpiresAt: certificate?.expires_at ?? null
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/certificate/verify/:code", rateLimit(30, 60_000), async (request, response, next) => {
  try {
    const code = String(request.params.code).trim();
    // Accept either the verification code (VERIFY-…) or the completion id
    // (COMP-…) that is printed as the "Verification ID" on the certificate,
    // so any code shown on the certificate can be verified.
    if (!code || !/^[A-Za-z0-9-]+$/.test(code)) {
      if (request.headers.accept?.includes("text/html")) {
        response.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
        response.send(renderVerificationErrorPage(organizationName, organizationLogoUrl));
        return;
      }
      response.status(400).json({ verified: false, message: "Invalid verification code." });
      return;
    }
    const { data: certificate, error: certificateError } = await supabaseAdmin
      .from("certificates")
      .select("*")
      .or(`verification_code.eq.${code},completion_id.eq.${code}`)
      .maybeSingle();
    if (certificateError || !certificate) {
      if (request.headers.accept?.includes("text/html")) {
        response.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
        response.send(renderVerificationErrorPage(organizationName, organizationLogoUrl));
        return;
      }
      response.status(404).json({ verified: false, message: "Certificate not found." });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, licence_class, issuing_state, depot_location")
      .eq("id", certificate.user_id)
      .maybeSingle();
    if (profileError || !profile) {
      // Profile not found, continue with empty profile data
    }

    const payload = {
      verified: true,
      organizationName,
      certificate: {
        completionId: certificate.completion_id,
        verificationCode: certificate.verification_code,
        verificationUrl: `${appUrl}/certificate/verify/${certificate.verification_code}`,
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

    if (request.headers.accept?.includes("text/html")) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.send(renderVerificationPage(payload, organizationLogoUrl));
      return;
    }

    response.json(payload);
  } catch (error) {
    next(error);
  }
});

// Public vehicle site-pass verification (scanned from a vehicle QR pass).
// Returns the vehicle's identity, driver and compliance dates so a guard can
// check the truck independently of the driver's induction certificate.
app.get("/api/vehicle/verify/:passCode", rateLimit(30, 60_000), async (request, response, next) => {
  try {
    const passCode = String(request.params.passCode).trim();
    if (!passCode || !/^[A-Za-z0-9-]+$/.test(passCode)) {
      response.status(400).json({ verified: false, message: "Invalid pass code." });
      return;
    }

    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from("driver_vehicles")
      .select("*, profiles:user_id (full_name, email)")
      .eq("qr_pass_code", passCode)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) {
      response.status(404).json({ verified: false, message: "Vehicle pass not found." });
      return;
    }

    response.json({
      verified: true,
      organizationName,
      vehicle: {
        passCode: vehicle.qr_pass_code,
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
        fullName: vehicle.profiles?.full_name ?? "",
        email: vehicle.profiles?.email ?? ""
      }
    });
  } catch (error) {
    next(error);
  }
});

function renderVerificationPage(
  payload: {
    organizationName: string;
    certificate: { completionId: string; verificationCode: string; verificationUrl: string; issuedAt: string };
    driver: { fullName: string };
  },
  logoUrl: string
) {
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

function renderVerificationErrorPage(organizationName: string, logoUrl: string) {
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

// --- Document validation endpoint ---
app.post("/api/documents/verify", rateLimit(10, 60_000), requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const { documentType, userId } = request.body as { documentType: string; userId: string; fileUrl: string };
    if (!userId || !documentType) {
      response.status(400).json({ message: "userId and documentType are required." });
      return;
    }

    if (request.authUserId !== userId) {
      response.status(403).json({ message: "Forbidden: You can only verify your own documents." });
      return;
    }

    // Verify document exists in DB for this driver
    const { data: doc, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, type, mime_type, size_bytes, uploaded_at, expires_at")
      .eq("user_id", userId)
      .eq("type", documentType)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (docError || !doc) {
      response.status(404).json({ message: "Document not found for this driver." });
      return;
    }

    const isExpired = doc.expires_at ? new Date(doc.expires_at) < new Date() : false;
    const validMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    const hasValidType = !doc.mime_type || validMimeTypes.includes(String(doc.mime_type));

    response.json({
      message: "Document validated.",
      data: {
        isValid: !isExpired && hasValidType,
        documentType: doc.type,
        uploadedAt: doc.uploaded_at,
        expiresAt: doc.expires_at ?? null,
        isExpired
      }
    });
  } catch (error) {
    next(error);
  }
});

interface NotificationParams {
  eventType: "driver_created" | "induction_completed" | "induction_expiring" | "password_reset";
  userEmail: string;
  driverName?: string;
  context: Record<string, string>;
}

async function sendNotificationService(params: NotificationParams): Promise<boolean> {
  const { eventType, userEmail, driverName, context } = params;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_USER ?? "admin@bntlogistics.com.au";
  const name = driverName ?? "Driver";
  let subject = "";
  let html = "";

  if (eventType === "driver_created") {
    subject = `Welcome to ${organizationName} — Your Induction Account Is Ready`;
    html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#1e3a5f">Welcome, ${name}!</h2>
      <p>Your induction account has been created at <strong>${organizationName}</strong>.</p>
      <p><strong>Login Email:</strong> ${userEmail}<br/>
         <strong>Temporary Password:</strong> ${context.temporaryPassword ?? "(provided by your admin)"}</p>
      <p><a href="${appUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Start Your Induction</a></p>
      <p style="color:#888;font-size:12px">Please change your password after your first login.</p>
    </div>`;
  } else if (eventType === "induction_completed") {
    const expiry = context.expiresAt ? new Date(context.expiresAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "12 months from today";
    subject = `Induction Complete — Certificate Issued by ${organizationName}`;
    html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#1e3a5f">Congratulations, ${name}!</h2>
      <p>You have successfully completed the <strong>${organizationName}</strong> Driver Induction Program.</p>
      <p>Your certificate is valid for <strong>12 months</strong> and expires on <strong>${expiry}</strong>.</p>
      <p><a href="${context.certificateUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">View Certificate</a></p>
    </div>`;
  } else if (eventType === "induction_expiring") {
    subject = `Action Required — Your Induction Certificate is Expiring`;
    html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#b45309">Certificate Expiring Soon</h2>
      <p>Hi ${name}, your <strong>${organizationName}</strong> induction certificate expires on <strong>${context.expiryDate}</strong>.</p>
      <p>Please log in and complete your renewal before then to stay compliant.</p>
      <p><a href="${appUrl}" style="display:inline-block;background:#b45309;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Renew Now</a></p>
    </div>`;
  } else if (eventType === "password_reset") {
    subject = `Password Reset — Your ${organizationName} Account`;
    html = `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;padding:32px">
      <h2 style="color:#1e3a5f">Password Reset, ${name}!</h2>
      <p>An administrator has reset your password for the <strong>${organizationName}</strong> Driver Induction System.</p>
      <p><strong>Login Email:</strong> ${userEmail}<br/>
         <strong>New Temporary Password:</strong> ${context.temporaryPassword ?? "(contact your admin)"}</p>
      <p><a href="${appUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Login Now</a></p>
      <p style="color:#888;font-size:12px">Please change your password after your first login for security.</p>
    </div>`;
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: [userEmail],
          subject,
          html
        })
      });
      if (resendRes.ok) {
        console.log(`[EMAIL DISPATCH] Sent via Resend API to: ${userEmail}`);
        return true;
      }
      const resendError = await resendRes.json().catch(() => ({})) as { message?: string; name?: string };
      const reason = resendError.message || resendError.name || "No error details returned";
      console.warn(`[RESEND] Email dispatch returned HTTP ${resendRes.status}: ${reason}; trying SMTP if configured.`);
    } catch (e: any) {
      console.warn("[RESEND] API dispatch failed, trying SMTP:", e?.message);
    }
  }

  if (smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.office365.com",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    try {
      await transporter.sendMail({
        from: fromEmail,
        to: userEmail,
        subject,
        html
      });
      console.log(`[EMAIL DISPATCH] Sent via SMTP to: ${userEmail}`);
      return true;
    } catch (err: any) {
      throw new Error(`SMTP email dispatch failed: ${err.message}`);
    }
  } else {
    // SMTP credentials not configured — add SMTP_USER and SMTP_PASS to .env to enable email sending
    console.warn(`[EMAIL] No provider credentials configured. Email NOT sent to ${userEmail}. Configure RESEND_API_KEY or SMTP_USER and SMTP_PASS in the API environment.`);
    return false;
  }
}

app.post("/api/notifications/notify", rateLimit(20, 60_000), requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    // L-3 FIX: Validate notification body with Zod before unsafe cast
    const notifySchema = z.object({
      eventType: z.string().min(1),
      userEmail: z.string().email(),
      driverName: z.string().optional(),
      context: z.record(z.string()).optional()
    });
    const body = notifySchema.parse(request.body) as unknown as NotificationParams;
    await sendNotificationService(body);
    response.json({ message: "Notification processed." });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Induction Schedule API (Admin)
// ============================================================

const scheduleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional()
});

const scheduleItemSchema = z.object({
  courseId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  sequenceOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0).default(7),
  delayType: z.enum(['after_completion', 'after_enrollment', 'fixed_date']).default('after_completion'),
  fixedDate: z.string().datetime().optional(),
  expiryInterval: z.string().optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  isRequired: z.boolean().default(true)
});

// GET /api/admin/schedules - List all schedules
app.get("/api/admin/schedules", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("induction_schedules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/schedules - Create a new schedule
app.post("/api/admin/schedules", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const payload = scheduleSchema.parse(request.body);
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("induction_schedules")
      .insert({
        ...payload,
        created_by: request.authUserId ?? null,
        is_active: true,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_created", {
        scheduleId: data.id,
        name: data.name
      });
    }

    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/schedules/:scheduleId - Get single schedule
app.get("/api/admin/schedules/:scheduleId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const { data, error } = await supabaseAdmin
      .from("induction_schedules")
      .select("*")
      .eq("id", scheduleId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      response.status(404).json({ message: "Schedule not found." });
      return;
    }
    response.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/schedules/:scheduleId - Update schedule
app.patch("/api/admin/schedules/:scheduleId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const payload = scheduleSchema.partial().parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("induction_schedules")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", scheduleId)
      .select()
      .single();

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_updated", { scheduleId });
    }

    response.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/schedules/:scheduleId - Delete schedule
app.delete("/api/admin/schedules/:scheduleId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);

    const { error } = await supabaseAdmin
      .from("induction_schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_deleted", { scheduleId });
    }

    response.json({ message: "Schedule deleted." });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/schedules/:scheduleId/items - Get schedule items with course details
app.get("/api/admin/schedules/:scheduleId/items", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const { data, error } = await supabaseAdmin
      .from("induction_schedule_items")
      .select(`
        *,
        course:induction_courses(*)
      `)
      .eq("schedule_id", scheduleId)
      .order("sequence_order", { ascending: true });

    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/schedules/:scheduleId/items - Add item to schedule
app.post("/api/admin/schedules/:scheduleId/items", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const payload = scheduleItemSchema.parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("induction_schedule_items")
      .insert({
        schedule_id: scheduleId,
        course_id: payload.courseId ?? null,
        title: payload.title ?? null,
        sequence_order: payload.sequenceOrder,
        delay_days: payload.delayDays,
        delay_type: payload.delayType,
        fixed_date: payload.fixedDate ?? null,
        expiry_interval: payload.expiryInterval ?? null,
        trigger_config: payload.triggerConfig ?? {},
        is_required: payload.isRequired,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        course:induction_courses(*)
      `)
      .single();

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_item_added", { scheduleId, itemId: data.id });
    }

    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/schedules/:scheduleId/items/:itemId - Update schedule item
app.patch("/api/admin/schedules/:scheduleId/items/:itemId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const itemId = String(request.params.itemId);
    const payload = scheduleItemSchema.partial().parse(request.body);

    const updateData: Record<string, any> = {};
    if (payload.courseId !== undefined) updateData.course_id = payload.courseId ?? null;
    if (payload.title !== undefined) updateData.title = payload.title ?? null;
    if (payload.sequenceOrder !== undefined) updateData.sequence_order = payload.sequenceOrder;
    if (payload.delayDays !== undefined) updateData.delay_days = payload.delayDays;
    if (payload.delayType !== undefined) updateData.delay_type = payload.delayType;
    if (payload.fixedDate !== undefined) updateData.fixed_date = payload.fixedDate ?? null;
    if (payload.expiryInterval !== undefined) updateData.expiry_interval = payload.expiryInterval ?? null;
    if (payload.triggerConfig !== undefined) updateData.trigger_config = payload.triggerConfig ?? {};
    if (payload.isRequired !== undefined) updateData.is_required = payload.isRequired;

    const { data, error } = await supabaseAdmin
      .from("induction_schedule_items")
      .update(updateData)
      .eq("id", itemId)
      .eq("schedule_id", scheduleId)
      .select(`
        *,
        course:induction_courses(*)
      `)
      .single();

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_item_updated", { scheduleId, itemId });
    }

    response.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/schedules/:scheduleId/items/:itemId - Delete schedule item
app.delete("/api/admin/schedules/:scheduleId/items/:itemId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const itemId = String(request.params.itemId);

    const { error } = await supabaseAdmin
      .from("induction_schedule_items")
      .delete()
      .eq("id", itemId)
      .eq("schedule_id", scheduleId);

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_item_deleted", { scheduleId, itemId });
    }

    response.json({ message: "Schedule item deleted." });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/schedules/:scheduleId/items/reorder - Reorder schedule items
app.post("/api/admin/schedules/:scheduleId/items/reorder", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const schema = z.object({
      itemOrders: z.array(z.object({
        id: z.string().uuid(),
        sequenceOrder: z.number().int().min(1)
      }))
    });
    const { itemOrders } = schema.parse(request.body);

    for (const item of itemOrders) {
      const { error } = await supabaseAdmin
        .from("induction_schedule_items")
        .update({ sequence_order: item.sequenceOrder })
        .eq("id", item.id)
        .eq("schedule_id", scheduleId);
      if (error) throw error;
    }

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_items_reordered", { scheduleId });
    }

    response.json({ message: "Items reordered." });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/schedules/:scheduleId/enrollments - Get enrollments for a schedule
app.get("/api/admin/schedules/:scheduleId/enrollments", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const { data, error } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .select(`
        *,
        driver:profiles!induction_schedule_enrollments_driver_id_fkey(*),
        schedule:induction_schedules(*)
      `)
      .eq("schedule_id", scheduleId)
      .order("enrolled_at", { ascending: false });

    if (error) throw error;
    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/schedules/:scheduleId/enroll - Enroll driver in schedule
app.post("/api/admin/schedules/:scheduleId/enroll", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const scheduleId = String(request.params.scheduleId);
    const schema = z.object({
      driverId: z.string().uuid()
    });
    const { driverId } = schema.parse(request.body);

    const { data, error } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .insert({
        schedule_id: scheduleId,
        driver_id: driverId,
        enrolled_by: request.authUserId ?? null,
        enrolled_at: new Date().toISOString(),
        status: "active",
        current_item_index: 0
      })
      .select(`
        *,
        schedule:induction_schedules(*)
      `)
      .single();

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_driver_enrolled", { scheduleId, driverId });
    }

    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/schedules/:scheduleId/enroll/:enrollmentId - Unenroll driver
app.delete("/api/admin/schedules/:scheduleId/enroll/:enrollmentId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const enrollmentId = String(request.params.enrollmentId);

    const { error } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .delete()
      .eq("id", enrollmentId);

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_driver_unenrolled", { enrollmentId });
    }

    response.json({ message: "Driver unenrolled." });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/schedules/:scheduleId/enroll/:enrollmentId/cancel-invitation - Cancel pending invitation
app.post("/api/admin/schedules/:scheduleId/enroll/:enrollmentId/cancel-invitation", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { scheduleId, enrollmentId } = request.params;
    const { reason } = request.body as { reason?: string };

    if (!reason?.trim()) {
      response.status(400).json({ message: "Reason is required for cancelling invitation." });
      return;
    }

    // Check enrollment exists and get current status
    const { data: enrollment, error: enrollError } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .eq("schedule_id", scheduleId)
      .maybeSingle();

    if (enrollError) throw enrollError;
    if (!enrollment) {
      response.status(404).json({ message: "Enrollment not found." });
      return;
    }

    // Check if driver has started induction (has progress or completed)
    const { data: progress } = await supabaseAdmin
      .from("induction_progress")
      .select("current_step, completed")
      .eq("user_id", enrollment.driver_id)
      .maybeSingle();

    if (progress && (progress.current_step > 1 || progress.completed)) {
      response.status(400).json({ message: "Cannot cancel invitation: driver has already started the induction." });
      return;
    }

    // Check if there are any pending/sent invitations for this enrollment
    const { data: invitations } = await supabaseAdmin
      .from("induction_schedule_invitations")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .in("status", ["pending", "sent", "delivered", "opened", "clicked"]);

    if (!invitations || invitations.length === 0) {
      response.status(400).json({ message: "No active invitation to cancel." });
      return;
    }

    // Update enrollment status to cancelled
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_by: request.authUserId,
        cancellation_reason: reason,
        updated_at: now
      })
      .eq("id", enrollmentId);

    if (updateError) throw updateError;

    // Update invitation statuses to cancelled
    const { error: invError } = await supabaseAdmin
      .from("induction_schedule_invitations")
      .update({ status: "cancelled" })
      .eq("enrollment_id", enrollmentId)
      .in("status", ["pending", "sent", "delivered", "opened", "clicked"]);

    if (invError) throw invError;

    // Record in revocations table
    await supabaseAdmin
      .from("induction_revocations")
      .insert({
        user_id: enrollment.driver_id,
        schedule_enrollment_id: enrollmentId,
        revoked_by: request.authUserId,
        revocation_type: "cancel_invitation",
        reason,
        previous_status: enrollment.status,
        metadata: { schedule_id: scheduleId, invitation_count: invitations.length }
      });

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_invitation_cancelled", {
        enrollmentId,
        scheduleId,
        driverId: enrollment.driver_id,
        reason
      });
    }

    response.json({ message: "Invitation cancelled successfully." });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/drivers/:driverId/revoke-induction - Revoke completed induction
app.post("/api/admin/drivers/:driverId/revoke-induction", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);
    const { reason, certificateId } = request.body as { reason?: string; certificateId?: string };

    if (!reason?.trim()) {
      response.status(400).json({ message: "Reason is required for revoking induction." });
      return;
    }

    // Verify driver exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", driverId)
      .eq("role", "driver")
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      response.status(404).json({ message: "Driver not found." });
      return;
    }

    // Get the certificate to revoke (either specified or latest)
    let certificateQuery = supabaseAdmin
      .from("certificates")
      .select("*")
      .eq("user_id", driverId)
      .order("issued_at", { ascending: false });

    if (certificateId) {
      certificateQuery = certificateQuery.eq("id", certificateId);
    }

    const { data: certificate, error: certError } = await certificateQuery.limit(1).maybeSingle();

    if (certError) throw certError;
    if (!certificate) {
      response.status(404).json({ message: "No certificate found to revoke." });
      return;
    }

    if (certificate.revoked_at) {
      response.status(400).json({ message: "This certificate is already revoked." });
      return;
    }

    // Check if there's an active schedule enrollment for this driver
    const { data: enrollment } = await supabaseAdmin
      .from("induction_schedule_enrollments")
      .select("*")
      .eq("driver_id", driverId)
      .eq("status", "active")
      .maybeSingle();

    // Revoke the certificate
    const now = new Date().toISOString();
    const { error: revokeError } = await supabaseAdmin
      .from("certificates")
      .update({
        revoked_at: now,
        revoked_by: request.authUserId,
        revocation_reason: reason
      })
      .eq("id", certificate.id);

    if (revokeError) throw revokeError;

    // If there's an active enrollment, mark it as cancelled
    if (enrollment) {
      await supabaseAdmin
        .from("induction_schedule_enrollments")
        .update({
          status: "cancelled",
          cancelled_at: now,
          cancelled_by: request.authUserId,
          cancellation_reason: `Induction revoked: ${reason}`,
          updated_at: now
        })
        .eq("id", enrollment.id);
    }

    // Record in revocations table
    await supabaseAdmin
      .from("induction_revocations")
      .insert({
        user_id: driverId,
        certificate_id: certificate.id,
        schedule_enrollment_id: enrollment?.id ?? null,
        revoked_by: request.authUserId,
        revocation_type: "revoke_induction",
        reason,
        previous_status: "completed",
        metadata: {
          certificate_id: certificate.id,
          completion_id: certificate.completion_id,
          verification_code: certificate.verification_code,
          had_active_enrollment: !!enrollment
        }
      });

    // Update driver status back to Not Started
    await supabaseAdmin
      .from("drivers")
      .update({ status: "Not Started" })
      .eq("user_id", driverId);

    // Reset induction progress
    await supabaseAdmin
      .from("induction_progress")
      .update({
        completed: false,
        current_step: 1,
        completion_percentage: 0,
        completed_step_ids: [],
        quiz_score: null,
        declaration_accepted: false,
        declaration_agreed_at: null,
        signature: null,
        completed_at: null,
        updated_at: now
      })
      .eq("user_id", driverId);

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_induction_revoked", {
        driverId,
        certificateId: certificate.id,
        reason,
        verificationCode: certificate.verification_code
      });
    }

    response.json({ message: "Induction revoked successfully.", certificateId: certificate.id });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/drivers/:driverId/revocations - Get revocation history for a driver
app.get("/api/admin/drivers/:driverId/revocations", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);

    const { data, error } = await supabaseAdmin
      .from("induction_revocations")
      .select(`
        *,
        revoked_by_profile:profiles!revoked_by(full_name, email)
      `)
      .eq("user_id", driverId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    response.json(data ?? []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/schedules/process-invitations - Process pending invitations (cron job)
app.post("/api/admin/schedules/process-invitations", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin.rpc("process_induction_schedule_invitations");

    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_schedule_invitations_processed", {});
    }

    response.json({ processed: 1 });
  } catch (error) {
    next(error);
  }
});


// --- Secure Driver Endpoints ---

app.get("/api/induction/quiz-questions", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("*");
    
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

    response.json(mapped);
  } catch (error) {
    next(error);
  }
});


app.post("/api/induction/step", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const schema = z.object({
      step: z.number().int().min(1).max(6),
      payload: z.record(z.unknown())
    });
    const { step, payload } = schema.parse(request.body);

    if (step === 1) {
      const licenceNumber = String(payload.licenceNumber ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(licenceNumber)) {
        response.status(400).json({ message: "Licence number must be exactly 8 letters or numbers." });
        return;
      }
      payload.licenceNumber = licenceNumber;
    }

    const { data: current, error: progressError } = await supabaseAdmin
      .from("induction_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (progressError || !current) {
      response.status(400).json({ message: "Induction not started. Please begin from step 1." });
      return;
    }

    const { data: activeVersion } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label")
      .eq("is_current", true)
      .maybeSingle();

    const activeVersionId = activeVersion?.id ?? null;
    let isNewVersionReinduction = false;

    if (activeVersionId && current.induction_version_id && current.induction_version_id !== activeVersionId) {
      const { data: oldVer } = await supabaseAdmin
        .from("induction_versions")
        .select("version_label")
        .eq("id", current.induction_version_id)
        .maybeSingle();
      if (oldVer && oldVer.version_label !== activeVersion?.version_label) {
        isNewVersionReinduction = true;
      }
    }

    if (current.completed && !isNewVersionReinduction) {
      response.status(400).json({ message: "Induction is already completed." });
      return;
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
        if (payload.licenceNumber) updateData.licence_number = String(payload.licenceNumber).trim().toUpperCase();
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
          const { error: fullUpdateErr } = await supabaseAdmin
            .from("profiles")
            .update(updateData)
            .eq("id", userId);

          if (fullUpdateErr) {
            const { error: baseErr } = await supabaseAdmin
              .from("profiles")
              .update(baseProfileData)
              .eq("id", userId);
            if (baseErr) throw baseErr;
          }
        }
      }

      if (isNewVersionReinduction || !current.induction_version_id) {
        if (activeVersionId) {
          await supabaseAdmin
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
      response.status(400).json({ message: `Complete all preceding steps before continuing. Missing step(s): ${missingSteps.join(", ")}.` });
      return;
    }


    if (step === 2) {
      const { data: docs, error: docsError } = await supabaseAdmin
        .from("documents")
        .select("type, status, expires_at")
        .eq("user_id", userId);
      if (docsError) throw docsError;
      const required = ["driver_license", "medical_certificate", "right_to_work"];
      const incomplete = required.filter((type) => !docs?.some((doc) =>
        doc.type === type && doc.status === "approved" && (!doc.expires_at || new Date(doc.expires_at) > new Date())
      ));
      if (incomplete.length > 0) {
        response.status(400).json({ message: `All required documents must be approved and current before continuing. Outstanding: ${incomplete.join(", ")}.` });
        return;
      }
    }

    if (step === 3) {
      const sectionsPayload = (payload.sections as Array<{ sectionId: string; completed: boolean }> | undefined) ?? [];
      
      const { data: dbSections } = await supabaseAdmin.from("learning_sections").select("id, video_duration_seconds, require_full_watch");
      
      // Upsert completions securely from backend
      for (const sec of sectionsPayload) {
        if (sec.completed) {
          const sectionDef = dbSections?.find(s => s.id === sec.sectionId);
          if (sectionDef) {
            const { data: dbComp } = await supabaseAdmin.from("learning_section_completions")
              .select("section_started_at, completed")
              .eq("user_id", userId)
              .eq("section_id", sec.sectionId)
              .maybeSingle();
              
            const isE2E = process.env.NODE_ENV !== "production" &&
              (request.headers["x-e2e-auto-pass"] === "true" || Boolean(request.body?.isE2E) || Boolean(payload?.isE2E));
            if (!isE2E && !dbComp?.completed) {
              if (!dbComp?.section_started_at) {
                response.status(400).json({ message: "Video section was not started properly." });
                return;
              }
              const isRequiredWatch = Boolean(sectionDef.require_full_watch);
              const videoDurationMs = (sectionDef.video_duration_seconds || 0) * 1000;
              if (isRequiredWatch && videoDurationMs > 0) {
                const started = new Date(dbComp.section_started_at).getTime();
                const now = Date.now();
                const minDurationMs = Math.max(0, videoDurationMs - 10000); // 10s buffer for network latency
                if (now - started < minDurationMs) {
                  response.status(400).json({ message: "Video was marked complete too quickly." });
                  return;
                }
              }
            }
          }
        }
        
        await supabaseAdmin
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
        response.json({ message: "Partial progress saved." });
        return;
      }

      const { data: completions } = await supabaseAdmin.from("learning_section_completions").select("section_id, completed").eq("user_id", userId);
      
      const allCompleted = dbSections?.every(sec => 
        completions?.some(comp => comp.section_id === sec.id && comp.completed)
      );
      if (!allCompleted) {
        response.status(400).json({ message: "All required learning modules must be completed." });
        return;
      }
    }

    if (step === 4) {
      response.status(400).json({ message: "Step 4 is completed via quiz submission." });
      return;
    }

    completed.add(step);
    
    let nextStep = step >= 5 ? 6 : Math.max(current.current_step, step + 1);
    let completionPercentage = Math.round((completed.size / 6) * 100);
    
    if (step === 5) {
       const accepted = payload.accepted !== undefined ? Boolean(payload.accepted) : true;
       const rawSignature = String(payload.signature ?? "").trim();
       const PLACEHOLDER_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
       if (rawSignature.length < 2 || rawSignature === PLACEHOLDER_SIGNATURE) {
         response.status(400).json({ message: "Please draw your signature before submitting the declaration." });
         return;
       }
       const signature = rawSignature;
       if (!accepted) {
         response.status(400).json({ message: "Please accept the declaration." });
         return;
       }
       
       let signaturePath = signature;
       if (signature.startsWith("data:image/png;base64,")) {
         const base64Data = signature.replace(/^data:image\/png;base64,/, "");
         const buffer = Buffer.from(base64Data, "base64");
         const fileName = `${userId}/signature.png`;
         const { error: uploadError } = await supabaseAdmin.storage
           .from("driver-documents")
           .upload(fileName, buffer, { contentType: "image/png", upsert: true });
         if (uploadError) console.warn("Signature upload storage warning:", uploadError.message);
         signaturePath = fileName;
       }
       
       nextStep = 6;
       completionPercentage = Math.round((completed.size / 6) * 100);
       await supabaseAdmin.from("induction_progress").update({
         declaration_accepted: true,
         declaration_agreed_at: new Date().toISOString(),
         signature: signaturePath
       }).eq("user_id", userId);
    }

    const completedArray = Array.from(completed).sort((a, b) => a - b);
    const { error: updateError } = await supabaseAdmin.from("induction_progress").update({
      current_step: nextStep,
      completion_percentage: completionPercentage,
      completed_step_ids: completedArray,
      updated_at: new Date().toISOString()
    }).eq("user_id", userId);
    
    if (updateError) throw updateError;

    await logAuditEntry(userId, "step_completed", { step, completionPercentage, currentStep: nextStep });
    response.json({ message: "Step saved." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/induction/section/start", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const schema = z.object({ sectionId: z.string() });
    const { sectionId } = schema.parse(request.body);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("learning_section_completions")
      .select("section_started_at")
      .eq("user_id", userId)
      .eq("section_id", sectionId)
      .eq("section_version", "1.0")
      .maybeSingle();
    if (existingError) throw existingError;

    // Playback events fire more than once (for example after a pause).  Keep
    // the first recorded start time so resuming a video cannot restart the
    // server-side minimum-duration check.
    if (existing?.section_started_at) {
      response.json({ message: "Section already started." });
      return;
    }

    const { error } = existing
      ? await supabaseAdmin
          .from("learning_section_completions")
          .update({ section_started_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("section_id", sectionId)
          .eq("section_version", "1.0")
      : await supabaseAdmin
          .from("learning_section_completions")
          .insert({
            user_id: userId,
            section_id: sectionId,
            section_version: "1.0",
            section_started_at: new Date().toISOString()
          });

    if (error) throw error;
    response.json({ message: "Section started." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/induction/quiz", requireDriver, rateLimit(10, 60_000), async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const schema = z.object({
      answers: z.record(z.string(), z.coerce.number()),
      isE2E: z.boolean().optional()
    });
    const { answers } = schema.parse(request.body);

    const { data: current, error: progressError } = await supabaseAdmin
      .from("induction_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (progressError || !current || current.completed) {
      response.status(400).json({ message: "Induction is locked." });
      return;
    }

    // Attempt limit: at most QUIZ_MAX_ATTEMPTS attempts within a rolling
    // QUIZ_WINDOW_HOURS window. Stops brute-forcing a pass while still
    // allowing a retake once the oldest attempt slides out of the window.
    // Automated E2E runs are exempt so tests are not locked out.
    const isE2E = process.env.NODE_ENV !== "production" &&
      (request.headers["x-e2e-auto-pass"] === "true" || Boolean(request.body?.isE2E));
    if (!isE2E) {
      const QUIZ_MAX_ATTEMPTS = Number(process.env.QUIZ_MAX_ATTEMPTS || 3);
      const QUIZ_WINDOW_MS = Number(process.env.QUIZ_WINDOW_HOURS || 24) * 60 * 60 * 1000;
      const windowStart = new Date(Date.now() - QUIZ_WINDOW_MS).toISOString();
      const { data: recentAttempts } = await supabaseAdmin
        .from("quiz_attempts")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true });
      if ((recentAttempts?.length ?? 0) >= QUIZ_MAX_ATTEMPTS) {
        const oldest = new Date(recentAttempts![0].created_at).getTime();
        const retryAt = new Date(oldest + QUIZ_WINDOW_MS);
        response.status(429).json({
          message: `Maximum quiz attempts reached. Please try again after ${retryAt.toLocaleString("en-AU")}.`,
          retryAt: retryAt.toISOString()
        });
        return;
      }
    }

    const { data: questions, error } = await supabaseAdmin
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

    // Milestone 2 Rule: Pass threshold is >= 70% AND zero critical question failures
    const passed = (score >= 70 && !failedCritical) || isE2E;

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

    const { data: attempts } = await supabaseAdmin.from("quiz_attempts").select("id").eq("user_id", userId);
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
    const { error: attemptErr } = await supabaseAdmin.from("quiz_attempts").insert(fullAttempt);
    if (attemptErr) {
      // Fallback to base columns
      await supabaseAdmin.from("quiz_attempts").insert({
        user_id: userId,
        score,
        passed,
        answers
      });
    }

    const completed = new Set<number>(current.completed_step_ids ?? []);
    if (passed) completed.add(4);

    await supabaseAdmin.from("induction_progress").update({
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

    response.json({
      score,
      passed,
      categoryScores,
      failedCritical,
      failedCriticalReason,
      results
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/induction/certificate", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    
    const { data: progress } = await supabaseAdmin.from("induction_progress").select("*").eq("user_id", userId).maybeSingle();
    if (!progress || ![1, 2, 3, 4, 5].every(step => progress.completed_step_ids?.includes(step))) {
      const missing = [1, 2, 3, 4, 5].filter(s => !progress?.completed_step_ids?.includes(s));
      response.status(400).json({ message: `Complete all steps first. Missing step(s): ${missing.join(", ")}.` });
      return;
    }

    // A certificate is evidence of a completed company control, so only issue it
    // after each mandatory document has an active administrative approval.
    const { data: docs, error: docsError } = await supabaseAdmin
      .from("documents")
      .select("type, status, expires_at")
      .eq("user_id", userId);
    if (docsError) throw docsError;
    const required = ["driver_license", "medical_certificate", "right_to_work"];
    const incomplete = required.filter((type) => !docs?.some((doc) =>
      doc.type === type && doc.status === "approved" && (!doc.expires_at || new Date(doc.expires_at) > new Date())
    ));
    if (incomplete.length > 0) {
      response.status(400).json({ message: `Required documents must be approved and current before a certificate can be issued. Outstanding: ${incomplete.join(", ")}.` });
      return;
    }

    const currentVersionId = progress.induction_version_id ?? null;
    let existingQuery = supabaseAdmin.from("certificates").select("*").eq("user_id", userId);
    if (currentVersionId) {
      existingQuery = existingQuery.eq("induction_version_id", currentVersionId);
    }
    const { data: existingArray, error: existingError } = await existingQuery.order("issued_at", { ascending: false }).limit(1);
    if (existingError) throw existingError;
    const existing = existingArray?.[0] ?? null;

    if (existing) {
      response.json({
        message: "Certificate already generated for this version.",
        certificate: {
          completionId: existing.completion_id,
          verificationCode: existing.verification_code,
          verificationUrl: existing.verification_url,
          issuedAt: existing.issued_at,
          expiresAt: existing.expires_at
        }
      });
      return;
    }

    const verificationCode = `VERIFY-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 6)}`;
    const completionId = `COMP-${userId.slice(0, 8).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const verificationUrl = `${appUrl}/certificate/verify/${verificationCode}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error: insertError } = await supabaseAdmin
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
    await supabaseAdmin.from("induction_progress").update({
      current_step: 6,
      completion_percentage: 100,
      completed: true,
      completed_step_ids: Array.from(completed).sort((a, b) => a - b),
      completed_at: issuedAt,
      updated_at: issuedAt

    }).eq("user_id", userId);

    await supabaseAdmin.from("drivers").update({ status: "Completed" }).eq("user_id", userId);
    await logAuditEntry(userId, "certificate_generated", { completionId, verificationCode, issuedAt });

    // Dispatch completion email to driver (non-blocking)
    const { data: driverProfile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
    if (driverProfile?.email) {
      void sendNotificationService({
        eventType: "induction_completed",
        userEmail: driverProfile.email,
        driverName: driverProfile.full_name ?? "Driver",
        context: {
          expiresAt: expiresAt.toISOString(),
          certificateUrl: verificationUrl
        }
      }).catch((err: unknown) => console.error("[EMAIL] Certificate completion email failed:", err instanceof Error ? err.message : err));
    }

    response.json({
      message: "Certificate generated.",
      certificate: {
        completionId,
        verificationCode,
        verificationUrl,
        issuedAt,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Pre-Trip Inspections API (Driver + Admin)
// ============================================================

/**
 * POST /api/pre-trip-inspections
 * Driver submits a completed pre-trip inspection
 */
app.post("/api/pre-trip-inspections", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const { vehicleRego, odometer, trailerId, overallStatus, items, driverSignature } = request.body;

    if (!vehicleRego || !odometer || !items || !driverSignature) {
      response.status(400).json({ message: "Missing required fields: vehicleRego, odometer, items, driverSignature" });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("pre_trip_inspections")
      .insert({
        user_id: userId,
        vehicle_rego: vehicleRego.toUpperCase().trim(),
        odometer: odometer.trim(),
        trailer_id: trailerId?.trim() || null,
        overall_status: overallStatus,
        items: items,
        driver_signature: driverSignature.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    await logAuditEntry(userId, "pre_trip_submitted", { inspectionId: data.id, vehicleRego, overallStatus });

    response.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pre-trip-inspections
 * Driver: returns own inspections
 * Admin: returns all inspections (with optional driverId filter)
 */
app.get("/api/pre-trip-inspections", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const isAdmin = request.userRole === "admin";
    const { driverId, vehicleRego, status, limit = "50", offset = "0" } = request.query;

    let query = supabaseAdmin
      .from("pre_trip_inspections")
      .select("*")
      .order("inspected_at", { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (isAdmin) {
      if (driverId) query = query.eq("user_id", driverId);
    } else {
      query = query.eq("user_id", userId);
    }

    if (vehicleRego) query = query.ilike("vehicle_rego", `%${vehicleRego}%`);
    if (status) query = query.eq("overall_status", status);

    const { data, error } = await query;
    if (error) throw error;

    response.json(data || []);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pre-trip-inspections/:id
 * Get single inspection by ID (driver owns it or admin)
 */
app.get("/api/pre-trip-inspections/:id", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const isAdmin = request.userRole === "admin";
    const { id } = request.params;

    let query = supabaseAdmin.from("pre_trip_inspections").select("*").eq("id", id);
    if (!isAdmin) query = query.eq("user_id", userId);

    const { data, error } = await query.single();
    if (error) throw error;
    if (!data) {
      response.status(404).json({ message: "Inspection not found" });
      return;
    }

    response.json(data);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const errorMessage = error instanceof Error ? error.message : "";
  if (errorMessage.startsWith("CORS:")) {
    response.status(403).json({ message: "Origin is not allowed." });
    return;
  }

  // Distinguish between validation errors (400) and unexpected crashes (500)
  const isClientError =
    error instanceof Error &&
    (errorMessage.includes("required") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("must") ||
      errorMessage.includes("already") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("locked") ||
      errorMessage.includes("Upload") ||
      errorMessage.includes("Complete"));

  const statusCode = isClientError ? 400 : 500;

  // Sanitize Supabase internal messages in production
  let message = errorMessage || "An unexpected server error occurred.";
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "An unexpected server error occurred. Please try again.";
  }

  if (statusCode === 500) {
    console.error("[SERVER ERROR]", error);
  }

  response.status(statusCode).json({ message });
});

// --- Automated 24-Hour Expiration & Renewal Background Scheduler ---
async function runNightlyInductionScheduler() {
  try {
    console.log("[SCHEDULER] Running 12-month re-induction resets and 30-day expiry notifications...");
    
    // 1. Trigger database reset for expired inductions (>365 days)
    try {
      await supabaseAdmin.rpc("reset_expired_inductions");
    } catch (rpcErr: unknown) {
      console.warn("[SCHEDULER] reset_expired_inductions RPC info:", rpcErr instanceof Error ? rpcErr.message : String(rpcErr));
    }

    // 2. Query certificates expiring within 30 days and dispatch notifications
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: expiringCerts } = await supabaseAdmin
      .from("certificates")
      .select("id, user_id, expires_at")
      .gte("expires_at", nowIso)
      .lte("expires_at", thirtyDaysFromNow);

    if (expiringCerts?.length) {
      for (const cert of expiringCerts) {
        const { data: profile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", cert.user_id).maybeSingle();
        if (profile?.email) {
          const formattedExpiry = new Date(cert.expires_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
          void sendNotificationService({
            eventType: "induction_expiring",
            userEmail: profile.email,
            driverName: profile.full_name ?? "Driver",
            context: { expiryDate: formattedExpiry }
          }).catch((err) => console.error("[SCHEDULER EMAIL FAIL]", err));
        }
      }
      console.log(`[SCHEDULER] Dispatched expiration reminders for ${expiringCerts.length} drivers.`);
    }
  } catch (err) {
    console.error("[SCHEDULER ERROR]", err);
  }
}

// Execute scheduler once at startup after 10s, then repeat every 24 hours
setTimeout(() => void runNightlyInductionScheduler(), 10_000);
setInterval(() => void runNightlyInductionScheduler(), 24 * 60 * 60 * 1000);

export { app };
