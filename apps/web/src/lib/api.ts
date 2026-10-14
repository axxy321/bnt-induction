import { Session } from "@supabase/supabase-js";
import { createCertificatePdf } from "./certificate";
import { apiBaseUrl, organizationName, supabase, supabaseUrl, supabaseAnonKey } from "./supabase";
import {
  AdminOverview,
  AdminAuditAssignmentRow,
  AuditAssignment,
  AuditAssignmentStatus,
  AuditLog,
  BrandingSettings,
  CertificateRecord,
  CertificateVerificationResult,
  ComplianceAuditRecord,
  ContractorCompanyRecord,
  DriverVerificationResult,
  DocumentType,
  DriverBundle,
  DriverFeedback,
  DriverSelfRegisterInput,
  InductionVersion,
  InductionVersionRecord,
  InductionScheduleInvitation,
  InductionCourse,
  InductionSchedule,
  InductionScheduleEnrollment,
  InductionScheduleItem,
  InductionSlide,
  SlideQuestion,
  LearningSectionProgress,
  PolicyListItem,
  PolicyRecord,
  PolicySignatureSummary,
  PolicyPendingDriver,
  QuizQuestion,
  QuizSubmitResult,
  ReportsOverview,
  AttemptedInductionReport,
  CertificateStatusReport,
  ExpiringCertificateReport,
  ExpiringDocumentReport,
  DocumentApprovalReport,
  ScheduledStatusReport,
  SafetyIncidentRecord,
  PreTripInspectionRecord,
  SessionState,
  SiteCheckinRecord,
  SOPItem,
  VehiclePassVerificationResult,
  VehicleRecord
} from "../types";

console.log("[API] SUPABASE_URL:", supabaseUrl);

const bucketName = "driver-documents";

export const api = {
  async hydrateSession(session: Session | null): Promise<SessionState | null> {
    if (!session?.user) return null;
    let profile = await getProfile(session.user.id).catch(() => null);
    if (!profile) {
      const derivedRole = (session.user.user_metadata?.role as "driver" | "admin" | undefined) ?? (session.user.email?.includes("admin") ? "admin" : "driver");
      const fullName = session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User";
      try {
        await supabase.from("profiles").upsert({
          id: session.user.id,
          email: session.user.email || "",
          full_name: fullName,
          role: derivedRole,
          updated_at: new Date().toISOString()
        });
        profile = await getProfile(session.user.id).catch(() => null);
      } catch {}
    }
    const role = profile?.role ?? (session.user.email?.includes("admin") ? "admin" : "driver");
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: {
        id: session.user.id,
        email: session.user.email ?? "",
        role,
        driverId: session.user.id,
        mustChangePassword: Boolean(profile?.must_change_password)
      }
    };
  },

  async login(input: { email: string; password: string; role: "driver" | "admin" }) {
    const cleanEmail = input.email.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: input.password
    });

    if (error || !data?.session) {
      throw new Error(error?.message || "Invalid email or password. Please verify your credentials.");
    }

    const session = await api.hydrateSession(data.session);
    if (!session) throw new Error("Unable to create a session. Please contact your administrator.");

    // Auto-align role if user selected admin tab or has admin email
    if (session.user.role !== input.role) {
      if (cleanEmail.includes("admin") || session.user.role === "admin") {
        session.user.role = "admin";
      } else if (input.role === "admin" && !cleanEmail.includes("admin")) {
        await supabase.auth.signOut();
        throw new Error(`Account ${cleanEmail} is registered as a Driver, not a Compliance Manager.`);
      }
    }

    await logAuditEvent(session.user.id, "login", {
      role: session.user.role,
      email: session.user.email
    }).catch(() => {});

    return session;
  },

  async logout() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user?.id) {
      await logAuditEvent(user.id, "logout", { email: user.email ?? "" });
    }

    await supabase.auth.signOut().catch(() => {});
  },

  async getDriverProfile(session: SessionState) {
    const userId = session.user.id;

    const profile = await getProfile(userId).catch(() => null);

    const driver = await getDriverRow(userId).catch(() => ({
      id: userId,
      user_id: userId,
      status: "Not Started",
      created_at: new Date().toISOString()
    }));

    const progress = await getProgressRow(userId).catch(() => ({
      driverId: userId,
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
    }));

    const documents = await getSignedDocuments(userId).catch(() => []);
    const learningSections = await getLearningSections().catch(() => []);
    const learningProgress = await getLearningCompletions(userId, learningSections).catch(() => []);
    const quizAttempts = await getQuizAttempts(userId).catch(() => []);
    const certificate = await getCertificate(userId).catch(() => null);
    const feedback = await getDriverFeedback(userId).catch(() => null);

    let finalSignatureUrl = progress.signature ?? "";
    if (finalSignatureUrl && !finalSignatureUrl.startsWith("data:image")) {
      try {
        const { data: sigUrlData } = await supabase.storage.from("identity-verification").createSignedUrl(finalSignatureUrl, 3600);
        if (sigUrlData?.signedUrl) {
          finalSignatureUrl = sigUrlData.signedUrl;
        }
      } catch {}
    }

    const declaration = progress.declaration_accepted
      ? {
          driverId: userId,
          accepted: true,
          signature: finalSignatureUrl,
          agreedAt: progress.declaration_agreed_at ?? progress.updated_at
        }
      : null;

    let savedDriverMeta: any = null;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(`bnt-driver-meta-${userId}`) : null;
      if (raw) savedDriverMeta = JSON.parse(raw);
    } catch {}

    const bundleLicenceClass = profile?.licence_class || savedDriverMeta?.licenceClass || "HC";
    const bundleIssuingState = profile?.issuing_state || savedDriverMeta?.issuingState || "VIC";
    const bundleLicenceNumber = profile?.licence_number || savedDriverMeta?.licenceNumber || "";
    const bundleDepotLocation = profile?.depot_location || savedDriverMeta?.depotLocation || "Melbourne Hub";

    return {
      organizationName,
      driver: {
        id: userId,
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? session.user.email,
        phone: profile?.phone ?? "",
        address: profile?.address ?? "",
        preferredLanguage: profile?.preferred_language ?? "English",
        licenceClass: bundleLicenceClass,
        issuingState: bundleIssuingState,
        licenceNumber: bundleLicenceNumber,
        depotLocation: bundleDepotLocation,
        status: deriveDriverStatus(driver.status, progress),
        createdAt: profile?.created_at ?? new Date().toISOString(),
        updatedAt: profile?.updated_at ?? new Date().toISOString()
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

  async checkLicenceUnique(licenceNumber: string, issuingState: string, excludeUserId?: string) {
    if (!licenceNumber || !issuingState) return { unique: true };
    try {
      const trimmed = licenceNumber.trim().toUpperCase();
      if (!trimmed) return { unique: true };

      let query = supabase
        .from("profiles")
        .select("id, full_name, licence_number, issuing_state")
        .eq("licence_number", trimmed)
        .eq("issuing_state", issuingState)
        .limit(1);

      if (excludeUserId) {
        query = query.neq("id", excludeUserId);
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Licence uniqueness check warning:", error);
        return { unique: true };
      }

      return { unique: !(data && data.length > 0) };
    } catch (e) {
      console.warn("Licence uniqueness check failed:", e);
      return { unique: true };
    }
  },

  async saveProfile(session: SessionState, input: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    preferredLanguage: string;
    licenceClass?: string;
    issuingState?: string;
    licenceNumber?: string;
    depotLocation?: string;
  }) {
    const userId = session.user.id;
    try {
      const progress = await getProgressRow(userId);
      if (progress?.completed) throw new Error("This induction has already been completed and locked.");
    } catch (e: any) {
      if (e?.message?.includes("completed")) throw e;
    }

    try {
      const fullProfilePayload = {
        id: userId,
        email: input.email,
        full_name: input.fullName,
        phone: input.phone,
        address: input.address,
        preferred_language: input.preferredLanguage,
        licence_class: input.licenceClass ?? "HC",
        issuing_state: input.issuingState ?? "VIC",
        licence_number: input.licenceNumber ?? "",
        depot_location: input.depotLocation ?? "Melbourne Hub",
        role: "driver"
      };

      const { error: fullUpsertErr } = await supabase
        .from("profiles")
        .upsert(fullProfilePayload);

      if (fullUpsertErr) {
        // Fall back to base columns that always exist in schema
        await supabase
          .from("profiles")
          .upsert({
            id: userId,
            email: input.email,
            full_name: input.fullName,
            phone: input.phone,
            address: input.address,
            preferred_language: input.preferredLanguage,
            role: "driver"
          });
      }
    } catch (e) {
      console.warn("Profiles update warning:", e);
    }

    if (input.email && input.email !== session.user.email) {
      try {
        await supabase.auth.updateUser({ email: input.email });
      } catch (authErr) {
        console.warn("Auth email update warning:", authErr);
      }
    }

    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`bnt-driver-meta-${userId}`, JSON.stringify(input));
      }
    } catch {}

    await logAuditEvent(userId, "profile_updated", {
      email: input.email,
      preferredLanguage: input.preferredLanguage
    }).catch(() => {});

    return await api.saveStep(session, 1, input);
  },

  async saveStep(session: SessionState, step: number, payload: Record<string, unknown>) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/induction/step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ step, payload })
      });
    } catch {
      throw new Error("Unable to save induction progress. Check your connection and try again.");
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Induction progress was not accepted.");
    }
    return await api.getDriverProfile(session);
  },

  async startVideoSection(session: SessionState, sectionId: string) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/induction/section/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ sectionId })
      });
    } catch {
      throw new Error("Unable to record the module start. Check your connection and try again.");
    }
    if (!response.ok) throw new Error("Unable to record the module start.");
  },

  async getQuizQuestions(session?: SessionState) {
    if (!session) throw new Error("Unauthorized");

    try {
      const response = await fetch(`${apiBaseUrl}/induction/quiz-questions`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          return {
            questions: data.map((item: any) => ({
              id: item.id,
              question: item.question,
              options: Array.isArray(item.options) ? item.options.map(String) : [],
              explanation: item.explanation,
              category: item.category ?? "General",
              isCritical: Boolean(item.is_critical)
            })) satisfies QuizQuestion[]
          };
        }
      }
    } catch (e) {
      console.warn("Quiz questions API route notice, using direct Supabase query:", e);
    }

    // Direct Supabase fallback
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("id, question, options, explanation, category, is_critical, sort_order")
      .order("sort_order", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return {
        questions: data.map((item: any) => ({
          id: item.id,
          question: item.question,
          options: Array.isArray(item.options) ? item.options.map(String) : [],
          explanation: item.explanation,
          category: item.category ?? "General",
          isCritical: Boolean(item.is_critical)
        })) satisfies QuizQuestion[]
      };
    }

    throw new Error("Unable to load the knowledge check questions. Check your connection and try again.");
  },

  async submitQuiz(session: SessionState, answers: Record<string | number, number>) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    };

    // Grading always happens on the server so the answer key never
    // reaches the browser. If the API is unreachable we fail closed
    // instead of grading locally.
    const response = await fetch(`${apiBaseUrl}/induction/quiz`, {
      method: "POST",
      headers,
      body: JSON.stringify({ answers })
    });

    if (!response.ok) {
      let message = "Quiz submission failed. Please try again.";
      let retryAt: string | undefined;
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
        if (data?.retryAt) retryAt = data.retryAt;
      } catch {}
      const error = new Error(message);
      (error as any).retryAt = retryAt;
      throw error;
    }

    const data = await response.json();
    const state = await api.getDriverProfile(session);
    return { ...data, state } satisfies QuizSubmitResult;
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
    let finalPath = filePath;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, input.file, {
      cacheControl: "3600",
      upsert: true
    });
    if (uploadError) {
      // Re-throw so the caller's retry UI is triggered. Swallowing this would
      // create a dangling DB row pointing at a non-existent storage object.
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    onProgress?.(75);

    if (existingRow?.id) {
        const { error: dbError } = await supabase
          .from("documents")
          .update({
            file_url: finalPath,
            file_name: input.file.name,
            mime_type: input.file.type || "application/octet-stream",
            size_bytes: input.file.size,
            status: "pending"
          })
          .eq("id", existingRow.id);
        if (dbError) throw new Error(`Document record update failed: ${dbError.message}`);
      } else {
        const { error: dbError } = await supabase
          .from("documents")
          .insert({
            user_id: userId,
            file_url: finalPath,
            type: input.type,
            file_name: input.file.name,
            mime_type: input.file.type || "application/octet-stream",
            size_bytes: input.file.size,
            status: "pending"
          });
        if (dbError) throw new Error(`Document record insert failed: ${dbError.message}`);
      }

    // Always record local storage fallback document
    const localDocsKey = `bnt-documents-${userId}`;
    const localDocsRaw = window.localStorage.getItem(localDocsKey);
    const localDocs: any[] = localDocsRaw ? JSON.parse(localDocsRaw) : [];
    const newDoc = {
      id: crypto.randomUUID(),
      user_id: userId,
      type: input.type,
      file_url: finalPath,
      file_name: input.file.name,
      mime_type: input.file.type,
      size_bytes: input.file.size,
      status: "pending",
      uploaded_at: new Date().toISOString()
    };
    const updatedDocs = [...localDocs.filter((d: any) => d.type !== input.type), newDoc];
    window.localStorage.setItem(localDocsKey, JSON.stringify(updatedDocs));

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
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://driver-induction-platform.vercel.app";
    let serverCertificate: any = null;

    try {
      const response = await fetch(`${apiBaseUrl}/induction/certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        serverCertificate = data?.certificate ?? null;
      }
    } catch (err) {
      console.warn("Certificate endpoint notice:", err);
    }

    const bundle = await api.getDriverProfile(session);
    let cert = bundle.certificate;

    if (!cert && serverCertificate) {
      cert = {
        id: "",
        driverId: session.user.id,
        completionId: String(serverCertificate.completionId ?? ""),
        issuedAt: String(serverCertificate.issuedAt ?? new Date().toISOString()),
        expiresAt: serverCertificate.expiresAt
          ? String(serverCertificate.expiresAt)
          : null,
        verificationCode: String(serverCertificate.verificationCode ?? ""),
        verificationUrl: String(serverCertificate.verificationUrl ?? "")
      };
    }

    if (!cert) {
      const { data: certRow } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", session.user.id)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (certRow) {
        cert = {
          id: certRow.id || "",
          driverId: certRow.user_id,
          completionId: certRow.completion_id,
          issuedAt: certRow.issued_at,
          expiresAt: certRow.expires_at,
          verificationCode: certRow.verification_code,
          verificationUrl: certRow.verification_url
        };
      }
    }

    if (!cert) {
      throw new Error("Unable to issue the certificate. Please ensure all mandatory documents are submitted.");
    }

    // Normalize verificationUrl to replace localhost with active origin
    const rawVerifyUrl = cert.verificationUrl || `${origin}/certificate/verify/${cert.verificationCode}`;
    const cleanVerifyUrl = rawVerifyUrl.replace(/https?:\/\/localhost(:\d+)?/, origin);
    cert.verificationUrl = cleanVerifyUrl;

    const pdfBase64 = await buildCertificatePdf(
      bundle.driver.fullName || "Driver",
      cert.completionId,
      cert.issuedAt,
      cleanVerifyUrl,
      bundle.driver.licenceClass,
      bundle.driver.issuingState,
      bundle.driver.depotLocation
    );

    return {
      pdfBase64,
      state: { ...bundle, certificate: cert }
    };
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
    const fetchSafe = async (queryPromise: PromiseLike<any>) => {
      try {
        const { data, error } = (await queryPromise) as any;
        if (error) {
          console.warn("Supabase overview fetch warning:", error?.message);
          return [];
        }
        return data ?? [];
      } catch {
        return [];
      }
    };

    const [
      profilesRes,
      driversRes,
      progressRes,
      documentsRes,
      certificatesRes,
      auditLogsRes,
      feedbackRowsRes,
      quizAttemptsRes
    ] = await Promise.all([
      fetchSafe(supabase.from("profiles").select("*").eq("role", "driver").neq("full_name", "[DELETED]").order("created_at", { ascending: false }).limit(500)),
      fetchSafe(supabase.from("drivers").select("*").limit(500)),
      fetchSafe(supabase.from("induction_progress").select("*").limit(500)),
      fetchSafe(supabase.from("documents").select("*").limit(500)),
      fetchSafe(supabase.from("certificates").select("*").limit(500)),
      fetchSafe(supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)),
      fetchSafe(supabase.from("driver_feedback").select("*").order("submitted_at", { ascending: false }).limit(50)),
      fetchSafe(supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false }).limit(500))
    ]);

    const profiles: any[] = profilesRes;
    const drivers: any[] = driversRes;
    const progress: any[] = progressRes;
    const documents: any[] = documentsRes;
    const certificates: any[] = certificatesRes;
    const auditLogs: any[] = auditLogsRes;
    const feedbackRows: any[] = feedbackRowsRes;
    const quizAttempts: any[] = quizAttemptsRes;

    const docsByUser = await buildSignedDocumentMap(documents);
    const logsByUser = new Map<string, AuditLog[]>();
    const mappedLogs = mapAuditLogs(auditLogs);
    const feedbackByUser = new Map(feedbackRows.map((row: any) => [String(row.user_id), mapFeedbackRow(row)]));
    for (const log of mappedLogs) {
      const current = logsByUser.get(log.userId) ?? [];
      current.push(log);
      logsByUser.set(log.userId, current);
    }

    const attemptsByUser = new Map<string, Array<Record<string, unknown>>>();
    for (const attempt of quizAttempts) {
      const userId = String(attempt.user_id);
      const current = attemptsByUser.get(userId) ?? [];
      current.push(attempt);
      attemptsByUser.set(userId, current);
    }


    const rows = profiles.map((profile: any) => {
      const driver = drivers.find((item: any) => item.user_id === profile.id);
      const progressRow = progress.find((item: any) => item.user_id === profile.id);
      const certificate = certificates.find((item: any) => item.user_id === profile.id);
      const driverDocuments = docsByUser.get(profile.id) ?? [];
      const auditTrail = logsByUser.get(profile.id) ?? [];
      const feedback = feedbackByUser.get(profile.id) ?? null;
      const completionHours = calculateCompletionHours(profile.created_at, progressRow?.completed_at ?? null, auditTrail);

      let savedMeta: any = null;
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(`bnt-driver-meta-${profile.id}`) : null;
        if (raw) savedMeta = JSON.parse(raw);
      } catch {}

      const hasLicenceDoc = driverDocuments.some((d: any) => d.type === "driver_license");
      const licenceClass = profile.licence_class || savedMeta?.licenceClass || (hasLicenceDoc ? "HC" : (profile.full_name ? "HC" : ""));
      const issuingState = profile.issuing_state || savedMeta?.issuingState || (licenceClass ? (savedMeta?.issuingState || "VIC") : "");
      const licenceNumber = profile.licence_number || savedMeta?.licenceNumber || "";
      const depotLocation = profile.depot_location || savedMeta?.depotLocation || (profile.full_name ? "Melbourne Hub" : "");

      return {
        id: profile.id,
        fullName: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        address: profile.address ?? "",
        preferredLanguage: profile.preferred_language ?? "English",
        licenceClass,
        issuingState,
        licenceNumber,
        depotLocation,
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
        completionHours,
        archivedAt: profile.archived_at ?? null
      };
    });

    const realRows = rows;
    const completedDrivers = realRows.filter((row: any) => row.status === "Completed").length;
    const quizScores = realRows.map((row: any) => row.quizScore).filter((score: any): score is number => typeof score === "number");
    const completionHours = realRows.map((row: any) => row.completionHours).filter((value: any): value is number => typeof value === "number");
    const multiFailDrivers = realRows.filter((row: any) => {
      const attempts = attemptsByUser.get(row.id) ?? [];
      return attempts.filter((attempt: any) => !Boolean(attempt.passed)).length >= 2;
    });
    const stuckDrivers = realRows.filter((row: any) => {
      if (row.status === "Completed") return false;
      const reference = row.lastActivityAt ? new Date(row.lastActivityAt).getTime() : 0;
      return reference > 0 && Date.now() - reference > 3 * 24 * 60 * 60 * 1000;
    });
    const followUpDrivers = realRows.filter((row: any) => row.status !== "Completed" || (typeof row.quizScore === "number" && row.quizScore < 70));

    return {
      organizationName,
      metrics: {
        totalDrivers: realRows.length,
        completedDrivers,
        pendingDrivers: realRows.filter((row: any) => row.status !== "Completed").length,
        inProgressDrivers: realRows.filter((row: any) => row.status === "In Progress").length,
        completionRate: realRows.length ? Math.round((completedDrivers / realRows.length) * 100) : 0,
        averageQuizScore: quizScores.length ? Math.round(quizScores.reduce((sum: number, score: number) => sum + score, 0) / quizScores.length) : 0,
        averageCompletionHours: completionHours.length ? Math.round(completionHours.reduce((sum: number, value: number) => sum + value, 0) / completionHours.length) : 0,
        certificateRate: realRows.length ? Math.round((realRows.filter((row: any) => row.certificateId).length / realRows.length) * 100) : 0,
        certificateCount: realRows.filter((row: any) => row.certificateId).length,
        licenceRate: realRows.length ? Math.round((realRows.filter((row: any) => row.documents?.some((doc: any) => doc.type === "driver_license")).length / realRows.length) * 100) : 0,
        licenceCount: realRows.filter((row: any) => row.documents?.some((doc: any) => doc.type === "driver_license")).length
      },
      charts: {
        completionTrend: buildCompletionTrend(certificates),
        quizBands: buildQuizBands(quizScores)
      },
      insights: {
        multiFailDrivers,
        stuckDrivers,
        followUpDrivers: followUpDrivers.slice(0, 5)
      },
      drivers: rows,
      recentActivity: mappedLogs.slice(0, 10),
      recentFeedback: feedbackRows.map((row: any) => mapFeedbackRow(row)).slice(0, 6)
    } satisfies AdminOverview;
  },


  async registerDriver(input: DriverSelfRegisterInput) {
    const response = await fetch(`${apiBaseUrl}/auth/register-driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.message ?? "Self-registration failed.");
    }
    return body as { message: string; email: string };
  },

  async requestPasswordHelp(email: string) {
    const response = await fetch(`${apiBaseUrl}/auth/password-reset-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const body = await response.json().catch(() => ({ message: "Unable to submit the request right now." }));
    if (!response.ok) throw new Error(body.message || "Unable to submit the request right now.");
    return body as { message: string };
  },

  async createDriver(session: SessionState, input: {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    preferredLanguage: string;
    licenceClass?: string;
    issuingState?: string;
    licenceNumber?: string;
    depotLocation?: string;
  }) {
    try {
      const result = await adminRequest<{ emailSent?: boolean; message?: string }>("/admin/drivers", session, {
        method: "POST",
        body: JSON.stringify(input)
      });
      return { emailSent: Boolean(result?.emailSent), message: result?.message };
    } catch {
      // 1. Try RPC if available
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("create_user_by_admin", {
          new_email: input.email,
          new_password: input.password,
          new_full_name: input.fullName,
          new_phone: input.phone,
          new_address: input.address,
          new_language: input.preferredLanguage
        });
        if (!rpcErr && rpcRes) {
          try {
            if (typeof window !== "undefined") {
              localStorage.setItem(`bnt-driver-meta-${rpcRes}`, JSON.stringify(input));
            }
          } catch {}
          return { emailSent: false, message: "Driver created, but the welcome email could not be sent because the API email service was unavailable." };
        }
      } catch {}

      // 2. Direct Supabase Auth & DB fallback for client-only / Vercel hosting
      const { createClient } = await import("@supabase/supabase-js");
      const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const cleanEmail = input.email.trim();
      const cleanName = input.fullName.trim();

      const { data: authData, error: authErr } = await tempAuthClient.auth.signUp({
        email: cleanEmail,
        password: input.password,
        options: {
          data: {
            role: "driver",
            full_name: cleanName,
            licenceClass: input.licenceClass || "HC",
            issuingState: input.issuingState || "VIC",
            licenceNumber: input.licenceNumber || "",
            depotLocation: input.depotLocation || "Melbourne Hub"
          }
        }
      });

      let userId = authData.user?.id;

      if (!userId && authErr) {
        // If user is already registered in Auth, lookup existing profile ID
        if (authErr.message.toLowerCase().includes("already registered") || authErr.message.toLowerCase().includes("already exists")) {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", cleanEmail)
            .maybeSingle();

          if (existingProfile?.id) {
            userId = existingProfile.id;
          }
        }

        if (!userId) {
          if (authErr.message.toLowerCase().includes("rate limit")) {
            throw new Error("Supabase email rate limit reached. Please wait 60 seconds before creating another driver account.");
          }
          throw new Error(authErr.message || "Failed to create driver account.");
        }
      }

      if (!userId) {
        throw new Error("Unable to create or locate driver user ID.");
      }

      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(`bnt-driver-meta-${userId}`, JSON.stringify(input));
        }
      } catch {}

      // Upsert profile as authenticated Admin
      await supabase.from("profiles").upsert({
        id: userId,
        email: cleanEmail,
        full_name: cleanName,
        phone: input.phone || "",
        address: input.address || "",
        preferred_language: input.preferredLanguage || "English",
        role: "driver",
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

      // Upsert drivers table entry
      await supabase.from("drivers").upsert({
        user_id: userId,
        status: "Not Started"
      }, { onConflict: "user_id" });

      // Upsert induction progress entry
      await supabase.from("induction_progress").upsert({
        user_id: userId,
        current_step: 1,
        completion_percentage: 0,
        completed_step_ids: [],
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      return { emailSent: false, message: "Driver created, but the welcome email was not sent. Configure an email provider on the API server." };
    }
  },

  async updateDriverByAdmin(session: SessionState, driverId: string, input: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    preferredLanguage: string;
    licenceClass?: string;
    issuingState?: string;
    licenceNumber?: string;
    depotLocation?: string;
  }) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`bnt-driver-meta-${driverId}`, JSON.stringify(input));
      }
    } catch {}

    try {
      await adminRequest(`/admin/drivers/${driverId}`, session, {
        method: "PUT",
        body: JSON.stringify(input)
      });
      return;
    } catch {
      // Direct Supabase fallback
    }

    const fullPayload: Record<string, any> = {
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      preferred_language: input.preferredLanguage,
      updated_at: new Date().toISOString()
    };
    if (input.licenceClass) fullPayload.licence_class = input.licenceClass;
    if (input.issuingState) fullPayload.issuing_state = input.issuingState;
    if (input.licenceNumber) fullPayload.licence_number = input.licenceNumber;
    if (input.depotLocation) fullPayload.depot_location = input.depotLocation;

    const { error: fullUpdateErr } = await supabase.from("profiles").update(fullPayload).eq("id", driverId);
    if (fullUpdateErr) {
      // Fallback to base columns
      await supabase.from("profiles").update({
        full_name: input.fullName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        preferred_language: input.preferredLanguage,
        updated_at: new Date().toISOString()
      }).eq("id", driverId);
    }
  },

  async resetDriverPassword(session: SessionState, driverId: string, password: string) {
    return await adminRequest<{ emailSent: boolean; message: string }>(`/admin/drivers/${driverId}/reset-password`, session, {
      method: "POST",
      body: JSON.stringify({ password })
    });
  },

  async getPasswordHelpRequests(session: SessionState) {
    return await adminRequest<Array<{
      id: string;
      email: string;
      status: "pending" | "handled";
      created_at: string;
      handled_at: string | null;
      driver: { full_name: string | null; phone: string | null } | null;
    }>>("/admin/password-reset-requests", session, { method: "GET" });
  },

  async markPasswordHelpRequestHandled(session: SessionState, requestId: string) {
    return await adminRequest<{ message: string }>(`/admin/password-reset-requests/${requestId}/handled`, session, {
      method: "POST"
    });
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
      declaration_agreed_at: null, // M-8 FIX: clear stale legal consent timestamp
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

      // H-6 FIX: Fetch and delete storage files before deleting DB rows.
      // Previously, documents were deleted from the DB but storage files were never removed,
      // permanently leaking every driver's uploaded files (licence images, etc.).
      const { data: docsToDelete } = await supabase
        .from("documents")
        .select("file_url")
        .eq("user_id", driverId);
      if (docsToDelete?.length) {
        await supabase.storage
          .from("driver-documents")
          .remove(docsToDelete.map((d) => d.file_url));
      }

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

  async changePassword(session: SessionState, newPassword: string, currentPassword?: string) {
    const response = await fetch(`${apiBaseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
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
    const cleanCode = code.trim();
    try {
      const response = await fetch(`${apiBaseUrl}/certificate/verify/${encodeURIComponent(cleanCode)}`);
      if (response.ok) {
        const body = await response.json();
        return {
          valid: true,
          verified: true,
          driverName: body.driverName || body.driver?.fullName || "Certified Heavy Vehicle Driver",
          driver: body.driver || { fullName: body.driverName || "Certified Heavy Vehicle Driver" },
          certificateId: body.certificateId || cleanCode,
          verificationCode: body.verificationCode || cleanCode,
          issuedAt: body.issuedAt || new Date().toISOString(),
          expiresAt: body.expiresAt || new Date(Date.now() + 365 * 864e5).toISOString(),
          licenceClass: body.licenceClass || "HC",
          issuingState: body.issuingState || "VIC",
          depotLocation: body.depotLocation || "Melbourne Hub"
        };
      }
    } catch {
      // Fallback to direct Supabase query if Express API is offline
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);
      const orFilter = isUuid
        ? `completion_id.eq.${cleanCode},verification_code.eq.${cleanCode},id.eq.${cleanCode}`
        : `completion_id.eq.${cleanCode},verification_code.eq.${cleanCode}`;

      // Search certificates table in Supabase
      const { data: cert } = await supabase
        .from("certificates")
        .select("*")
        .or(orFilter)
        .maybeSingle();

      if (cert) {
        let fullName = "Certified Heavy Vehicle Driver";
        let licenceClass = "HC";
        let issuingState = "VIC";
        let depotLocation = "Melbourne Hub";

        if (cert.user_id) {
          const { data: driverProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", cert.user_id)
            .maybeSingle();
          if (driverProfile) {
            fullName = driverProfile.full_name || fullName;
            licenceClass = (driverProfile as any).licence_class || licenceClass;
            issuingState = (driverProfile as any).issuing_state || issuingState;
            depotLocation = (driverProfile as any).depot_location || depotLocation;
          }
        }

        return {
          valid: true,
          verified: true,
          driverName: fullName,
          driver: { fullName },
          certificateId: cert.completion_id || cleanCode,
          verificationCode: cert.verification_code || cleanCode,
          issuedAt: cert.issued_at || cert.created_at || new Date().toISOString(),
          expiresAt: cert.expires_at || new Date(Date.now() + 365 * 864e5).toISOString(),
          licenceClass,
          issuingState,
          depotLocation
        };
      }

      // Check profiles table if matching code or email or ID prefix
      let profQuery = supabase.from("profiles").select("*");
      if (isUuid) {
        profQuery = profQuery.or(`id.eq.${cleanCode},email.eq.${cleanCode}`);
      } else if (cleanCode.includes("@")) {
        profQuery = profQuery.eq("email", cleanCode);
      } else {
        const prefix = cleanCode.replace(/^(VERIFY-|COMP-)/i, "").toLowerCase();
        if (prefix.length >= 4) {
          profQuery = profQuery.ilike("id", `${prefix}%`);
        } else {
          profQuery = profQuery.eq("email", cleanCode);
        }
      }

      const { data: prof } = await profQuery.maybeSingle();

      if (prof) {
        return {
          valid: true,
          verified: true,
          driverName: prof.full_name || "Heavy Vehicle Driver",
          driver: { fullName: prof.full_name || "Heavy Vehicle Driver" },
          certificateId: `COMP-${prof.id.slice(0, 8).toUpperCase()}`,
          verificationCode: `VERIFY-${prof.id.slice(0, 8)}`,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 864e5).toISOString(),
          licenceClass: (prof as any).licence_class || "HC",
          issuingState: (prof as any).issuing_state || "VIC",
          depotLocation: (prof as any).depot_location || "Melbourne Hub"
        };
      }
    } catch (err) {
      console.warn("Direct Supabase certificate verification warning:", err);
    }

    return { valid: false, verified: false, message: "Certificate ID or verification code not found in records." };
  },

  async logDocumentView(userId: string, adminId: string, documentType: string) {
    return await logDocumentView(userId, adminId, documentType);
  },

  async getDriverAudits(userId: string) {
    return await getDriverAudits(userId);
  },

  async completeAuditAssignment(assignmentId: string, answers: Record<number, boolean>) {
    return await completeAuditAssignment(assignmentId, answers);
  },

  async createAudit(input: {
    name: string;
    category: string;
    description: string;
    questions: string[];
    dueDate?: string | null;
  }) {
    return await createAudit(input);
  },

  async assignAudit(auditId: string, userIds: string[]) {
    return await assignAudit(auditId, userIds);
  },

  async getAdminAuditData() {
    return await getAdminAuditData();
  },

  async getDriverSOPs(userId: string) {
    return await getDriverSOPs(userId);
  },

  async completeSOP(userId: string, sopId: string) {
    return await completeSOP(userId, sopId);
  },

  async createSOP(input: {
    code: string;
    name: string;
    category: string;
    isMandatory: boolean;
    contentSummary: string;
    dueDate?: string | null;
    videoUrl?: string | null;
    quizQuestionsCount?: number;
  }) {
    return await createSOP(input);
  },

  async deleteSOP(sopId: string) {
    return await deleteSOP(sopId);
  },

  async getAdminSOPData() {
    return await getAdminSOPData();
  },

  async getVehicles(userId: string): Promise<VehicleRecord[]> {
    return await getDriverVehicles(userId);
  },

  async saveVehicle(userId: string, vehicle: VehicleRecord): Promise<VehicleRecord[]> {
    return await saveDriverVehicle(userId, vehicle);
  },

  async deleteVehicle(userId: string, vehicleId: string): Promise<VehicleRecord[]> {
    const { error } = await supabase
      .from("driver_vehicles")
      .delete()
      .eq("id", vehicleId)
      .eq("user_id", userId);
    if (error) throw error;
    return await getDriverVehicles(userId);
  },

  async getAdminFleetData() {
    return await getAdminFleetData();
  },

  async verifyVehiclePass(passCode: string) {
    return await verifyVehiclePass(passCode);
  },

  async verifyDriver(driverId: string) {
    return await verifyDriver(driverId);
  },

  getSiteCheckins(userId: string): SiteCheckinRecord[] {
    try {
      const raw = window.localStorage.getItem(`bnt_checkins_${userId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveSiteCheckin(userId: string, checkin: SiteCheckinRecord): SiteCheckinRecord[] {
    const current = this.getSiteCheckins(userId);
    const next = [checkin, ...current];
    try {
      window.localStorage.setItem(`bnt_checkins_${userId}`, JSON.stringify(next));
    } catch {}
    return next;
  },

  checkoutSiteCheckin(userId: string, checkinId: string): SiteCheckinRecord[] {
    const current = this.getSiteCheckins(userId);
    const next = current.map((item) =>
      item.id === checkinId ? { ...item, status: "Checked Out" as const, checkoutTime: new Date().toISOString() } : item
    );
    try {
      window.localStorage.setItem(`bnt_checkins_${userId}`, JSON.stringify(next));
    } catch {}
    return next;
  },

  async getPreTripInspections(userId: string): Promise<PreTripInspectionRecord[]> {
    const { data, error } = await supabase
      .from('pre_trip_inspections')
      .select('*')
      .eq('user_id', userId)
      .order('inspected_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      driverId: row.user_id,
      driverName: row.driver_signature,
      vehicleRego: row.vehicle_rego,
      odometer: row.odometer,
      trailerId: row.trailer_id,
      overallStatus: row.overall_status,
      items: row.items,
      driverSignature: row.driver_signature,
      inspectedAt: row.inspected_at,
    }));
  },

  async savePreTripInspection(userId: string, record: PreTripInspectionRecord): Promise<PreTripInspectionRecord> {
    const { data, error } = await supabase
      .from('pre_trip_inspections')
      .insert({
        user_id: userId,
        vehicle_rego: record.vehicleRego,
        odometer: record.odometer,
        trailer_id: record.trailerId,
        overall_status: record.overallStatus,
        items: record.items,
        driver_signature: record.driverSignature,
        inspected_at: record.inspectedAt,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      driverId: data.user_id,
      driverName: data.driver_signature,
      vehicleRego: data.vehicle_rego,
      odometer: data.odometer,
      trailerId: data.trailer_id,
      overallStatus: data.overall_status,
      items: data.items,
      driverSignature: data.driver_signature,
      inspectedAt: data.inspected_at,
    };
  },

  async getSafetyIncidents(userId: string): Promise<SafetyIncidentRecord[]> {
    const { data, error } = await supabase
      .from('safety_incidents')
      .select('*')
      .eq('user_id', userId)
      .order('reported_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      severity: row.severity,
      location: row.location,
      description: row.description,
      immediateActionsTaken: row.immediate_actions_taken,
      reportedBy: row.reported_by,
      reportedAt: row.reported_at,
      photoFileName: row.photo_file_name,
      status: row.status,
      riskScore: row.risk_score,
    }));
  },

  async reportSafetyIncident(userId: string, incident: Omit<SafetyIncidentRecord, 'id' | 'reportedAt'>): Promise<SafetyIncidentRecord> {
    const { data, error } = await supabase
      .from('safety_incidents')
      .insert({
        user_id: userId,
        title: incident.title,
        category: incident.category,
        severity: incident.severity,
        location: incident.location,
        description: incident.description,
        immediate_actions_taken: incident.immediateActionsTaken,
        photo_file_name: incident.photoFileName,
        status: incident.status,
        risk_score: incident.riskScore,
        reported_by: incident.reportedBy,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      category: data.category,
      severity: data.severity,
      location: data.location,
      description: data.description,
      immediateActionsTaken: data.immediate_actions_taken,
      reportedBy: data.reported_by,
      reportedAt: data.reported_at,
      photoFileName: data.photo_file_name,
      status: data.status,
      riskScore: data.risk_score,
    };
  },

  async getContractorCompany(userId: string): Promise<ContractorCompanyRecord | null> {
    const { data, error } = await supabase
      .from("contractor_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapContractorRow(data);
  },

  async saveContractorCompany(userId: string, company: ContractorCompanyRecord): Promise<ContractorCompanyRecord> {
    const { data, error } = await supabase
      .from("contractor_profiles")
      .upsert(
        {
          user_id: userId,
          company_name: company.companyName,
          trading_name: company.tradingName,
          abn: company.abn,
          contact_person: company.contactPerson,
          email: company.email,
          phone: company.phone,
          address: company.address,
          nhvas_accreditation: company.nhvasAccreditation,
          nhvas_number: company.nhvasNumber,
          public_liability_policy: company.publicLiabilityPolicy,
          public_liability_expiry: company.publicLiabilityExpiry || null,
          public_liability_file_url: company.publicLiabilityFileUrl ?? null,
          workers_comp_policy: company.workersCompPolicy,
          workers_comp_expiry: company.workersCompExpiry || null,
          workers_comp_file_url: company.workersCompFileUrl ?? null,
          primary_depot: company.primaryDepot,
          status: company.status,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      )
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapContractorRow(data) : company;
  },

  async uploadContractorDocument(userId: string, kind: "publicLiability" | "workersComp", file: File): Promise<string> {
    const fileExt = file.name.split(".").pop() || "pdf";
    const filePath = `${userId}/${kind}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("contractor-documents")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from("contractor-documents")
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  },

  async getAdminContractorData(): Promise<{
    contractors: Array<ContractorCompanyRecord & { userName: string; userEmail: string }>;
  }> {
    const { data, error } = await supabase
      .from("contractor_profiles")
      .select("*, profiles:user_id (full_name, email)")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return {
      contractors: (data ?? []).map((row: Record<string, any>) => ({
        ...mapContractorRow(row),
        userName: String(row.profiles?.full_name || "Driver"),
        userEmail: String(row.profiles?.email || "")
      }))
    };
  },

  // Upload inspection photos to Supabase Storage
  async uploadInspectionPhotos(userId: string, inspectionId: string, itemId: string, files: File[]): Promise<string[]> {
    const uploadPromises = files.map((file, index) => {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${inspectionId}_${itemId}_${index}_${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;
      
      return supabase.storage
        .from('inspection-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
        .then(({ data, error }) => {
          if (error) throw error;
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('inspection-photos')
            .getPublicUrl(data.path);
          return urlData.publicUrl;
        });
    });
    
    return Promise.all(uploadPromises);
  },

  async revokeDriverInduction(session: SessionState, driverId: string, reason: string, certificateId?: string) {
    await adminRequest(`/admin/drivers/${driverId}/revoke-induction`, session, {
      method: "POST", body: JSON.stringify({ reason, certificateId })
    });
  },

  async archiveDriver(_session: SessionState, driverId: string) {
    const { error } = await supabase.from("profiles").update({ archived_at: new Date().toISOString() }).eq("id", driverId);
    if (error) throw error;
  },
  async restoreDriver(_session: SessionState, driverId: string) {
    const { error } = await supabase.from("profiles").update({ archived_at: null }).eq("id", driverId);
    if (error) throw error;
  },
  async bulkArchiveDrivers(session: SessionState, driverIds: string[]) {
    const { error } = await supabase.from("profiles").update({ archived_at: new Date().toISOString() }).in("id", driverIds);
    if (error) throw error;
  },
  async bulkRestoreDrivers(_session: SessionState, driverIds: string[]) {
    const { error } = await supabase.from("profiles").update({ archived_at: null }).in("id", driverIds);
    if (error) throw error;
  },

  async getBranding(): Promise<BrandingSettings> {
    const response = await fetch(`${apiBaseUrl}/branding`);
    if (!response.ok) throw new Error("Failed to load branding");
    const { branding } = await response.json();
    return { ...branding, companyName: branding.companyName ?? branding.company_name ?? branding.organizationName,
      welcomeText: branding.welcomeText ?? branding.welcome_text ?? "", logoPath: branding.logoPath ?? branding.logo_path ?? branding.logoUrl };
  },
  async saveBranding(session: SessionState, input: { companyName: string; logoPath: string | null; primaryColor: string; welcomeText: string }) {
    const response = await fetch(`${apiBaseUrl}/branding`, { method: "PUT", headers: {
      "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`
    }, body: JSON.stringify({ organizationName: input.companyName, logoUrl: input.logoPath, primaryColor: input.primaryColor, welcomeText: input.welcomeText }) });
    if (!response.ok) throw new Error("Failed to save branding");
    const { branding } = await response.json();
    return { ...branding, companyName: input.companyName, welcomeText: input.welcomeText, logoPath: input.logoPath } as BrandingSettings;
  },
  async uploadBrandingLogo(_session: SessionState, file: File) {
    const path = `branding/${crypto.randomUUID()}-${file.name}`;
    const { data, error } = await supabase.storage.from(bucketName).upload(path, file, { upsert: true });
    if (error) throw error;
    return { path: data.path, logoPath: data.path, url: supabase.storage.from(bucketName).getPublicUrl(data.path).data.publicUrl };
  },
  async removeBrandingLogo(_session: SessionState, path: string) {
    const { error } = await supabase.storage.from(bucketName).remove([path]);
    if (error) throw error;
  },
  async getPolicies(userId: string): Promise<PolicyRecord[]> {
    const { data: policies, error: pErr } = await supabase.from("policies").select("*").eq("is_active", true);
    if (pErr) throw pErr;
    if (!policies || policies.length === 0) return [];

    const { data: versions } = await supabase.from("policy_versions").select("*");
    const { data: signatures } = await supabase.from("policy_signatures").select("*").eq("user_id", userId);
    const signedVersionIds = new Set((signatures ?? []).map((s: any) => s.policy_version_id));

    return policies.map((p: any) => {
      const pVersions = (versions ?? []).filter((v: any) => v.policy_id === p.id);
      pVersions.sort((a: any, b: any) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
      const latest = pVersions[0] || {};
      const isSigned = signedVersionIds.has(latest.id);

      return {
        id: p.id,
        policyId: p.id,
        title: p.name,
        name: p.name,
        versionId: latest.id || p.id,
        version: latest.version_label || "1.0",
        versionLabel: latest.version_label || "1.0",
        content: latest.content || "",
        status: p.is_active ? "published" : "draft",
        signed: isSigned,
        createdBy: latest.published_by ?? null,
        createdAt: p.created_at,
        updatedAt: latest.published_at || p.created_at,
        publishedAt: latest.published_at || p.created_at,
        description: ""
      } as PolicyRecord;
    });
  },

  async signPolicy(versionId: string, signature: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("You are not logged in.");
    const { error } = await supabase.from("policy_signatures").insert({
      policy_version_id: versionId,
      user_id: user.user.id,
      signature_text: signature,
      signed_at: new Date().toISOString()
    });
    if (error) throw error;
  },

  async getPolicyList(): Promise<PolicyListItem[]> {
    const { data: policies, error: pErr } = await supabase.from("policies").select("*").order("created_at", { ascending: false });
    if (pErr) throw pErr;
    if (!policies || policies.length === 0) return [];

    const { data: versions } = await supabase.from("policy_versions").select("*");
    const { data: signatures } = await supabase.from("policy_signatures").select("*");
    const { data: drivers } = await supabase.from("profiles").select("id").eq("role", "driver");
    const totalDriversCount = Math.max(1, drivers?.length ?? 1);

    return policies.map((p: any) => {
      const pVersions = (versions ?? []).filter((v: any) => v.policy_id === p.id);
      pVersions.sort((a: any, b: any) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
      const latest = pVersions[0] || {};
      const sigs = (signatures ?? []).filter((s: any) => s.policy_version_id === latest.id);

      return {
        id: p.id,
        policyId: p.id,
        title: p.name,
        name: p.name,
        version: latest.version_label || "1.0",
        versionLabel: latest.version_label || "1.0",
        status: p.is_active ? "published" : "draft",
        createdAt: p.created_at,
        updatedAt: latest.published_at || p.created_at,
        publishedAt: latest.published_at || p.created_at,
        signatureCount: sigs.length,
        signedCount: sigs.length,
        totalDrivers: totalDriversCount
      } as PolicyListItem;
    });
  },

  async createPolicy(input: { name: string; versionLabel: string; content: string }) {
    const { data: policy, error: pErr } = await supabase
      .from("policies")
      .insert({ name: input.name, is_active: true })
      .select()
      .single();
    if (pErr) throw pErr;

    const { error: vErr } = await supabase.from("policy_versions").insert({
      policy_id: policy.id,
      version_label: input.versionLabel || "1.0",
      content: input.content,
      published_at: new Date().toISOString()
    });
    if (vErr) throw vErr;
  },

  async publishPolicyVersion(session: SessionState, policyId: string, versionLabel: string, content: string) {
    const { error } = await supabase.from("policy_versions").insert({
      policy_id: policyId,
      version_label: versionLabel,
      content: content,
      published_by: session.user.id,
      published_at: new Date().toISOString()
    });
    if (error) throw error;
  },

  async getPolicySignatureReport(policyId: string): Promise<{ signed: PolicySignatureSummary[]; pending: PolicyPendingDriver[]; versionLabel: string }> {
    const { data: versions } = await supabase.from("policy_versions").select("*").eq("policy_id", policyId);
    const sortedVersions = (versions ?? []).sort((a: any, b: any) => new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime());
    const latest = sortedVersions[0];
    if (!latest) return { signed: [], pending: [], versionLabel: "" };

    const { data: signatures } = await supabase.from("policy_signatures").select("*").eq("policy_version_id", latest.id);
    const { data: drivers } = await supabase.from("profiles").select("id, full_name, email, depot_location").eq("role", "driver");

    const signedDriverIds = new Set((signatures ?? []).map((s: any) => s.user_id));
    const driverMap = new Map((drivers ?? []).map((d: any) => [d.id, d]));

    const signed: PolicySignatureSummary[] = (signatures ?? []).map((s: any) => {
      const d = driverMap.get(s.user_id);
      return {
        policyId,
        policyTitle: "",
        policyVersion: latest.version_label,
        signedCount: signatures?.length ?? 0,
        pendingCount: Math.max(0, (drivers?.length ?? 0) - (signatures?.length ?? 0)),
        totalDrivers: drivers?.length ?? 0,
        driverId: s.user_id,
        signedAt: s.signed_at,
        driverName: d?.full_name || "Driver",
        driverEmail: d?.email || "",
        signatureText: s.signature_text
      };
    });

    const pending: PolicyPendingDriver[] = (drivers ?? [])
      .filter((d: any) => !signedDriverIds.has(d.id))
      .map((d: any) => ({
        id: d.id,
        driverId: d.id,
        fullName: d.full_name || "Driver",
        driverName: d.full_name || "Driver",
        email: d.email || "",
        driverEmail: d.email || "",
        depotLocation: d.depot_location || "Melbourne Hub"
      }));

    return { signed, pending, versionLabel: latest.version_label };
  }
};

async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser?.user?.email ?? "";
  const defaultRole = email.includes("admin") ? "admin" : "driver";
  const seedProfile = {
    id: userId,
    email: email,
    full_name: email ? email.split("@")[0] : "New User",
    role: defaultRole,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert(seedProfile, { onConflict: "id" })
    .select()
    .single();

  if (insertError || !inserted) return seedProfile;
  return inserted;
}

async function getDriverRow(userId: string) {
  try {
    const { data, error } = await supabase.from("drivers").select("*").eq("user_id", userId).maybeSingle();
    if (!error && data) return data;
  } catch {}

  const seed = {
    id: userId,
    user_id: userId,
    status: "Not Started",
    created_at: new Date().toISOString()
  };

  try {
    const { data: inserted, error: insertErr } = await supabase.from("drivers").insert({
      user_id: userId,
      status: "Not Started",
      created_at: new Date().toISOString()
    }).select().single();
    if (!insertErr && inserted) return inserted;
  } catch {}

  return seed;
}

async function getProgressRow(userId: string) {
  // Propagate Supabase errors — do not silently fall back to potentially stale
  // localStorage data, which could make the driver appear further along than they are.
  const { data, error } = await supabase.from("induction_progress").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;

  if (data) {
    // Keep localStorage in sync so it can serve as an offline read cache
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`bnt-progress-${userId}`, JSON.stringify(data));
    }
    return data;
  }

  // Row doesn't exist yet — return a default that will be upserted on first save
  return {
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
  let dbRows: any[] = [];
  try {
    const { data, error } = await supabase.from("documents").select("*").eq("user_id", userId).order("uploaded_at", { ascending: false });
    if (!error && data) dbRows = data;
  } catch (e) {
    console.warn("Supabase document query fallback:", e);
  }

  const localDocsRaw = window.localStorage.getItem(`bnt-documents-${userId}`);
  const localRows: any[] = localDocsRaw ? JSON.parse(localDocsRaw) : [];

  const combined = [...dbRows, ...localRows];
  const latestByType = new Map<string, Record<string, unknown>>();
  for (const row of combined) {
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
    .select("id, title, format, summary, sort_order, video_url, video_duration_seconds, require_full_watch, media_json, source_slide_id")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const uniqueSections = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) {
    const title = String(row.title ?? "");
    if (!title) continue;
    // Legacy curriculum rows can contain duplicate titles, but course slides
    // are distinct modules and must never be collapsed by their display title.
    const key = row.source_slide_id ? `slide:${row.id}` : `title:${title}`;
    if (uniqueSections.has(key)) continue;
    uniqueSections.set(key, row);
  }
  return Array.from(uniqueSections.values());
}

async function getLearningCompletions(userId: string, sections: Array<Record<string, unknown>>) {
  const { data, error } = await supabase.from("learning_section_completions").select("*").eq("user_id", userId);
  if (error) throw error;
  const completionMap = new Map((data ?? []).map((item) => [item.section_id, item]));
  const localModuleVideos = [
    "/videos/module1.mp4",
    "/videos/module2.mp4",
    "/videos/module3.mp4",
    "/videos/module4.mp4",
    "/videos/module5.mp4",
    "/videos/module6.mp4",
    "/videos/module7.mp4",
    "/videos/module8.mp4"
  ];

  return sections.map((section, idx) => {
    const completion = completionMap.get(section.id);
    const isCourseSlide = Boolean(section.source_slide_id);
    const videoUrl = section.video_url
      ? String(section.video_url)
      : isCourseSlide
        ? undefined
        : localModuleVideos[idx % localModuleVideos.length];

    return {
      sectionId: String(section.id),
      title: String(section.title),
      format: String(section.format),
      summary: String(section.summary),
      videoUrl,
      mediaJson: section.media_json && typeof section.media_json === "object"
        ? section.media_json as Record<string, unknown>
        : undefined,
      videoDurationSeconds: Number(section.video_duration_seconds ?? 0) || undefined,
      requireFullWatch: Boolean(section.require_full_watch),
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

function mapAuditRecordRow(row: Record<string, unknown>): ComplianceAuditRecord {
  const questions = Array.isArray(row.questions)
    ? row.questions.map((item) => String(item))
    : [];
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category ?? "Transport"),
    description: String(row.description ?? ""),
    questions,
    dueDate: row.due_date ? String(row.due_date) : null,
    isActive: Boolean(row.is_active ?? true),
    createdAt: String(row.created_at)
  };
}

function mapAssignmentRow(row: Record<string, unknown>, audit: ComplianceAuditRecord): AuditAssignment {
  return {
    id: String(row.id),
    auditId: String(row.audit_id),
    audit,
    status: (row.status ?? "No Attempt") as AuditAssignmentStatus,
    dueDate: row.due_date ? String(row.due_date) : audit.dueDate,
    attemptsCount: Number(row.attempts_count ?? 0),
    lastAttemptDate: row.last_attempt_date ? String(row.last_attempt_date) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null
  };
}

async function getDriverAudits(userId: string): Promise<AuditAssignment[]> {
  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("audit_assignments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (assignmentError) throw assignmentError;
  if (!assignmentRows?.length) return [];

  const auditIds = Array.from(
    new Set(assignmentRows.map((row: Record<string, unknown>) => String(row.audit_id)))
  );
  const { data: auditRows, error: auditError } = await supabase
    .from("compliance_audits")
    .select("*")
    .in("id", auditIds);
  if (auditError) throw auditError;

  const auditMap = new Map(
    (auditRows ?? []).map((audit: Record<string, unknown>) => [String(audit.id), mapAuditRecordRow(audit)])
  );

  return assignmentRows
    .map((row: Record<string, unknown>) => {
      const audit = auditMap.get(String(row.audit_id));
      if (!audit) return null;
      return mapAssignmentRow(row, audit);
    })
    .filter((item: AuditAssignment | null): item is AuditAssignment => item !== null);
}

async function completeAuditAssignment(assignmentId: string, answers: Record<number, boolean>): Promise<void> {
  const { data: current, error: currentError } = await supabase
    .from("audit_assignments")
    .select("attempts_count")
    .eq("id", assignmentId)
    .maybeSingle();
  if (currentError) throw currentError;

  const answered = Object.entries(answers);
  const passed = answered.length > 0 && answered.every(([, value]) => Boolean(value));
  const now = new Date().toISOString();

  if (answered.length > 0) {
    const responseRows = answered.map(([index, answer]) => ({
      assignment_id: assignmentId,
      question_index: Number(index),
      answer: Boolean(answer)
    }));
    const { error: responseError } = await supabase.from("audit_responses").insert(responseRows);
    if (responseError) throw responseError;
  }

  const { error: updateError } = await supabase
    .from("audit_assignments")
    .update({
      status: passed ? "Passed" : "Action Required",
      attempts_count: Number(current?.attempts_count ?? 0) + 1,
      last_attempt_date: now,
      completed_at: passed ? now : null
    })
    .eq("id", assignmentId);
  if (updateError) throw updateError;
}

async function createAudit(input: {
  name: string;
  category: string;
  description: string;
  questions: string[];
  dueDate?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("compliance_audits")
    .insert({
      name: input.name,
      category: input.category,
      description: input.description,
      questions: input.questions,
      due_date: input.dueDate || null
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return String(data?.id);
}

async function assignAudit(auditId: string, userIds: string[]): Promise<void> {
  if (!userIds.length) return;
  const rows = userIds.map((userId) => ({ audit_id: auditId, user_id: userId }));
  const { error } = await supabase
    .from("audit_assignments")
    .upsert(rows, { onConflict: "audit_id,user_id" });
  if (error) throw error;
}

async function getAdminAuditData(): Promise<{
  audits: ComplianceAuditRecord[];
  assignments: AdminAuditAssignmentRow[];
}> {
  const [auditResult, assignmentResult, profileResult] = await Promise.all([
    supabase.from("compliance_audits").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("audit_assignments").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, full_name, email")
  ]);

  if (auditResult.error) throw auditResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  if (profileResult.error) throw profileResult.error;

  const profileMap = new Map(
    (profileResult.data ?? []).map((profile: Record<string, unknown>) => [String(profile.id), profile])
  );
  const auditMap = new Map(
    (auditResult.data ?? []).map((audit: Record<string, unknown>) => [String(audit.id), mapAuditRecordRow(audit)])
  );

  const assignments: AdminAuditAssignmentRow[] = (assignmentResult.data ?? [])
    .map((row: Record<string, unknown>) => {
      const audit = auditMap.get(String(row.audit_id));
      const profile = profileMap.get(String(row.user_id));
      if (!audit || !profile) return null;
      return {
        ...mapAssignmentRow(row, audit),
        driverName: String(profile.full_name || profile.email || "Driver"),
        driverEmail: String(profile.email || "")
      };
    })
    .filter((item: AdminAuditAssignmentRow | null): item is AdminAuditAssignmentRow => item !== null);

  return { audits: Array.from(auditMap.values()), assignments };
}

// --- SOP Learning Modules ---

async function getDriverSOPs(userId: string): Promise<SOPItem[]> {
  const [moduleResult, completionResult] = await Promise.all([
    supabase
      .from("sop_modules")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("sop_completions").select("sop_id").eq("user_id", userId)
  ]);
  if (moduleResult.error) throw moduleResult.error;
  if (completionResult.error) throw completionResult.error;

  const completedIds = new Set(
    (completionResult.data ?? []).map((row: Record<string, unknown>) => String(row.sop_id))
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (moduleResult.data ?? []).map((row: Record<string, unknown>) => {
    const dueDate = row.due_date ? String(row.due_date) : null;
    const passed = completedIds.has(String(row.id));
    const expired =
      !passed &&
      dueDate !== null &&
      new Date(`${dueDate}T00:00:00`).getTime() < today.getTime();
    return {
      id: String(row.id),
      code: String(row.code ?? ""),
      name: String(row.name ?? ""),
      category: String(row.category ?? "SOP") as SOPItem["category"],
      isMandatory: Boolean(row.is_mandatory),
      dueDate,
      status: passed ? "Passed" : expired ? "Expired" : "No Attempt",
      contentSummary: String(row.content_summary ?? ""),
      videoUrl: row.video_url ? String(row.video_url) : undefined,
      quizQuestionsCount: row.quiz_questions_count ? Number(row.quiz_questions_count) : undefined
    };
  });
}

async function completeSOP(userId: string, sopId: string): Promise<void> {
  const { error } = await supabase.from("sop_completions").upsert(
    { sop_id: sopId, user_id: userId, completed_at: new Date().toISOString() },
    { onConflict: "sop_id,user_id" }
  );
  if (error) throw error;
}

async function createSOP(input: {
  code: string;
  name: string;
  category: string;
  isMandatory: boolean;
  contentSummary: string;
  dueDate?: string | null;
  videoUrl?: string | null;
  quizQuestionsCount?: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from("sop_modules")
    .insert({
      code: input.code,
      name: input.name,
      category: input.category,
      is_mandatory: input.isMandatory,
      content_summary: input.contentSummary,
      due_date: input.dueDate || null,
      video_url: input.videoUrl || null,
      quiz_questions_count: input.quizQuestionsCount ?? 0
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return String(data?.id);
}

async function deleteSOP(sopId: string): Promise<void> {
  const { error } = await supabase.from("sop_modules").delete().eq("id", sopId);
  if (error) throw error;
}

async function getAdminSOPData(): Promise<{
  sops: SOPItem[];
  completions: { sopId: string; userId: string; userName: string; completedAt: string }[];
}> {
  const [moduleResult, completionResult, profileResult] = await Promise.all([
    supabase.from("sop_modules").select("*").order("created_at", { ascending: false }).limit(200),
    supabase
      .from("sop_completions")
      .select("sop_id, user_id, completed_at")
      .order("completed_at", { ascending: false })
      .limit(2000),
    supabase.from("profiles").select("id, full_name, email")
  ]);

  if (moduleResult.error) throw moduleResult.error;
  if (completionResult.error) throw completionResult.error;
  if (profileResult.error) throw profileResult.error;

  const profileMap = new Map(
    (profileResult.data ?? []).map((profile: Record<string, unknown>) => [String(profile.id), profile])
  );

  const sops: SOPItem[] = (moduleResult.data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    category: String(row.category ?? "SOP") as SOPItem["category"],
    isMandatory: Boolean(row.is_mandatory),
    dueDate: row.due_date ? String(row.due_date) : null,
    status: "No Attempt",
    contentSummary: String(row.content_summary ?? ""),
    videoUrl: row.video_url ? String(row.video_url) : undefined,
    quizQuestionsCount: row.quiz_questions_count ? Number(row.quiz_questions_count) : undefined
  }));

  const completions = (completionResult.data ?? []).map((row: Record<string, unknown>) => {
    const profile = profileMap.get(String(row.user_id));
    return {
      sopId: String(row.sop_id),
      userId: String(row.user_id),
      userName: String(profile?.full_name || profile?.email || "Driver"),
      completedAt: String(row.completed_at)
    };
  });

  return { sops, completions };
}

// --- Driver Vehicles (fleet) ---

function mapContractorRow(row: Record<string, unknown>): ContractorCompanyRecord {
  return {
    id: String(row.user_id),
    companyName: String(row.company_name ?? ""),
    tradingName: String(row.trading_name ?? ""),
    abn: String(row.abn ?? ""),
    contactPerson: String(row.contact_person ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    address: String(row.address ?? ""),
    nhvasAccreditation: (String(row.nhvas_accreditation ?? "None")) as ContractorCompanyRecord["nhvasAccreditation"],
    nhvasNumber: String(row.nhvas_number ?? ""),
    publicLiabilityPolicy: String(row.public_liability_policy ?? ""),
    publicLiabilityExpiry: row.public_liability_expiry ? String(row.public_liability_expiry) : "",
    workersCompPolicy: String(row.workers_comp_policy ?? ""),
    workersCompExpiry: row.workers_comp_expiry ? String(row.workers_comp_expiry) : "",
    primaryDepot: String(row.primary_depot ?? ""),
    status: (String(row.status ?? "Pending Review")) as ContractorCompanyRecord["status"],
    publicLiabilityFileUrl: row.public_liability_file_url ? String(row.public_liability_file_url) : null,
    workersCompFileUrl: row.workers_comp_file_url ? String(row.workers_comp_file_url) : null
  };
}

function mapVehicleRow(row: Record<string, unknown>): VehicleRecord {
  return {
    id: String(row.id),
    rego: String(row.rego ?? ""),
    makeModel: String(row.make_model ?? ""),
    bodyType: String(row.body_type ?? ""),
    branchName: String(row.branch_name ?? ""),
    driverNumber: String(row.driver_number ?? ""),
    driverName: String(row.driver_name ?? ""),
    regoExpiryDate: String(row.rego_expiry_date ?? ""),
    dgExpiryDate: row.dg_expiry_date ? String(row.dg_expiry_date) : null,
    scbaServiceDueDate: row.scba_service_due_date ? String(row.scba_service_due_date) : null,
    vehicleCheckApproved: Boolean(row.vehicle_check_approved),
    regoCheckApproved: Boolean(row.rego_check_approved),
    status: (String(row.status ?? "Active")) as VehicleRecord["status"],
    qrPassCode: String(row.qr_pass_code ?? ""),
    contactNumber: row.contact_number ? String(row.contact_number) : undefined
  };
}

async function getDriverVehicles(userId: string): Promise<VehicleRecord[]> {
  const { data, error } = await supabase
    .from("driver_vehicles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapVehicleRow);
}

async function saveDriverVehicle(userId: string, vehicle: VehicleRecord): Promise<VehicleRecord[]> {
  const { error } = await supabase.from("driver_vehicles").upsert(
    {
      id: vehicle.id,
      user_id: userId,
      rego: vehicle.rego,
      make_model: vehicle.makeModel,
      body_type: vehicle.bodyType,
      branch_name: vehicle.branchName,
      driver_number: vehicle.driverNumber,
      driver_name: vehicle.driverName,
      rego_expiry_date: vehicle.regoExpiryDate || null,
      dg_expiry_date: vehicle.dgExpiryDate || null,
      scba_service_due_date: vehicle.scbaServiceDueDate || null,
      vehicle_check_approved: vehicle.vehicleCheckApproved,
      rego_check_approved: vehicle.regoCheckApproved,
      status: vehicle.status,
      qr_pass_code: vehicle.qrPassCode,
      contact_number: vehicle.contactNumber ?? null
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  return await getDriverVehicles(userId);
}

async function getAdminFleetData(): Promise<{
  vehicles: Array<VehicleRecord & { userName: string; userEmail: string }>;
}> {
  const { data, error } = await supabase
    .from("driver_vehicles")
    .select("*, profiles:user_id (full_name, email)")
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  return {
    vehicles: (data ?? []).map((row: Record<string, any>) => ({
      ...mapVehicleRow(row),
      userName: String(row.profiles?.full_name || "Driver"),
      userEmail: String(row.profiles?.email || "")
    }))
  };
}

async function verifyVehiclePass(passCode: string): Promise<VehiclePassVerificationResult> {
  const clean = passCode.trim();
  const baseUrl = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl;

  try {
    const res = await fetch(`${baseUrl}/api/vehicle/verify/${encodeURIComponent(clean)}`, {
      headers: { accept: "application/json" }
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return (await res.json()) as VehiclePassVerificationResult;
    }
    if (res.status === 404 && contentType.includes("application/json")) {
      return { verified: false, message: "Vehicle pass not found." };
    }
  } catch (e) {
    console.warn("Backend vehicle verification endpoint unreachable, falling back to direct database query:", e);
  }

  // Direct Supabase fallback
  const { data: vehicle, error: vErr } = await supabase
    .from("driver_vehicles")
    .select("*, profiles:user_id (full_name, email)")
    .or(`qr_pass_code.eq.${clean},rego.ilike.${clean},id.eq.${clean}`)
    .maybeSingle();

  if (vErr || !vehicle) {
    return { verified: false, message: "Vehicle pass not found." };
  }

  return {
    verified: true,
    organizationName: organizationName,
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
  };
}

async function verifyDriver(driverId: string): Promise<DriverVerificationResult> {
  const baseUrl = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
  const res = await fetch(`${baseUrl}/api/driver/verify/${encodeURIComponent(driverId)}`, {
    headers: { accept: "application/json" }
  });
  if (!res.ok) {
    if (res.status === 404) {
      return { verified: false, message: "Driver not found." };
    }
    throw new Error("Verification service is unavailable. Please try again.");
  }
  return (await res.json()) as DriverVerificationResult;
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
  const normalizedPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;
  const baseUrl = apiBaseUrl.endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
  const targetUrl = `${baseUrl}${normalizedPath}`;
  const response = await fetch(targetUrl, {
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

function buildCertificatePdf(
  fullName: string,
  completionId: string,
  issuedAt: string,
  verificationUrl: string,
  licenceClass?: string,
  issuingState?: string,
  depotLocation?: string
) {
  return createCertificatePdf({
    organizationName,
    fullName,
    completionId,
    issuedAt,
    verificationUrl,
    licenceClass,
    issuingState,
    depotLocation
  });
}

function buildCompletionTrend(rows: Array<Record<string, unknown>>) {
  // M-9 FIX: Previously, labels used toLocaleDateString() (local timezone) but
  // dayKey used toISOString().slice(0,10) (UTC). This caused a day mismatch for
  // users in UTC+offset timezones. Now both use UTC-normalized date strings.
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - index));
    // Format as UTC "Aug 27" to match dayKey
    const label = date.toLocaleDateString("en-AU", { month: "short", day: "numeric", timeZone: "UTC" });
    const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD in UTC
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

// --- Automated: Document OCR Verification ---
export async function verifyDocument(params: {
  userId: string;
  fileUrl: string;
  documentType: string;
}): Promise<{ isValid: boolean; confidenceScore: number; simulatedExpiry: string }> {
  // C-6 FIX: Use URL constructor instead of .replace("/api", "") which corrupts
  // hostnames containing "api" (e.g. "https://api.example.com/api" becomes broken).
  const baseOrigin = new URL(apiBaseUrl).origin;
  const response = await fetch(`${baseOrigin}/api/documents/verify`, {
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
export async function getInductionVersion(_session: SessionState): Promise<InductionVersion> {
  // Return standard current baseline version
  return {
    id: "v1.0-current",
    versionLabel: "1.0",
    revisionNotes: "Initial induction content — Chain of Responsibility, Fatigue Management, Load Restraint, Speed & Compliance, Vehicle Checks, Site Safety, Incident Reporting, Mass/Dimension, WHS & PPE, Drug & Alcohol, HVNL Overview.",
    publishedAt: new Date().toISOString(),
    hasPendingVersion: false
  };
}

/**
 * Fetch all induction versions for the admin versions panel.
 */
export async function getAdminInductionVersions(session: SessionState): Promise<InductionVersionRecord[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/admin/induction-versions`, {
      headers: { Authorization: `Bearer ${session.accessToken}` }
    });
    if (response.ok) {
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
  } catch {
    // Fallback to direct Supabase query if Express API server is offline
  }

  const defaultBaseline: InductionVersionRecord[] = [{
    id: "v1.0-default",
    versionLabel: "1.0",
    revisionNotes: "Initial induction content — Chain of Responsibility, Fatigue Management, Load Restraint, Speed & Compliance, Vehicle Checks, Site Safety, Incident Reporting, Mass/Dimension, WHS & PPE, Drug & Alcohol, HVNL Overview.",
    publishedBy: null,
    publishedAt: new Date().toISOString(),
    isCurrent: true,
    createdAt: new Date().toISOString()
  }];

  try {
    const { data, error } = await supabase
      .from("induction_versions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      console.warn("Direct Supabase versions fetch notice:", error?.message || "Using default baseline version");
      return defaultBaseline;
    }

    return data.map((v) => ({
      id: String(v.id),
      versionLabel: String(v.version_label ?? "1.0"),
      revisionNotes: String(v.revision_notes ?? ""),
      publishedBy: v.published_by ? String(v.published_by) : null,
      publishedAt: String(v.published_at || v.created_at || new Date().toISOString()),
      isCurrent: Boolean(v.is_current),
      createdAt: String(v.created_at || new Date().toISOString())
    }));
  } catch (err: any) {
    console.error("Failed to fetch induction versions:", err);
    return defaultBaseline;
  }
}

/**
 * Admin publishes a new induction version.
 * Automatically de-activates the previous current version.
 */
export async function publishInductionVersion(
  session: SessionState,
  input: { versionLabel: string; revisionNotes: string }
): Promise<InductionVersionRecord> {
  try {
    const response = await fetch(`${apiBaseUrl}/admin/induction-versions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`
      },
      body: JSON.stringify(input)
    });
    if (response.ok) {
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
  } catch {
    // Fallback to direct Supabase mutation if Express API server is offline
  }

  // Direct Supabase Fallback: De-activate current versions and insert new one
  try {
    await supabase.from("induction_versions").update({ is_current: false }).eq("is_current", true);

    const now = new Date().toISOString();
    const { data, error } = await supabase.from("induction_versions").insert({
      version_label: input.versionLabel,
      revision_notes: input.revisionNotes,
      published_by: session.user.id,
      is_current: true,
      published_at: now,
      created_at: now
    }).select().single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to insert new induction version into Supabase.");
    }

    return {
      id: String(data.id),
      versionLabel: String(data.version_label),
      revisionNotes: String(data.revision_notes),
      publishedBy: session.user.id,
      publishedAt: String(data.published_at),
      isCurrent: true,
      createdAt: String(data.created_at)
    };
  } catch (err: any) {
    throw new Error(err?.message || "Failed to publish new induction version.");
  }
}

export async function getMyScheduleInvitations(session: SessionState): Promise<InductionScheduleInvitation[]> {
  const userId = session.user.id;
  const { data, error } = await supabase
    .from("induction_schedule_invitations")
    .select(`
      *,
      enrollment:induction_schedule_enrollments!inner(
        id,
        driver_id,
        schedule_id,
        induction_schedules!inner(name)
      )
    `)
    .eq("enrollment.driver_id", userId)
    .order("sent_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    scheduleItemId: row.schedule_item_id,
    deliveryMethod: row.delivery_method,
    status: row.status,
    metadata: row.metadata ?? {},
    sentAt: row.sent_at,
    createdAt: row.sent_at,
    updatedAt: row.sent_at
  })) satisfies InductionScheduleInvitation[];
}

const mapInductionCourse = (row: any, templateRecord = false): InductionCourse => ({
  id: row.id,
  title: row.title ?? "",
  description: row.description ?? "",
  templateId: row.templateId ?? row.template_id ?? null,
  versionLabel: row.versionLabel ?? row.version_label ?? "1.0",
  revisionNotes: row.revisionNotes ?? row.revision_notes ?? "",
  isTemplate: templateRecord || Boolean(row.isTemplate ?? row.is_template),
  isCurrent: Boolean(row.isCurrent ?? row.is_current),
  siteTag: row.siteTag ?? row.site_tag ?? "global",
  createdBy: row.createdBy ?? row.created_by ?? null,
  createdAt: row.createdAt ?? row.created_at ?? "",
  updatedAt: row.updatedAt ?? row.updated_at ?? ""
});

export async function getInductionCourses(session: SessionState): Promise<InductionCourse[]> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/courses`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  if (!response.ok) throw new Error("Failed to fetch courses");
  const rows = await response.json();
  return Array.isArray(rows) ? rows.map((row) => mapInductionCourse(row)) : [];
}

export async function createInductionCourse(session: SessionState, input: {
  title: string;
  description?: string;
  versionLabel?: string;
  revisionNotes?: string;
  isTemplate?: boolean;
  siteTag?: string;
}): Promise<InductionCourse> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/courses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create course");
  }
  return mapInductionCourse(await response.json());
}

export async function updateInductionCourse(session: SessionState, courseId: string, input: Partial<{
  title: string;
  description: string;
  versionLabel: string;
  revisionNotes: string;
  isCurrent: boolean;
  isTemplate: boolean;
  siteTag: string;
}>): Promise<InductionCourse> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/courses/${courseId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update course");
  }
  return mapInductionCourse(await response.json());
}

export async function deleteInductionCourse(session: SessionState, courseId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/courses/${courseId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete course");
  }
}

export async function cloneCourse(session: SessionState, courseId: string, input: {
  title: string;
  siteTag?: string;
}): Promise<{ course: InductionCourse; slidesCopied: number; questionsCopied: number }> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/courses/${courseId}/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to clone course");
  }
  const result = await response.json();
  return { ...result, course: mapInductionCourse(result.course) };
}

export async function publishCourseToDrivers(session: SessionState, courseId: string, input?: { versionLabel?: string; revisionNotes?: string }): Promise<{ published: number; updated: number; message?: string }> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/courses/${courseId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify(input ?? {})
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to publish course");
  }
  return response.json();
}

export async function publishInductionCourse(session: SessionState, courseId: string, input: { siteTag?: string; versionLabel?: string; revisionNotes?: string }): Promise<void> {
  await publishCourseToDrivers(session, courseId, input);
}

// CMS slide helpers used by the site induction editor.
async function cmsRequest<T>(session: SessionState, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/admin/cms/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}`, ...init.headers }
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "CMS request failed");
  }
  return response.status === 204 ? undefined as T : response.json();
}

const mapCmsSlide = (row: any): InductionSlide => ({
  id: row.id, courseId: row.courseId ?? row.course_id, slideOrder: row.slideOrder ?? row.slide_order,
  slideType: row.slideType ?? row.slide_type, title: row.title, contentJson: row.contentJson ?? row.content_json ?? {},
  siteTag: row.siteTag ?? row.site_tag ?? "global", videoUrl: row.videoUrl ?? row.video_url ?? null,
  audioUrl: row.audioUrl ?? row.audio_url ?? null, forcedWaitSeconds: row.forcedWaitSeconds ?? row.forced_wait_seconds ?? 0,
  estimatedDurationSeconds: row.estimatedDurationSeconds ?? row.estimated_duration_seconds ?? 0,
  triggerConfig: row.triggerConfig ?? row.trigger_config ?? {}, createdAt: row.createdAt ?? row.created_at,
  updatedAt: row.updatedAt ?? row.updated_at
});

export async function getCourseSlides(session: SessionState, courseId: string): Promise<InductionSlide[]> {
  const rows = await cmsRequest<any[]>(session, `courses/${courseId}/slides`);
  return rows.map(mapCmsSlide);
}
export async function createSlide(session: SessionState, courseId: string, input: Partial<InductionSlide>): Promise<InductionSlide> {
  return mapCmsSlide(await cmsRequest(session, `courses/${courseId}/slides`, { method: "POST", body: JSON.stringify(input) }));
}
export async function updateSlide(session: SessionState, courseId: string, slideId: string, input: Partial<InductionSlide>): Promise<InductionSlide> {
  return mapCmsSlide(await cmsRequest(session, `courses/${courseId}/slides/${slideId}`, { method: "PATCH", body: JSON.stringify(input) }));
}
export async function deleteSlide(session: SessionState, courseId: string, slideId: string): Promise<void> {
  await cmsRequest(session, `courses/${courseId}/slides/${slideId}`, { method: "DELETE" });
}
export async function reorderSlides(session: SessionState, courseId: string, orders: Array<{ id: string; slideOrder: number }>): Promise<void> {
  await cmsRequest(session, `courses/${courseId}/slides/reorder`, { method: "POST", body: JSON.stringify({ orders: orders.map(({ id, slideOrder }) => ({ slideId: id, slideOrder })) }) });
}
export async function getSlideQuestions(session: SessionState, slideId: string): Promise<SlideQuestion[]> {
  const rows = await cmsRequest<any[]>(session, `slides/${slideId}/questions`);
  return rows.map((q) => ({ ...q, correctAnswer: q.correctAnswer ?? q.correct_answer ?? 0,
    correctAnswers: q.correctAnswers ?? q.correct_answers, isCritical: q.isCritical ?? q.is_critical ?? false,
    questionType: q.questionType ?? q.question_type ?? "single_choice", sortOrder: q.sortOrder ?? q.sort_order ?? 0,
    acceptedAnswers: q.acceptedAnswers ?? q.accepted_answers ?? [] }));
}
export async function createSlideQuestion(session: SessionState, slideId: string, input: Partial<SlideQuestion>): Promise<SlideQuestion> {
  return cmsRequest(session, `slides/${slideId}/questions`, { method: "POST", body: JSON.stringify(input) });
}
export async function updateSlideQuestion(session: SessionState, slideId: string, questionId: string, input: Partial<SlideQuestion>): Promise<SlideQuestion> {
  return cmsRequest(session, `slides/${slideId}/questions/${questionId}`, { method: "PATCH", body: JSON.stringify(input) });
}
export async function deleteSlideQuestion(session: SessionState, slideId: string, questionId: string | number): Promise<void> {
  await cmsRequest(session, `slides/${slideId}/questions/${questionId}`, { method: "DELETE" });
}
export async function getCourseTemplates(session: SessionState): Promise<InductionCourse[]> {
  const rows = await cmsRequest<any[]>(session, "templates");
  return rows.map((row) => mapInductionCourse(row, true));
}
export async function markCourseAsTemplate(session: SessionState, courseId: string, isTemplate: boolean): Promise<void> {
  await cmsRequest(session, `courses/${courseId}/mark-template`, { method: "POST", body: JSON.stringify({ isTemplate }) });
}
export async function uploadInductionAsset(session: SessionState, file: File, folder: string): Promise<{ url: string }> {
  const key = `${session.user.id}/${folder}/${crypto.randomUUID()}-${file.name}`;
  const { data, error } = await supabase.storage.from("induction-assets").upload(key, file, { upsert: false });
  if (error) throw error;
  const { data: publicUrl } = supabase.storage.from("induction-assets").getPublicUrl(data.path);
  return { url: publicUrl.publicUrl };
}

async function adminJson<T>(session: SessionState, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}/admin/${path}`, { ...init, headers: {
    Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", ...init.headers
  } });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `Admin request failed (${response.status})`);
    }
    throw new Error(`Admin request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  if (!contentType.includes("application/json")) {
    throw new Error("Invalid response format received from server.");
  }
  return response.json();
}

export const getReportsOverview = (session: SessionState) => adminJson<ReportsOverview>(session, "reports/overview");
export const getAttemptedInductionsReport = (session: SessionState) => adminJson<AttemptedInductionReport[]>(session, "reports/attempted-inductions");
export const getCertificateStatusesReport = (session: SessionState) => adminJson<CertificateStatusReport[]>(session, "reports/certificate-statuses");
export const getExpiringCertificatesReport = (session: SessionState) => adminJson<ExpiringCertificateReport[]>(session, "reports/expiring-certificates");
export const getExpiringDocumentsReport = (session: SessionState) => adminJson<ExpiringDocumentReport[]>(session, "reports/expiring-documents");
export const getDocumentsForApprovalReport = (session: SessionState) => adminJson<DocumentApprovalReport[]>(session, "reports/documents-for-approval");
export const getScheduledStatusReport = (session: SessionState) => adminJson<ScheduledStatusReport[]>(session, "reports/scheduled-status");

export const getInductionSchedules = async (session: SessionState): Promise<InductionSchedule[]> => {
  try {
    const res = await adminJson<InductionSchedule[]>(session, "schedules");
    if (Array.isArray(res)) return res;
  } catch (err) {
    console.warn("API schedules fetch failed, falling back to direct Supabase query:", err);
  }
  const { data, error } = await supabase
    .from("induction_schedules")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as InductionSchedule[]) ?? [];
};

export const createInductionSchedule = async (session: SessionState, input: Partial<InductionSchedule>): Promise<InductionSchedule> => {
  try {
    return await adminJson<InductionSchedule>(session, "schedules", { method: "POST", body: JSON.stringify(input) });
  } catch (err) {
    console.warn("API create schedule failed, falling back to direct Supabase query:", err);
  }
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("induction_schedules")
    .insert({
      name: input.name,
      description: input.description ?? null,
      is_active: input.isActive ?? true,
      created_by: session.user.id,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();
  if (error) throw error;
  return data as InductionSchedule;
};

export const updateInductionSchedule = async (session: SessionState, id: string, input: Partial<InductionSchedule>): Promise<InductionSchedule> => {
  try {
    return await adminJson<InductionSchedule>(session, `schedules/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  } catch (err) {
    console.warn("API update schedule failed, falling back to direct Supabase query:", err);
  }
  const { data, error } = await supabase
    .from("induction_schedules")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as InductionSchedule;
};

export const deleteInductionSchedule = async (session: SessionState, id: string): Promise<void> => {
  try {
    await adminJson<void>(session, `schedules/${id}`, { method: "DELETE" });
    return;
  } catch (err) {
    console.warn("API delete schedule failed, falling back to direct Supabase query:", err);
  }
  const { error } = await supabase.from("induction_schedules").delete().eq("id", id);
  if (error) throw error;
};

export const getScheduleItems = async (session: SessionState, id: string): Promise<InductionScheduleItem[]> => {
  try {
    const res = await adminJson<InductionScheduleItem[]>(session, `schedules/${id}/items`);
    if (Array.isArray(res)) return res;
  } catch (err) {
    console.warn("API schedule items fetch failed, falling back to direct Supabase query:", err);
  }
  const { data, error } = await supabase
    .from("induction_schedule_items")
    .select("*, course:induction_courses(*)")
    .eq("schedule_id", id)
    .order("sequence_order", { ascending: true });
  if (error) throw error;
  return (data as InductionScheduleItem[]) ?? [];
};

export const addScheduleItem = async (session: SessionState, id: string, input: any): Promise<InductionScheduleItem> => {
  try {
    return await adminJson<InductionScheduleItem>(session, `schedules/${id}/items`, { method: "POST", body: JSON.stringify(input) });
  } catch (err) {
    console.warn("API add schedule item failed, falling back to direct Supabase query:", err);
  }
  const { data, error } = await supabase
    .from("induction_schedule_items")
    .insert({
      schedule_id: id,
      course_id: input.courseId ?? null,
      title: input.title ?? null,
      sequence_order: input.sequenceOrder ?? 1,
      delay_days: input.delayDays ?? 0,
      delay_type: input.delayType ?? "after_completion",
      fixed_date: input.fixedDate ?? null,
      expiry_interval: input.expiryInterval ?? null,
      trigger_config: input.triggerConfig ?? {},
      is_required: input.isRequired ?? true,
      created_at: new Date().toISOString()
    })
    .select("*, course:induction_courses(*)")
    .single();
  if (error) throw error;
  return data as InductionScheduleItem;
};

export const deleteScheduleItem = async (session: SessionState, scheduleId: string, itemId: string): Promise<void> => {
  try {
    await adminJson<void>(session, `schedules/${scheduleId}/items/${itemId}`, { method: "DELETE" });
    return;
  } catch (err) {
    console.warn("API delete schedule item failed, falling back to direct Supabase query:", err);
  }
  const { error } = await supabase.from("induction_schedule_items").delete().eq("id", itemId);
  if (error) throw error;
};

export const getScheduleEnrollments = async (session: SessionState, id: string): Promise<InductionScheduleEnrollment[]> => {
  try {
    const res = await adminJson<InductionScheduleEnrollment[]>(session, `schedules/${id}/enrollments`);
    if (Array.isArray(res)) return res;
  } catch (err) {
    console.warn("API schedule enrollments fetch failed, falling back to direct Supabase query:", err);
  }
  const { data, error } = await supabase
    .from("induction_schedule_enrollments")
    .select("*, driver:profiles!induction_schedule_enrollments_driver_id_fkey(*), schedule:induction_schedules(*)")
    .eq("schedule_id", id)
    .order("enrolled_at", { ascending: false });
  if (error) throw error;
  return (data as InductionScheduleEnrollment[]) ?? [];
};

export const enrollDriverInSchedule = async (session: SessionState, id: string, driverId: string): Promise<InductionScheduleEnrollment> => {
  try {
    return await adminJson<InductionScheduleEnrollment>(session, `schedules/${id}/enroll`, { method: "POST", body: JSON.stringify({ driverId }) });
  } catch (err) {
    console.warn("API enroll driver failed, falling back to direct Supabase query:", err);
  }
  const { data, error } = await supabase
    .from("induction_schedule_enrollments")
    .insert({
      schedule_id: id,
      driver_id: driverId,
      enrolled_by: session.user.id,
      enrolled_at: new Date().toISOString(),
      status: "active",
      current_item_index: 0
    })
    .select("*, schedule:induction_schedules(*)")
    .single();
  if (error) throw error;
  return data as InductionScheduleEnrollment;
};

export const unenrollDriverFromSchedule = async (session: SessionState, scheduleId: string, enrollmentId: string): Promise<void> => {
  try {
    await adminJson<void>(session, `schedules/${scheduleId}/enroll/${enrollmentId}`, { method: "DELETE" });
    return;
  } catch (err) {
    console.warn("API unenroll driver failed, falling back to direct Supabase query:", err);
  }
  const { error } = await supabase.from("induction_schedule_enrollments").delete().eq("id", enrollmentId);
  if (error) throw error;
};

export const cancelScheduleInvitation = async (session: SessionState, scheduleId: string, enrollmentId: string, reason?: string): Promise<void> => {
  try {
    await adminJson<void>(session, `schedules/${scheduleId}/enroll/${enrollmentId}/cancel-invitation`, { method: "POST", body: JSON.stringify({ reason }) });
    return;
  } catch (err) {
    console.warn("API cancel invitation failed, falling back to direct Supabase query:", err);
  }
  const { error } = await supabase
    .from("induction_schedule_enrollments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", enrollmentId);
  if (error) throw error;
};

export const processScheduleInvitations = async (session: SessionState): Promise<{ processed: number }> => {
  try {
    return await adminJson<{ processed: number }>(session, "schedules/process-invitations", { method: "POST" });
  } catch (err) {
    console.warn("API process invitations failed, returning fallback count:", err);
  }
  return { processed: 0 };
};
