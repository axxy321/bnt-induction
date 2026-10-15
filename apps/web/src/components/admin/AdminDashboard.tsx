import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, FileCheck, Settings, RefreshCw, CalendarClock, Activity, AlertTriangle, ClipboardCheck, ClipboardList, GraduationCap, Truck, Building2, Palette, ScrollText, BarChart3, KeyRound, ShieldCheck } from "lucide-react";
import { AdminOverview, BrandingSettings } from "../../types";
import type { DriverCreateResult } from "../../state/AppContext";
import { DriverTable } from "./DriverTable";
import { VerificationQueue } from "../VerificationQueue";
import { AdminCMS } from "../AdminCMS";
import { AdminExpiryMatrix } from "./AdminExpiryMatrix";
import { SafetyIncidentAdmin } from "../SafetyIncidentAdmin";
import { PreTripInspectionAdmin } from "../PreTripInspectionAdmin";
import { ComplianceAuditsAdmin } from "./ComplianceAuditsAdmin";
import { SOPAdmin } from "./SOPAdmin";
import { FleetAdmin } from "./FleetAdmin";
import { ContractorsAdmin } from "./ContractorsAdmin";
import { BrandingAdmin } from "./BrandingAdmin";
import { PoliciesAdmin } from "./PoliciesAdmin";
import { SchedulesAdmin } from "./SchedulesAdmin";
import { ReportsAdmin } from "./ReportsAdmin";
import { ProgressRing } from "./ProgressRing";
import { CountUp } from "../ui/CountUp";
import { Skeleton } from "../ui/Skeleton";
import { Sparkline } from "../ui/Sparkline";
import { NotificationBell } from "./NotificationBell";
import { FadeIn } from "../ui/FadeIn";
import { PasswordHelpRequestsAdmin } from "./PasswordHelpRequestsAdmin";
import { api } from "../../lib/api";

interface AdminDashboardProps {
  overview: AdminOverview | null;
  onRefresh: () => Promise<void>;
  onCreateDriver: (input: any) => Promise<DriverCreateResult | void>;
  onUpdateDriver: (id: string, input: any) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<DriverCreateResult | void>;
  onResetInduction: (id: string) => Promise<void>;
  onDeleteDriver: (id: string) => Promise<void>;
  onArchiveDriver: (id: string) => Promise<void>;
  onRestoreDriver: (id: string) => Promise<void>;
  onBulkArchiveDrivers: (ids: string[]) => Promise<void>;
  onBulkRestoreDrivers: (ids: string[]) => Promise<void>;
  onExportReport: (format: "csv" | "pdf", options?: any) => Promise<Blob>;
  onVerifyCertificate: (code: string) => Promise<any>;
  onRevokeInduction: (id: string, reason?: string, certificateId?: string) => Promise<void>;
  loading: boolean;
  session: any;
  branding: BrandingSettings | null;
  onBrandingUpdated: (branding: BrandingSettings) => void;
}

export function AdminDashboard({
  overview,
  onRefresh,
  onCreateDriver,
  onUpdateDriver,
  onResetPassword,
  onResetInduction,
  onDeleteDriver,
  onArchiveDriver,
  onRestoreDriver,
  onBulkArchiveDrivers,
  onBulkRestoreDrivers,
  onExportReport,
  onVerifyCertificate,
  onRevokeInduction,
  loading,
  session,
  branding,
  onBrandingUpdated
}: AdminDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"drivers" | "passwordHelp" | "verification" | "cms" | "expiries" | "activity" | "incidents" | "pretrip" | "audits" | "sops" | "fleet" | "contractors" | "branding" | "policies" | "schedules" | "reports">("drivers");
  const [passwordHelpCount, setPasswordHelpCount] = useState(0);
  const updatePasswordHelpCount = useCallback((count: number) => setPasswordHelpCount(count), []);

  const pendingDocsCount = useMemo(() => {
    return (overview?.drivers || []).reduce((acc, driver) => {
      const pendingInDriver = (driver.documents || []).filter((doc: any) => doc.status === "pending").length;
      return acc + pendingInDriver;
    }, 0);
  }, [overview?.drivers]);

  useEffect(() => {
    let mounted = true;
    const refreshCount = async () => {
      try {
        const requests = await api.getPasswordHelpRequests(session);
        if (mounted) setPasswordHelpCount(requests.filter((request) => request.status === "pending").length);
      } catch {
        // The request panel will show a specific load error if opened.
      }
    };
    void refreshCount();
    const timer = window.setInterval(() => void refreshCount(), 30_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [session]);

  const metrics = overview?.metrics || {
    totalDrivers: 0,
    completedDrivers: 0,
    pendingDrivers: 0,
    inProgressDrivers: 0,
    completionRate: 0,
    averageQuizScore: 0,
    certificateRate: 0,
    licenceRate: 0,
    certificateCount: 0,
    licenceCount: 0
  };

  return (
    <div className="admin-dashboard" style={{ width: "100%", maxWidth: "1320px", margin: "0 auto", padding: "0 16px" }}>
      {/* Dashboard Header */}
      <FadeIn>
        <div className="admin-page-heading">
          <div className="admin-heading-mark"><ShieldCheck className="w-6 h-6" /></div>
          <div className="admin-heading-copy">
            <p className="eyebrow">{t("compliance_portal")}</p>
            <h2>{t("adm_dash_title")}</h2>
            <p>{t("adm_dash_intro")}</p>
          </div>
          {overview && <NotificationBell overview={overview} />}
        </div>
      </FadeIn>

      {/* Metrics Row */}
      <FadeIn delay={0.05}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "12px",
          marginBottom: "24px"
        }}
      >
        {!overview
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass" style={{ padding: "20px", borderRadius: "14px" }}>
                <Skeleton style={{ width: "65%", height: "12px", marginBottom: "14px" }} />
                <Skeleton style={{ width: "40%", height: "30px" }} />
              </div>
            ))
          : (
            <>
              <div className="glass card-hover admin-metric-card" style={{ padding: "20px", borderRadius: "14px" }}>
                <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>{t("adm_total_drivers")}</span>
                <strong style={{ fontSize: "1.8rem", color: "var(--metric-blue, #1e3a5f)" }}><CountUp value={metrics.totalDrivers} /></strong>
              </div>
              <div className="glass card-hover admin-metric-card" style={{ padding: "20px", borderRadius: "14px" }}>
                <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>{t("adm_completed_inductions")}</span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "8px" }}>
                  <strong style={{ fontSize: "1.8rem", color: "#16a34a" }}><CountUp value={metrics.completedDrivers} /></strong>
                  <Sparkline data={overview?.charts.completionTrend || []} color="#16a34a" />
                </div>
              </div>
              <div className="glass card-hover admin-metric-card" style={{ padding: "20px", borderRadius: "14px" }}>
                <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>{t("adm_in_progress")}</span>
                <strong style={{ fontSize: "1.8rem", color: "#d97706" }}><CountUp value={metrics.inProgressDrivers} /></strong>
              </div>
              <div className="glass card-hover admin-metric-card" style={{ padding: "20px", borderRadius: "14px" }}>
                <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>{t("adm_completion_rate")}</span>
                <strong style={{ fontSize: "1.8rem", color: "#2563eb" }}><CountUp value={metrics.completionRate} suffix="%" /></strong>
              </div>
              <div className="glass card-hover admin-metric-card" style={{ padding: "20px", borderRadius: "14px" }}>
                <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>{t("adm_avg_score")}</span>
                <strong style={{ fontSize: "1.8rem", color: "#9333ea" }}><CountUp value={metrics.averageQuizScore} suffix="%" /></strong>
              </div>
            </>
          )}
      </div>
      </FadeIn>

      {/* Progress Rings Row */}
      <FadeIn delay={0.1}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "16px",
          marginBottom: "24px"
        }}
      >
        {!overview
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass" style={{ padding: "20px", borderRadius: "14px", display: "flex", justifyContent: "center" }}>
                <Skeleton style={{ width: "120px", height: "120px", borderRadius: "50%" }} />
              </div>
            ))
          : (
            <>
              <div className="glass card-hover admin-progress-card" style={{ padding: "20px", borderRadius: "14px", display: "flex", justifyContent: "center" }}>
                <ProgressRing
                  value={metrics.completionRate}
                  label={t("adm_ring_training")}
                  detail={`${metrics.completedDrivers} ${t("adm_ring_of")} ${metrics.totalDrivers}`}
                />
              </div>
              <div className="glass card-hover admin-progress-card" style={{ padding: "20px", borderRadius: "14px", display: "flex", justifyContent: "center" }}>
                <ProgressRing
                  value={metrics.certificateRate}
                  label={t("adm_ring_certificates")}
                  detail={`${metrics.certificateCount} ${t("adm_ring_of")} ${metrics.totalDrivers}`}
                />
              </div>
              <div className="glass card-hover admin-progress-card" style={{ padding: "20px", borderRadius: "14px", display: "flex", justifyContent: "center" }}>
                <ProgressRing
                  value={metrics.licenceRate}
                  label={t("adm_ring_licence")}
                  detail={`${metrics.licenceCount} ${t("adm_ring_of")} ${metrics.totalDrivers}`}
                />
              </div>
            </>
          )}
      </div>
      </FadeIn>

      {/* Mobile Tab Quick Dropdown */}
      <div className="md:hidden mb-3">
        <label htmlFor="admin-tab-select" className="sr-only">Select Admin Section</label>
        <select
          id="admin-tab-select"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as any)}
          className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm"
        >
          <option value="drivers">{t("adm_tab_drivers")}</option>
          <option value="passwordHelp">{t("adm_tab_password_help")} ({passwordHelpCount})</option>
          <option value="verification">{t("adm_tab_verification")} ({pendingDocsCount})</option>
          <option value="cms">{t("adm_tab_cms")}</option>
          <option value="expiries">{t("adm_tab_expiries")}</option>
          <option value="activity">{t("adm_tab_activity")}</option>
          <option value="incidents">{t("adm_tab_incidents")}</option>
          <option value="pretrip">{t("adm_tab_pretrip")}</option>
          <option value="audits">{t("adm_tab_audits")}</option>
          <option value="sops">{t("adm_tab_sops")}</option>
          <option value="fleet">{t("adm_tab_fleet")}</option>
          <option value="contractors">{t("adm_tab_contractors")}</option>
          <option value="branding">{t("adm_tab_branding")}</option>
          <option value="policies">{t("adm_tab_policies")}</option>
          <option value="schedules">{t("adm_tab_schedules")}</option>
          <option value="reports">{t("reports_title")}</option>
        </select>
      </div>

      {/* Navigation Tabs */}
      <div
        className="glass admin-nav-tabs responsive-nav-scroll"
        style={{
          padding: "8px 12px",
          borderRadius: "14px",
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          maxWidth: "100%"
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "drivers" ? "#1e3a5f" : "transparent",
            color: activeTab === "drivers" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Users className="w-4 h-4" /> {t("adm_tab_drivers")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("passwordHelp")}
          aria-label={t("adm_tab_password_help")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "passwordHelp" ? "#1e3a5f" : "transparent",
            color: activeTab === "passwordHelp" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <KeyRound className="w-4 h-4" /> {t("adm_tab_password_help")}
          {passwordHelpCount > 0 && <span style={{ minWidth: "20px", padding: "2px 6px", borderRadius: "999px", background: "#dc2626", color: "#fff", fontSize: "0.7rem", textAlign: "center" }}>{passwordHelpCount}</span>}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("verification")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "verification" ? "#1e3a5f" : "transparent",
            color: activeTab === "verification" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <FileCheck className="w-4 h-4" /> {t("adm_tab_verification")}
          {pendingDocsCount > 0 && (
            <span style={{ minWidth: "20px", padding: "2px 6px", borderRadius: "999px", background: "#f59e0b", color: "#000", fontWeight: 700, fontSize: "0.7rem", textAlign: "center" }}>
              {pendingDocsCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cms")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "cms" ? "#1e3a5f" : "transparent",
            color: activeTab === "cms" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Settings className="w-4 h-4" /> {t("adm_tab_cms")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expiries")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "expiries" ? "#1e3a5f" : "transparent",
            color: activeTab === "expiries" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <CalendarClock className="w-4 h-4" /> {t("adm_tab_expiries")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "activity" ? "#1e3a5f" : "transparent",
            color: activeTab === "activity" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Activity className="w-4 h-4" /> {t("adm_tab_activity")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("incidents")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "incidents" ? "#1e3a5f" : "transparent",
            color: activeTab === "incidents" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <AlertTriangle className="w-4 h-4" /> {t("adm_tab_incidents")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pretrip")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "pretrip" ? "#1e3a5f" : "transparent",
            color: activeTab === "pretrip" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <ClipboardCheck className="w-4 h-4" /> {t("adm_tab_pretrip")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audits")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "audits" ? "#1e3a5f" : "transparent",
            color: activeTab === "audits" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <ClipboardList className="w-4 h-4" /> {t("adm_tab_audits")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sops")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "sops" ? "#1e3a5f" : "transparent",
            color: activeTab === "sops" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <GraduationCap className="w-4 h-4" /> {t("adm_tab_sops")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fleet")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "fleet" ? "#1e3a5f" : "transparent",
            color: activeTab === "fleet" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Truck className="w-4 h-4" /> {t("adm_tab_fleet")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("contractors")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "contractors" ? "#1e3a5f" : "transparent",
            color: activeTab === "contractors" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Building2 className="w-4 h-4" /> {t("adm_tab_contractors")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "branding" ? "#1e3a5f" : "transparent",
            color: activeTab === "branding" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <Palette className="w-4 h-4" /> {t("adm_tab_branding")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("policies")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "policies" ? "#1e3a5f" : "transparent",
            color: activeTab === "policies" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <ScrollText className="w-4 h-4" /> {t("adm_tab_policies")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("schedules")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "schedules" ? "#1e3a5f" : "transparent",
            color: activeTab === "schedules" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <CalendarClock className="w-4 h-4" /> {t("adm_tab_schedules")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          style={{
            padding: "9px 16px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "reports" ? "#1e3a5f" : "transparent",
            color: activeTab === "reports" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <BarChart3 className="w-4 h-4" /> {t("reports_title")}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.82rem",
            whiteSpace: "nowrap",
            flexShrink: 0
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t("adm_refresh")}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "expiries" && (
        <AdminExpiryMatrix drivers={overview?.drivers || []} />
      )}

      {activeTab === "activity" && (
        <div className="glass card-hover" style={{ padding: "28px", borderRadius: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
                {t("adm_activity_title")}
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                {t("adm_activity_sub")}
              </p>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "4px 12px", borderRadius: "999px", background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
              {(overview?.recentActivity || []).length === 1
                ? t("adm_logged_events_one", { count: (overview?.recentActivity || []).length })
                : t("adm_logged_events_other", { count: (overview?.recentActivity || []).length })}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(overview?.recentActivity || []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--color-muted)" }}>
                {t("adm_no_activity")}
              </div>
            ) : (
              (overview?.recentActivity || []).map((log, idx) => (
                <div
                  key={log.id || idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "var(--bg-elevated, rgba(255,255,255,0.03))",
                    border: "1px solid var(--border, rgba(255,255,255,0.08))",
                    gap: "12px",
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: "0.88rem", textTransform: "capitalize" }}>
                        {log.action.replace(/_/g, " ")}
                      </strong>
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {t("adm_user_id")}: <span style={{ fontFamily: "monospace" }}>{log.userId.slice(0, 8)}...</span>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span> â€¢ {JSON.stringify(log.metadata).slice(0, 60)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="muted" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {new Date(log.createdAt).toLocaleString("en-AU")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === "drivers" && (
        <DriverTable
          drivers={overview?.drivers || []}
          onCreateDriver={onCreateDriver}
          onUpdateDriver={onUpdateDriver}
          onResetPassword={onResetPassword}
          onResetInduction={onResetInduction}
          onDeleteDriver={onDeleteDriver}
          onArchiveDriver={onArchiveDriver}
          onRestoreDriver={onRestoreDriver}
          onBulkArchiveDrivers={onBulkArchiveDrivers}
          onBulkRestoreDrivers={onBulkRestoreDrivers}
          onExportReport={onExportReport}
          onVerifyCertificate={onVerifyCertificate}
          onRevokeInduction={onRevokeInduction}
          loading={loading}
        />
      )}

      {activeTab === "passwordHelp" && session && (
        <PasswordHelpRequestsAdmin session={session} onPendingCountChange={updatePasswordHelpCount} />
      )}

      {activeTab === "verification" && <VerificationQueue onRefresh={onRefresh} />}

      {activeTab === "cms" && <AdminCMS />}

      {activeTab === "incidents" && <SafetyIncidentAdmin session={session} />}

      {activeTab === "pretrip" && <PreTripInspectionAdmin session={session} />}

      {activeTab === "audits" && <ComplianceAuditsAdmin drivers={overview?.drivers || []} />}

      {activeTab === "sops" && <SOPAdmin />}

      {activeTab === "fleet" && <FleetAdmin />}

      {activeTab === "contractors" && <ContractorsAdmin />}

      {activeTab === "branding" && (
        <BrandingAdmin session={session} branding={branding} onUpdated={onBrandingUpdated} />
      )}

      {activeTab === "policies" && <PoliciesAdmin session={session} />}

      {activeTab === "schedules" && <SchedulesAdmin />}

      {activeTab === "reports" && <ReportsAdmin />}
    </div>
  );
}
