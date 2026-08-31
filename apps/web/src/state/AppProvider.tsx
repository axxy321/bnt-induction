import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getInductionVersion } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  AdminOverview,
  CertificateVerificationResult,
  DriverBundle,
  DriverSelfRegisterInput,
  InductionVersion,
  QuizQuestion,
  QuizSubmitResult,
  SessionState
} from "../types";

interface DriverFormInput {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredLanguage: string;
}

interface AppContextValue {
  session: SessionState | null;
  driverBundle: DriverBundle | null;
  adminOverview: AdminOverview | null;
  quizQuestions: QuizQuestion[];
  inductionVersion: InductionVersion | null;
  loading: boolean;
  authLoading: boolean;
  login: (input: { email: string; password: string; role: "driver" | "admin" }) => Promise<void>;
  logout: () => Promise<void>;
  refreshDriverBundle: () => Promise<void>;
  refreshAdminOverview: () => Promise<void>;
  saveProfile: (input: DriverFormInput) => Promise<DriverBundle>;
  uploadDocument: (input: { type: string; file: File }, onProgress?: (progress: number) => void) => Promise<void>;
  saveStep: (step: number, payload?: Record<string, unknown>) => Promise<DriverBundle>;
  startVideoSection: (sectionId: string) => Promise<void>;
  submitQuiz: (answers: Record<number, number>) => Promise<QuizSubmitResult>;
  submitDriverFeedback: (input: { clarityRating: number; issues: string }) => Promise<DriverBundle>;
  generateCertificate: () => Promise<{ pdfBase64: string }>;
  createDriver: (input: DriverFormInput & { password: string }) => Promise<void>;
  registerDriver: (input: DriverSelfRegisterInput) => Promise<void>;
  updateDriverByAdmin: (driverId: string, input: DriverFormInput) => Promise<void>;
  resetDriverPassword: (driverId: string, password: string) => Promise<void>;
  resetDriverInduction: (driverId: string) => Promise<void>;
  deleteDriver: (driverId: string) => Promise<void>;
  exportAdminReport: (
    format: "csv" | "pdf",
    options?: { from?: string; to?: string; scope?: "drivers" | "audit"; driverId?: string }
  ) => Promise<Blob>;
  verifyCertificate: (code: string) => Promise<CertificateVerificationResult>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [driverBundle, setDriverBundle] = useState<DriverBundle | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [inductionVersion, setInductionVersion] = useState<InductionVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

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
        const [bundle, questions, version] = await Promise.all([
          api.getDriverProfile(nextSession).catch((err) => {
            console.warn("Driver profile load fallback:", err);
            return null as any;
          }),
          api.getQuizQuestions(nextSession).catch(() => ({ questions: [] })),
          getInductionVersion(nextSession).catch(() => null)
        ]);
        setDriverBundle(bundle);
        setQuizQuestions(questions.questions);
        setInductionVersion(version);
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
    try {
      const nextSession = await api.login(input);
      setSession(nextSession);
      await syncSession(nextSession);
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

  const createDriver = useCallback(async (input: DriverFormInput & { password: string }) => {
    if (!session) throw new Error("You are not logged in.");
    await api.createDriver(session, input);
    await refreshAdminOverview();
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

  const resetDriverPassword = useCallback(async (driverId: string, password: string) => {
    if (!session) throw new Error("You are not logged in.");
    await api.resetDriverPassword(session, driverId, password);
    await refreshAdminOverview();
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
      deleteDriver,
      exportAdminReport,
      verifyCertificate
    }),
    [
      session, driverBundle, adminOverview, quizQuestions, inductionVersion, loading, authLoading,
      login, logout, refreshDriverBundle, refreshAdminOverview, saveProfile, uploadDriverDocument,
      saveDriverStep, startDriverVideoSection, submitDriverQuiz, submitDriverFeedback, generateDriverCertificate,
      createDriver, registerDriver, updateDriverByAdmin, resetDriverPassword,
      resetDriverInduction, deleteDriver, exportAdminReport, verifyCertificate
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used inside AppProvider.");
  return context;
}
