import { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "./i18n";
import { useAppState } from "./state/AppContext";
import { api } from "./lib/api";
import bntLogo from "./assets/bnt-logistics-logo.png";
import {
  ThemeMode,
  ComplianceAudit,
  AuditAssignment,
  SOPItem,
  ComplianceDocumentRequirement,
  UploadedDocument,
  VehicleRecord,
  ContractorCompanyRecord,
  SafetyIncidentRecord,
  SiteCheckinRecord,
  BrandingSettings,
  PolicyRecord,
} from "./types";
import { LoginForm } from "./components/auth/LoginForm";
import { DriverWizard } from "./components/driver/DriverWizard";
import { DriverScheduleInvitations } from "./components/driver/DriverScheduleInvitations";
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
import { PolicySignModal } from "./components/driver/PolicySignModal";
import { ToastHost, showToast } from "./components/ui/Toast";
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
  LogOut,
  CalendarClock
} from "lucide-react";

import {
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
          <div className="glass card-hover" style={{ maxWidth: "500px", margin: "0 auto", padding: "32px", borderRadius: "20px" }}>
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

const DOCUMENT_LABELS: Record<string, string> = {
  driver_license: "Driver Licence",
  medical_certificate: "Medical Certificate",
  identity_proof: "Identity Proof",
  driving_history: "Driving History",
  right_to_work: "Right to Work",
  nhvas_bfm_certificate: "NHVR BFM Certificate",
  dangerous_goods_license: "Dangerous Goods Licence",
  hrwl_forklift: "HRWL Forklift Ticket",
  identity_selfie: "Identity Selfie"
};

function mapUploadedDocumentToVault(doc: UploadedDocument): ComplianceDocumentRequirement {
  const isMandatory =
    doc.type === "driver_license" || doc.type === "medical_certificate" || doc.type === "right_to_work";
  return {
    id: doc.id,
    name: DOCUMENT_LABELS[doc.type] ?? doc.type,
    category: doc.type === "driver_license" ? "Licence" : "Certificates",
    isMandatory,
    expiryDate: doc.expiresAt ? doc.expiresAt.split("T")[0] : null,
    status:
      doc.status === "approved" ? "Approved" : doc.status === "rejected" ? "Action Required" : "Pending",
    historyStatus:
      doc.status === "approved" ? "Approved" : doc.status === "rejected" ? "Rejected" : "Pending Review",
    uploadedFileUrl: doc.fileUrl,
    uploadedFileName: doc.name,
    uploadedAt: doc.uploadedAt ? doc.uploadedAt.split("T")[0] : null,
    rejectionReason: doc.rejectionReason ?? null,
    documentType: doc.type
  };
}

function AppContent() {
  const { t, i18n } = useTranslation();
  const [theme, toggleTheme] = usePersistentTheme();
  const [driverStep, setDriverStep] = useState(1);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "induction" | "schedule" | "documents" | "audits" | "learning" | "vehicles" | "contractor" | "incidents" | "checkin" | "pretrip"
  >("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gatePassOpen, setGatePassOpen] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [driverPolicies, setDriverPolicies] = useState<PolicyRecord[]>([]);
  const [signPolicyOpen, setSignPolicyOpen] = useState<PolicyRecord | null>(null);
  const [showLoginArrival, setShowLoginArrival] = useState(false);
  const [showLogoutDeparture, setShowLogoutDeparture] = useState(false);

  // Load portal branding (company name, logo, colour, welcome text)
  useEffect(() => {
    api.getBranding()
      .then((settings) => {
        setBranding(settings);
        if (settings.primaryColor) {
          document.documentElement.style.setProperty("--brand-color", settings.primaryColor);
        }
      })
      .catch(() => {});
  }, []);

  const handleBrandingUpdated = (next: BrandingSettings) => {
    setBranding(next);
    if (next.primaryColor) {
      document.documentElement.style.setProperty("--brand-color", next.primaryColor);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setShowLogoutDeparture(true);
    window.setTimeout(() => setShowLogoutDeparture(false), 1250);
  };

  // Compliance state
  const [audits, setAudits] = useState<AuditAssignment[]>([]);
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
    revokeDriverInduction,
    archiveDriver,
    restoreDriver,
    bulkArchiveDrivers,
    bulkRestoreDrivers,
    deleteDriver,
    exportAdminReport,
    verifyCertificate
  } = useAppState();

  // Load pending policy signatures for the signed-in driver
  useEffect(() => {
    if (session?.user?.id && session.user.role === "driver") {
      api.getPolicies(session.user.id)
        .then(setDriverPolicies)
        .catch(() => setDriverPolicies([]));
    } else {
      setDriverPolicies([]);
    }
  }, [session?.user?.id, session?.user?.role]);

  const handlePolicySigned = async () => {
    setSignPolicyOpen(null);
    if (session?.user?.id) {
      try {
        const refreshed = await api.getPolicies(session.user.id);
        setDriverPolicies(refreshed);
      } catch {
        setDriverPolicies((prev) =>
          prev.map((p) =>
            p.versionId === signPolicyOpen?.versionId ? { ...p, signed: true } : p
          )
        );
      }
    }
  };

  // Load real user-scoped records upon authentication
  useEffect(() => {
    if (session?.user?.id) {
      const uid = session.user.id;
      api.getSafetyIncidents(uid).then(setIncidents).catch(() => setIncidents([]));
      setCheckins(api.getSiteCheckins(uid));
      api.getPreTripInspections(uid).then(setPreTripInspections).catch(() => setPreTripInspections([]));
      api.getDriverAudits(uid).then(setAudits).catch(() => setAudits([]));
      api.getDriverSOPs(uid).then(setSops).catch(() => setSops([]));
      api.getVehicles(uid).then((rows) => {
        setVehicles(rows);
        if (rows.length === 0) {
          // One-time move of old browser-only vehicles into the shared database
          try {
            const raw = window.localStorage.getItem(`bnt_vehicles_${uid}`);
            const legacy = raw ? (JSON.parse(raw) as VehicleRecord[]) : [];
            if (legacy.length) {
              Promise.all(legacy.map((v) => api.saveVehicle(uid, v)))
                .then((final) => setVehicles(final[final.length - 1] ?? []))
                .catch(() => {});
            }
          } catch {}
        }
      }).catch(() => setVehicles([]));
      api.getContractorCompany(uid)
        .then((savedCompany) => {
          if (savedCompany) {
            setContractor(savedCompany);
          } else {
            // One-time move of the old browser-only contractor profile
            // into the shared database.
            try {
              const raw = window.localStorage.getItem(`bnt_contractor_${uid}`);
              if (raw) {
                const legacy = JSON.parse(raw) as ContractorCompanyRecord;
                if (legacy && (legacy.companyName || legacy.abn)) {
                  api
                    .saveContractorCompany(uid, { ...legacy, id: uid })
                    .then(setContractor)
                    .catch(() => {});
                }
              }
            } catch {}
          }
        })
        .catch(() => {});
    } else {
      setVehicles([]);
      setIncidents([]);
      setCheckins([]);
      setPreTripInspections([]);
      setAudits([]);
      setSops([]);
      setContractor(INITIAL_CONTRACTOR_COMPANY);
    }
  }, [session?.user?.id]);

  // Sync induction wizard step with driver progress
  useEffect(() => {
    if (driverBundle?.progress?.currentStep) {
      setDriverStep(driverBundle.progress.currentStep);
    }
  }, [driverBundle?.progress?.currentStep]);

  // Sync the Vault with the driver's real documents stored in the database
  useEffect(() => {
    if (!driverBundle?.documents?.length) return;
    setComplianceDocs(driverBundle.documents.map(mapUploadedDocumentToVault));
  }, [driverBundle?.documents]);

  const handleToggleModule = async (moduleItem: any) => {
    if (!driverBundle) return;
    const updated = driverBundle.learningProgress.map((m) =>
      m.sectionId === moduleItem.sectionId ? { ...m, completed: !m.completed } : m
    );
    await saveStep(3, {
      allowPartial: true,
      sections: updated.map((m) => ({ sectionId: m.sectionId, completed: m.completed }))
    });
  };

  const handleStartModule = async (moduleItem: any) => {
    await startVideoSection(moduleItem.sectionId);
  };

  const handleSaveDeclaration = async (accepted: boolean, signature: string) => {
    await saveStep(5, { accepted, signature });
  };

  const handleCompleteAudit = async (assignment: AuditAssignment, answers: Record<number, boolean>) => {
    await api.completeAuditAssignment(assignment.id, answers);
    if (session?.user?.id) {
      const refreshed = await api.getDriverAudits(session.user.id);
      setAudits(refreshed);
    }
  };

  const handleCompleteSOP = async (sopId: string) => {
    if (!session?.user?.id) return;
    const previous = sops.find((s) => s.id === sopId)?.status ?? "No Attempt";
    setSops((prev) =>
      prev.map((s) => (s.id === sopId ? { ...s, status: "Passed" } : s))
    );
    try {
      await api.completeSOP(session.user.id, sopId);
    } catch {
      setSops((prev) =>
        prev.map((s) => (s.id === sopId ? { ...s, status: previous } : s))
      );
    }
  };

  const handleUploadComplianceDoc = async (
    docId: string,
    fileName: string,
    file: File | null,
    expiryDate: string | null
  ) => {
    const target = complianceDocs.find((d) => d.id === docId);
    if (!target) return;

    // Persist the replacement through the real document API.
    // The profile refresh that follows re-syncs the Vault with the server state.
    if (session && target.documentType && file) {
      try {
        await uploadDocument({ type: target.documentType, file });
        return;
      } catch {
        // Fall through so the Vault still reflects the attempt locally.
      }
    }

    setComplianceDocs((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              status: "Pending",
              historyStatus: "Pending Review",
              uploadedFileName: fileName,
              expiryDate: expiryDate || d.expiryDate,
              uploadedAt: new Date().toISOString().split("T")[0],
            }
          : d
      )
    );
  };

  const handleAddVehicle = async (newVeh: VehicleRecord) => {
    if (session?.user?.id) {
      setVehicles((prev) => [newVeh, ...prev]);
      try {
        const updated = await api.saveVehicle(session.user.id, newVeh);
        setVehicles(updated);
        showToast(t("veh_saved"));
      } catch {
        // keep the optimistic copy if the save fails
      }
    } else {
      setVehicles((prev) => [newVeh, ...prev]);
    }
  };

  const handleReportIncident = async (newInc: SafetyIncidentRecord) => {
    if (session?.user?.id) {
      const saved = await api.reportSafetyIncident(session.user.id, newInc);
      setIncidents((prev) => [saved, ...prev]);
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

  const handleSavePreTripInspection = async (record: any) => {
    if (session?.user?.id) {
      const savedRecord = await api.savePreTripInspection(session.user.id, record);
      setPreTripInspections((prev) => [savedRecord, ...prev]);

      // If inspection detected a defect, automatically ground the vehicle
      if (record.overallStatus && record.overallStatus !== "Fit for Duty") {
        const vehicleRego = (record.vehicleRego || "").toUpperCase().trim();
        const existing = vehicles.find((v) => v.rego.toUpperCase().trim() === vehicleRego);
        if (existing) {
          const updatedVeh: VehicleRecord = {
            ...existing,
            status: "Maintenance Required"
          };
          setVehicles((prev) =>
            prev.map((v) => (v.id === existing.id ? updatedVeh : v))
          );
          try {
            const nextVehicles = await api.saveVehicle(session.user.id, updatedVeh);
            setVehicles(nextVehicles);
            showToast(t("veh_saved"));
          } catch {
            // keep the optimistic grounding if the save fails
          }
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

  const handleUpdateContractor = async (updatedCompany: ContractorCompanyRecord) => {
    if (session?.user?.id) {
      try {
        const saved = await api.saveContractorCompany(session.user.id, updatedCompany);
        setContractor(saved);
      } catch {
        // Keep the update in the UI even if the database save fails,
        // so the driver is never blocked by a network hiccup.
        setContractor(updatedCompany);
      }
    } else {
      setContractor(updatedCompany);
    }
  };

  return (
    <div className="app-shell flex flex-col min-h-screen">
      <ToastHost />
      {showLoginArrival && (
        <div className="login-arrival" role="status" aria-label="Welcome. Your portal is opening.">
          <div className="login-arrival-road" />
          <Truck className="login-arrival-truck" aria-hidden="true" />
          <span className="login-arrival-message">{t("login_success")}</span>
        </div>
      )}
      {showLogoutDeparture && (
        <div className="logout-departure" role="status" aria-label={t("sign_out")}>
          <div className="logout-departure-road" />
          <Truck className="logout-departure-truck" aria-hidden="true" />
          <span className="logout-departure-message">{t("sign_out")}</span>
        </div>
      )}
      {/* Global Modern Top Header & Navigation */}
      <header className="app-header sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60 px-3 sm:px-6 md:px-8 py-2.5 sm:py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <img src={branding?.logoUrl || bntLogo} alt={branding?.companyName || "BNT Logistics"} className="h-8 sm:h-9 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">{branding?.companyName || "BNT LOGISTICS"}</span>
                <span className="hidden lg:inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
                  {t("compliance_portal")}
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-400 block font-medium line-clamp-1">{t("platform_subtitle")}</span>
            </div>
          </div>

          {/* User Controls & Mobile Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
            {session && session.user.role === "driver" && (
              <button
                type="button"
                onClick={() => setGatePassOpen(true)}
                className="hidden md:flex px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors items-center gap-1.5 shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" /> {t("gate_pass")}
              </button>
            )}
            {/* Language Switcher — English / ਪੰਜਾਬੀ */}
            <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setAppLanguage("en")}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] font-black transition-colors ${
                  i18n.language === "en" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setAppLanguage("pa")}
                className={`px-2 sm:px-2.5 py-1 sm:py-1.5 text-[11px] font-black transition-colors ${
                  i18n.language === "pa" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                ਪੰਜਾਬੀ
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
            >
              {theme === "light" ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              <span className="hidden sm:inline">{theme === "light" ? t("dark") : t("light")}</span>
            </button>

            {session && (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden lg:block text-right">
                  <span className="text-xs font-bold text-white block truncate max-w-[140px]">{driverBundle?.driver?.fullName || session.user.email}</span>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">
                    {session.user.role === "admin" ? t("admin_role") : t("driver_role")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md flex items-center gap-1.5 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("sign_out")}</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            {session && session.user.role === "driver" && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-1.5 sm:p-2 rounded-lg bg-slate-800 text-slate-200 hover:text-white border border-slate-700 shrink-0"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Secondary Navigation Row — scrollable pill bar on tablets and laptops */}
        {session && session.user.role === "driver" && (
          <div className="max-w-7xl mx-auto mt-2 sm:mt-3">
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-inner overflow-x-auto responsive-nav-scroll">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "dashboard" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> {t("nav_dashboard")}
              </button>
              <button
                onClick={() => setActiveTab("schedule")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "schedule" ? "bg-amber-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5" /> {t("nav_schedule")}
              </button>
              <button
                onClick={() => setActiveTab("induction")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "induction" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" /> {t("nav_induction")}
              </button>
              <button
                onClick={() => setActiveTab("documents")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "documents" ? "bg-purple-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> {t("nav_vault")} ({complianceDocs.length})
              </button>
              <button
                onClick={() => setActiveTab("audits")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "audits" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" /> {t("nav_audits")}
              </button>
              <button
                onClick={() => setActiveTab("vehicles")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "vehicles" ? "bg-amber-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> {t("nav_fleet")}
              </button>
              <button
                onClick={() => setActiveTab("contractor")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "contractor" ? "bg-indigo-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> {t("nav_contractor")}
              </button>
              <button
                onClick={() => setActiveTab("incidents")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "incidents" ? "bg-rose-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> {t("nav_hazards")} ({incidents.filter(i => i.status !== "Resolved").length})
              </button>
              <button
                onClick={() => setActiveTab("pretrip")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "pretrip" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-400" /> {t("nav_pretrip")}
              </button>
              <button
                onClick={() => setActiveTab("checkin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  activeTab === "checkin" ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" /> {t("nav_checkin")}
              </button>
            </nav>
          </div>
        )}

        {/* Mobile Navigation Drawer */}
        {session && session.user.role === "driver" && mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-slate-800 space-y-3 animate-fadeIn">
            {/* Quick Profile & Gate Pass in Mobile Menu */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span className="text-xs font-bold text-white block">{driverBundle?.driver?.fullName || session.user.email}</span>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">{t("driver_role")}</span>
              </div>
              <button
                type="button"
                onClick={() => { setGatePassOpen(true); setMobileMenuOpen(false); }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" /> {t("gate_pass")}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "dashboard" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <LayoutDashboard className="w-4 h-4" /> {t("nav_dashboard")}
              </button>
              <button
                onClick={() => { setActiveTab("schedule"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "schedule" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <CalendarClock className="w-4 h-4" /> {t("nav_schedule")}
              </button>
              <button
                onClick={() => { setActiveTab("induction"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "induction" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <GraduationCap className="w-4 h-4" /> {t("nav_induction")}
              </button>
              <button
                onClick={() => { setActiveTab("documents"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "documents" ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <FileText className="w-4 h-4" /> {t("nav_vault")} ({complianceDocs.length})
              </button>
              <button
                onClick={() => { setActiveTab("audits"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "audits" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <ClipboardCheck className="w-4 h-4" /> {t("nav_audits")}
              </button>
              <button
                onClick={() => { setActiveTab("vehicles"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "vehicles" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <Truck className="w-4 h-4" /> {t("nav_fleet")}
              </button>
              <button
                onClick={() => { setActiveTab("contractor"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "contractor" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <Building2 className="w-4 h-4" /> {t("nav_contractor")}
              </button>
              <button
                onClick={() => { setActiveTab("incidents"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "incidents" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <AlertTriangle className="w-4 h-4" /> {t("nav_hazards")}
              </button>
              <button
                onClick={() => { setActiveTab("pretrip"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "pretrip" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <ClipboardList className="w-4 h-4 text-emerald-400" /> {t("nav_pretrip")}
              </button>
              <button
                onClick={() => { setActiveTab("checkin"); setMobileMenuOpen(false); }}
                className={`p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 ${activeTab === "checkin" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
              >
                <MapPin className="w-4 h-4" /> {t("nav_checkin")}
              </button>
              <button
                onClick={() => { setGatePassOpen(true); setMobileMenuOpen(false); }}
                className="p-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 col-span-2"
              >
                <QrCode className="w-4 h-4" /> {t("view_gate_pass")}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container View */}
      {loading ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <div className="app-loading-road" aria-hidden="true">
              <Truck className="app-loading-truck" />
            </div>
            <p className="text-slate-400 text-sm font-medium">{t("initializing")}</p>
          </div>
        </main>
      ) : !session ? (
        <LoginForm branding={branding} onRequestPasswordHelp={async (email) => {
          await api.requestPasswordHelp(email);
        }} onLogin={async (email, pass, role) => {
          await login({ email, password: pass, role });
          setShowLoginArrival(true);
          window.setTimeout(() => setShowLoginArrival(false), 1550);
          showToast(t("login_success"));
        }} loading={authLoading} error={authError} />
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
                  policies={driverPolicies}
                  onNavigateTab={(tab) => setActiveTab(tab as any)}
                  onStartAudit={() => setActiveTab("audits")}
                  onStartSOP={() => setActiveTab("learning")}
                  onUploadDoc={() => setActiveTab("documents")}
                  onOpenGatePass={() => setGatePassOpen(true)}
                  onSignPolicy={(policy) => setSignPolicyOpen(policy)}
                />
              )}

            {activeTab === "induction" && (
              <DriverWizard
                bundle={driverBundle}
                currentStep={driverStep}
                onSetStep={setDriverStep}
                onSaveProfile={saveProfile}
                onUploadDocument={(type, file, onProgress) => uploadDocument({ type, file }, onProgress)}
                onCompleteStep2={async () => {
                  await saveStep(2, {});
                }}
                onCompleteStep3={async () => {
                  const sections = driverBundle.learningProgress.map((m) => ({
                    sectionId: m.sectionId,
                    completed: m.completed
                  }));
                  await saveStep(3, { sections });
                }}
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

            {activeTab === "schedule" && (
              <DriverScheduleInvitations
                session={session}
                onStartInduction={(scheduleItemId, itemTitle) => {
                  sessionStorage.setItem("pendingScheduleItemId", scheduleItemId);
                  sessionStorage.setItem("pendingScheduleItemTitle", itemTitle);
                  setActiveTab("induction");
                }}
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
                userId={session.user.id}
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
            onArchiveDriver={archiveDriver}
            onRestoreDriver={restoreDriver}
            onBulkArchiveDrivers={bulkArchiveDrivers}
            onBulkRestoreDrivers={bulkRestoreDrivers}
            onExportReport={exportAdminReport}
            onVerifyCertificate={verifyCertificate}
            onRevokeInduction={revokeDriverInduction}
            loading={loading}
            session={session}
            branding={branding}
            onBrandingUpdated={handleBrandingUpdated}
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

      {/* Policy E-Sign Modal */}
      {session?.user.role === "driver" && signPolicyOpen && (
        <PolicySignModal
          policy={signPolicyOpen}
          session={session}
          onClose={() => setSignPolicyOpen(null)}
          onSigned={handlePolicySigned}
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

