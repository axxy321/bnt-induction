import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Download,
  RefreshCw,
  FileText,
  Award,
  Clock,
  AlertTriangle,
  FileCheck2,
  CalendarClock,
  Loader2
} from "lucide-react";
import { useAppState } from "../../state/AppContext";
import {
  ReportsOverview,
  AttemptedInductionReport,
  CertificateStatusReport,
  ExpiringCertificateReport,
  ExpiringDocumentReport,
  DocumentApprovalReport,
  ScheduledStatusReport
} from "../../types";
import {
  getReportsOverview,
  getAttemptedInductionsReport,
  getCertificateStatusesReport,
  getExpiringCertificatesReport,
  getExpiringDocumentsReport,
  getDocumentsForApprovalReport,
  getScheduledStatusReport
} from "../../lib/api";

type ReportTab =
  | "overview"
  | "attempted"
  | "certificates"
  | "expiring_certs"
  | "expiring_docs"
  | "approvals"
  | "scheduled";

const STATUS_COLORS: Record<string, string> = {
  Valid: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  "Expiring Soon": "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  Expired: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  Revoked: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  Active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  Completed: "bg-sky-500/10 text-sky-400 border border-sky-500/30",
  Overdue: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  Paused: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  Cancelled: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  Pending: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  "In Progress": "bg-blue-500/10 text-blue-400 border border-blue-500/30",
  "Not Started": "bg-slate-500/10 text-slate-400 border border-slate-500/30"
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDocType(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: 700,
        whiteSpace: "nowrap"
      }}
      className={STATUS_COLORS[status] ?? "bg-slate-500/10 text-slate-400 border border-slate-500/30"}
    >
      {status}
    </span>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="glass card-hover" style={{ padding: "20px", borderRadius: "14px" }}>
      <span className="muted" style={{ fontSize: "0.78rem", fontWeight: 600, display: "block" }}>{label}</span>
      <strong style={{ fontSize: "1.7rem", color: accent }}>{value}</strong>
    </div>
  );
}

export function ReportsAdmin() {
  const { t } = useTranslation();
  const { session } = useAppState();
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [attempted, setAttempted] = useState<AttemptedInductionReport[]>([]);
  const [certificates, setCertificates] = useState<CertificateStatusReport[]>([]);
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCertificateReport[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDocumentReport[]>([]);
  const [approvals, setApprovals] = useState<DocumentApprovalReport[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledStatusReport[]>([]);

  const tabs: Array<{ id: ReportTab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: t("reports_tab_overview"), icon: <BarChart3 className="w-4 h-4" /> },
    { id: "attempted", label: t("reports_tab_attempted"), icon: <FileText className="w-4 h-4" /> },
    { id: "certificates", label: t("reports_tab_certificates"), icon: <Award className="w-4 h-4" /> },
    { id: "expiring_certs", label: t("reports_tab_expiring_certs"), icon: <Clock className="w-4 h-4" /> },
    { id: "expiring_docs", label: t("reports_tab_expiring_docs"), icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "approvals", label: t("reports_tab_approvals"), icon: <FileCheck2 className="w-4 h-4" /> },
    { id: "scheduled", label: t("reports_tab_scheduled"), icon: <CalendarClock className="w-4 h-4" /> }
  ];

  const loadAll = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getReportsOverview(session),
        getAttemptedInductionsReport(session),
        getCertificateStatusesReport(session),
        getExpiringCertificatesReport(session),
        getExpiringDocumentsReport(session),
        getDocumentsForApprovalReport(session),
        getScheduledStatusReport(session)
      ]);
      const [ov, att, cert, expCert, expDoc, appr, sch] = results;
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (att.status === "fulfilled") setAttempted(att.value ?? []);
      if (cert.status === "fulfilled") setCertificates(cert.value ?? []);
      if (expCert.status === "fulfilled") setExpiringCerts(expCert.value ?? []);
      if (expDoc.status === "fulfilled") setExpiringDocs(expDoc.value ?? []);
      if (appr.status === "fulfilled") setApprovals(appr.value ?? []);
      if (sch.status === "fulfilled") setScheduled(sch.value ?? []);
      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`Failed to load report ${tabs[i]?.id}`, r.reason);
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const currentRows = (): any[] => {
    switch (activeTab) {
      case "attempted": return attempted;
      case "certificates": return certificates;
      case "expiring_certs": return expiringCerts;
      case "expiring_docs": return expiringDocs;
      case "approvals": return approvals;
      case "scheduled": return scheduled;
      default: return [];
    }
  };

  const currentColumns = (): Array<{ key: string; label: string; render?: (row: any) => React.ReactNode }> => {
    switch (activeTab) {
      case "attempted":
        return [
          { key: "driverName", label: t("reports_driver_name") },
          { key: "driverEmail", label: t("reports_driver_email") },
          { key: "inductionVersion", label: t("reports_induction_version") },
          { key: "status", label: t("reports_status"), render: (r) => <StatusBadge status={r.status} /> },
          { key: "quizScore", label: t("reports_quiz_score"), render: (r) => r.quizScore != null ? `${r.quizScore}%` : "—" },
          { key: "lastAttemptAt", label: t("reports_last_attempt"), render: (r) => formatDate(r.lastAttemptAt) },
          { key: "completedAt", label: t("reports_completed_at"), render: (r) => formatDate(r.completedAt) }
        ];
      case "certificates":
        return [
          { key: "driverName", label: t("reports_driver_name") },
          { key: "driverEmail", label: t("reports_driver_email") },
          { key: "verificationCode", label: t("reports_verification_code") },
          { key: "status", label: t("reports_status"), render: (r) => <StatusBadge status={r.status} /> },
          { key: "issuedAt", label: t("reports_issued_at"), render: (r) => formatDate(r.issuedAt) },
          { key: "expiresAt", label: t("reports_expires_at"), render: (r) => formatDate(r.expiresAt) },
          { key: "daysUntilExpiry", label: t("reports_days_until_expiry"), render: (r) => r.daysUntilExpiry != null ? `${r.daysUntilExpiry}` : "—" }
        ];
      case "expiring_certs":
        return [
          { key: "driverName", label: t("reports_driver_name") },
          { key: "driverEmail", label: t("reports_driver_email") },
          { key: "verificationCode", label: t("reports_verification_code") },
          { key: "expiresAt", label: t("reports_expires_at"), render: (r) => formatDate(r.expiresAt) },
          { key: "daysUntilExpiry", label: t("reports_days_until_expiry") },
          { key: "inductionVersion", label: t("reports_induction_version") }
        ];
      case "expiring_docs":
        return [
          { key: "driverName", label: t("reports_driver_name") },
          { key: "driverEmail", label: t("reports_driver_email") },
          { key: "documentName", label: t("reports_document_name") },
          { key: "documentType", label: t("reports_document_type"), render: (r) => formatDocType(r.documentType) },
          { key: "expiresAt", label: t("reports_expires_at"), render: (r) => formatDate(r.expiresAt) },
          { key: "daysUntilExpiry", label: t("reports_days_until_expiry") }
        ];
      case "approvals":
        return [
          { key: "driverName", label: t("reports_driver_name") },
          { key: "driverEmail", label: t("reports_driver_email") },
          { key: "documentName", label: t("reports_document_name") },
          { key: "documentType", label: t("reports_document_type"), render: (r) => formatDocType(r.documentType) },
          { key: "uploadedAt", label: t("reports_uploaded_at"), render: (r) => formatDate(r.uploadedAt) }
        ];
      case "scheduled":
        return [
          { key: "driverName", label: t("reports_driver_name") },
          { key: "driverEmail", label: t("reports_driver_email") },
          { key: "scheduleName", label: t("reports_schedule_name") },
          { key: "status", label: t("reports_status"), render: (r) => <StatusBadge status={r.status} /> },
          { key: "currentItemTitle", label: t("reports_current_item"), render: (r) => r.currentItemTitle ?? "—" },
          { key: "nextItemTitle", label: t("reports_next_item"), render: (r) => r.nextItemTitle ?? "—" },
          { key: "enrolledAt", label: t("reports_enrolled_at"), render: (r) => formatDate(r.enrolledAt) },
          { key: "completedAt", label: t("reports_completed_at"), render: (r) => formatDate(r.completedAt) }
        ];
      default:
        return [];
    }
  };

  const handleExportCsv = () => {
    const rows = currentRows();
    const cols = currentColumns();
    if (rows.length === 0 || cols.length === 0) return;
    setExporting(true);
    try {
      const header = cols.map((c) => c.label).join(",");
      const body = rows.map((row) =>
        cols
          .map((c) => {
            const raw = (row as any)[c.key];
            const val =
              raw === null || raw === undefined
                ? ""
                : c.key === "documentType"
                ? formatDocType(raw)
                : raw instanceof Date
                ? raw.toISOString()
                : String(raw);
            return val.includes(",") || val.includes('"') || val.includes("\n")
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(",")
      );
      const csv = [header, ...body].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const rows = currentRows();
  const columns = currentColumns();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div
        className="glass"
        style={{
          padding: "24px",
          borderRadius: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}
          >
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>{t("reports_title")}</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {t("reports_sub")}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || activeTab === "overview" || rows.length === 0}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid #2563eb",
              background: "rgba(37, 99, 235, 0.1)",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: exporting || activeTab === "overview" ? "not-allowed" : "pointer",
              opacity: exporting || activeTab === "overview" || rows.length === 0 ? 0.5 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t("reports_export_csv")}
          </button>

          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {t("adm_refresh")}
          </button>
        </div>
      </div>

      {/* Report Sub-tabs */}
      <div
        className="glass"
        style={{
          padding: "8px 12px",
          borderRadius: "14px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          overflowX: "auto",
          flexWrap: "wrap"
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 14px",
              borderRadius: "10px",
              border: "none",
              background: activeTab === tab.id ? "#1e3a5f" : "transparent",
              color: activeTab === tab.id ? "#ffffff" : "var(--color-muted)",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap"
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--color-muted)" }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ margin: "0 auto 12px" }} />
          {t("reports_loading")}
        </div>
      ) : activeTab === "overview" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}
        >
          <StatCard label={t("reports_overview_total_drivers")} value={overview?.totalDrivers ?? 0} accent="#1e3a5f" />
          <StatCard label={t("reports_overview_attempted")} value={overview?.attemptedInductions ?? 0} accent="#2563eb" />
          <StatCard label={t("reports_overview_valid_certs")} value={overview?.validCertificates ?? 0} accent="#16a34a" />
          <StatCard label={t("reports_overview_expiring_certs")} value={overview?.expiringCertificates ?? 0} accent="#d97706" />
          <StatCard label={t("reports_overview_expired_certs")} value={overview?.expiredCertificates ?? 0} accent="#dc2626" />
          <StatCard label={t("reports_overview_expiring_docs")} value={overview?.expiringDocuments ?? 0} accent="#d97706" />
          <StatCard label={t("reports_overview_pending_approvals")} value={overview?.pendingApprovals ?? 0} accent="#d97706" />
          <StatCard label={t("reports_overview_active_schedules")} value={overview?.activeSchedules ?? 0} accent="#16a34a" />
          <StatCard label={t("reports_overview_overdue_schedules")} value={overview?.overdueSchedules ?? 0} accent="#dc2626" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className="glass"
          style={{ padding: "48px 20px", borderRadius: "20px", textAlign: "center", color: "var(--color-muted)" }}
        >
          {t("reports_no_data")}
        </div>
      ) : (
        <div className="glass" style={{ borderRadius: "20px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        color: "var(--color-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                    {columns.map((col) => (
                      <td key={col.key} style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                        {col.render ? col.render(row) : String((row as any)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
