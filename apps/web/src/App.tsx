import { AnimatePresence, motion } from "framer-motion";
import {
  CSSProperties,
  ChangeEvent,
  Component,
  ErrorInfo,
  KeyboardEvent,
  MutableRefObject,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useTranslation } from "react-i18next";
import { useAppState } from "./state/AppProvider";
import { supabase } from "./lib/supabase";
import { api } from "./lib/api";
import bntLogo from "./assets/bnt-logistics-logo.png";
import { VideoPlayer } from "./components/VideoPlayer";
import { SignaturePad } from "./components/SignaturePad";
import { AdminCMS } from "./components/AdminCMS";
import { InductionVersionBanner } from "./components/InductionVersionBanner";
import { VerificationQueue } from "./components/VerificationQueue";
import {
  AdminDriverRow,
  AuditLog,
  CertificateVerificationResult,
  DocumentType,
  DriverBundle,
  DriverProfile,
  LearningSectionProgress,
  ThemeMode
} from "./types";

const stepTitlesBase = [
  "step_1",
  "step_2",
  "step_3",
  "step_4",
  "step_5",
  "step_6"
];

const stepDescriptions = [
  "Confirm your identity and contact details.",
  "Upload your required employment documents.",
  "Complete the safety and compliance modules.",
  "Pass the knowledge check before continuing.",
  "Accept the declaration and sign digitally.",
  "Download your certificate of completion."
];

const stepHelperNotes = [
  "This usually takes 2 to 3 minutes. Use the same details held in your work records.",
  "Have your licence, medical certificate, and ID ready before you start this step.",
  "Read one topic at a time. Mark each topic complete after you understand the key points.",
  "The quiz uses plain multiple-choice questions. You can try again if you do not pass the first time.",
  "Your agreement and timestamp are saved for compliance records.",
  "Keep a copy of your certificate for your records. Admins can verify it at any time."
];


const defaultDriverForm = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  preferredLanguage: "English"
};

const allowedFileTypes = ["application/pdf", "image/jpeg", "image/png"];
const maxFileSize = 5 * 1024 * 1024;

function usePersistentTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem("induction-theme");
    return stored === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("induction-theme", theme);
  }, [theme]);

  return [theme, setTheme] as const;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("App render error", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell">
          <div className="glass fatal-state">
            <p className="eyebrow">Something Went Wrong</p>
            <h2>We hit an unexpected issue.</h2>
            <p className="muted">Please refresh the page. If the problem continues, contact your internal support team.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = usePersistentTheme();
  const {
    session,
    driverBundle,
    adminOverview,
    quizQuestions,
    inductionVersion,
    loading,
    authLoading,
    login,
    logout,
    refreshAdminOverview,
    saveProfile,
    uploadDocument,
    saveStep,
    submitQuiz,
    submitDriverFeedback,
    generateCertificate,
    createDriver,
    updateDriverByAdmin,
    resetDriverPassword,
    resetDriverInduction,
    deleteDriver,
    exportAdminReport,
    verifyCertificate
  } = useAppState();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRole, setLoginRole] = useState<"driver" | "admin">("driver");
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  const [profileDraft, setProfileDraft] = useState<DriverProfile | null>(null);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [activeStep, setActiveStep] = useState(1);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<Record<number, { correctAnswer: number; explanation: string }> | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [signature, setSignature] = useState("");
  const [declarationErrors, setDeclarationErrors] = useState<Record<string, string>>({});
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackIssues, setFeedbackIssues] = useState("");
  
  const [selfieUrl, setSelfieUrl] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [adminFilter, setAdminFilter] = useState<"all" | "Completed" | "In Progress" | "Not Started">("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [driverForm, setDriverForm] = useState({ ...defaultDriverForm, password: "" });
  const [driverFormErrors, setDriverFormErrors] = useState<Record<string, string>>({});
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [passwordReset, setPasswordReset] = useState("");
  const [passwordResetError, setPasswordResetError] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationResult, setVerificationResult] = useState<CertificateVerificationResult | null>(null);

  const [forcedNewPassword, setForcedNewPassword] = useState("");
  const [forcedConfirmPassword, setForcedConfirmPassword] = useState("");
  const [forcedPasswordError, setForcedPasswordError] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkImportReport, setBulkImportReport] = useState<{ message: string; created: Array<{ id: string; email: string; fullName: string }>; errors: Array<{ email: string; reason: string }> } | null>(null);

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [uploadRetries, setUploadRetries] = useState<Record<string, File | null>>({});
  const [dragTarget, setDragTarget] = useState<DocumentType | null>(null);

  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [retryLabel, setRetryLabel] = useState<string | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);

  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [stepSuccess, setStepSuccess] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  function showConfirm(message: string, onConfirm: () => void) {
    setConfirmDialog({ message, onConfirm });
  }

  useEffect(() => {
    if (driverBundle) {
      setProfileDraft(driverBundle.driver);
      setActiveStep(driverBundle.progress.currentStep);
      setDeclarationAccepted(driverBundle.declaration?.accepted ?? false);
      setSignature(driverBundle.declaration?.signature ?? "");
      setHasUnsavedChanges(false);
      setProfileErrors({});
      setDeclarationErrors({});
      setFeedbackRating(driverBundle.feedback?.clarityRating ?? 5);
      setFeedbackIssues(driverBundle.feedback?.issues ?? "");
    }
  }, [driverBundle]);

  useEffect(() => {
    if (!toast && !stepSuccess) return;
    const timer = window.setTimeout(() => {
      setToast("");
      setStepSuccess("");
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, stepSuccess]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => {
      setError("");
      setRetryLabel(null);
      retryActionRef.current = null;
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setToast("You’re back online.");
    };
    const goOffline = () => {
      setIsOnline(false);
      setError("You’re offline. Changes will save again once the connection returns.");
      setRetryLabel(null);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!session || session.user.role !== "driver") return;
    if (!hasUnsavedChanges) return;
    if (!(activeStep === 1 || activeStep === 5)) return;

    const timer = window.setTimeout(() => {
      void persistCurrentStep("autosave");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [session, hasUnsavedChanges, activeStep, profileDraft, declarationAccepted, signature]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const filteredDrivers = useMemo(() => {
    const drivers = adminOverview?.drivers ?? [];
    return drivers.filter((driver) => {
      const matchesFilter = adminFilter === "all" || driver.status === adminFilter;
      const query = adminSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        driver.fullName.toLowerCase().includes(query) ||
        driver.email.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [adminFilter, adminOverview, adminSearch]);

  const selectedDriver = useMemo(
    () => adminOverview?.drivers.find((driver) => driver.id === editingDriverId) ?? null,
    [adminOverview, editingDriverId]
  );

  const allowedStep = useMemo(
    () => {
      const ids = driverBundle?.progress.completedStepIds ?? [];
      return Math.min(6, (ids.length ? Math.max(...ids) : 0) + 1);
    },
    [driverBundle]
  );

  const completionLabel = hasUnsavedChanges
    ? "Unsaved changes"
    : driverBundle?.progress.updatedAt
      ? `Last saved ${new Date(driverBundle.progress.updatedAt).toLocaleTimeString()}`
      : "Progress will save automatically";

  function clearErrorState() {
    setError("");
    setRetryLabel(null);
    retryActionRef.current = null;
  }

  function setActionError(caught: unknown, retryLabelText?: string, retryAction?: () => Promise<void>) {
    setError(normalizeError(caught));
    if (retryLabelText && retryAction) {
      setRetryLabel(retryLabelText);
      retryActionRef.current = retryAction;
    } else {
      setRetryLabel(null);
      retryActionRef.current = null;
    }
  }

  async function withAction<T>(actionName: string, run: () => Promise<T>) {
    clearErrorState();
    setCurrentAction(actionName);
    try {
      return await run();
    } finally {
      setCurrentAction(null);
    }
  }

  async function handleLogin(role: "driver" | "admin") {
    const errors = validateLogin(loginEmail, loginPassword);
    setLoginErrors(errors);
    if (Object.keys(errors).length) {
      focusField(`login.${Object.keys(errors)[0]}`);
      return;
    }

    try {
      await withAction("login", () => login({ email: loginEmail.trim(), password: loginPassword, role }));
      devLog("login_success", role);
      setToast(role === "driver" ? "Welcome back. Your induction is ready to continue." : "Admin dashboard is up to date.");
    } catch (caught) {
      setActionError(caught, "Try again", async () => handleLogin(role));
    }
  }

  async function persistCurrentStep(mode: "advance" | "autosave" = "advance") {
    if (!profileDraft || !driverBundle) return false;
    const silent = mode === "autosave";

    if (activeStep === 1) {
      const errors = validateProfile(profileDraft);
      setProfileErrors(errors);
      if (Object.keys(errors).length) {
        if (!silent) focusField(`profile.${Object.keys(errors)[0]}`);
        return false;
      }
    }

    if (activeStep === 5) {
      const errors = validateDeclaration(declarationAccepted, signature);
      setDeclarationErrors(errors);
      if (Object.keys(errors).length) {
        if (!silent) focusField(`declaration.${Object.keys(errors)[0]}`);
        return false;
      }
    }

    const runner = async () => {
      if (activeStep === 1 && profileDraft) {
        const result = await saveProfile({
          fullName: sanitizeText(profileDraft.fullName),
          email: profileDraft.email.trim(),
          phone: sanitizeText(profileDraft.phone),
          address: sanitizeText(profileDraft.address),
          preferredLanguage: profileDraft.preferredLanguage
        });
        setProfileDraft(result.driver);
        return result;
      } else if (activeStep === 2) {
        return await saveStep(2, {});
      } else if (activeStep === 3) {
        return await saveStep(3, {
          sections: driverBundle.learningProgress.map((section) => ({
            sectionId: section.sectionId,
            completed: section.completed
          }))
        });
      } else if (activeStep === 5) {
        return await saveStep(5, {
          accepted: declarationAccepted,
          signature: signature
        });
      }
      return driverBundle;
    };

    try {
      if (silent) setIsAutosaving(true);
      const result = await withAction(silent ? "autosave" : "save-step", runner);
      setHasUnsavedChanges(false);
      if (!silent && result && activeStep < 6) {
        const nextStep = Math.max(activeStep + 1, result.progress.currentStep);
        setActiveStep(Math.min(6, nextStep));
      }
      setStepSuccess(activeStep === 1 ? "Details saved" : activeStep === 2 ? "Documents confirmed" : activeStep === 3 ? "Learning complete" : "Declaration saved");
      devLog("step_saved", activeStep, mode);
      return true;
    } catch (caught) {
      if (!silent) {
        setActionError(caught, "Try saving again", async () => {
          await persistCurrentStep(mode);
        });
      }
      return false;
    } finally {
      setIsAutosaving(false);
    }
  }

  async function handleSectionToggle(section: LearningSectionProgress) {
    if (!driverBundle) return;
    const sections = driverBundle.learningProgress.map((item) => ({
      sectionId: item.sectionId,
      completed: item.sectionId === section.sectionId ? !item.completed : item.completed
    }));

    try {
      await withAction("learning-toggle", () => saveStep(3, { sections, allowPartial: true }));
      setStepSuccess("Learning progress saved");
      devLog("learning_toggle", section.sectionId);
    } catch (caught) {
      setActionError(caught, "Retry module save", async () => handleSectionToggle(section));
    }
  }
  
  async function handleSectionStart(sectionId: string) {
    if (!session) return;
    try {
      await api.startVideoSection(session, sectionId);
    } catch (e) {
      console.error("Failed to mark section started", e);
    }
  }

  async function handleDocumentPick(type: DocumentType, file?: File | null) {
    if (!file) return;
    const fileError = validateUploadFile(file);
    if (fileError) {
      setUploadErrors((current) => ({ ...current, [type]: fileError }));
      return;
    }

    setUploadErrors((current) => ({ ...current, [type]: "" }));
    setUploadRetries((current) => ({ ...current, [type]: file }));
    setUploadProgress((current) => ({ ...current, [type]: 0 }));

    try {
      await withAction(`upload-${type}`, () =>
        uploadDocument({ type, file }, (progress) =>
          setUploadProgress((current) => ({ ...current, [type]: progress }))
        )
      );
      setUploadRetries((current) => ({ ...current, [type]: null }));
      setStepSuccess(`${labelForDoc(type)} uploaded`);
      devLog("document_uploaded", type);
    } catch (caught) {
      setActionError(caught, "Retry upload", async () => {
        const retryFile = uploadRetries[type] ?? file;
        await handleDocumentPick(type, retryFile);
      });
      setUploadErrors((current) => ({
        ...current,
        [type]: "That upload didn’t finish. Please try again."
      }));
    }
  }

  async function handleQuizSubmit() {
    if (quizQuestions.some((question) => quizAnswers[question.id] === undefined)) {
      setError("Please answer every question before submitting.");
      return;
    }

    try {
      const result = await withAction("quiz-submit", () => submitQuiz(quizAnswers));
      setQuizFeedback(Object.fromEntries(result.questions.map((question) => [question.id, question])));
      setActiveStep(result.passed ? 5 : 4);
      setStepSuccess(result.passed ? "Quiz passed" : "Quiz reviewed");
      devLog("quiz_submitted", result.score);
    } catch (caught) {
      setActionError(caught, "Retry quiz submission", handleQuizSubmit);
    }
  }

  async function handleFinalize() {
    const isCompleted = driverBundle?.progress.completedAt;

    if (!isCompleted) {
      const errors = validateDeclaration(declarationAccepted, signature);
      if (!selfieUrl) errors.selfie = "Please capture a selfie for identity verification.";
      
      setDeclarationErrors(errors);
      if (Object.keys(errors).length) {
        focusField(`declaration.${Object.keys(errors)[0]}`);
        return;
      }
    }

    try {
      await withAction("certificate-generate", async () => {
        if (!isCompleted) {
          await saveStep(5, { accepted: declarationAccepted, signature, selfieUrl });
        }
        const result = await generateCertificate();
        downloadBase64Pdf(result.pdfBase64, "driver-induction-certificate.pdf");
      });
      setActiveStep(6);
      if (!isCompleted) {
        setShowCelebration(true);
        window.setTimeout(() => setShowCelebration(false), 2600);
      }
      setStepSuccess(isCompleted ? "Certificate downloaded" : "Certificate ready");
      devLog("certificate_generated");
    } catch (caught) {
      setActionError(caught, "Generate again", handleFinalize);
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setDeclarationErrors(prev => ({ ...prev, selfie: "" }));
    } catch (err) {
      setDeclarationErrors(prev => ({ ...prev, selfie: "Camera access denied." }));
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureSelfie = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
          if (blob && session?.user.id) {
            stopCamera();
            withAction("certificate-generate", async () => {
              const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
              await api.uploadDocument(session, { type: "identity_selfie", file });
              // Retrieve public URL for immediate display
              const newState = await api.getDriverProfile(session);
              const selfieDoc = newState.documents.find(d => d.type === "identity_selfie");
              if (selfieDoc) {
                setSelfieUrl(selfieDoc.fileUrl);
              }
            }).catch(e => {
              setDeclarationErrors(prev => ({ ...prev, selfie: e.message || "Upload failed." }));
            });
          }
        }, "image/jpeg", 0.8);
      }
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function startEditDriver(driver: AdminDriverRow) {
    setEditingDriverId(driver.id);
    setDriverForm({
      fullName: driver.fullName,
      email: driver.email,
      phone: driver.phone,
      address: driver.address,
      preferredLanguage: driver.preferredLanguage,
      password: ""
    });
    setDriverFormErrors({});
    setPasswordReset("");
    setPasswordResetError("");
    setVerificationCode(driver.verificationCode ?? "");
    setVerificationResult(null);
  }

  function resetAdminForm() {
    setEditingDriverId(null);
    setDriverForm({ ...defaultDriverForm, password: "" });
    setDriverFormErrors({});
    setPasswordReset("");
    setPasswordResetError("");
    setVerificationCode("");
    setVerificationResult(null);
  }

  function fillTestDriverDetails() {
    const token = Date.now().toString().slice(-4);
    setEditingDriverId(null);
    setDriverForm({
      fullName: `Test Driver ${token}`,
      email: `test.driver.${token}@example.com`,
      phone: "0400 000 000",
      address: "12 Depot Road, Melbourne VIC",
      preferredLanguage: "English",
      password: "DriverTest123"
    });
    setDriverFormErrors({});
    setPasswordReset("");
    setPasswordResetError("");
    setToast("Sample test driver details loaded.");
  }

  async function handleAdminDriverSave() {
    const errors = validateAdminDriverForm(driverForm, !editingDriverId);
    setDriverFormErrors(errors);
    if (Object.keys(errors).length) {
      focusField(`admin.${Object.keys(errors)[0]}`);
      return;
    }

    try {
      await withAction("admin-save", async () => {
        if (editingDriverId) {
          await updateDriverByAdmin(editingDriverId, driverForm);
        } else {
          await createDriver(driverForm);
        }
      });
      setToast(editingDriverId ? "Driver details updated." : "Driver account created.");
      resetAdminForm();
    } catch (caught) {
      setActionError(caught, "Retry save", handleAdminDriverSave);
    }
  }

  async function handlePasswordReset() {
    const trimmed = passwordReset.trim();
    if (trimmed.length < 8) {
      setPasswordResetError("Use at least 8 characters for the new password.");
      focusField("admin.passwordReset");
      return;
    }

    try {
      await withAction("password-reset", () => resetDriverPassword(editingDriverId!, trimmed));
      setPasswordReset("");
      setPasswordResetError("");
      setToast("Password reset successfully.");
    } catch (caught) {
      setActionError(caught, "Retry password reset", handlePasswordReset);
    }
  }

  async function handleDeleteDriver(driverId: string) {
    showConfirm(
      "Delete this driver account permanently? Their login access and uploaded records will be removed. Audit logs will stay for compliance.",
      async () => {
        try {
          await withAction(`delete-${driverId}`, () => deleteDriver(driverId));
          if (editingDriverId === driverId) resetAdminForm();
          setToast("Driver removed.");
        } catch (caught) {
          setActionError(caught, "Retry delete", async () => handleDeleteDriver(driverId));
        }
      }
    );
  }

  async function handleResetInduction(driverId: string) {
    showConfirm(
      "Reset this driver back to step 1 for testing or retraining? Uploaded documents, quiz attempts, and the current certificate will be cleared.",
      async () => {
        try {
          await withAction(`reset-induction-${driverId}`, () => resetDriverInduction(driverId));
          setToast("Induction reset to step 1.");
        } catch (caught) {
          setActionError(caught, "Retry reset", async () => handleResetInduction(driverId));
        }
      }
    );
  }

  async function handleExport(format: "csv" | "pdf", options?: { scope?: "drivers" | "audit"; driverId?: string }) {
    try {
      const blob = await withAction(
        `export-${format}-${options?.scope ?? "drivers"}`,
        () => exportAdminReport(format, {
          from: reportFrom || undefined,
          to: reportTo || undefined,
          scope: options?.scope ?? "drivers",
          driverId: options?.driverId
        })
      );
      const suffix = options?.scope === "audit" ? "audit-report" : options?.driverId ? "driver-report" : "driver-induction-report";
      downloadBlob(blob, `${suffix}.${format}`);
      setToast(`${format.toUpperCase()} report exported.`);
    } catch (caught) {
      setActionError(caught, "Retry export", async () => handleExport(format, options));
    }
  }

  async function handleRefreshAdmin() {
    try {
      await withAction("admin-refresh", refreshAdminOverview);
      setToast("Dashboard refreshed.");
    } catch (caught) {
      setActionError(caught, "Retry refresh", handleRefreshAdmin);
    }
  }

  async function handleCertificateVerification() {
    const trimmed = verificationCode.trim();
    if (!trimmed) {
      setError("Enter a certificate verification code first.");
      return;
    }

    try {
      const result = await withAction("certificate-verify", () => verifyCertificate(trimmed));
      setVerificationResult(result);
      setToast(result.verified ? "Certificate verified." : "Certificate could not be verified.");
    } catch (caught) {
      setVerificationResult(null);
      setActionError(caught, "Retry verification", handleCertificateVerification);
    }
  }

  async function handleFeedbackSubmit() {
    try {
      await withAction("feedback-submit", () =>
        submitDriverFeedback({
          clarityRating: feedbackRating,
          issues: sanitizeText(feedbackIssues)
        })
      );
      setToast("Thanks. Your feedback has been saved.");
    } catch (caught) {
      setActionError(caught, "Retry feedback", handleFeedbackSubmit);
    }
  }

  return (
    <div className="app-shell">
      <BackgroundOrbs />
      <header className="topbar glass">
        <div className="brand-lockup">
          <img src={bntLogo} alt="BNT Logistics" className="brand-logo" />
          <div className="brand-text">
            <p className="eyebrow">Driver Induction System</p>
            <h1>BNT Induction</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} />
          {session && (
            <button className="ghost-button" onClick={() => { stopCamera(); void logout(); }} disabled={authLoading}>
              {authLoading ? "Signing out..." : "Logout"}
            </button>
          )}
        </div>
      </header>

      {!isOnline && <StatusBanner tone="warning" message="You’re offline. We’ll reconnect automatically when your network returns." />}
      {stepSuccess && <StatusBanner tone="success" message={stepSuccess} />}

      <main className="main-layout">
        {loading && !session ? (
          <LoginSkeleton />
        ) : !session ? (
          <LoginPanel
            loginEmail={loginEmail}
            loginPassword={loginPassword}
            loginRole={loginRole}
            loginErrors={loginErrors}
            setLoginEmail={setLoginEmail}
            setLoginPassword={setLoginPassword}
            setLoginRole={setLoginRole}
            onLogin={() => void handleLogin(loginRole)}
            authLoading={authLoading}
          />
        ) : session.user.role === "driver" ? (
          !driverBundle || !profileDraft ? (
            <DriverSkeleton />
          ) : (
            <DriverExperience
              bundle={driverBundle}
              profileDraft={profileDraft}
              profileErrors={profileErrors}
              activeStep={activeStep}
              allowedStep={allowedStep}
              loading={loading}
              currentAction={currentAction}
              isAutosaving={isAutosaving}
              completionLabel={completionLabel}
              uploadProgress={uploadProgress}
              uploadErrors={uploadErrors}
              dragTarget={dragTarget}
              quizQuestions={quizQuestions}
              quizAnswers={quizAnswers}
              quizFeedback={quizFeedback}
              declarationAccepted={declarationAccepted}
              declarationErrors={declarationErrors}
              signature={signature}
              feedbackRating={feedbackRating}
              feedbackIssues={feedbackIssues}
              fileInputs={fileInputs}
              showCelebration={showCelebration}
              onProfileChange={(event) => {
                setHasUnsavedChanges(true);
                setProfileDraft((current) => (current ? { ...current, [event.target.name]: event.target.value } : current));
                if (profileDraft) {
                  setProfileErrors(validateProfile({ ...profileDraft, [event.target.name]: event.target.value }));
                }
              }}
              onStepSelect={setActiveStep}
              onSectionToggle={(section) => void handleSectionToggle(section)}
              onSectionStart={(sectionId) => void handleSectionStart(sectionId)}
              onAnswerSelect={(questionId, optionIndex) =>
                setQuizAnswers((current) => ({ ...current, [questionId]: optionIndex }))
              }
              onDeclarationChange={(value) => {
                setHasUnsavedChanges(true);
                setDeclarationAccepted(value);
                setDeclarationErrors(validateDeclaration(value, signature));
              }}
              onSignatureChange={(value) => {
                setHasUnsavedChanges(true);
                setSignature(value);
                setDeclarationErrors(validateDeclaration(declarationAccepted, value));
              }}
              onFeedbackRatingChange={setFeedbackRating}
              onFeedbackIssuesChange={setFeedbackIssues}
              onUploadClick={(type) => fileInputs.current[type]?.click()}
              onUploadFile={(type, file) => void handleDocumentPick(type, file)}
              onUploadRetry={(type) => void handleDocumentPick(type, uploadRetries[type])}
              onDropTargetChange={setDragTarget}
              onNext={() => void persistCurrentStep("advance")}
              onPrev={() => setActiveStep((current) => Math.max(1, current - 1))}
              onQuizSubmit={() => void handleQuizSubmit()}
              onQuizReset={() => {
                setQuizAnswers({});
                setQuizFeedback(null);
              }}
              onFinalize={() => void handleFinalize()}
              onFeedbackSubmit={() => void handleFeedbackSubmit()}
              selfieUrl={selfieUrl}
              setSelfieUrl={setSelfieUrl}
              isCameraActive={isCameraActive}
              startCamera={startCamera}
              stopCamera={stopCamera}
              captureSelfie={captureSelfie}
              videoRef={videoRef}
              canvasRef={canvasRef}
            />
          )
        ) : !adminOverview ? (
          <AdminSkeleton />
        ) : (
          <>
            <AdminExperience
              organizationName={adminOverview.organizationName}
              metrics={adminOverview.metrics}
              charts={adminOverview.charts}
              insights={adminOverview.insights}
              drivers={filteredDrivers}
              recentActivity={adminOverview.recentActivity}
              recentFeedback={adminOverview.recentFeedback}
              selectedDriver={selectedDriver}
              loading={loading}
              currentAction={currentAction}
              filter={adminFilter}
              setFilter={setAdminFilter}
              search={adminSearch}
              setSearch={setAdminSearch}
              reportFrom={reportFrom}
              reportTo={reportTo}
              setReportFrom={setReportFrom}
              setReportTo={setReportTo}
              driverForm={driverForm}
              driverFormErrors={driverFormErrors}
              setDriverForm={setDriverForm}
              editingDriverId={editingDriverId}
              passwordReset={passwordReset}
              passwordResetError={passwordResetError}
              setPasswordReset={setPasswordReset}
              verificationCode={verificationCode}
              verificationResult={verificationResult}
              setVerificationCode={setVerificationCode}
              onSaveDriver={() => void handleAdminDriverSave()}
              onEditDriver={startEditDriver}
              onDeleteDriver={(driverId) => void handleDeleteDriver(driverId)}
              onResetInduction={(driverId) => void handleResetInduction(driverId)}
              onResetPassword={() => void handlePasswordReset()}
              onClearForm={resetAdminForm}
              onFillTestDriver={fillTestDriverDetails}
              onExport={(format, options) => void handleExport(format, options)}
              onRefresh={() => void handleRefreshAdmin()}
              onVerifyCertificate={() => void handleCertificateVerification()}
              onOpenBulkImport={() => setShowBulkModal(true)}
            />
            <VerificationQueue />
            <AdminCMS />
          </>
        )}
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div className="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div className="toast error-toast rich-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            <span>{error}</span>
            {retryLabel && retryActionRef.current && (
              <button className="secondary-button toast-button" onClick={() => void retryActionRef.current?.()}>
                {retryLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Dialog Modal */}
      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
            }}
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="glass"
              style={{ maxWidth: 460, width: "90%", padding: "32px", borderRadius: "20px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>Are you sure?</h3>
              <p className="muted" style={{ margin: "0 0 24px" }}>{confirmDialog.message}</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button className="ghost-button" onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button className="primary-button" onClick={() => { const cb = confirmDialog.onConfirm; setConfirmDialog(null); cb(); }}>Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mandatory Password Reset Modal for New Driver Accounts */}
      <AnimatePresence>
        {session?.user.role === "driver" && session.user.mustChangePassword && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.88)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass"
              style={{ maxWidth: 480, width: "90%", padding: "36px", borderRadius: "24px", background: "var(--card-bg, #ffffff)" }}
            >
              <h2 style={{ margin: "0 0 8px", fontSize: "1.3rem" }}>🔒 Password Change Required</h2>
              <p className="muted" style={{ margin: "0 0 20px", fontSize: "0.9rem" }}>
                Welcome to BNT Logistics! For security reasons, you must set a new personal password before starting your induction.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <label className="floating-field">
                  <input
                    type="password"
                    value={forcedNewPassword}
                    onChange={(e) => setForcedNewPassword(e.target.value)}
                    placeholder=" "
                  />
                  <span>New Password (min 8 characters)</span>
                </label>
                <label className="floating-field">
                  <input
                    type="password"
                    value={forcedConfirmPassword}
                    onChange={(e) => setForcedConfirmPassword(e.target.value)}
                    placeholder=" "
                  />
                  <span>Confirm New Password</span>
                </label>
                {forcedPasswordError && <p className="field-error" style={{ color: "#ef4444", margin: 0 }}>{forcedPasswordError}</p>}
                <button
                  className="primary-button"
                  style={{ width: "100%", padding: "12px" }}
                  disabled={currentAction === "force-change-password"}
                  onClick={async () => {
                    if (forcedNewPassword.length < 8) {
                      setForcedPasswordError("Password must be at least 8 characters long.");
                      return;
                    }
                    if (forcedNewPassword !== forcedConfirmPassword) {
                      setForcedPasswordError("Passwords do not match. Please re-enter both fields.");
                      return;
                    }
                    try {
                      setCurrentAction("force-change-password");
                      await api.changePassword(session, forcedNewPassword);
                      session.user.mustChangePassword = false;
                      setToast("Password updated successfully! Welcome to your induction.");
                    } catch (err: unknown) {
                      setForcedPasswordError(err instanceof Error ? err.message : "Failed to update password.");
                    } finally {
                      setCurrentAction(null);
                    }
                  }}
                >
                  {currentAction === "force-change-password" ? "Updating Password..." : "Set Password & Continue"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Driver CSV Import Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
            }}
            onClick={() => setShowBulkModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass"
              style={{ maxWidth: 640, width: "90%", padding: "32px", borderRadius: "24px", background: "var(--card-bg, #fff)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem" }}>👥 Bulk Driver CSV Import</h2>
              <p className="muted" style={{ margin: "0 0 16px", fontSize: "0.88rem" }}>
                Paste CSV lines (Format: <code>Full Name, Email, Phone, Temporary Password</code>) to create multiple driver accounts at once.
              </p>

              <textarea
                style={{
                  width: "100%", height: 160, fontFamily: "monospace", fontSize: "0.85rem",
                  padding: "12px", borderRadius: "12px", border: "1px solid var(--border-color, #cbd5e1)",
                  background: "var(--input-bg, #f8fafc)", color: "inherit", resize: "vertical"
                }}
                placeholder={"employee_name, employee@bntlogistics.com.au, 0400000000, TempPassword123!\nnext_employee, next@bntlogistics.com.au, 0411111111, TempPassword456!"}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
              />

              {bulkImportReport && (
                <div style={{ marginTop: "16px", padding: "12px", background: "#f1f5f9", borderRadius: "12px", fontSize: "0.88rem" }}>
                  <strong>{bulkImportReport.message}</strong>
                  {bulkImportReport.errors.length > 0 && (
                    <ul style={{ color: "#ef4444", margin: "8px 0 0", paddingLeft: "20px" }}>
                      {bulkImportReport.errors.map((e, idx) => <li key={idx}>{e.email}: {e.reason}</li>)}
                    </ul>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
                <button className="ghost-button" onClick={() => { setShowBulkModal(false); setBulkCsvText(""); setBulkImportReport(null); }}>
                  Close
                </button>
                <button
                  className="primary-button"
                  disabled={!bulkCsvText.trim() || currentAction === "bulk-import-drivers"}
                  onClick={async () => {
                    if (!session) return;
                    try {
                      setCurrentAction("bulk-import-drivers");
                      const lines = bulkCsvText.trim().split("\n").filter((l) => l.trim().length > 0);
                      const parsedDrivers = lines.map((line) => {
                        const [fullName, email, phone, password] = line.split(",").map((s) => s.trim());
                        return {
                          fullName: fullName || "Driver",
                          email: email || "",
                          phone: phone || "0400000000",
                          password: password || "Temporary123!"
                        };
                      });

                      const result = await api.bulkImportDrivers(session, parsedDrivers);
                      setBulkImportReport(result);
                      setToast(result.message);
                      handleRefreshAdmin();
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Bulk import failed.");
                    } finally {
                      setCurrentAction(null);
                    }
                  }}
                >
                  {currentAction === "bulk-import-drivers" ? "Importing Drivers..." : "Import Drivers"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <button className="toggle-button" onClick={onToggle} aria-label="Toggle theme">
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
      <span className="toggle-track">
        <span className={`toggle-thumb ${theme}`} />
      </span>
    </button>
  );
}

function BackgroundOrbs() {
  return (
    <div className="background-orbs" aria-hidden="true">
      <span className="orb orb-primary" />
      <span className="orb orb-secondary" />
      <span className="orb orb-accent" />
    </div>
  );
}

function StatusBanner({ tone, message }: { tone: "success" | "warning"; message: string }) {
  return <div className={`status-banner ${tone}`}>{message}</div>;
}

function LoginPanel(props: {
  loginEmail: string;
  loginPassword: string;
  loginRole: "driver" | "admin";
  loginErrors: Record<string, string>;
  setLoginEmail: (value: string) => void;
  setLoginPassword: (value: string) => void;
  setLoginRole: (value: "driver" | "admin") => void;
  onLogin: () => void;
  authLoading: boolean;
}) {
  const {
    loginEmail,
    loginPassword,
    loginRole,
    loginErrors,
    setLoginEmail,
    setLoginPassword,
    setLoginRole,
    onLogin,
    authLoading
  } = props;

  return (
    <section className="split-panel glass login-screen">
      <div className="panel-hero">
        <div>
          <div className="hero-brand-chip">
            <img src={bntLogo} alt="BNT Logistics" className="hero-logo" />
          </div>
          <p className="eyebrow">Single Organization</p>
          <h2>Simple driver induction for one transport team, with clear steps, saved progress, and admin-managed accounts.</h2>
        </div>
        <div className="feature-grid">
          <FeatureCard title="What drivers do" body="Finish 6 simple steps, upload documents, complete the quiz, and download a certificate." />
          <FeatureCard title="How long it takes" body="Most drivers finish in about 20 to 25 minutes if documents are ready before they start." />
          <FeatureCard title="Need help?" body="If anything is unclear, contact your supervisor or compliance contact before moving on." />
        </div>
      </div>
      <div className="panel-form glass-inner">
        <div className="segmented-control login-role-switch">
          <button className={loginRole === "driver" ? "active" : ""} onClick={() => setLoginRole("driver")}>
            Driver Login
          </button>
          <button className={loginRole === "admin" ? "active" : ""} onClick={() => setLoginRole("admin")}>
            Admin Login
          </button>
        </div>
        <h3>{loginRole === "driver" ? "Driver sign in" : "Admin sign in"}</h3>
        <p className="muted">
          {loginRole === "driver"
            ? "Drivers should use the email and password provided by the company. If you cannot sign in, ask an admin to create or reset your account."
            : "Admins should use their internal admin account. After signing in, you can create driver logins from the dashboard."}
        </p>
        <div className="input-grid">
          <Field
            fieldKey="login.email"
            name="email"
            label="Email address"
            value={loginEmail}
            error={loginErrors.email}
            onChange={(event) => setLoginEmail(event.target.value)}
            autoComplete="email"
          />
          <Field
            fieldKey="login.password"
            name="password"
            label="Password"
            type="password"
            value={loginPassword}
            error={loginErrors.password}
            onChange={(event) => setLoginPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="button-stack">
          <button className="primary-button" onClick={onLogin} disabled={authLoading}>
            {authLoading ? "Signing in..." : loginRole === "driver" ? "Continue as Driver" : "Open Admin Dashboard"}
          </button>
          <small className="muted">
            {loginRole === "driver"
              ? "Driver accounts are created by admins. There is no public self-registration."
              : "Admin login is separate from driver login, even though both use email and password."}
          </small>
        </div>
      </div>
    </section>
  );
}

function DriverExperience(props: {
  bundle: DriverBundle;
  profileDraft: DriverProfile;
  profileErrors: Record<string, string>;
  activeStep: number;
  allowedStep: number;
  loading: boolean;
  currentAction: string | null;
  isAutosaving: boolean;
  completionLabel: string;
  uploadProgress: Record<string, number>;
  uploadErrors: Record<string, string>;
  dragTarget: DocumentType | null;
  quizQuestions: Array<{ id: number; question: string; options: string[]; category?: string; isCritical?: boolean }>;
  quizAnswers: Record<number, number>;
  quizFeedback: Record<number, { correctAnswer: number; explanation: string }> | null;
  declarationAccepted: boolean;
  declarationErrors: Record<string, string>;
  signature: string;
  feedbackRating: number;
  feedbackIssues: string;
  fileInputs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  showCelebration: boolean;
  onProfileChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onStepSelect: (step: number) => void;
  onSectionToggle: (section: LearningSectionProgress) => void;
  onSectionStart: (sectionId: string) => void;
  onAnswerSelect: (questionId: number, optionIndex: number) => void;
  onDeclarationChange: (value: boolean) => void;
  onSignatureChange: (value: string) => void;
  onFeedbackRatingChange: (value: number) => void;
  onFeedbackIssuesChange: (value: string) => void;
  onUploadClick: (type: DocumentType) => void;
  onUploadFile: (type: DocumentType, file?: File | null) => void;
  onUploadRetry: (type: DocumentType) => void;
  onDropTargetChange: (type: DocumentType | null) => void;
  onNext: () => void;
  onPrev: () => void;
  onQuizSubmit: () => void;
  onQuizReset: () => void;
  onFinalize: () => void;
  onFeedbackSubmit: () => void;
  selfieUrl: string;
  setSelfieUrl: (url: string) => void;
  isCameraActive: boolean;
  startCamera: () => void;
  stopCamera: () => void;
  captureSelfie: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}) {
  const { t, i18n } = useTranslation();
  const stepTitles = stepTitlesBase.map(key => t(key));
  const {
    bundle,
    profileDraft,
    profileErrors,
    activeStep,
    allowedStep,
    loading,
    currentAction,
    isAutosaving,
    completionLabel,
    uploadProgress,
    uploadErrors,
    dragTarget,
    quizQuestions,
    quizAnswers,
    quizFeedback,
    declarationAccepted,
    declarationErrors,
    signature,
    feedbackRating,
    feedbackIssues,
    fileInputs,
    showCelebration,
    onProfileChange,
    onStepSelect,
    onSectionToggle,
    onSectionStart,
    onAnswerSelect,
    onDeclarationChange,
    onSignatureChange,
    onFeedbackRatingChange,
    onFeedbackIssuesChange,
    onUploadClick,
    onUploadFile,
    onUploadRetry,
    onDropTargetChange,
    onNext,
    onPrev,
    onQuizSubmit,
    onQuizReset,
    onFinalize,
    onFeedbackSubmit,
    selfieUrl,
    setSelfieUrl,
    isCameraActive,
    startCamera,
    stopCamera,
    captureSelfie,
    videoRef,
    canvasRef
  } = props;

  const answeredCount = quizQuestions.filter((question) => quizAnswers[question.id] !== undefined).length;
  const latestAttempt = bundle.quizAttempts[0];
  const passState = latestAttempt ? (latestAttempt.passed ? "passed" : "failed") : null;
  const isStepSaving = currentAction === "save-step" || currentAction === "autosave";
  const isCertificateBusy = currentAction === "certificate-generate";
  const isStepNavigationDisabled = isStepSaving || isCertificateBusy || (() => {
    if (!bundle) return true;
    if (activeStep === 1) return !profileDraft.fullName || !profileDraft.phone || !profileDraft.address;
    if (activeStep === 2) {
      const requiredDocs: DocumentType[] = ["driver_license", "medical_certificate", "identity_proof"];
      return !requiredDocs.every(type => bundle.documents.some((doc: any) => doc.type === type));
    }
    if (activeStep === 3) return !bundle.learningProgress.every((s: any) => s.completed);
    if (activeStep === 5) return !declarationAccepted || !signature.trim();
    return false;
  })();

  return (
    <div className="experience-grid">
      <aside className="induction-sidebar desktop-only">
          <div className="sidebar-header">
            <h3>Induction Portal</h3>
            <span className="compliance-badge">✓ Compliance Ready</span>
          </div>
          <div className="sidebar-nav">
            {stepTitles.map((title, index) => {
            const stepNumber = index + 1;
            const isLocked = stepNumber > allowedStep;
            return (
              <button
                key={title}
                className={`step-card ${activeStep === stepNumber ? "active" : ""} ${isLocked ? "locked" : ""}`}
                onClick={() => !isLocked && onStepSelect(stepNumber)}
                disabled={isLocked}
              >
                <span className={`step-dot ${bundle.progress.completedStepIds.includes(stepNumber) ? "complete" : ""}`}>{stepNumber}</span>
                <span>
                  <strong>{title}</strong>
                  <small>{isLocked ? "Complete earlier steps first." : stepDescriptions[index]}</small>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flow-panel">
        <AnimatePresence mode="wait">
          <motion.div key={activeStep} className="glass content-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {inductionVersion && (
              <InductionVersionBanner
                currentVersion={inductionVersion}
                certificateVersionLabel={bundle.certificate ? "1.0" : null}
              />
            )}
            <div className="step-overview">
              <div>
                <p className="eyebrow">Step {activeStep} of 6</p>
                <h3>{stepTitles[activeStep - 1]}</h3>
                <p className="muted">{stepHelperNotes[activeStep - 1]}</p>
              </div>
              <div className="step-progress-inline">
                <div className="progress-bar">
                  <span className="progress-fill" style={{ width: `${(activeStep / 6) * 100}%` }} />
                </div>
                <small>{bundle.progress.completedStepIds.length} completed</small>
              </div>
            </div>

            {activeStep === 1 && (
              <div className="panel-section">
                <SectionHeader title="Personal Details" subtitle="Check your basic details so your work records and certificate are correct." />
                <div className="form-grid">
                  <Field fieldKey="profile.fullName" name="fullName" label="Full name" value={profileDraft.fullName} error={profileErrors.fullName} onChange={onProfileChange} />
                  <Field fieldKey="profile.email" name="email" label="Email" value={profileDraft.email} error={profileErrors.email} onChange={onProfileChange} autoComplete="email" />
                  <Field fieldKey="profile.phone" name="phone" label="Phone" value={profileDraft.phone} error={profileErrors.phone} onChange={onProfileChange} autoComplete="tel" />
                  <Field fieldKey="profile.address" name="address" label="Address" value={profileDraft.address} error={profileErrors.address} onChange={onProfileChange} autoComplete="street-address" />
                  <SelectField
                    fieldKey="profile.preferredLanguage"
                    name="preferredLanguage"
                    label="Preferred language"
                    value={profileDraft.preferredLanguage}
                    error={profileErrors.preferredLanguage}
                    onChange={onProfileChange}
                    options={["English"]}
                  />
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="panel-section">
                <SectionHeader title="Documents Upload" subtitle="Upload the required documents your workplace needs before you can move on." />
                <div className="upload-grid">
                  {([
                    ["driver_license", "Driver license"],
                    ["medical_certificate", "Medical certificate"],
                    ["identity_proof", "Identity proof"],
                    ["driving_history", "Driver history report"],
                    ["right_to_work", "Visa / Right to work"],
                    ["nhvas_bfm_certificate", "NHVAS BFM certificate"],
                    ["dangerous_goods_license", "Dangerous goods license (optional)"]
                  ] as Array<[DocumentType, string]>).map(([type, label]) => {
                    const uploaded = bundle.documents.find((item) => item.type === type);
                    const isBusy = currentAction === `upload-${type}`;
                    return (
                      <div
                        key={type}
                        className={`upload-card upload-card-static ${dragTarget === type ? "drag-active" : ""}`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          onDropTargetChange(type);
                        }}
                        onDragLeave={() => onDropTargetChange(null)}
                        onDrop={(event) => {
                          event.preventDefault();
                          onDropTargetChange(null);
                          void onUploadFile(type, event.dataTransfer.files?.[0]);
                        }}
                      >
                        <strong>{label}</strong>
                        <span>{uploaded ? uploaded.name : "Drag and drop here, or choose a PDF, JPG, or PNG file up to 5 MB."}</span>
                        <div className="inline-row wrap">
                          <button className="secondary-button" onClick={() => onUploadClick(type)} disabled={isBusy}>
                            {isBusy ? "Uploading..." : uploaded ? "Replace file" : "Choose file"}
                          </button>
                          {uploadErrors[type] && (
                            <button className="ghost-button" onClick={() => onUploadRetry(type)}>
                              Retry
                            </button>
                          )}
                        </div>
                        <input
                          ref={(element) => {
                            fileInputs.current[type] = element;
                          }}
                          className="hidden-input"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(event) => onUploadFile(type, event.target.files?.[0])}
                        />
                        <div className="progress-bar compact">
                          <span className="progress-fill" style={{ width: `${uploadProgress[type] ?? (uploaded ? 100 : 0)}%` }} />
                        </div>
                        {uploadErrors[type] && <p className="field-error">{uploadErrors[type]}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="docs-list">
                  {bundle.documents.length ? bundle.documents.map((document) => (
                    <div className="doc-item" key={document.id}>
                      <div>
                        <strong>{document.name}</strong>
                        <small>{formatFileSize(document.size)} • {new Date(document.uploadedAt).toLocaleString()}</small>
                      </div>
                      {document.fileUrl ? (
                        <a className="success-chip" href={document.fileUrl} target="_blank" rel="noreferrer">
                          Preview
                        </a>
                      ) : (
                        <button className="ghost-button" onClick={() => alert("Document preview is not available.")} style={{ color: "#ef4444" }}>
                          Preview Unavailable
                        </button>
                      )}
                    </div>
                  )) : <div className="empty-state-card"><strong>No documents uploaded yet.</strong><p>Start with your driver licence, then add your medical certificate and ID.</p></div>}
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="panel-section">
                <SectionHeader title="Safety Content" subtitle="Read the key points below in simple language, then mark each topic complete when you are ready." />
                <div className="learning-grid">
                  {bundle.learningProgress.map((section) => (
                    <div key={section.sectionId} className="learning-card">
                      <div className="inline-row spread">
                        <div>
                          <strong>{section.title}</strong>
                          <p className="muted">{section.format}</p>
                        </div>
                        {(!section.videoUrl || section.completed) && (
                          <button
                            className={section.completed ? "success-chip button-chip" : "ghost-chip button-chip"}
                            onClick={() => onSectionToggle(section)}
                            disabled={currentAction === "learning-toggle"}
                          >
                            {section.completed ? "Completed" : "Mark complete"}
                          </button>
                        )}
                      </div>
                      <p>{section.summary}</p>
                      {section.videoUrl && (
                        <VideoPlayer
                          src={section.videoUrl}
                          onStart={() => onSectionStart(section.sectionId)}
                          onComplete={() => onSectionToggle(section)}
                        />
                      )}
                      {(() => {
                        let parsed;
                        try { parsed = JSON.parse(section.summary); } catch (e) { parsed = null; }
                        
                        if (parsed && typeof parsed === 'object') {
                          return (
                            <>
                              <p>{parsed.intro || ""}</p>
                              <ul className="learning-points">
                                {(parsed.bullets || []).map((point: string) => (
                                  <li key={point}>{point}</li>
                                ))}
                              </ul>
                              {parsed.scenario && (
                                <div className="scenario-note">
                                  <strong>Real-life example</strong>
                                  <p>{parsed.scenario}</p>
                                </div>
                              )}
                            </>
                          );
                        }
                        
                        return (
                          <>
                            <p>{section.summary}</p>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStep === 4 && (
              <div className="panel-section">
                <SectionHeader title="Knowledge Check" subtitle="Answer all questions, then submit. You need 70% or more to pass and can try again if needed." />
                <div className="quiz-summary-card">
                  <strong>Question progress</strong>
                  <span>{answeredCount}/{quizQuestions.length} answered</span>
                  <div className="progress-bar compact">
                    <span className="progress-fill" style={{ width: `${quizQuestions.length ? (answeredCount / quizQuestions.length) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="quiz-stack">
                  {quizQuestions.map((question, index) => (
                    <div key={question.id} className="quiz-card">
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                        <small className="muted">Question {index + 1} of {quizQuestions.length}</small>
                        {question.category && (
                          <span className="badge badge--archived" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>{question.category}</span>
                        )}
                        {question.isCritical && (
                          <span className="badge alert--error" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>⚠️ Critical Safety Question</span>
                        )}
                      </div>
                      <strong>{question.question}</strong>
                      <div className="quiz-options">
                        {question.options.map((option, optionIndex) => (
                          <button
                            key={option}
                            className={`quiz-option ${quizAnswers[question.id] === optionIndex ? "selected" : ""} ${quizFeedback && optionIndex === quizFeedback[question.id]?.correctAnswer ? "correct-answer" : ""}`}
                            onClick={() => onAnswerSelect(question.id, optionIndex)}
                            disabled={currentAction === "quiz-submit"}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      {quizFeedback?.[question.id] && (
                        <p className={quizAnswers[question.id] === quizFeedback[question.id].correctAnswer ? "feedback success" : "feedback error"}>
                          {quizFeedback[question.id].explanation} Correct answer: {question.options[quizFeedback[question.id].correctAnswer]}.
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {latestAttempt?.categoryScores && Object.keys(latestAttempt.categoryScores).length > 0 && (
                  <div className="glass" style={{ padding: "16px", borderRadius: "12px", margin: "16px 0" }}>
                    <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "10px" }}>Category Performance Breakdown</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                      {Object.entries(latestAttempt.categoryScores).map(([cat, score]) => (
                        <div key={cat} style={{ background: "rgba(148,163,184,0.1)", padding: "10px 14px", borderRadius: "10px" }}>
                          <small className="muted" style={{ display: "block" }}>{cat}</small>
                          <strong style={{ color: score >= 70 ? "#16a34a" : "#dc2626" }}>{score}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`result-banner ${passState ?? "pending"}`}>
                  {passState === "passed" && <strong>You passed with {latestAttempt?.score}%.</strong>}
                  {passState === "failed" && (
                    <div>
                      <strong>You scored {latestAttempt?.score}%.</strong>
                      {latestAttempt?.failedCritical ? (
                        <p style={{ margin: "4px 0 0", color: "#dc2626", fontWeight: 600 }}>
                          ⚠️ Critical Safety Failure: You missed a critical safety question. 100% accuracy is required on all critical safety questions. Please retry.
                        </p>
                      ) : (
                        <span> Review the questions and try again when ready.</span>
                      )}
                    </div>
                  )}
                  {!passState && <strong>Your result will appear here after submission.</strong>}
                </div>
                <div className="inline-row spread wrap">
                  <div className="score-chip">Latest score: {bundle.progress.quizScore ?? "Pending"}</div>
                  <div className="inline-row">
                    <button className="secondary-button" onClick={onQuizReset} disabled={currentAction === "quiz-submit"}>Retry</button>
                    <button className="primary-button" onClick={onQuizSubmit} disabled={currentAction === "quiz-submit"}>
                      {currentAction === "quiz-submit" ? "Submitting..." : "Submit Quiz"}
                    </button>
                  </div>
                </div>
                <div className="attempt-list">
                  {bundle.quizAttempts.slice(0, 3).map((attempt, index) => (
                    <small key={attempt.id}>Attempt {index + 1} • {attempt.score}% • {new Date(attempt.attemptedAt).toLocaleString()}</small>
                  ))}
                </div>
              </div>
            )}

            {activeStep === 5 && (
              <div className="panel-section">
                <SectionHeader title="Identity & Declaration" subtitle="Verify your identity and sign the final compliance declaration." />
                
                <div className="identity-verification-box glass" style={{ padding: "20px", borderRadius: "16px", marginBottom: "24px" }}>
                  <h4 style={{ margin: "0 0 12px" }}>1. Identity Verification</h4>
                  <p className="muted" style={{ marginBottom: "16px", fontSize: "0.9rem" }}>Please take a live selfie to confirm it is you completing this induction.</p>
                  
                  {!selfieUrl ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
                      <div style={{ display: isCameraActive ? "block" : "none", width: "100%", maxWidth: "400px", borderRadius: "12px", overflow: "hidden", background: "#000" }}>
                        <video ref={videoRef} style={{ width: "100%", display: "block" }} playsInline muted />
                        <canvas ref={canvasRef} style={{ display: "none" }} />
                      </div>
                      
                      {isCameraActive ? (
                        <div style={{ display: "flex", gap: "12px" }}>
                          <button className="primary-button" onClick={captureSelfie} disabled={currentAction === "uploading-selfie"}>
                            {currentAction === "uploading-selfie" ? "Uploading..." : "Capture Photo"}
                          </button>
                          <button className="secondary-button" onClick={stopCamera}>Cancel</button>
                        </div>
                      ) : (
                        <button className="primary-button" onClick={startCamera}>Start Camera</button>
                      )}
                      {declarationErrors.selfie && <p className="field-error">{declarationErrors.selfie}</p>}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <img src={selfieUrl} alt="Selfie" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "50%", border: "2px solid #22c55e" }} />
                      <div>
                        <p style={{ color: "#22c55e", fontWeight: 600, margin: "0 0 8px" }}>Identity Verified</p>
                        <button className="secondary-button inline-button" onClick={() => { setSelfieUrl(""); startCamera(); }}>Retake Photo</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="glass" style={{ padding: "20px", borderRadius: "16px" }}>
                  <h4 style={{ margin: "0 0 16px" }}>2. Sign Declaration</h4>
                  <label className="checkbox-row declaration">
                    <input type="checkbox" checked={declarationAccepted} onChange={(event) => onDeclarationChange(event.target.checked)} />
                    <span>I confirm that I completed this induction myself and understand the workplace safety, fatigue, loading, and compliance rules of BNT Logistics as required under the Heavy Vehicle National Law (HVNL) and relevant Australian WHS legislation.</span>
                  </label>
                  {declarationErrors.accepted && <p className="field-error">{declarationErrors.accepted}</p>}
                  <SignaturePad
                    initialSignature={signature}
                    onSignatureChange={(value) => onSignatureChange(value)}
                  />
                  {declarationErrors.signature && <p className="field-error">{declarationErrors.signature}</p>}
                </div>
              </div>
            )}

            {activeStep === 6 && (
              <div className="panel-section completion-panel">
                {showCelebration && <CelebrationBurst />}
                <div className="completion-badge">Certificate Ready</div>
                <h2>Induction complete for {bundle.driver.fullName}</h2>
                <p className="muted">{bundle.organizationName}</p>
                <div className="certificate-card">
                  <div>
                    <p className="eyebrow">Certificate of Completion</p>
                    <h3>{bundle.driver.fullName}</h3>
                    <small>{bundle.certificate?.completionId}</small>
                    <small>Issued {bundle.certificate ? new Date(bundle.certificate.issuedAt).toLocaleString() : "-"}</small>
                  </div>
                  <div className="qr-visual" dangerouslySetInnerHTML={{ __html: buildPseudoQr(bundle.certificate?.verificationUrl ?? "") }} />
                </div>
                {bundle.certificate && (
                  <div className="inline-row wrap">
                    <button className="primary-button" onClick={onFinalize} disabled={currentAction === "certificate-generate"}>
                      Download Certificate
                    </button>
                    <a className="secondary-button inline-button" href={bundle.certificate.verificationUrl} target="_blank" rel="noreferrer">
                      Verify certificate
                    </a>
                  </div>
                )}
                <div className="feature-card feedback-card">
                  <div className="inline-row spread">
                    <strong>Quick feedback</strong>
                    <span className="ghost-chip">Optional</span>
                  </div>
                  <p className="muted">Was this induction clear and easy to follow? Your feedback helps the admin team improve future inductions.</p>
                  <div className="inline-row wrap">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        className={feedbackRating === value ? "primary-button button-chip" : "ghost-button button-chip"}
                        onClick={() => onFeedbackRatingChange(value)}
                        type="button"
                      >
                        {value}
                      </button>
                    ))}
                    <small>{feedbackRating <= 2 ? "Needs work" : feedbackRating === 3 ? "Okay" : "Clear and helpful"}</small>
                  </div>
                  <label className="floating-field" data-field="feedback.issues">
                    <input
                      name="issues"
                      value={feedbackIssues}
                      onChange={(event) => onFeedbackIssuesChange(event.target.value)}
                      placeholder=" "
                    />
                    <span>Anything confusing or missing?</span>
                  </label>
                  <div className="inline-row wrap">
                    <button className="secondary-button" onClick={onFeedbackSubmit} disabled={currentAction === "feedback-submit"}>
                      {currentAction === "feedback-submit" ? "Saving feedback..." : bundle.feedback ? "Update Feedback" : "Send Feedback"}
                    </button>
                    {bundle.feedback && <small>Saved {new Date(bundle.feedback.submittedAt).toLocaleString()}</small>}
                  </div>
                </div>
              </div>
            )}

            <footer className="wizard-footer">
              <button className="ghost-button" type="button" disabled={activeStep === 1 || activeStep === 6 || isStepNavigationDisabled} onClick={onPrev}>
                Previous
              </button>
              {activeStep < 4 && (
                <button className="primary-button" type="button" onClick={onNext} disabled={isStepNavigationDisabled}>
                  {isStepSaving ? "Saving..." : "Save & Continue"}
                </button>
              )}
              {activeStep === 5 && (
                <button className="primary-button" type="button" onClick={onFinalize} disabled={isCertificateBusy || isStepSaving}>
                  {isCertificateBusy ? "Preparing certificate..." : "Generate Certificate"}
                </button>
              )}
            </footer>
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function AdminExperience(props: {
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
  recentFeedback: Array<{ id: string; userId: string; clarityRating: number; issues: string; submittedAt: string }>;
  selectedDriver: AdminDriverRow | null;
  loading: boolean;
  currentAction: string | null;
  filter: "all" | "Completed" | "In Progress" | "Not Started";
  setFilter: (value: "all" | "Completed" | "In Progress" | "Not Started") => void;
  search: string;
  setSearch: (value: string) => void;
  reportFrom: string;
  reportTo: string;
  setReportFrom: (value: string) => void;
  setReportTo: (value: string) => void;
  driverForm: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    preferredLanguage: string;
    password: string;
  };
  driverFormErrors: Record<string, string>;
  setDriverForm: (value: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    preferredLanguage: string;
    password: string;
  }) => void;
  editingDriverId: string | null;
  passwordReset: string;
  passwordResetError: string;
  setPasswordReset: (value: string) => void;
  verificationCode: string;
  verificationResult: CertificateVerificationResult | null;
  setVerificationCode: (value: string) => void;
  onSaveDriver: () => void;
  onEditDriver: (driver: AdminDriverRow) => void;
  onDeleteDriver: (driverId: string) => void;
  onResetInduction: (driverId: string) => void;
  onResetPassword: () => void;
  onClearForm: () => void;
  onFillTestDriver: () => void;
  onExport: (format: "csv" | "pdf", options?: { scope?: "drivers" | "audit"; driverId?: string }) => void;
  onRefresh: () => void;
  onVerifyCertificate: () => void;
  onOpenBulkImport?: () => void;
}) {
  const {
    organizationName,
    metrics,
    charts,
    insights,
    drivers,
    recentActivity,
    recentFeedback,
    selectedDriver,
    loading,
    currentAction,
    filter,
    setFilter,
    search,
    setSearch,
    reportFrom,
    reportTo,
    setReportFrom,
    setReportTo,
    driverForm,
    driverFormErrors,
    setDriverForm,
    editingDriverId,
    passwordReset,
    passwordResetError,
    setPasswordReset,
    verificationCode,
    verificationResult,
    setVerificationCode,
    onSaveDriver,
    onEditDriver,
    onDeleteDriver,
    onResetInduction,
    onResetPassword,
    onClearForm,
    onFillTestDriver,
    onExport,
    onRefresh,
    onVerifyCertificate
  } = props;
  const hasDrivers = metrics.totalDrivers > 0;
  const hasRecentFeedback = recentFeedback.length > 0;
  const hasSelectedDriver = Boolean(selectedDriver);
  const canExportDrivers = hasDrivers;
  const canExportAudit = recentActivity.length > 0;
  const activeDriver = selectedDriver;

  return (
    <section className="admin-layout">
      <div className="admin-summary-row">
        <MetricCard label="Drivers" value={String(metrics.totalDrivers)} detail={organizationName} />
        <MetricCard label="Completed" value={String(metrics.completedDrivers)} detail={hasDrivers ? "Certificates issued" : "No completions yet"} />
        <MetricCard label="Still To Finish" value={String(metrics.pendingDrivers)} detail={hasDrivers ? "Need follow-up" : "Create your first driver"} />
        <MetricCard label="Completion Rate" value={hasDrivers ? `${metrics.completionRate}%` : "No data"} detail={loading ? "Refreshing data" : hasDrivers ? "Overall progress" : "Starts after first induction"} />
        <MetricCard label="Avg Quiz" value={hasDrivers ? `${metrics.averageQuizScore}%` : "No data"} detail={hasDrivers ? "Across submitted attempts" : "Shown after quiz attempts"} />
        <MetricCard label="Avg Time" value={hasDrivers ? `${metrics.averageCompletionHours}h` : "No data"} detail={hasDrivers ? "Typical completion time" : "Shown after completions"} />
      </div>

      {!hasDrivers && (
        <div className="glass content-panel onboarding-banner">
          <SectionHeader title="Get Started" subtitle="This workspace is ready, but there are no drivers yet. Create the first account to begin induction tracking." />
          <div className="feature-grid setup-grid">
            <FeatureCard title="1. Create a driver" body="Enter a name, email, and temporary password. The driver will use those details to sign in." />
            <FeatureCard title="2. Share the login" body="Give the driver their email and temporary password so they can start the induction flow." />
            <FeatureCard title="3. Track progress here" body="Once the first driver starts, this dashboard will show progress, activity, quiz scores, and completion data." />
          </div>
          <div className="inline-row wrap">
            <button className="primary-button" onClick={onFillTestDriver}>Use Test Details</button>
            <small>Tip: create a sample driver first if you want to test the full journey end to end.</small>
          </div>
        </div>
      )}

      <div className="admin-grid">
        <div className="glass content-panel">
          <SectionHeader title="Driver Management" subtitle="Create accounts, search drivers, and handle common admin tasks from one place." />
          <div className="toolbar wrap">
            <div className="segmented-control wide-control">
              {(["all", "Completed", "In Progress", "Not Started"] as const).map((value) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                  {value}
                </button>
              ))}
            </div>
            <div className="inline-row wrap">
              <Field fieldKey="admin.search" name="search" label="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
              <Field fieldKey="admin.reportFrom" name="reportFrom" label="Report from" type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
              <Field fieldKey="admin.reportTo" name="reportTo" label="Report to" type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
              <button className="ghost-button" onClick={onRefresh} disabled={currentAction === "admin-refresh"} title="Reload the latest driver and compliance data">
                {currentAction === "admin-refresh" ? "Refreshing..." : "Refresh"}
              </button>
              <button className="secondary-button" onClick={() => onExport("csv")} disabled={!canExportDrivers || currentAction === "export-csv-drivers"} title={canExportDrivers ? "Download the filtered driver report as a spreadsheet" : "Create a driver first to export a report"}>
                Export CSV
              </button>
              <button className="primary-button" onClick={() => onExport("pdf")} disabled={!canExportDrivers || currentAction === "export-pdf-drivers"} title={canExportDrivers ? "Download the filtered driver report as a printable file" : "Create a driver first to export a report"}>
                Export PDF
              </button>
              <button className="ghost-button" onClick={() => onExport("csv", { scope: "audit" })} disabled={!canExportAudit || currentAction === "export-csv-audit"} title={canExportAudit ? "Download the audit log for compliance review" : "Audit log export becomes useful after activity exists"}>
                Export Audit Log
              </button>
              <button className="secondary-button" onClick={props.onOpenBulkImport} title="Import multiple drivers via CSV format">
                Bulk Import Drivers
              </button>
            </div>
          </div>

          <div className="admin-editor">
            <div className="form-grid">
              <Field fieldKey="admin.fullName" name="fullName" label="Full name" value={driverForm.fullName} error={driverFormErrors.fullName} onChange={(event) => setDriverForm({ ...driverForm, fullName: event.target.value })} />
              <Field fieldKey="admin.email" name="email" label="Email" value={driverForm.email} error={driverFormErrors.email} onChange={(event) => setDriverForm({ ...driverForm, email: event.target.value })} />
              <Field fieldKey="admin.phone" name="phone" label="Phone" value={driverForm.phone} error={driverFormErrors.phone} onChange={(event) => setDriverForm({ ...driverForm, phone: event.target.value })} />
              <Field fieldKey="admin.address" name="address" label="Address" value={driverForm.address} error={driverFormErrors.address} onChange={(event) => setDriverForm({ ...driverForm, address: event.target.value })} />
              <SelectField fieldKey="admin.preferredLanguage" name="preferredLanguage" label="Preferred language" value={driverForm.preferredLanguage} error={driverFormErrors.preferredLanguage} onChange={(event) => setDriverForm({ ...driverForm, preferredLanguage: event.target.value })} options={["English"]} />
              {!editingDriverId && (
                <Field fieldKey="admin.password" name="password" label="Temporary password" type="password" value={driverForm.password} error={driverFormErrors.password} onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} />
              )}
            </div>
            <div className="inline-row wrap">
              <button className="primary-button" onClick={onSaveDriver} disabled={currentAction === "admin-save"} title={editingDriverId ? "Save updates for this driver" : "Create a new driver login"}>
                {currentAction === "admin-save" ? "Saving..." : editingDriverId ? "Save Changes" : "Create Driver"}
              </button>
              <button className="ghost-button" onClick={onFillTestDriver} title="Fill the form with sample details for testing">
                Use Test Details
              </button>
              <button className="ghost-button" onClick={onClearForm} title="Clear the form and start again">Clear</button>
            </div>
            {editingDriverId && (
              <div className="password-reset-card">
                <Field fieldKey="admin.passwordReset" name="passwordReset" label="New password" type="password" value={passwordReset} error={passwordResetError} onChange={(event) => setPasswordReset(event.target.value)} />
                <button className="secondary-button" onClick={onResetPassword} disabled={currentAction === "password-reset"} title="Set a fresh password for this driver">
                  {currentAction === "password-reset" ? "Resetting..." : "Reset Password"}
                </button>
                <button className="ghost-button" onClick={() => onResetInduction(editingDriverId)} disabled={currentAction === `reset-induction-${editingDriverId}`} title="Clear this driver’s progress and send them back to step 1">
                  {currentAction === `reset-induction-${editingDriverId}` ? "Resetting Progress..." : "Reset Induction"}
                </button>
              </div>
            )}
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.length ? drivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className={`table-row-clickable ${editingDriverId === driver.id ? "selected-row" : ""}`}
                    onClick={() => onEditDriver(driver)}
                    onKeyDown={(event) => handleRowKeyDown(event, () => onEditDriver(driver))}
                    role="button"
                    tabIndex={0}
                  >
                    <td>
                      <strong>{driver.fullName}</strong>
                      <small>{driver.email}</small>
                    </td>
                    <td>{driver.status}</td>
                    <td>
                      <div className="table-progress">
                        <span>{driver.completionPercentage}%</span>
                        <div className="progress-bar compact">
                          <span className="progress-fill" style={{ width: `${driver.completionPercentage}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>{driver.documents.length}</td>
                    <td>
                      <div className="table-actions">
                        <button className="text-button" onClick={(event) => {
                          event.stopPropagation();
                          onEditDriver(driver);
                        }} title="Open this driver’s details">
                          Edit
                        </button>
                        <button className="text-button danger-text" onClick={(event) => {
                          event.stopPropagation();
                          onDeleteDriver(driver.id);
                        }} title="Delete this driver account">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state-card">
                        <strong>{hasDrivers ? "No drivers match your current filters." : "No drivers yet."}</strong>
                        <p>{hasDrivers ? "Change the search or status filters to see more results." : "Create a driver account above, or use the test details button to generate a safe sample record."}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass content-panel">
          <SectionHeader title="Compliance Overview" subtitle="Review trends, spot drivers who need support, and keep the induction experience running smoothly." />
          {hasDrivers ? (
            <>
              <div className="analytics-grid">
                <div className="chart-card">
                  <div className="inline-row spread">
                    <strong>Completion trend</strong>
                    <small>Last 7 days</small>
                  </div>
                  <MiniBarChart data={charts.completionTrend} />
                </div>
                <div className="chart-card">
                  <div className="inline-row spread">
                    <strong>Quiz score spread</strong>
                    <small>Latest results</small>
                  </div>
                  <MiniBarChart data={charts.quizBands} />
                </div>
              </div>
              <div className="insight-grid">
                <InsightList
                  title="Needs follow-up"
                  description="Drivers who are incomplete or have low quiz scores."
                  drivers={insights.followUpDrivers}
                  emptyMessage="No follow-up is needed right now."
                />
                <InsightList
                  title="Multiple quiz fails"
                  description="Drivers who may need extra coaching."
                  drivers={insights.multiFailDrivers}
                  emptyMessage="No drivers have multiple failed quiz attempts."
                />
                <InsightList
                  title="Stuck on a step"
                  description="Drivers with no recent progress for more than 3 days."
                  drivers={insights.stuckDrivers}
                  emptyMessage="No drivers appear stuck right now."
                />
              </div>
            </>
          ) : (
            <div className="empty-analytics-state">
              <strong>No induction data yet.</strong>
              <p>Charts, risk insights, quiz trends, and completion timing will appear here after drivers begin their induction.</p>
            </div>
          )}
          <div className="admin-side-stack">
            <div className="feature-card">
              <div className="inline-row spread">
                <strong>Recent System Activity</strong>
                <span className="ghost-chip">{recentActivity.length} logged</span>
              </div>
              <div className="timeline-list">
                {recentActivity.length ? recentActivity.slice(0, 3).map((item) => (
                  <div key={item.id} className="timeline-item">
                    <div>
                      <strong>{formatAuditAction(item.action)}</strong>
                      <small>{renderAuditMeta(item.metadata)}</small>
                    </div>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </div>
                )) : <p className="muted">Audit events will appear here as the team uses the system.</p>}
              </div>
            </div>

            <div className="feature-card">
              <div className="inline-row spread">
                <strong>Recent feedback</strong>
                <span className="ghost-chip">{recentFeedback.length} responses</span>
              </div>
              <div className="timeline-list">
                {hasRecentFeedback ? recentFeedback.map((item) => (
                  <div key={item.id} className="timeline-item">
                    <div>
                      <strong>{`Clarity ${item.clarityRating}/5`}</strong>
                      <small>{item.issues || "No issues reported."}</small>
                    </div>
                    <small>{new Date(item.submittedAt).toLocaleString()}</small>
                  </div>
                )) : <p className="muted">Driver feedback will appear here after inductions are completed.</p>}
              </div>
            </div>

            <div className="feature-card">
              <div className="inline-row spread">
                <strong>{selectedDriver ? selectedDriver.fullName : "Driver Timeline"}</strong>
                <span className="ghost-chip">{selectedDriver?.status ?? "Select a driver"}</span>
              </div>
              {activeDriver ? (
                <>
                  <p>
                    Step {activeDriver.currentStep} • Progress {activeDriver.completionPercentage}% • Last activity{" "}
                    {activeDriver.lastActivityAt ? new Date(activeDriver.lastActivityAt).toLocaleString() : "Pending"}
                  </p>
                  <p className="muted">
                    {activeDriver.completionHours
                      ? `Completed in about ${activeDriver.completionHours} hours from first activity.`
                      : activeDriver.quizScore !== null && activeDriver.quizScore < 70
                        ? "Quiz support may be needed before this driver can finish."
                        : "Continue monitoring progress and follow up if the driver stops moving forward."}
                  </p>
                  <div className="doc-preview-list">
                    {activeDriver.documents.map((document) => (
                      <button key={document.id} className="ghost-chip" onClick={() => {
                        window.open(document.fileUrl, "_blank");
                      }}>
                        {labelForDoc(document.type)}
                      </button>
                    ))}
                    {!activeDriver.documents.length && <span className="muted">No documents uploaded yet.</span>}
                  </div>
                  <div className="inline-row wrap">
                    <button className="secondary-button" onClick={() => onExport("csv", { driverId: activeDriver.id })} disabled={currentAction === "export-csv-drivers"} title="Download this driver’s report as CSV">
                      Driver CSV
                    </button>
                    <button className="ghost-button" onClick={() => onExport("pdf", { driverId: activeDriver.id })} disabled={currentAction === "export-pdf-drivers"} title="Download this driver’s report as PDF">
                      Driver PDF
                    </button>
                  </div>
                  <div className="timeline-list">
                    {activeDriver.auditTrail.length ? activeDriver.auditTrail.slice(0, 10).map((item) => (
                      <div key={item.id} className="timeline-item">
                        <div>
                          <strong>{formatAuditAction(item.action)}</strong>
                          <small>{renderAuditMeta(item.metadata)}</small>
                        </div>
                        <small>{new Date(item.createdAt).toLocaleString()}</small>
                      </div>
                    )) : <p className="muted">This driver has no recorded timeline events yet.</p>}
                  </div>
                  {activeDriver.feedback && (
                    <div className="scenario-note">
                      <strong>{`Driver feedback: ${activeDriver.feedback.clarityRating}/5`}</strong>
                      <p>{activeDriver.feedback.issues || "The driver did not report any issues."}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted">{hasDrivers ? "Select a driver row to inspect their full induction history." : "Create or select a driver to inspect timeline history here."}</p>
              )}
            </div>

            <div className="feature-card">
              <div className="inline-row spread">
                <strong>Certificate Verification</strong>
                <span className="ghost-chip">Admin check</span>
              </div>
              <p className="muted">Paste the full verification code from a completed driver certificate, then run the check.</p>
              <div className="inline-row wrap">
                <Field fieldKey="admin.verificationCode" name="verificationCode" label="Verification code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} />
                <button className="primary-button" onClick={onVerifyCertificate} disabled={!verificationCode.trim() || currentAction === "certificate-verify"}>
                  {currentAction === "certificate-verify" ? "Verifying..." : "Verify"}
                </button>
              </div>
              {verificationResult && (
                <div className={`result-banner ${verificationResult.verified ? "passed" : "failed"}`}>
                  <strong>{verificationResult.verified ? "Certificate is valid" : "Certificate not found"}</strong>
                  <p>
                    {verificationResult.verified
                      ? `${verificationResult.driver?.fullName ?? "Driver"} completed induction on ${new Date(verificationResult.certificate?.issuedAt ?? "").toLocaleString()}.`
                      : verificationResult.message ?? "No matching certificate record was found."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-header">
      <p className="eyebrow">{title}</p>
      <h3>{subtitle}</h3>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="feature-card">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="glass metric-card">
      <p className="muted">{label}</p>
      <h3>{value}</h3>
      <small>{detail}</small>
    </div>
  );
}

function MiniBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="mini-chart">
      {data.map((item) => (
        <div key={item.label} className="mini-chart-item">
          <div className="mini-chart-bar-wrap">
            <div className="mini-chart-bar" style={{ height: `${Math.max(10, (item.value / maxValue) * 100)}%` }} />
          </div>
          <strong>{item.value}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function InsightList(props: {
  title: string;
  description: string;
  drivers: AdminDriverRow[];
  emptyMessage: string;
}) {
  const { title, description, drivers, emptyMessage } = props;

  return (
    <div className="feature-card">
      <strong>{title}</strong>
      <p className="muted">{description}</p>
      <div className="timeline-list">
        {drivers.length ? drivers.slice(0, 4).map((driver) => (
          <div key={driver.id} className="timeline-item">
            <div>
              <strong>{driver.fullName}</strong>
              <small>{driver.status} • Step {driver.currentStep} • Quiz {driver.quizScore ?? "Pending"}</small>
            </div>
            <small>{driver.lastActivityAt ? new Date(driver.lastActivityAt).toLocaleDateString() : "No activity"}</small>
          </div>
        )) : <p className="muted">{emptyMessage}</p>}
      </div>
    </div>
  );
}

function Field(props: {
  fieldKey: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  error?: string;
  autoComplete?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = props.type === "password";

  return (
    <label className={`floating-field ${isPassword ? "password-field" : ""}`} data-field={props.fieldKey}>
      <input
        name={props.name}
        type={isPassword && revealed ? "text" : props.type ?? "text"}
        value={props.value}
        onChange={props.onChange}
        placeholder=" "
        autoComplete={props.autoComplete}
        aria-invalid={Boolean(props.error)}
      />
      <span>{props.label}</span>
      {isPassword && (
        <button
          type="button"
          className="field-toggle"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? `Hide ${props.label}` : `Show ${props.label}`}
        >
          {revealed ? "Hide" : "Show"}
        </button>
      )}
      {props.error && <small className="field-error">{props.error}</small>}
    </label>
  );
}

function SelectField(props: {
  fieldKey: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
  options: string[];
}) {
  return (
    <label className="floating-field" data-field={props.fieldKey}>
      <select name={props.name} value={props.value} onChange={props.onChange} aria-invalid={Boolean(props.error)}>
        {props.options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <span>{props.label}</span>
      {props.error && <small className="field-error">{props.error}</small>}
    </label>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

function LoginSkeleton() {
  return (
    <section className="split-panel glass login-screen">
      <div className="panel-hero">
        <SkeletonBlock className="skeleton-title" />
        <div className="feature-grid">
          <SkeletonBlock className="skeleton-card" />
          <SkeletonBlock className="skeleton-card" />
          <SkeletonBlock className="skeleton-card" />
        </div>
      </div>
      <div className="panel-form glass-inner">
        <SkeletonBlock className="skeleton-line" />
        <SkeletonBlock className="skeleton-input" />
        <SkeletonBlock className="skeleton-input" />
        <SkeletonBlock className="skeleton-button" />
      </div>
    </section>
  );
}

function DriverSkeleton() {
  return (
    <div className="experience-grid">
      <aside className="dashboard-sidebar glass">
        <SkeletonBlock className="skeleton-card tall" />
      </aside>
      <section className="flow-panel glass content-panel">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonBlock className="skeleton-input" />
        <SkeletonBlock className="skeleton-input" />
        <SkeletonBlock className="skeleton-input" />
      </section>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <section className="admin-layout">
      <div className="admin-summary-row">
        <SkeletonBlock className="skeleton-card" />
        <SkeletonBlock className="skeleton-card" />
        <SkeletonBlock className="skeleton-card" />
        <SkeletonBlock className="skeleton-card" />
      </div>
      <div className="glass content-panel">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonBlock className="skeleton-input" />
        <SkeletonBlock className="skeleton-card tall" />
      </div>
    </section>
  );
}

function CelebrationBurst() {
  return (
    <div className="celebration-burst" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span
          key={index}
          className={`burst-dot burst-${index % 4}`}
          style={{ "--delay": `${index * 0.05}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function validateLogin(email: string, password: string) {
  const errors: Record<string, string> = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!/\S+@\S+\.\S+/.test(email)) errors.email = "Enter a valid email address.";
  if (!password.trim()) errors.password = "Enter your password.";
  else if (password.trim().length < 6) errors.password = "Use at least 6 characters.";
  return errors;
}

function validateProfile(profile: Pick<DriverProfile, "fullName" | "email" | "phone" | "address" | "preferredLanguage">) {
  const errors: Record<string, string> = {};
  if (!sanitizeText(profile.fullName)) errors.fullName = "Enter the driver’s full name.";
  if (!profile.email.trim()) errors.email = "Enter an email address.";
  else if (!/\S+@\S+\.\S+/.test(profile.email)) errors.email = "Enter a valid email address.";
  if (!sanitizeText(profile.phone)) errors.phone = "Enter a phone number.";
  if (!sanitizeText(profile.address)) errors.address = "Enter an address.";
  if (!profile.preferredLanguage) errors.preferredLanguage = "Choose a preferred language.";
  return errors;
}

function validateDeclaration(accepted: boolean, signature: string) {
  const errors: Record<string, string> = {};
  if (!accepted) errors.accepted = "Please confirm the declaration before continuing.";
  if (!signature || signature.trim().length === 0) errors.signature = "Add your digital signature.";
  return errors;
}

function validateAdminDriverForm(
  form: { fullName: string; email: string; phone: string; address: string; preferredLanguage: string; password: string },
  requirePassword: boolean
) {
  const errors = validateProfile(form);
  if (requirePassword) {
    if (!form.password.trim()) errors.password = "Set a temporary password.";
    else if (form.password.trim().length < 8) errors.password = "Use at least 8 characters.";
  }
  return errors;
}

function validateUploadFile(file: File) {
  if (!allowedFileTypes.includes(file.type)) {
    return "Use a PDF, JPG, or PNG file.";
  }
  if (file.size > maxFileSize) {
    return "Files must be 5 MB or smaller.";
  }
  return "";
}

function focusField(fieldKey: string) {
  const target = document.querySelector<HTMLElement>(`[data-field="${fieldKey}"] input, [data-field="${fieldKey}"] select`);
  target?.focus();
}

function normalizeError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Something went wrong.";
  if (/network|fetch|offline|failed to fetch/i.test(raw)) {
    return "We couldn’t reach the server. Please check your connection and try again.";
  }
  if (/invalid login credentials/i.test(raw)) {
    return "That email or password didn’t match our records.";
  }
  if (/registered as admin, not driver/i.test(raw)) {
    return "This email belongs to an admin account. Switch to Admin Login and try again.";
  }
  if (/registered as driver, not admin/i.test(raw)) {
    return "This email belongs to a driver account. Switch to Driver Login and try again.";
  }
  if (/account setup is incomplete|profile not found|multiple \(or no\) rows returned/i.test(raw)) {
    return "This account exists, but it has not been fully set up yet. Ask your admin to finish the account setup.";
  }
  if (/jwt|permission|forbidden|rls/i.test(raw)) {
    return "You don’t have permission to do that action.";
  }
  return raw;
}

function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function sanitizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function labelForDoc(type: DocumentType) {
  if (type === "driver_license") return "Licence";
  if (type === "medical_certificate") return "Medical";
  if (type === "driving_history") return "History";
  if (type === "right_to_work") return "Visa";
  if (type === "nhvas_bfm_certificate") return "NHVAS";
  if (type === "dangerous_goods_license") return "DG License";
  if (type === "identity_selfie") return "Selfie Verification";
  return "ID";
}

function formatAuditAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderAuditMeta(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== null && value !== "");
  if (!entries.length) return "Compliance event recorded.";
  return entries
    .slice(0, 3)
    .map(([key, value]) => `${formatAuditAction(key)}: ${String(value)}`)
    .join(" • ");
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  if (size > 0) {
    return `${size} B`;
  }
  return "Uploaded";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function downloadBase64Pdf(pdfBase64: string, fileName: string) {
  const byteCharacters = window.atob(pdfBase64);
  const bytes = new Uint8Array(byteCharacters.length);
  for (let index = 0; index < byteCharacters.length; index += 1) {
    bytes[index] = byteCharacters.charCodeAt(index);
  }
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), fileName);
}

function buildPseudoQr(value: string) {
  const cells = 11;
  const size = 132;
  const rects = Array.from({ length: cells * cells }, (_, index) => {
    const char = value.charCodeAt(index % Math.max(value.length, 1)) || 0;
    if ((char + index) % 2 !== 0) return "";
    const x = (index % cells) * 12;
    const y = Math.floor(index / cells) * 12;
    return `<rect x="${x}" y="${y}" width="10" height="10" rx="1" fill="currentColor" />`;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="18" fill="rgba(255,255,255,0.08)"/>${rects}</svg>`;
}

function devLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log("[driver-induction]", ...args);
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
