import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, getInductionVersion } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type {
  AdminOverview,
  DriverBundle,
  DriverSelfRegisterInput,
  InductionVersion,
  QuizQuestion,
  SessionState
} from "../types";
import { AppContext, type AppContextValue, type DriverCreateResult, type DriverFormInput } from "./AppContext";

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [driverBundle, setDriverBundle] = useState<DriverBundle | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [inductionVersion, setInductionVersion] = useState<InductionVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrapSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        void syncSession(nextSession, true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function bootstrapSession() {
    try {
      const { data } = await supabase.auth.getSession();
      await syncSession(data.session, false);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("bootstrapSession failed", error);
      }
      setLoading(false);
    }
  }

  async function syncSession(target?: Session | SessionState | null, isSilent = false) {
    if (!isSilent) setLoading(true);
    try {
      let nextSession: SessionState | null = null;
      if (target === undefined) {
        const authSession = (await supabase.auth.getSession()).data.session;
        nextSession = await api.hydrateSession(authSession);
      } else if (target && "user" in target && "accessToken" in target) {
        nextSession = target as SessionState;
      } else {
        nextSession = await api.hydrateSession(target as Session | null);
      }

      setSession(nextSession ?? null);
      if (!nextSession) {
        setDriverBundle(null);
        setAdminOverview(null);
        setQuizQuestions([]);
        return;
      }

      if (nextSession.user.role === "driver") {
        const bundle = await api.getDriverProfile(nextSession);
        setDriverBundle(bundle);

        void api.getQuizQuestions(nextSession).then((questions) => {
          if (questions?.questions) setQuizQuestions(questions.questions);
        }).catch((err) => {
          console.warn("Quiz questions load notice:", err);
        });

        void getInductionVersion(nextSession).then((v) => {
          if (v) setInductionVersion(v);
        }).catch(() => {});

        setAdminOverview(null);
      } else {
        const overview = await api.getAdminOverview(nextSession).catch((err) => {
          console.warn("Admin overview load fallback:", err);
          return null as any;
        });
        setAdminOverview(overview);
        setDriverBundle(null);
        setQuizQuestions([]);
      }
    } catch (error) {
      console.error("syncSession failed", error);
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (input: { email: string; password: string; role: "driver" | "admin" }) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const nextSession = await api.login(input);
      setSession(nextSession);
      await syncSession(nextSession);
    } catch (err: any) {
      setAuthError(err?.message || "Sign in failed. Please verify your email and password.");
      throw err;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthLoading(true);
    try {
      await api.logout();
      setSession(null);
      setDriverBundle(null);
      setAdminOverview(null);
      setQuizQuestions([]);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshDriverBundle = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setDriverBundle(await api.getDriverProfile(session));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const refreshAdminOverview = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setAdminOverview(await api.getAdminOverview(session));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const saveProfile = useCallback(async (input: DriverFormInput) => {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.saveProfile(session, input);
    setDriverBundle(result);
    return result;
  }, [session]);

  const uploadDriverDocument = useCallback(async (input: { type: string; file: File }, onProgress?: (progress: number) => void) => {
    if (!session) throw new Error("You are not logged in.");
    await api.uploadDocument(session, input, onProgress);
    setDriverBundle(await api.getDriverProfile(session));
  }, [session]);

  const saveDriverStep = useCallback(async (step: number, payload: Record<string, unknown> = {}) => {
    if (!session) throw new Error("You are not logged in.");
    const previousBundle = driverBundle;
    const isPartialLearningSave = step === 3 && Boolean(payload.allowPartial);

    if (isPartialLearningSave && previousBundle) {
      const nextSections = new Map(
        (((payload.sections as Array<{ sectionId: string; completed: boolean }> | undefined) ?? [])).map((section) => [
          section.sectionId,
          section
        ])
      );

      setDriverBundle({
        ...previousBundle,
        learningProgress: previousBundle.learningProgress.map((section) => {
          const next = nextSections.get(section.sectionId);
          if (!next) return section;
          return {
            ...section,
            completed: next.completed,
            completedAt: next.completed ? new Date().toISOString() : null
          };
        })
      });
    }

    try {
      const result = await api.saveStep(session, step, payload);
      setDriverBundle(result);
      return result;
    } catch (error) {
      if (isPartialLearningSave && previousBundle) {
        setDriverBundle(previousBundle);
      }
      throw error;
    }
  }, [session, driverBundle]);

  const startDriverVideoSection = useCallback(async (sectionId: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.startVideoSection(session, sectionId);
  }, [session]);

  const submitDriverQuiz = useCallback(async (answers: Record<number, number>) => {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.submitQuiz(session, answers);
    setDriverBundle(result.state);
    return result;
  }, [session]);

  const generateDriverCertificate = useCallback(async () => {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.generateCertificate(session);
    setDriverBundle(result.state);
    return { pdfBase64: result.pdfBase64 };
  }, [session]);

  const submitDriverFeedback = useCallback(async (input: { clarityRating: number; issues: string }) => {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.submitDriverFeedback(session, input);
    setDriverBundle(result);
    return result;
  }, [session]);

  const createDriver = useCallback(async (input: DriverFormInput & { password: string }): Promise<DriverCreateResult> => {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.createDriver(session, input);
    await refreshAdminOverview();
    return result;
  }, [session, refreshAdminOverview]);

  const registerDriver = useCallback(async (input: DriverSelfRegisterInput) => {
    await api.registerDriver(input);
    await login({ email: input.email, password: input.password, role: "driver" });
  }, [login]);

  const updateDriverByAdmin = useCallback(async (driverId: string, input: DriverFormInput) => {
    if (!session) throw new Error("You are not logged in.");
    await api.updateDriverByAdmin(session, driverId, input);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const resetDriverPassword = useCallback(async (driverId: string, password: string): Promise<DriverCreateResult> => {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.resetDriverPassword(session, driverId, password);
    await refreshAdminOverview();
    return result;
  }, [session, refreshAdminOverview]);

  const deleteDriver = useCallback(async (driverId: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.deleteDriver(session, driverId);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

const resetDriverInduction = useCallback(async (driverId: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.resetDriverInduction(session, driverId);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const revokeDriverInduction = useCallback(async (driverId: string, reason?: string, certificateId?: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.revokeDriverInduction(session, driverId, reason || "Admin revoked induction", certificateId);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const archiveDriver = useCallback(async (driverId: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.archiveDriver(session, driverId);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const restoreDriver = useCallback(async (driverId: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.restoreDriver(session, driverId);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const bulkArchiveDrivers = useCallback(async (driverIds: string[]) => {
    if (!session) throw new Error("You are not logged in.");
    await api.bulkArchiveDrivers(session, driverIds);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const bulkRestoreDrivers = useCallback(async (driverIds: string[]) => {
    if (!session) throw new Error("You are not logged in.");
    await api.bulkRestoreDrivers(session, driverIds);
    await refreshAdminOverview();
  }, [session, refreshAdminOverview]);

  const exportAdminReport = useCallback(async (
    format: "csv" | "pdf",
    options?: { from?: string; to?: string; scope?: "drivers" | "audit"; driverId?: string }
  ) => {
    if (!session) throw new Error("You are not logged in.");
    return await api.exportAdminReport(session, format, options);
  }, [session]);

  const verifyCertificate = useCallback(async (code: string) => {
    return await api.verifyCertificate(code);
  }, []);

const value = useMemo<AppContextValue>(
    () => ({
      session,
      driverBundle,
      adminOverview,
      quizQuestions,
      inductionVersion,
      loading,
      authLoading,
      authError,
      login,
      logout,
      refreshDriverBundle,
      refreshAdminOverview,
      saveProfile,
      uploadDocument: uploadDriverDocument,
      saveStep: saveDriverStep,
      startVideoSection: startDriverVideoSection,
      submitQuiz: submitDriverQuiz,
      submitDriverFeedback,
      generateCertificate: generateDriverCertificate,
      createDriver,
      registerDriver,
      updateDriverByAdmin,
      resetDriverPassword,
      resetDriverInduction,
      revokeDriverInduction,
      archiveDriver,
      restoreDriver,
      bulkArchiveDrivers,
      bulkRestoreDrivers,
      deleteDriver,
      exportAdminReport,
      verifyCertificate
    }),
[
      session, driverBundle, adminOverview, quizQuestions, inductionVersion, loading, authLoading,
      login, logout, refreshDriverBundle, refreshAdminOverview, saveProfile, uploadDriverDocument,
      saveDriverStep, startDriverVideoSection, submitDriverQuiz, submitDriverFeedback, generateDriverCertificate,
      createDriver, registerDriver, updateDriverByAdmin, resetDriverPassword,
      resetDriverInduction, revokeDriverInduction, archiveDriver, restoreDriver, bulkArchiveDrivers, bulkRestoreDrivers, deleteDriver, exportAdminReport, verifyCertificate
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}


