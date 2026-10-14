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
  mediaJson?: Record<string, unknown>;
  videoDurationSeconds?: number;
  requireFullWatch?: boolean;
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
  correctAnswer?: number;
  correct_answer?: number;
  correctAnswers?: number[];
  questionType?: string;
  question_type?: string;
  placement?: string;
  sortOrder?: number;
  sort_order?: number;
  acceptedAnswers?: number[];
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
  archivedAt: string | null;
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
    certificateRate: number;
    certificateCount: number;
    licenceRate: number;
    licenceCount: number;
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
  valid?: boolean;
  organizationName?: string;
  message?: string;
  driverName?: string;
  certificateId?: string;
  verificationCode?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  licenceClass?: string | null;
  issuingState?: string | null;
  depotLocation?: string | null;
  certificate?: {
    completionId: string;
    verificationCode: string;
    verificationUrl: string;
    issuedAt: string;
    expiresAt?: string | null;
  };
  driver?: {
    fullName: string;
  };
}

export interface QuizQuestionResult {
  id: number;
  category?: string;
  isCritical?: boolean;
  correct: boolean;
  // Only populated when the attempt passed, so a failed attempt
  // never reveals the correct answer to the driver.
  correctAnswer?: number;
  explanation?: string;
}

export interface QuizSubmitResult {
  score: number;
  passed: boolean;
  attempt?: QuizAttempt;
  questions?: Array<{ id: number; explanation: string; correctAnswer: number }>;
  results?: QuizQuestionResult[];
  retryAt?: string;
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

export interface InductionCourse {
  id: string;
  title: string;
  description: string;
  templateId: string | null;
  versionLabel: string;
  revisionNotes: string;
  isTemplate: boolean;
  isCurrent: boolean;
  siteTag: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// BNT LOGISTICS COMPLIANCE & FLEET MANAGEMENT TYPES
// ============================================================

export type AuditCategory = "Transport" | "Work Health & Safety" | "Operational Risk" | "Fleet Compliance";
export type AuditStatus = "Passed" | "In Progress" | "No Attempt" | "Action Required";

export interface ComplianceAudit {
  id: string;
  name: string;
  category: AuditCategory;
  assignedModule: string;
  status: AuditStatus;
  attemptsCount: number;
  description: string;
  lastAttemptDate?: string | null;
}

export type SOPCategory = "SOP" | "Policy & Procedure" | "Licensing" | "Product Inductions";
export type SOPStatus = "Passed" | "In Progress" | "No Attempt" | "Expired";

export interface SOPItem {
  id: string;
  code: string;
  name: string;
  category: SOPCategory;
  isMandatory: boolean;
  dueDate?: string | null;
  status: SOPStatus;
  contentSummary: string;
  videoUrl?: string;
  quizQuestionsCount?: number;
}

// ============================================================
// COMPLIANCE AUDITS (admin-assigned safety audits)
// ============================================================

export type ComplianceAuditCategory =
  | "Transport"
  | "Work Health & Safety"
  | "Operational Risk"
  | "Fleet Compliance";

export type AuditAssignmentStatus = "No Attempt" | "In Progress" | "Passed" | "Action Required";

export interface ComplianceAuditRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  questions: string[];
  dueDate: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AuditAssignment {
  id: string;
  auditId: string;
  audit: ComplianceAuditRecord;
  status: AuditAssignmentStatus;
  dueDate: string | null;
  attemptsCount: number;
  lastAttemptDate: string | null;
  completedAt: string | null;
}

export interface AdminAuditAssignmentRow extends AuditAssignment {
  driverName: string;
  driverEmail: string;
}

export type ComplianceDocCategory = "Licence" | "Insurance" | "Certificates" | "SLA / Contract";
export type ComplianceDocStatus = "Approved" | "Pending" | "Expired" | "Action Required" | "Not Submitted";

export interface ComplianceDocumentRequirement {
  id: string;
  name: string;
  category: ComplianceDocCategory;
  isMandatory: boolean;
  expiryDate: string | null;
  status: ComplianceDocStatus;
  historyStatus: string;
  uploadedFileUrl?: string | null;
  uploadedFileName?: string | null;
  uploadedAt?: string | null;
  rejectionReason?: string | null;
  documentType?: string | null;
}

export interface VehicleRecord {
  id: string;
  rego: string;
  makeModel: string;
  bodyType: string;
  branchName: string;
  driverNumber: string;
  driverName: string;
  regoExpiryDate: string;
  dgExpiryDate?: string | null;
  scbaServiceDueDate?: string | null;
  vehicleCheckApproved: boolean;
  regoCheckApproved: boolean;
  status: "Active" | "Inactive" | "Maintenance Required";
  qrPassCode: string;
  contactNumber?: string;
}

export interface VehiclePassVerificationResult {
  verified: boolean;
  message?: string;
  organizationName?: string;
  vehicle?: {
    passCode: string;
    rego: string;
    makeModel: string;
    bodyType?: string | null;
    branchName?: string | null;
    status: string;
    regoExpiryDate?: string | null;
    dgExpiryDate?: string | null;
    scbaServiceDueDate?: string | null;
  };
  driver?: {
    fullName: string;
    email: string;
  };
}

export interface DriverVerificationResult {
  verified: boolean;
  message?: string;
  organizationName?: string;
  driver?: {
    driverId: string;
    fullName: string;
    phone?: string;
    licenceClass?: string;
    inductionStatus: string;
    inductionCompleted: boolean;
    completedAt?: string | null;
    certificateExpiresAt?: string | null;
  };
}

export interface ComplianceOverview {
  complianceScore: number;
  auditsCount: { total: number; completed: number; pending: number };
  sopsCount: { total: number; completed: number; pending: number };
  documentsCount: { total: number; approved: number; expiringSoon: number; actionRequired: number };
  vehiclesCount: { total: number; active: number };
}

export interface ContractorCompanyRecord {
  id: string;
  companyName: string;
  tradingName: string;
  abn: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  nhvasAccreditation: "Basic Fatigue" | "Mass Management" | "Maintenance Management" | "None";
  nhvasNumber: string;
  publicLiabilityPolicy: string;
  publicLiabilityExpiry: string;
  publicLiabilityFileUrl?: string | null;
  workersCompPolicy: string;
  workersCompExpiry: string;
  workersCompFileUrl?: string | null;
  primaryDepot: string;
  status: "Compliant" | "Pending Review" | "Suspended";
}

export type IncidentCategory = "Near Miss" | "Vehicle Defect" | "Spill / Leak" | "Safety Hazard" | "Injury / Illness";
export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";

export interface SafetyIncidentRecord {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  location: string;
  description: string;
  immediateActionsTaken: string;
  reportedBy: string;
  reportedAt: string;
  photoFileName?: string;
  status: "Open" | "Under Review" | "Resolved";
  riskScore: number;
}

export interface SiteCheckinRecord {
  id: string;
  depotName: string;
  driverName: string;
  vehicleRego: string;
  checkinTime: string;
  checkoutTime?: string | null;
  hoursDrivenToday: number;
  hoursRestedLast24h: number;
  fitnessDeclaration: boolean;
  status: "Active" | "Checked Out";
}

export interface PreTripCheckItem {
  id: string;
  category: string;
  label: string;
  status: "Pass" | "Defect";
  notes?: string;
  photos?: string[];
}

export interface PreTripInspectionRecord {
  id: string;
  driverId: string;
  driverName: string;
  vehicleRego: string;
  odometer: string;
  trailerId?: string;
  inspectedAt: string;
  overallStatus: "Fit for Duty" | "Minor Defect" | "Out of Service";
  items: PreTripCheckItem[];
  driverSignature: string;
}

// --- Worksite Management ---
export interface WorksiteRecord {
  id: string;
  name: string;
  address: string;
  siteCode: string;
  qrToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorksiteAttendanceRecord {
  id: string;
  worksiteId: string;
  worksiteName: string;
  userId: string;
  driverName: string;
  signinPhotoUrl: string;
  signinAt: string;
  signoutAt: string | null;
  signoutPhotoUrl: string | null;
  status: string;
  durationMinutes: number | null;
}

export interface WorksiteAttendanceReport {
  driverId: string;
  driverName: string;
  worksiteId: string;
  worksiteName: string;
  verificationCode: string;
  signinAt: string;
  signoutAt: string | null;
  status: string;
  durationMinutes: number | null;
  signinPhotoUrl: string | null;
  signoutPhotoUrl: string | null;
}

export interface InductionScheduleInvitation {
  id: string;
  enrollmentId: string;
  scheduleItemId: string;
  deliveryMethod: string;
  status: "pending" | "sent" | "delivered" | "opened" | "clicked" | "failed" | "bounced";
  metadata: {
    driver_email: string;
    driver_name: string;
    item_title: string;
    schedule_name: string;
    due_date?: string;
    expiry_interval?: string;
  };
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// INDUCTION SCHEDULES
// ============================================================

export interface InductionSchedule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InductionScheduleItem {
  id: string;
  scheduleId: string;
  courseId: string | null;
  title: string;
  sequenceOrder: number;
  delayType: "after_completion" | "after_enrollment" | "fixed_date";
  delayDays: number;
  fixedDate: string | null;
  expiryInterval: string | null;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
  course?: InductionCourse;
}

export interface InductionScheduleEnrollment {
  id: string;
  scheduleId: string;
  driverId: string;
  enrolledAt: string;
  enrolledBy: string | null;
  status: "active" | "completed" | "cancelled" | "paused";
  currentItemIndex: number;
  completedAt: string | null;
  driver?: DriverProfile;
  schedule?: InductionSchedule;
  enrolledByProfile?: { id: string; email: string; fullName: string };
}

// ============================================================
// SITE INDUCTION COURSES - SLIDES & QUESTIONS
// ============================================================

export interface InductionSlide {
  id: string;
  courseId: string;
  slideOrder: number;
  slideType: string;
  title: string;
  contentJson: Record<string, any>;
  siteTag: string;
  videoUrl: string | null;
  audioUrl: string | null;
  forcedWaitSeconds: number;
  estimatedDurationSeconds: number;
  triggerConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SlideExtras {
  mediaJson?: Record<string, unknown>;
  documents?: Array<{ url: string; title?: string; name?: string; requireRead?: boolean; pages?: number }>;
  questions?: SlideQuestion[];
  images?: Array<{ url: string; caption?: string; alt?: string }>;
  attachments?: Array<{ url: string; name?: string }>;
  voiceover?: { url: string };
  warning?: string;
  textSize?: string;
  videoUrl?: string;
  audioUrl?: string;
  forcedWaitSeconds?: number;
  estimatedDurationSeconds?: number;
  triggerConfig?: Record<string, unknown>;
}

export interface SlideQuestion {
  id: string;
  question: string;
  prompt?: string;
  options: string[];
  correctAnswer: number;
  correct_answer?: number;
  correctAnswers?: number[];
  explanation: string;
  category: string;
  isCritical: boolean;
  is_critical?: boolean;
  questionType: "single_choice" | "text_input" | "multiple_choice";
  question_type?: string;
  placement: "separate_page" | "below_slide";
  sortOrder: number;
  sort_order?: number;
  acceptedAnswers?: string[];
}

// ============================================================
// BRANDING & POLICIES
// ============================================================

export interface BrandingSettings {
  id: string;
  organizationName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  customCss: string;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  welcomeText?: string;
  logoPath?: string | null;
}

export interface PolicyRecord {
  id: string;
  title: string;
  description: string;
  version: string;
  status: "draft" | "published" | "archived";
  content: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  versionId: string;
  name: string;
  versionLabel: string;
  signed: boolean;
}

export interface PolicyListItem {
  id: string;
  title: string;
  version: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  signatureCount: number;
  totalDrivers: number;
  policyId: string;
  name: string;
  versionLabel: string;
  signedCount: number;
}

export interface PolicySignatureSummary {
  policyId: string;
  policyTitle: string;
  policyVersion: string;
  signedCount: number;
  pendingCount: number;
  totalDrivers: number;
  driverId?: string;
  signedAt: string;
  driverName: string;
  driverEmail: string;
  signatureText: string;
}

export interface PolicyPendingDriver {
  id: string;
  fullName: string;
  email: string;
  depotLocation: string;
  driverId?: string;
  driverName?: string;
  driverEmail?: string;
}

// ============================================================
// REPORTS
// ============================================================

export interface ReportsOverview {
  totalDrivers: number;
  completedInductions: number;
  pendingInductions: number;
  certificatesIssued: number;
  documentsPending: number;
  expiringSoon: number;
  attemptedInductions?: number;
  validCertificates?: number;
  expiringCertificates?: number;
  expiredCertificates?: number;
  expiringDocuments?: number;
  pendingApprovals?: number;
  activeSchedules?: number;
  overdueSchedules?: number;
}

export interface AttemptedInductionReport {
  driverId: string;
  driverName: string;
  email: string;
  inductionTitle: string;
  attemptDate: string;
  score: number;
  passed: boolean;
  status: string;
}

export interface CertificateStatusReport {
  driverId: string;
  driverName: string;
  email: string;
  certificateId: string;
  issuedAt: string;
  expiresAt: string | null;
  status: "valid" | "expiring" | "expired";
  verificationCode: string;
}

export interface ExpiringCertificateReport {
  driverId: string;
  driverName: string;
  email: string;
  certificateId: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface ExpiringDocumentReport {
  driverId: string;
  driverName: string;
  email: string;
  documentType: string;
  documentName: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface DocumentApprovalReport {
  driverId: string;
  driverName: string;
  email: string;
  documentType: string;
  documentName: string;
  uploadedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface ScheduledStatusReport {
  driverId: string;
  driverName: string;
  email: string;
  scheduleName: string;
  currentItem: string;
  status: "active" | "completed" | "cancelled" | "paused";
  enrolledAt: string;
  completedAt: string | null;
}
