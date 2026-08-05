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
function rateLimit(maxRequests: number, windowMs: number) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    const ip = String(request.ip ?? request.socket.remoteAddress ?? "unknown");
    const now = Date.now();
    const entry = rateLimitStore.get(ip);
    if (!entry || now > entry.resetAt) {
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

// Restrict CORS to the known frontend origin only
app.use(cors({
  origin: appUrl,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "2mb" }));

interface AdminRequest extends express.Request {
  authUserId?: string;
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

app.get("/health", (_request, response) => {
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
    .single();

  if (profileError || profile?.role !== "admin") {
    response.status(403).json({ message: "Admin access is required." });
    return;
  }

  request.authUserId = authData.user.id;
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
    .single();

  if (profileError || profile?.role !== "driver") {
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
  next();
}

// ============================================================
// MILESTONE 1: Versioned Inductions — Read current version (public)
// ============================================================

/**
 * GET /api/induction/version
 * Driver-facing. Returns the currently active induction version.
 * Drivers call this to detect if a newer version requires re-completion.
 */
app.get("/api/induction/version", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    const { data: currentVersion, error } = await supabaseAdmin
      .from("induction_versions")
      .select("id, version_label, revision_notes, published_at")
      .eq("is_current", true)
      .single();

    if (error || !currentVersion) {
      response.json({ id: null, versionLabel: "1.0", revisionNotes: "", publishedAt: null, hasPendingVersion: false });
      return;
    }

    const { data: cert } = await supabaseAdmin
      .from("certificates")
      .select("induction_version_id")
      .eq("user_id", userId)
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
app.get("/admin/induction-versions", requireAdmin, async (_request, response, next) => {
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
app.post("/admin/induction-versions", requireAdmin, async (request: AdminRequest, response, next) => {
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

app.post("/admin/drivers", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      phone: z.string().min(5),
      address: z.string().min(5),
      preferredLanguage: z.string().min(2)
    });
    const payload = schema.parse(request.body);

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { role: "driver", must_change_password: true }
    });
    if (createError || !createdUser.user) throw createError ?? new Error("Unable to create driver account.");

    const userId = createdUser.user.id;
    const createdAt = new Date().toISOString();

    try {
      const { error: profileError } = await supabaseAdmin.from("profiles").insert({
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
      if (profileError) throw profileError;

      const { error: driverError } = await supabaseAdmin.from("drivers").insert({
        user_id: userId,
        status: "Not Started",
        created_at: createdAt
      });
      if (driverError) throw driverError;

      const { error: progressError } = await supabaseAdmin.from("induction_progress").insert({
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

    // Fire welcome email non-blocking via direct service function
    void sendNotificationService({
      eventType: "driver_created",
      userEmail: payload.email,
      driverName: payload.fullName,
      context: { temporaryPassword: payload.password }
    }).catch((err: unknown) => console.error("[EMAIL] Welcome email failed:", err));

    response.status(201).json({ message: "Driver account created.", userId });
  } catch (error) {
    next(error);
  }
});

app.put("/admin/drivers/:driverId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(5),
      address: z.string().min(5),
      preferredLanguage: z.string().min(2)
    });
    const payload = schema.parse(request.body);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(driverId, {
      email: payload.email,
      user_metadata: { role: "driver" }
    });
    if (authError) throw authError;

    const { error: profileError } = await supabaseAdmin
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
    if (profileError) throw profileError;

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

app.post("/admin/drivers/:driverId/reset-password", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);
    const schema = z.object({
      password: z.string().min(8)
    });
    const payload = schema.parse(request.body);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(driverId, {
      password: payload.password
    });
    if (error) throw error;

    if (request.authUserId) {
      await logAuditEntry(request.authUserId, "admin_password_reset", {
        driverId
      });
    }

    response.json({ message: "Temporary password set for driver." });
  } catch (error) {
    next(error);
  }
});

// Bulk Driver Onboarding Endpoint
app.post("/admin/drivers/bulk", requireAdmin, rateLimit(10, 60_000), async (request: AdminRequest, response, next) => {
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

    const createdList: Array<{ id: string; email: string; fullName: string }> = [];
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
          await supabaseAdmin.from("profiles").insert({
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

          await supabaseAdmin.from("drivers").insert({ user_id: userId, status: "Not Started", created_at: now });
          await supabaseAdmin.from("induction_progress").insert({ user_id: userId, current_step: 1, completion_percentage: 0, completed: false, completed_step_ids: [], updated_at: now });

          const { data: sections } = await supabaseAdmin.from("learning_sections").select("id");
          if (sections?.length) {
            const completionRows = sections.map((sec) => ({ user_id: userId, section_id: sec.id, section_version: "1.0", completed: false, completed_at: null }));
            await supabaseAdmin.from("learning_section_completions").insert(completionRows);
          }
        } catch (dbErr) {
          await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
          throw dbErr;
        }

        void sendNotificationService({
          eventType: "driver_created",
          userEmail: driverItem.email,
          driverName: driverItem.fullName,
          context: { temporaryPassword: driverItem.password }
        }).catch((e) => console.error("[BULK EMAIL FAIL]", e));

        createdList.push({ id: userId, email: driverItem.email, fullName: driverItem.fullName });
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
app.post("/admin/documents/:documentId/approve", requireAdmin, async (request: AdminRequest, response, next) => {
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

app.post("/admin/documents/:documentId/reject", requireAdmin, async (request: AdminRequest, response, next) => {
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
app.get("/admin/verification-queue", requireAdmin, async (_request, response, next) => {
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

app.post("/admin/documents/:documentId/verify", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const documentId = String(request.params.documentId);
    const schema = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().optional() });
    const { action, reason } = schema.parse(request.body);
    const now = new Date().toISOString();

    const { data: doc, error: fetchErr } = await supabaseAdmin.from("documents").select("id, user_id, type").eq("id", documentId).single();
    if (fetchErr || !doc) throw fetchErr ?? new Error("Document not found.");

    const isApprove = action === "approve";
    const { error } = await supabaseAdmin.from("documents").update({
      status: isApprove ? "approved" : "rejected"
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

    const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
    const { currentPassword, newPassword } = schema.parse(request.body);

    // Verify current password first with a temporary client to prevent session pollution
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

app.post("/admin/drivers/:driverId/reset-induction", requireAdmin, async (request: AdminRequest, response, next) => {
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

app.delete("/admin/drivers/:driverId", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const driverId = String(request.params.driverId);

    const { data: documents, error: documentsError } = await supabaseAdmin
      .from("documents")
      .select("file_url")
      .eq("user_id", driverId);
    if (documentsError) throw documentsError;

    await supabaseAdmin.from("documents").delete().eq("user_id", driverId);
    await supabaseAdmin.from("learning_section_completions").delete().eq("user_id", driverId);
    await supabaseAdmin.from("quiz_attempts").delete().eq("user_id", driverId);
    await supabaseAdmin.from("certificates").delete().eq("user_id", driverId);
    await supabaseAdmin.from("induction_progress").delete().eq("user_id", driverId);
    await supabaseAdmin.from("drivers").delete().eq("user_id", driverId);
    await supabaseAdmin.from("profiles").delete().eq("id", driverId);

    if (documents?.length) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("driver-documents")
        .remove(documents.map((document) => document.file_url));
      if (storageError) throw storageError;
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(driverId);
    if (deleteUserError) throw deleteUserError;

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

app.patch("/admin/cms/questions/:id", requireAdmin, async (request: AdminRequest, response, next) => {
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

app.patch("/admin/cms/sections/:id", requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    const sectionId = String(request.params.id);
    const schema = z.object({
      summary: z.string(),
      format: z.string(),
      video_url: z.string().nullable().optional(),
      video_duration_seconds: z.coerce.number().optional()
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

app.get("/admin/reports/export", requireAdmin, async (request: AdminRequest, response, next) => {
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
    const csv = [
      header.join(","),
      ...(rows.length
        ? rows.map((row) => header.map((key) => JSON.stringify(String(row[key as keyof typeof row] ?? ""))).join(","))
        : ['"No records found for the selected filters."'])
    ].join("\n");
    response.setHeader("Content-Type", "text/csv");
    response.setHeader("Content-Disposition", `attachment; filename=${filename}.csv`);
    response.send(csv);
  } catch (error) {
    next(error);
  }
});

app.get("/certificate/verify/:code", rateLimit(30, 60_000), async (request, response, next) => {
  try {
    const code = String(request.params.code);
    const { data: certificate, error: certificateError } = await supabaseAdmin
      .from("certificates")
      .select("*")
      .eq("verification_code", code)
      .single();
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
      .select("full_name")
      .eq("id", certificate.user_id)
      .single();
    if (profileError) throw profileError;

    const payload = {
      verified: true,
      organizationName,
      certificate: {
        completionId: certificate.completion_id,
        verificationCode: certificate.verification_code,
        verificationUrl: `${appUrl}/certificate/verify/${certificate.verification_code}`,
        issuedAt: certificate.issued_at
      },
      driver: {
        fullName: profile.full_name ?? ""
      }
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
  eventType: "driver_created" | "induction_completed" | "induction_expiring";
  userEmail: string;
  driverName?: string;
  context: Record<string, string>;
}

async function sendNotificationService(params: NotificationParams) {
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
        return;
      }
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
    } catch (err: any) {
      throw new Error(`SMTP email dispatch failed: ${err.message}`);
    }
  } else {
    // SMTP credentials not configured — add SMTP_USER and SMTP_PASS to .env to enable email sending
    console.warn(`[EMAIL] SMTP credentials not set. Email NOT sent to ${userEmail}. Configure SMTP_USER and SMTP_PASS in .env`);
  }
}

app.post("/api/notifications/notify", rateLimit(20, 60_000), requireAdmin, async (request: AdminRequest, response, next) => {
  try {
    await sendNotificationService(request.body as NotificationParams);
    response.json({ message: "Notification processed." });
  } catch (error) {
    next(error);
  }
});



// --- Secure Driver Endpoints ---

app.get("/api/induction/quiz-questions", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("id, question, options, sort_order");
    
    if (error) throw error;

    // Server-side Fisher-Yates random shuffle of question bank
    const questions = [...(data ?? [])];
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    const mapped = questions.map((q) => ({
      id: q.sort_order || q.id,
      question: q.question,
      options: q.options,
      sort_order: q.sort_order,
      category: q.category ?? "General",
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

    const { data: current, error: progressError } = await supabaseAdmin
      .from("induction_progress")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (progressError) throw progressError;

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
      const { data: docs } = await supabaseAdmin.from("documents").select("type").eq("user_id", userId);
      const required = ["driver_license", "medical_certificate", "identity_proof"];
      const missing = required.filter(type => !docs?.some(doc => doc.type === type));
      if (missing.length > 0) {
        response.status(400).json({ message: `Upload all required documents before continuing. Missing: ${missing.join(", ")}.` });
        return;
      }
      // Documents are uploaded — admin can verify after driver finishes induction
      // We do NOT block on approval status here to allow induction to proceed
    }

    if (step === 3) {
      const sectionsPayload = (payload.sections as Array<{ sectionId: string; completed: boolean }> | undefined) ?? [];
      
      const { data: dbSections } = await supabaseAdmin.from("learning_sections").select("id");
      
      // Upsert completions securely from backend
      for (const sec of sectionsPayload) {
        if (sec.completed) {
          const sectionDef = dbSections?.find(s => s.id === sec.sectionId);
          if (sectionDef && (sectionDef.video_duration_seconds || 0) > 0) {
            const { data: dbComp } = await supabaseAdmin.from("learning_section_completions")
              .select("section_started_at, completed")
              .eq("user_id", userId)
              .eq("section_id", sec.sectionId)
              .maybeSingle();
              
            if (!dbComp?.completed) {
              if (!dbComp?.section_started_at) {
                response.status(400).json({ message: "Video section was not started properly." });
                return;
              }
              const started = new Date(dbComp.section_started_at).getTime();
              const now = Date.now();
              const elapsedSeconds = (now - started) / 1000;
              if (elapsedSeconds < sectionDef.video_duration_seconds! * 0.8) {
                response.status(400).json({ message: "Video watch requirement not met." });
                return;
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
       const accepted = Boolean(payload.accepted);
       const signature = String(payload.signature ?? "");
       if (!accepted || signature.trim().length < 2) {
         response.status(400).json({ message: "Please accept the declaration and add your signature." });
         return;
       }
       
       let signaturePath = signature;
       if (signature.startsWith("data:image/png;base64,")) {
         const base64Data = signature.replace(/^data:image\/png;base64,/, "");
         const buffer = Buffer.from(base64Data, "base64");
         const fileName = `${userId}/signature.png`;
         const { error: uploadError } = await supabaseAdmin.storage
           .from("identity-verification")
           .upload(fileName, buffer, { contentType: "image/png", upsert: true });
         if (uploadError) throw uploadError;
         signaturePath = fileName;
       }
       
       const selfieUrl = String(payload.selfieUrl ?? "").trim();
       const { data: selfieDoc } = await supabaseAdmin
         .from("documents")
         .select("id")
         .eq("user_id", userId)
         .eq("type", "identity_selfie")
         .maybeSingle();

       if (!selfieUrl && !selfieDoc) {
         response.status(400).json({ message: "Please capture an identity verification selfie before completing your declaration." });
         return;
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

    const { error } = await supabaseAdmin
      .from("learning_section_completions")
      .upsert({
        user_id: userId,
        section_id: sectionId,
        section_version: "1.0",
        section_started_at: new Date().toISOString()
      }, { onConflict: "user_id,section_id,section_version" });

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
      answers: z.record(z.coerce.number(), z.coerce.number())
    });
    const { answers } = schema.parse(request.body);

    const { data: current, error: progressError } = await supabaseAdmin
      .from("induction_progress")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (progressError || current.completed) {
      response.status(400).json({ message: "Induction is locked." });
      return;
    }

    const { data: questions, error } = await supabaseAdmin
      .from("quiz_questions")
      .select("id, correct_answer, sort_order, category, is_critical")
      .order("sort_order", { ascending: true });
    if (error) throw error;

    let correctCount = 0;
    let failedCritical = false;
    let criticalQuestionsAsked = 0;

    const categoryStats: Record<string, { total: number; correct: number }> = {};

    for (const q of questions ?? []) {
      const localId = q.sort_order || q.id;
      const driverAnswer = answers[localId];
      
      const category = q.category || "General";
      const isCritical = Boolean(q.is_critical);

      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, correct: 0 };
      }
      categoryStats[category].total += 1;

      if (isCritical) {
        criticalQuestionsAsked += 1;
      }

      if (driverAnswer === q.correct_answer) {
        correctCount += 1;
        categoryStats[category].correct += 1;
      } else {
        if (isCritical) {
          failedCritical = true;
        }
      }
    }

    const totalQuestions = Math.max(1, (questions ?? []).length);
    const score = Math.round((correctCount / totalQuestions) * 100);

    const categoryScores: Record<string, number> = {};
    for (const [cat, stats] of Object.entries(categoryStats)) {
      categoryScores[cat] = Math.round((stats.correct / Math.max(1, stats.total)) * 100);
    }

    // Milestone 2 Rule: Pass threshold is >= 70% AND zero critical question failures
    const passed = score >= 70 && !failedCritical;

    let failedCriticalReason: string | undefined;
    if (failedCritical) {
      failedCriticalReason = "You answered a critical safety question incorrectly. A 100% pass is required on all critical safety questions.";
    }

    const { data: attempts } = await supabaseAdmin.from("quiz_attempts").select("id").eq("user_id", userId);
    const attemptNumber = (attempts?.length ?? 0) + 1;

    await supabaseAdmin.from("quiz_attempts").insert({
      user_id: userId,
      score,
      passed,
      attempt_number: attemptNumber,
      answers,
      category_scores: categoryScores,
      failed_critical: failedCritical,
      critical_questions_asked: criticalQuestionsAsked
    });

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
      failedCriticalReason
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/induction/certificate", requireDriver, async (request: AdminRequest, response, next) => {
  try {
    const userId = request.authUserId!;
    
    const { data: progress } = await supabaseAdmin.from("induction_progress").select("*").eq("user_id", userId).single();
    if (!progress || ![1, 2, 3, 4, 5].every(step => progress.completed_step_ids?.includes(step))) {
      response.status(400).json({ message: "Complete all steps first." });
      return;
    }

    // Verify required documents were at least uploaded (approval is admin workflow, not a blocker)
    const { data: docs } = await supabaseAdmin.from("documents").select("type").eq("user_id", userId);
    const required = ["driver_license", "medical_certificate", "identity_proof"];
    const missing = required.filter(type => !docs?.some(doc => doc.type === type));
    if (missing.length > 0) {
      response.status(400).json({ message: "Required documents must be uploaded before a certificate can be issued." });
      return;
    }

    const currentVersionId = progress.induction_version_id ?? null;
    let existingQuery = supabaseAdmin.from("certificates").select("*").eq("user_id", userId);
    if (currentVersionId) {
      existingQuery = existingQuery.eq("induction_version_id", currentVersionId);
    }
    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      response.json({ message: "Certificate already generated for this version." });
      return;
    }

    const verificationCode = `VERIFY-${userId.slice(0, 8)}-${crypto.randomUUID().slice(0, 6)}`;
    const completionId = `COMP-${userId.slice(0, 8).toUpperCase()}`;
    const verificationUrl = `${appUrl}/certificate/verify/${verificationCode}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await supabaseAdmin.from("certificates").insert({
      user_id: userId,
      completion_id: completionId,
      verification_code: verificationCode,
      verification_url: verificationUrl,
      issued_at: issuedAt,
      expires_at: expiresAt.toISOString()
    });

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
    const { data: driverProfile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", userId).single();
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

    response.json({ message: "Certificate generated." });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  // Distinguish between validation errors (400) and unexpected crashes (500)
  const isClientError =
    error instanceof Error &&
    (error.message.includes("required") ||
      error.message.includes("invalid") ||
      error.message.includes("must") ||
      error.message.includes("already") ||
      error.message.includes("not found") ||
      error.message.includes("locked") ||
      error.message.includes("Upload") ||
      error.message.includes("Complete"));

  const statusCode = isClientError ? 400 : 500;

  // Sanitize Supabase internal messages in production
  let message = error instanceof Error ? error.message : "An unexpected server error occurred.";
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
        const { data: profile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", cert.user_id).single();
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
