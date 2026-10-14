import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type {
  AdminOverview,
  CertificateVerificationResult,
  DriverBundle,
  DriverSelfRegisterInput,
  InductionVersion,
  QuizQuestion,
  QuizSubmitResult,
  SessionState
} from "../types";

export interface DriverFormInput {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredLanguage: string;
}

export interface DriverCreateResult {
  emailSent: boolean;
  message?: string;
}

export interface AppContextValue {
  session: SessionState | null;
  driverBundle: DriverBundle | null;
  adminOverview: AdminOverview | null;
  quizQuestions: QuizQuestion[];
  inductionVersion: InductionVersion | null;
  loading: boolean;
  authLoading: boolean;
  authError: string | null;
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
  createDriver: (input: DriverFormInput & { password: string }) => Promise<DriverCreateResult>;
  registerDriver: (input: DriverSelfRegisterInput) => Promise<void>;
  updateDriverByAdmin: (driverId: string, input: DriverFormInput) => Promise<void>;
  resetDriverPassword: (driverId: string, password: string) => Promise<DriverCreateResult>;
  resetDriverInduction: (driverId: string) => Promise<void>;
  deleteDriver: (driverId: string) => Promise<void>;
  archiveDriver: (driverId: string) => Promise<void>;
  restoreDriver: (driverId: string) => Promise<void>;
  bulkArchiveDrivers: (driverIds: string[]) => Promise<void>;
  bulkRestoreDrivers: (driverIds: string[]) => Promise<void>;
  exportAdminReport: (
    format: "csv" | "pdf",
    options?: { from?: string; to?: string; scope?: "drivers" | "audit"; driverId?: string }
  ) => Promise<Blob>;
  verifyCertificate: (code: string) => Promise<CertificateVerificationResult>;
  revokeDriverInduction: (driverId: string, reason?: string, certificateId?: string) => Promise<void>;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppState must be used inside AppProvider.");
  return context;
}
