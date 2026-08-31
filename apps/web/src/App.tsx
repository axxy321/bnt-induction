import { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppState } from "./state/AppProvider";
import bntLogo from "./assets/bnt-logistics-logo.png";
import { ThemeMode } from "./types";
import { LoginForm } from "./components/auth/LoginForm";
import { DriverWizard } from "./components/driver/DriverWizard";
import { AdminDashboard } from "./components/admin/AdminDashboard";

function usePersistentTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem("induction-theme");
    return stored === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("induction-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return [theme, toggleTheme] as const;
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
        <div className="app-shell" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div className="glass" style={{ maxWidth: "500px", margin: "0 auto", padding: "32px", borderRadius: "20px" }}>
            <h2 style={{ fontSize: "1.4rem", margin: "0 0 8px" }}>Something Went Wrong</h2>
            <p className="muted" style={{ margin: "0 0 16px" }}>
              We hit an unexpected issue. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { t } = useTranslation();
  const [theme, toggleTheme] = usePersistentTheme();
  const [driverStep, setDriverStep] = useState(1);

  const {
    session,
    driverBundle,
    adminOverview,
    quizQuestions,
    loading,
    authLoading,
    login,
    logout,
    refreshAdminOverview,
    saveProfile,
    uploadDocument,
    saveStep,
    startVideoSection,
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

  const handleToggleModule = async (moduleItem: any) => {
    if (!driverBundle) return;
    const updated = driverBundle.learningProgress.map((m) =>
      m.sectionId === moduleItem.sectionId ? { ...m, completed: !m.completed } : m
    );
    await saveStep(3, { sections: updated.map((m) => ({ sectionId: m.sectionId, completed: m.completed })) });
  };

  const handleStartModule = async (moduleItem: any) => {
    await startVideoSection(moduleItem.sectionId);
  };

  const handleSaveDeclaration = async (accepted: boolean, signature: string) => {
    await saveStep(5, { accepted, signature });
  };

  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Global Header */}
      <header
        className="glass"
        style={{
          padding: "14px 24px",
          margin: "12px 16px 24px",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={bntLogo} alt="BNT Logistics" style={{ height: "36px", objectFit: "contain" }} />
          <div>
            <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
              BNT Logistics
            </h1>
            <span className="muted" style={{ fontSize: "0.78rem" }}>
              Australian Heavy Vehicle Compliance Portal
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "0.82rem",
              cursor: "pointer"
            }}
          >
            {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>

          {session && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                {session.user.email} ({session.user.role})
              </span>
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer"
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Body View */}
      <main style={{ flex: 1, paddingBottom: "40px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "8px" }}>🔄</div>
            <p className="muted">Loading Compliance Portal...</p>
          </div>
        ) : !session ? (
          <LoginForm onLogin={login} loading={authLoading} />
        ) : session.user.role === "driver" && driverBundle ? (
          <DriverWizard
            bundle={driverBundle}
            currentStep={driverStep}
            onSetStep={setDriverStep}
            onSaveProfile={saveProfile}
            onUploadDocument={(type, file) => uploadDocument({ type, file })}
            onToggleModule={handleToggleModule}
            onStartModule={handleStartModule}
            onSubmitQuiz={submitQuiz}
            onSaveDeclaration={handleSaveDeclaration}
            onGenerateCertificate={generateCertificate}
            onSubmitFeedback={submitDriverFeedback}
            quizQuestions={quizQuestions}
            loading={loading}
          />
        ) : session.user.role === "admin" ? (
          <AdminDashboard
            overview={adminOverview}
            onRefresh={refreshAdminOverview}
            onCreateDriver={createDriver}
            onUpdateDriver={updateDriverByAdmin}
            onResetPassword={resetDriverPassword}
            onResetInduction={resetDriverInduction}
            onDeleteDriver={deleteDriver}
            onExportReport={exportAdminReport}
            onVerifyCertificate={verifyCertificate}
            loading={loading}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p>Initializing Session...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
