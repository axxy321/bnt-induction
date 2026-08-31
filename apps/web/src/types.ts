export type UserRole = "driver" | "admin";
export type ThemeMode = "light" | "dark";
export type DriverStatus = "Not Started" | "In Progress" | "Completed";
export type DocumentType =
  | "driver_license"
  | "medical_certificate"
  | "identity_proof"
  | "driving_history"
  | "right_to_work"
  | "nhvas_bfm_certificate"
  | "dangerous_goods_license"
  | "hrwl_forklift"
  | "identity_selfie";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  driverId: string | null;
  mustChangePassword?: boolean;
}

export interface SessionState {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface DriverSelfRegisterInput {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredLanguage: string;
  password: string;
  depotCode?: string;
  licenceClass?: string;
  issuingState?: string;
  licenceNumber?: string;
}

export interface DriverFormInput {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredLanguage: string;
  licenceClass?: string;
  issuingState?: string;
  licenceNumber?: string;
  depotLocation?: string;
}

export interface DriverProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  preferredLanguage: string;
  licenceClass?: string;
  issuingState?: string;
  licenceNumber?: string;
  depotLocation?: string;
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedDocument {
  id: string;
  driverId: string;
  name: string;
  type: DocumentType;
  mimeType: string;
  size: number;
  fileUrl: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  verifiedByAdmin: boolean;
  uploadedAt: string;
  expiresAt: string | null;
}

export interface LearningSectionProgress {
  sectionId: string;
  title: string;
  format: string;
  summary: string;
  videoUrl?: string;
  completed: boolean;
  completedAt: string | null;
}

export interface ProgressState {
  driverId: string;
  currentStep: number;
  completionPercentage: number;
  quizScore: number | null;
  completedStepIds: number[];
  completedAt: string | null;
  declarationAgreedAt?: string | null;
  updatedAt: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  explanation: string;
  category?: string;
  isCritical?: boolean;
}

export interface QuizAttempt {
  id: string;
  driverId: string;
  answers: Record<number, number>;
  score: number;
  passed: boolean;
  attemptedAt: string;
  categoryScores?: Record<string, number>;
  failedCritical?: boolean;
  criticalQuestionsAsked?: number;
}

export interface DeclarationRecord {
  driverId: string;
  accepted: boolean;
  signature: string;
  agreedAt: string;
}

export interface CertificateRecord {
  id: string;
  driverId: string;
  completionId: string;
  issuedAt: string;
  expiresAt: string | null;
  verificationCode: string;
  verificationUrl: string;
}

export interface DriverFeedback {
  id: string;
  userId: string;
  clarityRating: number;
  issues: string;
  submittedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DriverBundle {
  organizationName: string;
  driver: DriverProfile;
  progress: ProgressState;
  documents: UploadedDocument[];
  learningProgress: LearningSectionProgress[];
  declaration: DeclarationRecord | null;
  certificate: CertificateRecord | null;
  quizAttempts: QuizAttempt[];
  feedback: DriverFeedback | null;
}

export interface AdminDriverRow extends DriverProfile {
  currentStep: number;
  completionPercentage: number;
  quizScore: number | null;
  completedAt: string | null;
  certificateId: string | null;
  verificationCode: string | null;
  documents: UploadedDocument[];
  auditTrail: AuditLog[];
  lastActivityAt: string | null;
  feedback: DriverFeedback | null;
  completionHours: number | null;
}

export interface AdminOverview {
  organizationName: string;
  metrics: {
    totalDrivers: number;
    completedDrivers: number;
    pendingDrivers: number;
    inProgressDrivers: number;
    completionRate: number;
    averageQuizScore: number;
    averageCompletionHours: number;
  };
  charts: {
    completionTrend: Array<{ label: string; value: number }>;
    quizBands: Array<{ label: string; value: number }>;
  };
  insights: {
    multiFailDrivers: AdminDriverRow[];
    stuckDrivers: AdminDriverRow[];
    followUpDrivers: AdminDriverRow[];
  };
  drivers: AdminDriverRow[];
  recentActivity: AuditLog[];
  recentFeedback: DriverFeedback[];
}

export interface CertificateVerificationResult {
  verified: boolean;
  organizationName?: string;
  certificate?: {
    completionId: string;
    verificationCode: string;
    verificationUrl: string;
    issuedAt: string;
  };
  driver?: {
    fullName: string;
  };
  message?: string;
}

export interface QuizSubmitResult {
  score: number;
  passed: boolean;
  attempt?: QuizAttempt;
  questions?: Array<{ id: number; explanation: string; correctAnswer: number }>;
  state?: DriverBundle;
  categoryScores?: Record<string, number>;
  failedCritical?: boolean;
  failedCriticalReason?: string;
}

// ============================================================
// MILESTONE 1: Versioned Inductions
// ============================================================

export interface InductionVersion {
  id: string | null;
  versionLabel: string;
  revisionNotes: string;
  publishedAt: string | null;
  hasPendingVersion: boolean;
}

export interface InductionVersionRecord {
  id: string;
  versionLabel: string;
  revisionNotes: string;
  publishedBy: string | null;
  publishedAt: string;
  isCurrent: boolean;
  createdAt: string;
}
