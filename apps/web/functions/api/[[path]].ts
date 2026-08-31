import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_URL: string;
  ORGANIZATION_NAME: string;
  ORGANIZATION_LOGO_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const rawPath = (params.path as string[])?.join("/") || "";
  const cleanPath = rawPath.replace(/^api\//, "");
  const method = request.method;

  // Simple Router
  try {
    // Health Check
    if ((cleanPath === "health" || rawPath === "health") && method === "GET") {
      return jsonResponse({
        status: "ok",
        service: "driver-induction-api-functions",
        organizationName: env.ORGANIZATION_NAME,
        timestamp: new Date().toISOString()
      });
    }

    // --- Public Registration Route ---
    if (cleanPath === "auth/register-driver" && method === "POST") {
      if ((env as Record<string, string | undefined>).ALLOW_SELF_REGISTRATION !== "true") {
        return errorResponse("Self-registration is disabled. Ask your administrator to create your induction account.", 403);
      }
      return handleSelfRegisterDriver(request, env);
    }

    // --- Admin Routes ---
    if (cleanPath.startsWith("admin/")) {
      const adminId = await requireAdmin(request, env);
      if (!adminId) return errorResponse("Admin access required.", 401);

      // Create Driver
      if (cleanPath === "admin/drivers" && method === "POST") {
        return handleCreateDriver(request, env, adminId);
      }

      // Update Driver
      const driverMatch = cleanPath.match(/^admin\/drivers\/([^/]+)$/);
      if (driverMatch && method === "PUT") {
        return handleUpdateDriver(request, env, adminId, driverMatch[1]);
      }

      // Reset Password
      const pwResetMatch = cleanPath.match(/^admin\/drivers\/([^/]+)\/reset-password$/);
      if (pwResetMatch && method === "POST") {
        return handleResetPassword(request, env, adminId, pwResetMatch[1]);
      }

      // Reset Induction
      const inductionResetMatch = cleanPath.match(/^admin\/drivers\/([^/]+)\/reset-induction$/);
      if (inductionResetMatch && method === "POST") {
        return handleResetInduction(request, env, adminId, inductionResetMatch[1]);
      }

      // Delete Driver
      if (driverMatch && method === "DELETE") {
        return handleDeleteDriver(request, env, adminId, driverMatch[1]);
      }

      // Export Reports
      if (cleanPath === "admin/reports/export" && method === "GET") {
        return handleExportReports(url, env, adminId);
      }

      // Verification Queue — GET all pending documents
      if (cleanPath === "admin/verification-queue" && method === "GET") {
        return handleGetVerificationQueue(env, adminId);
      }

      // Approve / Reject a document
      const docVerifyMatch = cleanPath.match(/^admin\/documents\/([^/]+)\/verify$/);
      if (docVerifyMatch && method === "POST") {
        return handleVerifyDocument(request, env, adminId, docVerifyMatch[1]);
      }
    }

    // --- Public Routes ---

    // Verify Certificate
    const verifyMatch = cleanPath.match(/^certificate\/verify\/([^/]+)$/);
    if (verifyMatch && method === "GET") {
      return handleVerifyCertificate(verifyMatch[1], env, request);
    }

    // OCR is deliberately not exposed as a public service-role endpoint. Document
    // approval and expiry decisions must be made by an authorised compliance user.
    if ((cleanPath === "documents/verify" || rawPath === "api/documents/verify") && method === "POST") {
      return errorResponse("Document verification is performed by authorised compliance staff.", 403);
    }

    // Notifications can dispatch third-party email and therefore require admin auth.
    if ((cleanPath === "notifications/notify" || rawPath === "api/notifications/notify") && method === "POST") {
      const adminId = await requireAdmin(request, env);
      if (!adminId) return errorResponse("Admin access required.", 401);
      return handleNotify(request, env);
    }

    return errorResponse("Route not found: " + rawPath, 404);
  } catch (err: any) {
    console.error("API Error:", err);
    return errorResponse(err.message || "Internal Server Error", 500);
  }
};

// --- Helper Functions ---

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    }
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ message }, status);
}

const getSupabaseAdmin = (env: Env) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

async function requireAdmin(request: Request, env: Env) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length);
  const supabase = getSupabaseAdmin(env);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  return profile?.role === "admin" ? authData.user.id : null;
}

async function logAuditEntry(supabase: any, userId: string, action: string, metadata: any) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    metadata,
    created_at: new Date().toISOString()
  });
  // M-13 fix: log failures instead of silently swallowing them
  if (error) {
    console.error("[AUDIT] Failed to write audit log:", action, error.message);
  }
}

async function handleSelfRegisterDriver(request: Request, env: Env) {
  const supabase = getSupabaseAdmin(env);
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
  for (const [label, res] of [["profiles", profileRes], ["drivers", driverRes], ["induction_progress", progressRes]] as [string, PromiseSettledResult<any>][]) {
    if (res.status === "rejected") {
      insertErrors.push(`${label}: ${res.reason?.message ?? "unknown"}`);
    } else if (res.value?.error) {
      insertErrors.push(`${label}: ${res.value.error.message}`);
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

  await logAuditEntry(supabase, userId, "driver_self_registered", { email: emailLower, depotCode: payload.depotCode });
  return jsonResponse({ message: "Registration successful. You can now log in.", email: emailLower });
}

// --- Route Handlers ---


async function handleCreateDriver(request: Request, env: Env, adminId: string) {
  const supabase = getSupabaseAdmin(env);
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

  if (createError || !createdUser.user) throw createError || new Error("Account creation failed");

  const userId = createdUser.user.id;
  const now = new Date().toISOString();

  // C-5 FIX: Check errors from all Supabase inserts individually.
  // Supabase JS never throws — errors are returned as { data, error }.
  // An unchecked failure creates an orphaned auth user with no profile.
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

  // Collect any insert errors and roll back the auth user if any failed
  const insertErrors: string[] = [];
  for (const [label, res] of [["profiles", profileRes], ["drivers", driverRes], ["induction_progress", progressRes]] as [string, PromiseSettledResult<any>][]) {
    if (res.status === "rejected") {
      insertErrors.push(`${label}: ${res.reason?.message ?? "unknown error"}`);
    } else if (res.value?.error) {
      insertErrors.push(`${label}: ${res.value.error.message}`);
    }
  }

  if (insertErrors.length > 0) {
    // Roll back: delete the auth user to avoid orphaned account
    await supabase.auth.admin.deleteUser(userId).catch((e: any) =>
      console.error("[ROLLBACK] Failed to delete orphaned auth user:", e.message)
    );
    throw new Error(`Driver creation failed — DB inserts failed: ${insertErrors.join("; ")}`);
  }

  // Initial Sections
  const { data: sections } = await supabase.from("learning_sections").select("id");
  if (sections?.length) {
    await supabase.from("learning_section_completions").insert(
      sections.map(s => ({ user_id: userId, section_id: s.id, completed: false }))
    );
  }

  await logAuditEntry(supabase, adminId, "admin_driver_created", { driverId: userId, email: payload.email });

  return jsonResponse({ message: "Driver created", userId }, 201);
}

async function handleUpdateDriver(request: Request, env: Env, adminId: string, driverId: string) {
  const supabase = getSupabaseAdmin(env);

  // H-11 FIX: Validate input with Zod — raw unvalidated JSON was passed to admin APIs
  const updateSchema = z.object({
    email: z.string().email().optional(),
    fullName: z.string().min(2).optional(),
    phone: z.string().min(5).optional(),
    address: z.string().min(5).optional(),
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

  await logAuditEntry(supabase, adminId, "admin_driver_updated", { driverId, email: payload.email });
  return jsonResponse({ message: "Driver updated" });
}

async function handleResetPassword(request: Request, env: Env, adminId: string, driverId: string) {
  const supabase = getSupabaseAdmin(env);
  const { password } = await request.json() as any;
  await supabase.auth.admin.updateUserById(driverId, { password });
  await logAuditEntry(supabase, adminId, "admin_password_reset", { driverId });
  return jsonResponse({ message: "Password reset" });
}

async function handleResetInduction(request: Request, env: Env, adminId: string, driverId: string) {
  const supabase = getSupabaseAdmin(env);
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

  await logAuditEntry(supabase, adminId, "admin_induction_reset", { driverId });
  return jsonResponse({ message: "Induction reset complete" });
}

async function handleDeleteDriver(request: Request, env: Env, adminId: string, driverId: string) {
  const supabase = getSupabaseAdmin(env);

  // Cleanup
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

  await logAuditEntry(supabase, adminId, "admin_driver_deleted", { driverId });
  return jsonResponse({ message: "Driver deleted" });
}

async function handleExportReports(url: URL, env: Env, adminId: string) {
  const supabase = getSupabaseAdmin(env);
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

  await logAuditEntry(supabase, adminId, "admin_report_exported", { scope, format });

  const headers = Object.keys(data[0] || {});

  if (format === "pdf") {
    // Generate styled printable HTML report for PDF export in Cloudflare Worker environment
    const htmlReport = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${env.ORGANIZATION_NAME || "BNT Logistics"} ${scope.toUpperCase()} Report</title>
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
  <h1>${env.ORGANIZATION_NAME || "BNT Logistics"} — ${scope.toUpperCase()} Report</h1>
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

  // CSV export fallback
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

async function handleVerifyCertificate(code: string, env: Env, request: Request) {
  const supabase = getSupabaseAdmin(env);
  const { data: cert, error } = await supabase.from("certificates").select("*").eq("verification_code", code).single();

  if (error || !cert) {
    return errorResponse("Certificate not found", 404);
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", cert.user_id).single();

  return jsonResponse({
    verified: true,
    organizationName: env.ORGANIZATION_NAME,
    certificate: {
      completionId: cert.completion_id,
      verificationCode: cert.verification_code,
      issuedAt: cert.issued_at
    },
    driver: { fullName: profile?.full_name || "Unknown" }
  });
}

async function handleOCRVerify(request: Request, env: Env) {
  const { fileUrl, documentType, userId } = await request.json() as any;
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const supabase = getSupabaseAdmin(env);
  if (userId && fileUrl) {
    await supabase.from("documents").update({ expires_at: expiryDate.toISOString() })
      .eq("user_id", userId).eq("file_url", fileUrl);
  }

  return jsonResponse({
    message: "OCR processing mock success",
    data: { isValid: true, confidenceScore: 0.99, simulatedExpiry: expiryDate.toISOString() }
  });
}

async function handleNotify(request: Request, env: Env) {
  const payload = await request.json() as any;
  const { eventType, userEmail, driverName, context } = payload;

  console.log(`[NOTIFICATION] ${eventType} for ${userEmail}`);

  if (env.RESEND_API_KEY && userEmail) {
     try {
       await fetch("https://api.resend.com/emails", {
         method: "POST",
         headers: {
           "Authorization": `Bearer ${env.RESEND_API_KEY}`,
           "Content-Type": "application/json"
         },
         body: JSON.stringify({
           from: env.RESEND_FROM_EMAIL || "notifications@resend.dev",
           to: userEmail,
           subject: `${env.ORGANIZATION_NAME || "BNT Logistics"} Notification: ${eventType}`,
           html: `<p>Hello ${driverName || "Driver"},</p><p>Event: <strong>${eventType}</strong></p><p>${context || ""}</p>`
         })
       });
       console.log(`[NOTIFICATION] Resend email dispatched to ${userEmail}`);
     } catch (e) {
       console.error("[NOTIFICATION] Resend dispatch error:", e);
     }
  }

  return jsonResponse({ message: "Notification dispatched" });
}

// --- Verification Queue Handlers ---

async function handleGetVerificationQueue(env: Env, adminId: string) {
  const supabase = getSupabaseAdmin(env);

  // Fetch all pending documents with driver profile info
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

async function handleVerifyDocument(request: Request, env: Env, adminId: string, docId: string) {
  const supabase = getSupabaseAdmin(env);
  const { action } = await request.json() as { action: "approve" | "reject" };

  if (action !== "approve" && action !== "reject") {
    return errorResponse("Action must be 'approve' or 'reject'.", 400);
  }

  // Fetch the document to get the driver's user_id
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("user_id, type")
    .eq("id", docId)
    .single();
  if (docError || !doc) return errorResponse("Document not found.", 404);

  const driverId = doc.user_id;

  // Update document status
  const { error: updateError } = await supabase
    .from("documents")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      verified_by_admin: action === "approve"
    })
    .eq("id", docId);
  if (updateError) throw updateError;

  // If approved: check if ALL documents for this driver are now approved
  if (action === "approve") {
    const { data: allDocs } = await supabase
      .from("documents")
      .select("status")
      .eq("user_id", driverId);

    const requiredTypes = ["driver_license", "medical_certificate", "identity_proof"];
    const { data: driverDocs } = await supabase
      .from("documents")
      .select("type, status")
      .eq("user_id", driverId);

    const allApproved =
      requiredTypes.every((type) =>
        (driverDocs ?? []).some((d: any) => d.type === type && d.status === "approved")
      );

    if (allApproved) {
      // Advance driver to step 2 — TRAINING UNLOCKED
      const { data: progress } = await supabase
        .from("induction_progress")
        .select("completed_step_ids, current_step")
        .eq("user_id", driverId)
        .single();

      const completedSteps: number[] = progress?.completed_step_ids ?? [];
      if (!completedSteps.includes(1)) completedSteps.push(1);

      // H-12 FIX: Check errors from progress advance DB calls — silent failures
      // leave the driver perpetually stuck in the system with no way to progress.
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

  await logAuditEntry(supabase, adminId, `admin_document_${action}d`, {
    docId,
    driverId,
    documentType: doc.type
  });

  return jsonResponse({
    message: `Document ${action === "approve" ? "approved" : "rejected"} successfully.`
  });
}
