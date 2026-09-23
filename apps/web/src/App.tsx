import { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppState } from "./state/AppProvider";
import { api } from "./lib/api";
import bntLogo from "./assets/bnt-logistics-logo.png";
import {
  ThemeMode,
  ComplianceAudit,
  SOPItem,
  ComplianceDocumentRequirement,
  VehicleRecord,
  ContractorCompanyRecord,
  SafetyIncidentRecord,
  SiteCheckinRecord,
} from "./types";
import { LoginForm } from "./components/auth/LoginForm";
import { DriverWizard } from "./components/driver/DriverWizard";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { ComplianceDashboardView } from "./components/driver/ComplianceDashboardView";
import { DocumentComplianceVault } from "./components/driver/DocumentComplianceVault";
import { AuditAndSOPManager } from "./components/driver/AuditAndSOPManager";
import { VehicleManagementHub } from "./components/driver/VehicleManagementHub";
import { ContractorCompanyHub } from "./components/driver/ContractorCompanyHub";
import { SafetyIncidentReporter } from "./components/driver/SafetyIncidentReporter";
import { DepotCheckinFatigueHub } from "./components/driver/DepotCheckinFatigueHub";
import { PreTripInspectionHub } from "./components/driver/PreTripInspectionHub";
import { DepotGatePassModal } from "./components/driver/DepotGatePassModal";
import {
  LayoutDashboard,
  GraduationCap,
  FileText,
  ClipboardCheck,
  ClipboardList,
  QrCode,
  Truck,
  Building2,
  AlertTriangle,
  MapPin,
  Sun,
  Moon,
  Menu,
  X,
  RefreshCw,
  LogOut
} from "lucide-react";

import {
  INITIAL_AUDITS,
  INITIAL_SOPS,
  INITIAL_DOCUMENTS,
  INITIAL_VEHICLES,
  INITIAL_CONTRACTOR_COMPANY,
  INITIAL_INCIDENTS,
  INITIAL_SITE_CHECKINS,
} from "./state/complianceData";

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
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "induction" | "documents" | "audits" | "learning" | "vehicles" | "contractor" | "incidents" | "checkin" | "pretrip"
  >("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gatePassOpen, setGatePassOpen] = useState(false);

  // Compliance state
  const [audits, setAudits] = useState<ComplianceAudit[]>(INITIAL_AUDITS);
  const [sops, setSops] = useState<SOPItem[]>(INITIAL_SOPS);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocumentRequirement[]>(INITIAL_DOCUMENTS);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(INITIAL_VEHICLES);
  const [contractor, setContractor] = useState<ContractorCompanyRecord>(INITIAL_CONTRACTOR_COMPANY);
  const [incidents, setIncidents] = useState<SafetyIncidentRecord[]>(INITIAL_INCIDENTS);
  const [checkins, setCheckins] = useState<SiteCheckinRecord[]>(INITIAL_SITE_CHECKINS);
  const [preTripInspections, setPreTripInspections] = useState<any[]>([]);

  const {
    session,
    driverBundle,
    adminOverview,
    quizQuestions,
    loading,
    authLoading,
    authError,
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

  // Load real user-scoped records upon authentication
  useEffect(() => {
    if (session?.user?.id) {
      const uid = session.user.id;
      setVehicles(api.getVehicles(uid));
      setIncidents(api.getSafetyIncidents(uid));
      setCheckins(api.getSiteCheckins(uid));
      setPreTripInspections(api.getPreTripInspections(uid));
      const savedCompany = api.getContractorCompany(uid);
      if (savedCompany) {
        setContractor(savedCompany);
      }
    } else {
      setVehicles([]);
      setIncidents([]);
      setCheckins([]);
      setPreTripInspections([]);
    }
  }, [session?.user?.id]);

  // Sync induction wizard step with driver progress
  useEffect(() => {
    if (driverBundle?.progress?.currentStep) {
      setDriverStep(driverBundle.progress.currentStep);
    }
  }, [driverBundle?.progress?.currentStep]);

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

  const handleCompleteAudit = (auditId: string) => {
    setAudits((prev) =>
      prev.map((a) =>
        a.id === auditId
          ? { ...a, status: "Passed", attemptsCount: a.attemptsCount + 1, lastAttemptDate: new Date().toISOString().split("T")[0] }
          : a
      )
    );
  };

  const handleCompleteSOP = (sopId: string) => {
    setSops((prev) =>
      prev.map((s) => (s.id === sopId ? { ...s, status: "Passed" } : s))
    );
  };

  const handleUploadComplianceDoc = (docId: string, fileName: string, expiryDate: string | null) => {
    setComplianceDocs((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              status: "Approved",
              historyStatus: "Approved",
              uploadedFileName: fileName,
              expiryDate: expiryDate || d.expiryDate,
              uploadedAt: new Date().toISOString().split("T")[0],
            }
          : d
      )
    );
  };

  const handleAddVehicle = (newVeh: VehicleRecord) => {
    if (session?.user?.id) {
      const updated = api.saveVehicle(session.user.id, newVeh);
      setVehicles(updated);
    } else {
      setVehicles((prev) => [newVeh, ...prev]);
    }
  };

  const handleReportIncident = (newInc: SafetyIncidentRecord) => {
    if (session?.user?.id) {
      const updated = api.reportSafetyIncident(session.user.id, newInc);
      setIncidents(updated);
    } else {
      setIncidents((prev) => [newInc, ...prev]);
    }
  };

  const handleSiteCheckin = (newCheckin: SiteCheckinRecord) => {
    if (session?.user?.id) {
      const updated = api.saveSiteCheckin(session.user.id, newCheckin);
      setCheckins(updated);
    } else {
      setCheckins((prev) => [newCheckin, ...prev]);
    }
  };

  const handleSavePreTripInspection = (record: any) => {
    if (session?.user?.id) {
      const updated = api.savePreTripInspection(session.user.id, record);
      setPreTripInspections(updated);

      // If inspection detected a defect, automatically ground the vehicle
      if (record.overallStatus && record.overallStatus !== "Fit for Duty") {
        const vehicleRego = (record.vehicleRego || "").toUpperCase().trim();
        const existing = vehicles.find((v) => v.rego.toUpperCase().trim() === vehicleRego);
        if (existing) {
          const updatedVeh: VehicleRecord = {
            ...existing,
            status: "Maintenance Required"
          };
          const nextVehicles = api.saveVehicle(session.user.id, updatedVeh);
          setVehicles(nextVehicles);
        }
      }
    } else {
      setPreTripInspections((prev) => [record, ...prev]);
      if (record.overallStatus && record.overallStatus !== "Fit for Duty") {
        const vehicleRego = (record.vehicleRego || "").toUpperCase().trim();
        setVehicles((prev) =>
          prev.map((v) =>
            v.rego.toUpperCase().trim() === vehicleRego ? { ...v, status: "Maintenance Required" } : v
          )
        );
      }
    }
  };

  const handleSiteCheckout = (checkinId: string) => {
    if (session?.user?.id) {
      const updated = api.checkoutSiteCheckin(session.user.id, checkinId);
      setCheckins(updated);
    } else {
      setCheckins((prev) =>
        prev.map((c) =>
          c.id === checkinId
            ? { ...c, status: "Checked Out", checkoutTime: new Date().toISOString().replace("T", " ").slice(0, 16) }
            : c
        )
      );
    }
  };

  const handleUpdateContractor = (updatedCompany: ContractorCompanyRecord) => {
    if (session?.user?.id) {
      const saved = api.saveContractorCompany(session.user.id, updatedCompany);
      setContractor(saved);
    } else {
      setContractor(updatedCompany);
    }
  };

  return (
    <div className="app-shell flex flex-col min-h-screen">
      {/* Global Modern Top Header & Navigation */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 px-4 md:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <img src={bntLogo} alt="BNT Logistics" className="h-9 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white tracking-tight">BNT LOGISTICS</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                  Compliance Portal
                </span>
              </div>
              <span className="text-xs text-slate-400 block font-medium">Site Compliance & Induction Platform</span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          {session && session.user.role === "driver" && (
            <nav className="hidden 2xl:flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-inner">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "dashboard" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </button>
              <button
                onClick={() => setActiveTab("induction")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "induction" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" /> Induction
              </button>
              <button
                onClick={() => setActiveTab("documents")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "documents" ? "bg-purple-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Vault ({complianceDocs.length})
              </button>
              <button
                onClick={() => setActiveTab("audits")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "audits" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> Audits & SOPs
              </button>
              <button
                onClick={() => setActiveTab("vehicles")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "vehicles" ? "bg-amber-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> Fleet Pass
              </button>
              <button
                onClick={() => setActiveTab("contractor")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "contractor" ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Contractor
              </button>
              <button
                onClick={() => setActiveTab("incidents")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "incidents" ? "bg-rose-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Hazards ({incidents.filter(i => i.status !== "Resolved").length})
              </button>
              <button
                onClick={() => setActiveTab("pretrip")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "pretrip" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-400" /> Pre-Trip
              </button>
              <button
                onClick={() => setActiveTab("checkin")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "checkin" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> Depot Check-In
              </button>
            </nav>
          )}

          {/* User Controls & Mobile Toggle */}
          <div className="flex items-center gap-3">
            {session && session.user.role === "driver" && (
              <button
                type="button"
                onClick={() => setGatePassOpen(true)}
                className="hidden sm:flex px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" /> Gate Pass
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              {theme === "light" ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span>{theme === "light" ? "Dark" : "Light"}</span>
            </button>

            {session && (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <span className="text-xs font-bold text-white block">{driverBundle?.driver?.fullName || session.user.email}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                    {session.user.role === "admin" ? "Compliance Administrator" : "Heavy Vehicle Driver"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            {session && session.user.role === "driver" && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="2xl:hidden p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white border border-slate-700"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {session && session.user.role === "driver" && mobileMenuOpen && (
          <div className="2xl:hidden mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fadeIn">
            <button
              onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "dashboard" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => { setActiveTab("induction"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "induction" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <GraduationCap className="w-4 h-4" /> Induction
            </button>
            <button
              onClick={() => { setActiveTab("documents"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "documents" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <FileText className="w-4 h-4" /> Vault ({complianceDocs.length})
            </button>
            <button
              onClick={() => { setActiveTab("audits"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "audits" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <ClipboardCheck className="w-4 h-4" /> Audits & SOPs
            </button>
            <button
              onClick={() => { setActiveTab("vehicles"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "vehicles" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <Truck className="w-4 h-4" /> Fleet Pass
            </button>
            <button
              onClick={() => { setActiveTab("contractor"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "contractor" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <Building2 className="w-4 h-4" /> Contractor Profile
            </button>
            <button
              onClick={() => { setActiveTab("incidents"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "incidents" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <AlertTriangle className="w-4 h-4" /> Safety Hazards
            </button>
            <button
              onClick={() => { setActiveTab("pretrip"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "pretrip" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <ClipboardList className="w-4 h-4 text-emerald-400" /> Pre-Trip Inspection
            </button>
            <button
              onClick={() => { setActiveTab("checkin"); setMobileMenuOpen(false); }}
              className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "checkin" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              <MapPin className="w-4 h-4" /> Depot Check-In
            </button>
            <button
              onClick={() => { setGatePassOpen(true); setMobileMenuOpen(false); }}
              className="p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            >
              <QrCode className="w-4 h-4" /> View Depot Gate Pass
            </button>
          </div>
        )}
      </header>

      {/* Main Container View */}
      {loading ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
            <p className="text-slate-400 text-sm font-medium">Initializing Compliance Hub...</p>
          </div>
        </main>
      ) : !session ? (
        <LoginForm onLogin={(email, pass, role) => login({ email, password: pass, role })} loading={authLoading} error={authError} />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
          {session.user.role === "driver" && driverBundle ? (
            <>
              {activeTab === "dashboard" && (
                <ComplianceDashboardView
                  driverBundle={driverBundle}
                  audits={audits}
                  sops={sops}
                  documents={complianceDocs}
                  vehicles={vehicles}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
                onStartAudit={() => setActiveTab("audits")}
                onStartSOP={() => setActiveTab("learning")}
                onUploadDoc={() => setActiveTab("documents")}
                onOpenGatePass={() => setGatePassOpen(true)}
              />
            )}

            {activeTab === "induction" && (
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
            )}

            {activeTab === "documents" && (
              <DocumentComplianceVault
                documents={complianceDocs}
                onUploadDocument={handleUploadComplianceDoc}
              />
            )}

            {(activeTab === "audits" || activeTab === "learning") && (
              <AuditAndSOPManager
                audits={audits}
                sops={sops}
                activeTab={activeTab === "learning" ? "learning" : "audits"}
                onCompleteAudit={handleCompleteAudit}
                onCompleteSOP={handleCompleteSOP}
              />
            )}

            {activeTab === "vehicles" && (
              <VehicleManagementHub
                vehicles={vehicles}
                onAddVehicle={handleAddVehicle}
                driverName={driverBundle.driver.fullName}
                driverNumber={driverBundle.driver.licenceNumber}
                contactNumber={driverBundle.driver.phone}
              />
            )}

            {activeTab === "contractor" && (
              <ContractorCompanyHub
                contractor={contractor}
                onUpdateContractor={handleUpdateContractor}
              />
            )}

            {activeTab === "incidents" && (
              <SafetyIncidentReporter
                incidents={incidents}
                onReportIncident={handleReportIncident}
              />
            )}

            {activeTab === "pretrip" && (
              <PreTripInspectionHub
                inspections={preTripInspections}
                onSaveInspection={handleSavePreTripInspection}
                driverName={driverBundle.driver.fullName}
                driverId={driverBundle.driver.id}
              />
            )}

            {activeTab === "checkin" && (
              <DepotCheckinFatigueHub
                checkins={checkins}
                vehicles={vehicles}
                driverName={driverBundle.driver.fullName}
                onCheckin={handleSiteCheckin}
                onCheckout={handleSiteCheckout}
              />
            )}
          </>
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
          <div className="text-center py-20">
            <p className="text-slate-400">Initializing Session...</p>
          </div>
        )}
      </main>
      )}

      {/* Depot Gate Pass Modal */}
      {session?.user.role === "driver" && driverBundle && (
        <DepotGatePassModal
          isOpen={gatePassOpen}
          onClose={() => setGatePassOpen(false)}
          driverBundle={driverBundle}
        />
      )}
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

