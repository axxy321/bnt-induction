import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getInductionVersion } from "../lib/api";
import { supabase } from "../lib/supabase";
import {
  AdminOverview,
  CertificateVerificationResult,
  DriverBundle,
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
  submitQuiz: (answers: Record<number, number>) => Promise<QuizSubmitResult>;
  submitDriverFeedback: (input: { clarityRating: number; issues: string }) => Promise<DriverBundle>;
  generateCertificate: () => Promise<{ pdfBase64: string }>;
  createDriver: (input: DriverFormInput & { password: string }) => Promise<void>;
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
      void syncSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function bootstrapSession() {
    try {
      const { data } = await supabase.auth.getSession();
      await syncSession(data.session);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("bootstrapSession failed", error);
      }
      setLoading(false);
    }
  }

  async function syncSession(nextAuthSession: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) {
    setLoading(true);
    try {
      const nextSession = await api.hydrateSession(nextAuthSession);
      setSession(nextSession);
      if (!nextSession) {
        setDriverBundle(null);
        setAdminOverview(null);
        setQuizQuestions([]);
        return;
      }

      if (nextSession.user.role === "driver") {
        const [bundle, questions, version] = await Promise.all([
          api.getDriverProfile(nextSession),
          api.getQuizQuestions(nextSession),
          getInductionVersion(nextSession).catch(() => null)
        ]);
        setDriverBundle(bundle);
        setQuizQuestions(questions.questions);
        setInductionVersion(version);
        setAdminOverview(null);
      } else {
        const overview = await api.getAdminOverview(nextSession);
        setAdminOverview(overview);
        setDriverBundle(null);
        setQuizQuestions([]);
      }
    } catch (error) {
      console.error("syncSession failed", error);
      setSession(null);
      setDriverBundle(null);
      setAdminOverview(null);
      setQuizQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  async function login(input: { email: string; password: string; role: "driver" | "admin" }) {
    setAuthLoading(true);
    try {
      const nextSession = await api.login(input);
      setSession(nextSession);
      await syncSession((await supabase.auth.getSession()).data.session);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
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
  }

  async function refreshDriverBundle() {
    if (!session) return;
    setLoading(true);
    try {
      setDriverBundle(await api.getDriverProfile(session));
    } finally {
      setLoading(false);
    }
  }

  async function refreshAdminOverview() {
    if (!session) return;
    setLoading(true);
    try {
      setAdminOverview(await api.getAdminOverview(session));
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(input: DriverFormInput) {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.saveProfile(session, input);
    setDriverBundle(result);
    return result;
  }

  async function uploadDriverDocument(input: { type: string; file: File }, onProgress?: (progress: number) => void) {
    if (!session) throw new Error("You are not logged in.");
    await api.uploadDocument(session, input, onProgress);
    setDriverBundle(await api.getDriverProfile(session));
  }

  async function saveDriverStep(step: number, payload: Record<string, unknown> = {}) {
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
  }

  async function submitDriverQuiz(answers: Record<number, number>) {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.submitQuiz(session, answers);
    setDriverBundle(result.state);
    return result;
  }

  async function generateDriverCertificate() {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.generateCertificate(session);
    setDriverBundle(result.state);
    return { pdfBase64: result.pdfBase64 };
  }

  async function submitDriverFeedback(input: { clarityRating: number; issues: string }) {
    if (!session) throw new Error("You are not logged in.");
    const result = await api.submitDriverFeedback(session, input);
    setDriverBundle(result);
    return result;
  }

  async function createDriver(input: DriverFormInput & { password: string }) {
    if (!session) throw new Error("You are not logged in.");
    await api.createDriver(session, input);
    await refreshAdminOverview();
  }

  async function updateDriverByAdmin(driverId: string, input: DriverFormInput) {
    if (!session) throw new Error("You are not logged in.");
    await api.updateDriverByAdmin(session, driverId, input);
    await refreshAdminOverview();
  }

  async function resetDriverPassword(driverId: string, password: string) {
    if (!session) throw new Error("You are not logged in.");
    await api.resetDriverPassword(session, driverId, password);
    await refreshAdminOverview();
  }

  async function deleteDriver(driverId: string) {
    if (!session) throw new Error("You are not logged in.");
    await api.deleteDriver(session, driverId);
    await refreshAdminOverview();
  }

  async function resetDriverInduction(driverId: string) {
    if (!session) throw new Error("You are not logged in.");
    await api.resetDriverInduction(session, driverId);
    await refreshAdminOverview();
  }

  async function exportAdminReport(
    format: "csv" | "pdf",
    options?: { from?: string; to?: string; scope?: "drivers" | "audit"; driverId?: string }
  ) {
    if (!session) throw new Error("You are not logged in.");
    return await api.exportAdminReport(session, format, options);
  }

  async function verifyCertificate(code: string) {
    return await api.verifyCertificate(code);
  }

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
      submitQuiz: submitDriverQuiz,
      submitDriverFeedback,
      generateCertificate: generateDriverCertificate,
      createDriver,
      updateDriverByAdmin,
      resetDriverPassword,
      resetDriverInduction,
      deleteDriver,
      exportAdminReport,
      verifyCertificate
    }),
    [session, driverBundle, adminOverview, quizQuestions, inductionVersion, loading, authLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used inside AppProvider.");
  return context;
}
