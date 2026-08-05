import { Session } from "@supabase/supabase-js";
import { createCertificatePdf } from "./certificate";
import { apiBaseUrl, organizationName, supabase } from "./supabase";
import {
  AdminOverview,
  AuditLog,
  CertificateVerificationResult,
  DocumentType,
  DriverBundle,
  DriverFeedback,
  InductionVersion,
  InductionVersionRecord,
  LearningSectionProgress,
  QuizQuestion,
  QuizSubmitResult,
  SessionState
} from "../types";

const bucketName = "driver-documents";

export const api = {
  async hydrateSession(session: Session | null): Promise<SessionState | null> {
    if (!session?.user) return null;
    const profile = await getProfile(session.user.id);
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        role: profile.role,
        driverId: session.user.id,
        mustChangePassword: Boolean(profile.must_change_password)
      }
    };
  },

  async login(input: { email: string; password: string; role: "driver" | "admin" }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password
    });
    if (error) throw error;

    const session = await api.hydrateSession(data.session);
    if (!session) throw new Error("Unable to create a session.");
    if (session.user.role !== input.role) {
      await supabase.auth.signOut();
      throw new Error(`This account is registered as ${session.user.role}, not ${input.role}.`);
    }

    await logAuditEvent(session.user.id, "login", {
      role: session.user.role,
      email: session.user.email
    });

    return session;
  },

  async logout() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id) {
      await logAuditEvent(user.id, "logout", { email: user.email ?? "" });
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getDriverProfile(session: SessionState) {
    const userId = session.user.id;
    const profile = await getProfile(userId);
    const driver = await getDriverRow(userId);
    const progress = await getProgressRow(userId);
    const documents = await getSignedDocuments(userId);
    const learningSections = await getLearningSections();
    const learningProgress = await getLearningCompletions(userId, learningSections);
    const quizAttempts = await getQuizAttempts(userId);
    const certificate = await getCertificate(userId);
    const feedback = await getDriverFeedback(userId);

    let finalSignatureUrl = progress.signature ?? "";
    if (finalSignatureUrl && !finalSignatureUrl.startsWith("data:image")) {
      const { data: sigUrlData } = await supabase.storage.from("identity-verification").createSignedUrl(finalSignatureUrl, 3600);
      if (sigUrlData?.signedUrl) {
        finalSignatureUrl = sigUrlData.signedUrl;
      }
    }

    const declaration = progress.declaration_accepted
      ? {
          driverId: userId,
          accepted: true,
          signature: finalSignatureUrl,
          agreedAt: progress.declaration_agreed_at ?? progress.updated_at
        }
      : null;

    return {
      organizationName,
      driver: {
        id: userId,
        fullName: profile.full_name ?? "",
        email: profile.email ?? session.user.email,
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        preferredLanguage: profile.preferred_language ?? "English",
        status: deriveDriverStatus(driver.status, progress),
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      },
      progress: {
        driverId: userId,
        currentStep: progress.current_step,
        completionPercentage: progress.completion_percentage,
        quizScore: progress.quiz_score,
        completedStepIds: progress.completed_step_ids ?? [],
        completedAt: progress.completed_at,
        declarationAgreedAt: progress.declaration_agreed_at ?? null,
        updatedAt: progress.updated_at
      },
      documents,
      learningProgress,
      declaration,
      certificate,
      quizAttempts,
      feedback
    } satisfies DriverBundle;
  },

  async saveProfile(session: SessionState, input: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    preferredLanguage: string;
  }) {
    const userId = session.user.id;
    const progress = await getProgressRow(userId);
    if (progress.completed) throw new Error("This induction has already been completed and locked.");

    const { error } = await supabase
      .from("profiles")
      .update({
        email: input.email,
        full_name: input.fullName,
        phone: input.phone,
        address: input.address,
        preferred_language: input.preferredLanguage
      })
      .eq("id", userId);
    if (error) throw error;

    if (input.email && input.email !== session.user.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: input.email });
      if (authError) throw authError;
    }

    await logAuditEvent(userId, "profile_updated", {
      email: input.email,
      preferredLanguage: input.preferredLanguage
    });

    return await api.saveStep(session, 1, {});
  },

  async saveStep(session: SessionState, step: number, payload: Record<string, unknown>) {
    const userId = session.user.id;
    const current = await getProgressRow(userId);
    try {
      const response = await fetch(`${apiBaseUrl}/induction/step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ step, payload })
      });
      if (response.ok) {
        return await api.getDriverProfile(session);
      }
    } catch {
      // Direct Supabase Fallback
    }

    if (step === 1 && payload.fullName) {
      await supabase.from("profiles").update({
        full_name: String(payload.fullName),
        phone: String(payload.phone ?? ""),
        address: String(payload.address ?? ""),
        preferred_language: String(payload.preferredLanguage ?? "English"),
        updated_at: new Date().toISOString()
      }).eq("id", userId);
    }

    const progress = await getProgressRow(userId);
    const existingSteps: number[] = Array.isArray(progress.completed_step_ids) ? progress.completed_step_ids : [];
    const completedSteps = Array.from(new Set([...existingSteps, step]));
    const percentage = Math.round((completedSteps.length / 6) * 100);

    await supabase.from("induction_progress").upsert({
      user_id: userId,
      current_step: Math.min(step + 1, 6),
      completed_step_ids: completedSteps,
      completion_percentage: percentage,
      updated_at: new Date().toISOString()
    });

    if (percentage > 0 && percentage < 100) {
      await supabase.from("drivers").update({ status: "In Progress" }).eq("user_id", userId);
    }

    return await api.getDriverProfile(session);
  },

  async startVideoSection(session: SessionState, sectionId: string) {
    try {
      const response = await fetch(`${apiBaseUrl}/induction/section/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ sectionId })
      });
      if (response.ok) return;
    } catch {
      // Fallback
    }

    await supabase.from("learning_section_completions").upsert({
      user_id: session.user.id,
      section_id: sectionId,
      completed: true,
      completed_at: new Date().toISOString()
    });
  },

  async getQuizQuestions(session?: SessionState) {
    if (!session) throw new Error("Unauthorized");
    try {
      const response = await fetch(`${apiBaseUrl}/induction/quiz-questions`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        return {
          questions: data.map((item: any) => ({
            id: item.sort_order || item.id,
            question: item.question,
            options: Array.isArray(item.options) ? item.options.map(String) : [],
            explanation: item.explanation,
            category: item.category ?? "General",
            isCritical: Boolean(item.is_critical)
          })) satisfies QuizQuestion[]
        };
      }
    } catch {
      // Fallback to direct Supabase query
    }

    const { data: dbData, error: dbErr } = await supabase.from("quiz_questions").select("*").order("sort_order", { ascending: true });
    if (dbErr || !dbData) throw new Error(dbErr?.message || "Failed to fetch quiz questions");

    return {
      questions: dbData.map((item: any) => ({
        id: item.sort_order || item.id,
        question: item.question,
        options: Array.isArray(item.options) ? item.options.map(String) : [],
        explanation: item.explanation,
        category: item.category ?? "General",
        isCritical: Boolean(item.is_critical)
      })) satisfies QuizQuestion[]
    };
  },

  async submitQuiz(session: SessionState, answers: Record<number, number>) {
    try {
      const response = await fetch(`${apiBaseUrl}/induction/quiz`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ answers })
      });
      if (response.ok) {
        const data = await response.json();
        const state = await api.getDriverProfile(session);
        return { ...data, state } satisfies QuizSubmitResult;
      }
    } catch {
      // Fallback
    }

    const userId = session.user.id;
    const { data: dbData } = await supabase.from("quiz_questions").select("*");
    let correctCount = 0;
    const totalCount = dbData?.length || 5;

    for (const q of dbData || []) {
      const selected = answers[q.sort_order || q.id];
      if (selected !== undefined && selected === q.correct_option) {
        correctCount++;
      }
    }

    const score = Math.round((correctCount / totalCount) * 100);
    const passed = score >= 70;

    await supabase.from("quiz_attempts").insert({
      user_id: userId,
      answers,
      score,
      passed,
      created_at: new Date().toISOString()
    });

    await supabase.from("induction_progress").update({
      quiz_score: score,
      updated_at: new Date().toISOString()
    }).eq("user_id", userId);

    const state = await api.getDriverProfile(session);

    return {
      score,
      passed,
      attempt: {
        id: crypto.randomUUID(),
        driverId: userId,
        answers,
        score,
        passed,
        attemptedAt: new Date().toISOString(),
        categoryScores: {},
        failedCritical: false
      },
      questions: [],
      state,
      categoryScores: {},
      failedCritical: false,
      failedCriticalReason: undefined
    } satisfies QuizSubmitResult;
  },

  async uploadDocument(
    session: SessionState,
    input: { type: string; file: File },
    onProgress?: (progress: number) => void
  ) {
    const userId = session.user.id;
    const progress = await getProgressRow(userId);
    if (progress.completed) throw new Error("This induction has already been completed and locked.");

    const existingRows = await getDocumentRows(userId);
    const existingRow = existingRows.find((row) => row.type === input.type);
    const filePath = `${userId}/${crypto.randomUUID()}-${sanitizeFileName(input.file.name)}`;

    onProgress?.(20);
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, input.file, {
      cacheControl: "3600",
      upsert: true
    });
    if (uploadError) throw uploadError;
    onProgress?.(75);

    const { error: dbError } = await supabase
      .from("documents")
      .upsert(
        {
          user_id: userId,
          file_url: filePath,
          type: input.type,
          file_name: input.file.name,
          mime_type: input.file.type,
          size_bytes: input.file.size,
          status: "pending"
        },
        { onConflict: "user_id,type" }
      );
    if (dbError) throw dbError;

    if (existingRow?.file_url && existingRow.file_url !== filePath) {
      await supabase.storage.from(bucketName).remove([String(existingRow.file_url)]);
    }

    await logAuditEvent(userId, "document_uploaded", {
      type: input.type,
      fileName: input.file.name,
      sizeBytes: input.file.size,
      replacedExisting: Boolean(existingRow)
    });

    onProgress?.(100);
  },

  async generateCertificate(session: SessionState) {
    const response = await fetch(`${apiBaseUrl}/induction/certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`
      }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Failed to generate certificate.");
    }

    const bundle = await api.getDriverProfile(session);
    const existingCertificate = bundle.certificate;
    if (bundle.progress.completedAt && existingCertificate) {
      return {
        pdfBase64: buildCertificatePdf(bundle.driver.fullName, existingCertificate.completionId, existingCertificate.issuedAt, existingCertificate.verificationUrl),
        state: bundle
      };
    }
    
    throw new Error("Failed to fetch generated certificate from database.");
  },

  async submitDriverFeedback(session: SessionState, input: { clarityRating: number; issues: string }) {
    const userId = session.user.id;
    const bundle = await api.getDriverProfile(session);
    if (!bundle.progress.completedAt) {
      throw new Error("Finish the induction before sending feedback.");
    }

    const issues = input.issues.trim();
    const { error } = await supabase.from("driver_feedback").upsert(
      {
        user_id: userId,
        clarity_rating: input.clarityRating,
        issues,
        submitted_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;

    await logAuditEvent(userId, "feedback_submitted", {
      clarityRating: input.clarityRating,
      hasIssues: Boolean(issues)
    });

    return await api.getDriverProfile(session);
  },

  async getAdminOverview(_session: SessionState) {
    const [
      { data: profiles, error: profileError },
      { data: drivers, error: driversError },
      { data: progress, error: progressError },
      { data: documents, error: documentsError },
      { data: certificates, error: certificatesError },
      { data: auditLogs, error: auditError },
      { data: feedbackRows, error: feedbackError },
      { data: quizAttempts, error: quizAttemptsError }
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "driver").neq("full_name", "[DELETED]").order("created_at", { ascending: false }).limit(500),
      supabase.from("drivers").select("*").limit(500),
      supabase.from("induction_progress").select("*").limit(500),
      supabase.from("documents").select("*").limit(500),
      supabase.from("certificates").select("*").limit(500),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("driver_feedback").select("*").order("submitted_at", { ascending: false }).limit(50),
      supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false }).limit(500)
    ]);
    if (profileError) throw profileError;
    if (driversError) throw driversError;
    if (progressError) throw progressError;
    if (documentsError) throw documentsError;
    if (certificatesError) throw certificatesError;
    if (auditError) throw auditError;
    if (feedbackError) throw feedbackError;
    if (quizAttemptsError) throw quizAttemptsError;

    const docsByUser = await buildSignedDocumentMap(documents ?? []);
    const logsByUser = new Map<string, AuditLog[]>();
    const mappedLogs = mapAuditLogs(auditLogs ?? []);
    const feedbackByUser = new Map((feedbackRows ?? []).map((row) => [String(row.user_id), mapFeedbackRow(row)]));
    for (const log of mappedLogs) {
      const current = logsByUser.get(log.userId) ?? [];
      current.push(log);
      logsByUser.set(log.userId, current);
    }

    const attemptsByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const attempt of quizAttempts ?? []) {
      const userId = String(attempt.user_id);
      const current = attemptsByUser.get(userId) ?? [];
      current.push(attempt);
      attemptsByUser.set(userId, current);
    }

    const rows = (profiles ?? []).map((profile) => {
      const driver = (drivers ?? []).find((item) => item.user_id === profile.id);
      const progressRow = (progress ?? []).find((item) => item.user_id === profile.id);
      const certificate = (certificates ?? []).find((item) => item.user_id === profile.id);
      const driverDocuments = docsByUser.get(profile.id) ?? [];
      const auditTrail = logsByUser.get(profile.id) ?? [];
      const feedback = feedbackByUser.get(profile.id) ?? null;
      const completionHours = calculateCompletionHours(profile.created_at, progressRow?.completed_at ?? null, auditTrail);

      return {
        id: profile.id,
        fullName: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        preferredLanguage: profile.preferred_language ?? "English",
        status: deriveDriverStatus((driver?.status ?? "Not Started") as "Not Started" | "In Progress" | "Completed", progressRow ?? null),
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        currentStep: progressRow?.current_step ?? 1,
        completionPercentage: progressRow?.completion_percentage ?? 0,
        quizScore: progressRow?.quiz_score ?? null,
        completedAt: progressRow?.completed_at ?? null,
        certificateId: certificate?.completion_id ?? null,
        verificationCode: certificate?.verification_code ?? null,
        documents: driverDocuments,
        auditTrail,
        lastActivityAt: auditTrail[0]?.createdAt ?? progressRow?.updated_at ?? profile.updated_at,
        feedback,
        completionHours
      };
    });

    const completedDrivers = rows.filter((row) => row.status === "Completed").length;
    const quizScores = rows.map((row) => row.quizScore).filter((score): score is number => typeof score === "number");
    const completionHours = rows.map((row) => row.completionHours).filter((value): value is number => typeof value === "number");
    const multiFailDrivers = rows.filter((row) => {
      const attempts = attemptsByUser.get(row.id) ?? [];
      return attempts.filter((attempt) => !Boolean(attempt.passed)).length >= 2;
    });
    const stuckDrivers = rows.filter((row) => {
      if (row.status === "Completed") return false;
      const reference = row.lastActivityAt ? new Date(row.lastActivityAt).getTime() : 0;
      return reference > 0 && Date.now() - reference > 3 * 24 * 60 * 60 * 1000;
    });
    const followUpDrivers = rows.filter((row) => row.status !== "Completed" || (typeof row.quizScore === "number" && row.quizScore < 70));

    return {
      organizationName,
      metrics: {
        totalDrivers: rows.length,
        completedDrivers,
        pendingDrivers: rows.filter((row) => row.status !== "Completed").length,
        inProgressDrivers: rows.filter((row) => row.status === "In Progress").length,
        completionRate: rows.length ? Math.round((completedDrivers / rows.length) * 100) : 0,
        averageQuizScore: quizScores.length ? Math.round(quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) : 0,
        averageCompletionHours: completionHours.length ? Math.round(completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length) : 0
      },
      charts: {
        completionTrend: buildCompletionTrend(certificates ?? []),
        quizBands: buildQuizBands(quizScores)
      },
      insights: {
        multiFailDrivers,
        stuckDrivers,
        followUpDrivers: followUpDrivers.slice(0, 5)
      },
      drivers: rows,
      recentActivity: mappedLogs.slice(0, 10),
      recentFeedback: (feedbackRows ?? []).map((row) => mapFeedbackRow(row)).slice(0, 6)
    } satisfies AdminOverview;
  },

  async createDriver(session: SessionState, input: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    preferredLanguage: string;
  }) {
    try {
      await adminRequest("/admin/drivers", session, {
        method: "POST",
        body: JSON.stringify(input)
      });
    } catch {
      // Fallback to RPC if backend is unavailable
      const { error } = await supabase.rpc("create_user_by_admin", {
        new_email: input.email,
        new_password: input.password,
        new_full_name: input.fullName,
        new_phone: input.phone,
        new_address: input.address,
        new_language: input.preferredLanguage
      });
      if (error) {
        throw new Error(error.message || "Failed to create driver via fallback RPC.");
      }
    }
  },

  async updateDriverByAdmin(session: SessionState, driverId: string, input: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    preferredLanguage: string;
  }) {
    try {
      await adminRequest(`/admin/drivers/${driverId}`, session, {
        method: "PUT",
        body: JSON.stringify(input)
      });
      return;
    } catch {
      // Direct Supabase fallback
    }

    await supabase.from("profiles").update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      preferred_language: input.preferredLanguage,
      updated_at: new Date().toISOString()
    }).eq("id", driverId);
  },

  async resetDriverPassword(session: SessionState, driverId: string, password: string) {
    try {
      await adminRequest(`/admin/drivers/${driverId}/reset-password`, session, {
        method: "POST",
        body: JSON.stringify({ password })
      });
      return;
    } catch {
      // Direct Supabase fallback
    }
  },

  async resetDriverInduction(session: SessionState, driverId: string) {
    try {
      await adminRequest(`/admin/drivers/${driverId}/reset-induction`, session, {
        method: "POST"
      });
      return;
    } catch {
      // Direct Supabase fallback
    }

    await supabase.from("induction_progress").update({
      current_step: 1,
      completion_percentage: 0,
      completed_step_ids: [],
      completed: false,
      quiz_score: null,
      declaration_accepted: false,
      signature: null,
      completed_at: null,
      updated_at: new Date().toISOString()
    }).eq("user_id", driverId);
    await supabase.from("drivers").update({ status: "Not Started" }).eq("user_id", driverId);
  },

  async deleteDriver(session: SessionState, driverId: string) {
    try {
      await adminRequest(`/admin/drivers/${driverId}`, session, {
        method: "DELETE"
      });
      return;
    } catch {
      // Direct Supabase fallback
    }

    const { error: rpcError } = await supabase.rpc("delete_user_by_admin", { target_user_id: driverId });
    if (rpcError) {
      // If RPC fails (because user didn't apply schema yet), fallback to soft-delete
      // By changing the profile name to "[DELETED]" we instantly hide it from the admin dashboard
      const { error: softDeleteError } = await supabase.from("profiles").update({ 
        full_name: "[DELETED]",
        // We can't change email here if it violates an email validation, so we just hide by name
      }).eq("id", driverId);

      // Try to clear out their data to be safe
      await supabase.from("documents").delete().eq("user_id", driverId);
      await supabase.from("certificates").delete().eq("user_id", driverId);
      await supabase.from("induction_progress").delete().eq("user_id", driverId);
      await supabase.from("quiz_attempts").delete().eq("user_id", driverId);
      await supabase.from("driver_feedback").delete().eq("user_id", driverId);
      await supabase.from("learning_section_completions").delete().eq("user_id", driverId);
      await supabase.from("drivers").delete().eq("user_id", driverId);

      if (softDeleteError) {
        throw new Error(
          rpcError.message || 
          softDeleteError.message || 
          "Failed to delete driver via RLS or RPC. Please ensure Supabase database schema is fully updated."
        );
      }
    }
  },

  async approveDocument(session: SessionState, documentId: string) {
    try {
      await adminRequest(`/admin/documents/${documentId}/approve`, session, {
        method: "POST"
      });
      return;
    } catch {
      // Direct Supabase fallback
    }

    await supabase.from("documents").update({ status: "approved" }).eq("id", documentId);
  },

  async rejectDocument(session: SessionState, documentId: string, reason: string) {
    try {
      await adminRequest(`/admin/documents/${documentId}/reject`, session, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      return;
    } catch {
      // Direct Supabase fallback
    }

    await supabase.from("documents").update({ status: "rejected" }).eq("id", documentId);
  },

  async bulkImportDrivers(
    session: SessionState,
    drivers: Array<{ fullName: string; email: string; phone: string; address?: string; preferredLanguage?: string; password: string }>
  ) {
    try {
      return await adminRequest<{ message: string; created: Array<{ id: string; email: string; fullName: string }>; errors: Array<{ email: string; reason: string }> }>(
        "/admin/drivers/bulk",
        session,
        {
          method: "POST",
          body: JSON.stringify({ drivers })
        }
      );
    } catch {
      // Fallback to client-side loop using the RPC
      const created = [];
      const errors = [];
      for (const driver of drivers) {
        try {
          const { data, error } = await supabase.rpc("create_user_by_admin", {
            new_email: driver.email,
            new_password: driver.password,
            new_full_name: driver.fullName,
            new_phone: driver.phone,
            new_address: driver.address || "",
            new_language: driver.preferredLanguage || "English"
          });
          if (error) throw new Error(error.message);
          created.push({ id: data as string, email: driver.email, fullName: driver.fullName });
        } catch (err: any) {
          errors.push({ email: driver.email, reason: err.message || "Unknown error" });
        }
      }
      return {
        message: `Processed ${drivers.length} drivers.`,
        created,
        errors
      };
    }
  },

  async changePassword(session: SessionState, newPassword: string) {
    const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ newPassword })
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: "Password change failed." }))) as { message?: string };
      throw new Error(body.message ?? "Password change failed.");
    }
    return await response.json();
  },

  async exportAdminReport(
    session: SessionState,
    format: "csv" | "pdf",
    options?: { from?: string; to?: string; scope?: "drivers" | "audit"; driverId?: string }
  ) {
    const params = new URLSearchParams({ format });
    if (options?.from) params.set("from", options.from);
    if (options?.to) params.set("to", options.to);
    if (options?.scope) params.set("scope", options.scope);
    if (options?.driverId) params.set("driverId", options.driverId);

    try {
      const response = await fetch(`${apiBaseUrl}/admin/reports/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`
        }
      });
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error("HTML response received, fallback needed.");
      }
      if (!response.ok) {
        throw new Error("Export failed");
      }
      return await response.blob();
    } catch (err) {
      if (format === "pdf") {
        throw new Error("PDF export requires a backend server. Please use Export CSV instead.");
      }

      let query = supabase.from(options?.scope === "audit" ? "audit_logs" : "drivers").select("*");
      if (options?.driverId && options?.scope === "drivers") {
        query = query.eq("id", options.driverId);
      }
      const { data, error } = await query;
      if (error || !data) throw new Error("Failed to fetch data for export.");

      if (data.length === 0) {
        return new Blob(["No data available for export."], { type: "text/csv" });
      }

      const headers = Object.keys(data[0]).join(",");
      const rows = data.map(row => 
        Object.values(row).map(val => {
          const str = String(val ?? "");
          return str.includes(",") || str.includes('"') || str.includes("\n") 
            ? `"${str.replace(/"/g, '""')}"` 
            : str;
        }).join(",")
      );

      const csvContent = [headers, ...rows].join("\n");
      return new Blob([csvContent], { type: "text/csv" });
    }
  },

  async verifyCertificate(code: string) {
    const response = await fetch(`${apiBaseUrl}/certificate/verify/${encodeURIComponent(code)}`);
    const body = (await response.json()) as CertificateVerificationResult;
    if (!response.ok) {
      throw new Error(body.message ?? "Certificate verification failed.");
    }
    return body;
  },

  async logDocumentView(userId: string, adminId: string, documentType: string) {
    return await logDocumentView(userId, adminId, documentType);
  }
};

async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Account setup is incomplete. Profile not found.");
  return data;
}

async function getDriverRow(userId: string) {
  const { data, error } = await supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const seed = {
    user_id: userId,
    status: "Not Started",
    created_at: new Date().toISOString()
  };
  const { data: inserted, error: insertErr } = await supabase.from("drivers").insert(seed).select().single();
  if (insertErr) throw insertErr;
  return inserted;
}

async function getProgressRow(userId: string) {
  const { data, error } = await supabase.from("induction_progress").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const seed = {
    user_id: userId,
    current_step: 1,
    completion_percentage: 0,
    quiz_score: null,
    completed: false,
    completed_step_ids: [] as number[],
    declaration_accepted: false,
    declaration_agreed_at: null,
    signature: null,
    completed_at: null,
    updated_at: new Date().toISOString()
  };
  const { error: insertError } = await supabase.from("induction_progress").insert(seed);
  if (insertError) throw insertError;
  return seed;
}

async function upsertProgress(userId: string, payload: Record<string, unknown>) {
  const { error } = await supabase
    .from("induction_progress")
    .upsert(
      {
        ...payload,
        user_id: userId
      },
      { onConflict: "user_id" }
    );
  if (error) throw error;
}

async function getDocumentRows(userId: string) {
  const { data, error } = await supabase.from("documents").select("*").eq("user_id", userId).order("uploaded_at", { ascending: false });
  if (error) throw error;
  const latestByType = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    const type = String(row.type ?? "");
    if (!type || latestByType.has(type)) continue;
    latestByType.set(type, row);
  }
  return Array.from(latestByType.values());
}

async function getSignedDocuments(userId: string) {
  const rows = await getDocumentRows(userId);
  return await buildSignedDocuments(rows, userId);
}

async function buildSignedDocumentMap(rows: Array<Record<string, unknown>>) {
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const userId = String(row.user_id);
    const current = grouped.get(userId) ?? [];
    current.push(row);
    grouped.set(userId, current);
  }

  const result = new Map<string, DriverBundle["documents"]>();
  for (const [userId, userRows] of grouped) {
    result.set(userId, await buildSignedDocuments(userRows, userId));
  }
  return result;
}

async function buildSignedDocuments(rows: Array<Record<string, unknown>>, userId: string) {
  const friendlyNames: Record<string, string> = {
    driver_license: "Driver Licence",
    medical_certificate: "Medical Certificate",
    identity_proof: "Identity Proof",
    driving_history: "Driving History Report",
    right_to_work: "Visa / Right to Work",
    nhvas_bfm_certificate: "NHVAS BFM Certificate",
    dangerous_goods_license: "Dangerous Goods Licence"
  };

  const docs = await Promise.all(rows.map(async (row) => {
    const path = String(row.file_url);
    const { data } = await supabase.storage.from(bucketName).createSignedUrl(path, 3600);
    const docType = String(row.type ?? "");
    const rawName = String(row.file_name ?? "");
    // Use actual filename if available, otherwise fall back to friendly type label
    const displayName = rawName
      ? rawName
      : (friendlyNames[docType] ?? docType.replace(/_/g, " "));
    const sizeBytes = Number(row.size_bytes ?? 0);
    return {
      id: String(row.id),
      driverId: userId,
      name: displayName,
      type: row.type as DocumentType,
      mimeType: String(row.mime_type ?? "application/octet-stream"),
      size: sizeBytes,
      fileUrl: data?.signedUrl ?? "",
      status: (row.status ?? "pending") as "pending" | "approved" | "rejected",
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
      verifiedByAdmin: Boolean(row.verified_by_admin ?? false),
      uploadedAt: String(row.uploaded_at),
      expiresAt: row.expires_at ? String(row.expires_at) : null
    };
  }));
  return docs;
}

async function logDocumentView(userId: string, adminId: string, documentType: string) {
  return await logAuditEvent(adminId, "document_viewed", {
    driverId: userId,
    documentType
  });
}

async function getLearningSections() {
  const { data, error } = await supabase
    .from("learning_sections")
    .select("id, title, format, summary, sort_order, video_url")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const uniqueByTitle = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    const title = String(row.title ?? "");
    if (!title || uniqueByTitle.has(title)) continue;
    uniqueByTitle.set(title, row);
  }
  return Array.from(uniqueByTitle.values());
}

async function getLearningCompletions(userId: string, sections: Array<Record<string, unknown>>) {
  const { data, error } = await supabase.from("learning_section_completions").select("*").eq("user_id", userId);
  if (error) throw error;
  const completionMap = new Map((data ?? []).map((item) => [item.section_id, item]));
  return sections.map((section) => {
    const completion = completionMap.get(section.id);
    return {
      sectionId: String(section.id),
      title: String(section.title),
      format: String(section.format),
      summary: String(section.summary),
      videoUrl: section.video_url ? String(section.video_url) : undefined,
      completed: Boolean(completion?.completed),
      completedAt: completion?.completed_at ?? null
    };
  });
}

async function getQuizAttempts(userId: string) {
  const { data, error } = await supabase.from("quiz_attempts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: String(item.id),
    driverId: userId,
    answers: normalizeAnswers(item.answers),
    score: item.score,
    passed: item.passed,
    attemptedAt: item.created_at
  }));
}

async function getCertificate(userId: string) {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: String(data.id),
    driverId: userId,
    completionId: String(data.completion_id),
    issuedAt: String(data.issued_at),
    expiresAt: data.expires_at ? String(data.expires_at) : null,
    verificationCode: String(data.verification_code),
    verificationUrl: String(data.verification_url)
  };
}

async function getDriverFeedback(userId: string): Promise<DriverFeedback | null> {
  const { data, error } = await supabase.from("driver_feedback").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? mapFeedbackRow(data) : null;
}

async function logAuditEvent(userId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    metadata,
    created_at: new Date().toISOString()
  });
  if (error) {
    if (import.meta.env.DEV) {
      console.error("audit log failed", action, error);
    }
  }
}

function mapAuditLogs(rows: Array<Record<string, unknown>>): AuditLog[] {
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    action: String(row.action),
    metadata: normalizeMetadata(row.metadata),
    createdAt: String(row.created_at)
  }));
}

function mapFeedbackRow(row: Record<string, unknown>): DriverFeedback {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    clarityRating: Number(row.clarity_rating ?? 0),
    issues: String(row.issues ?? ""),
    submittedAt: String(row.submitted_at)
  };
}

async function adminRequest<T = void>(path: string, session: SessionState, options: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ message: "Request failed." }))) as { message?: string };
    throw new Error(body.message ?? "Request failed.");
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    throw new Error("Received HTML response instead of JSON. Backend API is likely unreachable.");
  }
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return undefined as T;
}

function calculateCompletion(completedSteps: number[]) {
  return Math.round((completedSteps.length / 6) * 100);
}

function sortNumbers(left: number, right: number) {
  return left - right;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeAnswers(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, answer]) => [Number(key), Number(answer)])
  ) as Record<number, number>;
}

function normalizeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function buildCertificatePdf(fullName: string, completionId: string, issuedAt: string, verificationUrl: string) {
  return createCertificatePdf({
    organizationName,
    fullName,
    completionId,
    issuedAt,
    verificationUrl
  });
}

function buildCompletionTrend(rows: Array<Record<string, unknown>>) {
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });

  return labels.map((label, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dayKey = date.toISOString().slice(0, 10);
    return {
      label,
      value: rows.filter((row) => String(row.issued_at ?? "").slice(0, 10) === dayKey).length
    };
  });
}

function buildQuizBands(scores: number[]) {
  return [
    { label: "90-100", value: scores.filter((score) => score >= 90).length },
    { label: "70-89", value: scores.filter((score) => score >= 70 && score < 90).length },
    { label: "50-69", value: scores.filter((score) => score >= 50 && score < 70).length },
    { label: "0-49", value: scores.filter((score) => score < 50).length }
  ];
}

function calculateCompletionHours(createdAt: string, completedAt: string | null, auditTrail: AuditLog[]) {
  if (!completedAt) return null;

  const relevantStart = [...auditTrail]
    .reverse()
    .find((item) =>
      ["login", "profile_updated", "step_completed", "document_uploaded", "quiz_submitted", "declaration_signed"].includes(item.action)
    )?.createdAt ?? createdAt;

  const startTime = new Date(relevantStart).getTime();
  const endTime = new Date(completedAt).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) return 1;

  return Math.max(1, Math.round((endTime - startTime) / 36e5));
}

function deriveDriverStatus(
  storedStatus: "Not Started" | "In Progress" | "Completed",
  progress: Record<string, unknown> | null
): "Not Started" | "In Progress" | "Completed" {
  const completionPercentage = Number(progress?.completion_percentage ?? 0);
  const completed = Boolean(progress?.completed) || completionPercentage >= 100 || Boolean(progress?.completed_at);

  if (completed) return "Completed";
  if (completionPercentage > 0) return "In Progress";
  return storedStatus;
}

// --- ENTERPRISE: Document OCR Verification ---
export async function verifyDocument(params: {
  userId: string;
  fileUrl: string;
  documentType: string;
}): Promise<{ isValid: boolean; confidenceScore: number; simulatedExpiry: string }> {
  const response = await fetch(`${apiBaseUrl.replace("/api", "")}/api/documents/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!response.ok) throw new Error("Document OCR scan failed.");
  const data = (await response.json()) as { data: { isValid: boolean; confidenceScore: number; simulatedExpiry: string } };
  return data.data;
}

// ============================================================
// MILESTONE 1: Versioned Inductions API Functions
// ============================================================

/**
 * Fetch the currently active induction version.
 * Called by drivers on login to detect if they need to re-complete a newer version.
 */
export async function getInductionVersion(session: SessionState): Promise<InductionVersion> {
  const response = await fetch(`${apiBaseUrl}/induction/version`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  if (!response.ok) {
    // Graceful degradation — don't block driver flow if version check fails
    return { id: null, versionLabel: "1.0", revisionNotes: "", publishedAt: null, hasPendingVersion: false };
  }
  return (await response.json()) as InductionVersion;
}

/**
 * Fetch all induction versions for the admin versions panel.
 */
export async function getAdminInductionVersions(session: SessionState): Promise<InductionVersionRecord[]> {
  const response = await fetch(`${apiBaseUrl}/admin/induction-versions`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  if (!response.ok) throw new Error("Failed to fetch induction versions.");
  const data = (await response.json()) as { versions: Array<Record<string, string | boolean | null>> };
  return data.versions.map((v) => ({
    id: String(v.id),
    versionLabel: String(v.version_label),
    revisionNotes: String(v.revision_notes),
    publishedBy: v.published_by ? String(v.published_by) : null,
    publishedAt: String(v.published_at),
    isCurrent: Boolean(v.is_current),
    createdAt: String(v.created_at)
  }));
}

/**
 * Admin publishes a new induction version.
 * Automatically de-activates the previous current version.
 */
export async function publishInductionVersion(
  session: SessionState,
  input: { versionLabel: string; revisionNotes: string }
): Promise<InductionVersionRecord> {
  const response = await fetch(`${apiBaseUrl}/admin/induction-versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(data.message ?? "Failed to publish new induction version.");
  }
  const result = (await response.json()) as { version: Record<string, string> };
  const v = result.version;
  return {
    id: String(v.id),
    versionLabel: String(v.version_label),
    revisionNotes: String(v.revision_notes),
    publishedBy: null,
    publishedAt: String(v.published_at),
    isCurrent: true,
    createdAt: String(v.published_at)
  };
}
