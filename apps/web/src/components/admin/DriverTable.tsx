import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Download, Search, CheckCircle2, AlertCircle, QrCode, KeyRound, X, Check, Archive, RotateCcw, ShieldX } from "lucide-react";
import { AdminDriverRow, DriverFormInput } from "../../types";
import type { DriverCreateResult } from "../../state/AppContext";
import { tStatus } from "../../i18n";
import { DriverFormModal } from "./DriverFormModal";
import { CertificateScannerModal } from "./CertificateScannerModal";
import { showToast } from "../ui/Toast";

interface DriverTableProps {
  drivers: AdminDriverRow[];
  onCreateDriver: (input: DriverFormInput & { password?: string }) => Promise<DriverCreateResult | void>;
  onUpdateDriver: (id: string, input: DriverFormInput) => Promise<void>;
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
}

export function DriverTable({
  drivers,
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
  loading
}: DriverTableProps) {
  const { t } = useTranslation();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<AdminDriverRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [resetPassDriverId, setResetPassDriverId] = useState<string | null>(null);
  const [newPasswordText, setNewPasswordText] = useState("");
  const [verifyCodeText, setVerifyCodeText] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Revoke induction modal state
  const [revokeDriverId, setRevokeDriverId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  const filterLabels: Record<string, string> = {
    all: t("dt_filter_all"),
    "Not Started": t("dt_filter_not_started"),
    "In Progress": t("dt_filter_in_progress"),
    Completed: t("dt_filter_completed"),
    Archived: t("dt_filter_archived")
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchStatus = filterStatus === "all" || d.status === filterStatus || (filterStatus === "Archived" && d.archivedAt);
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        d.fullName.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.depotLocation && d.depotLocation.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [drivers, filterStatus, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDrivers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDrivers.map(d => d.id)));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds).filter(id => {
      const driver = filteredDrivers.find(d => d.id === id);
      return driver && !driver.archivedAt;
    });
    if (ids.length > 0) {
      await onBulkArchiveDrivers(ids);
      setSelectedIds(new Set());
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds).filter(id => {
      const driver = filteredDrivers.find(d => d.id === id);
      return driver && driver.archivedAt;
    });
    if (ids.length > 0) {
      await onBulkRestoreDrivers(ids);
      setSelectedIds(new Set());
    }
  };

  const hasActiveSelected = Array.from(selectedIds).some(id => {
    const driver = filteredDrivers.find(d => d.id === id);
    return driver && !driver.archivedAt;
  });

  const hasArchivedSelected = Array.from(selectedIds).some(id => {
    const driver = filteredDrivers.find(d => d.id === id);
    return driver && driver.archivedAt;
  });

  const handleOpenAddModal = () => {
    setSelectedDriver(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (driver: AdminDriverRow) => {
    setSelectedDriver(driver);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (input: DriverFormInput & { password?: string }) => {
    if (selectedDriver) {
      await onUpdateDriver(selectedDriver.id, input);
    } else {
      const result = await onCreateDriver(input);
      if (result && !result.emailSent) {
        window.alert(result.message || "Driver account created, but the welcome email was not sent. Check the API email configuration.");
      }
    }
    setIsModalOpen(false);
  };

  const handleExecuteResetPassword = async (id: string) => {
    if (!newPasswordText || newPasswordText.length < 8) return;
    const result = await onResetPassword(id, newPasswordText);
    if (result && !result.emailSent) {
      window.alert(result.message || "The password was changed, but the reset email was not sent. Check the API email configuration.");
    }
    showToast(t("dt_reset_complete"));
    setResetPassDriverId(null);
    setNewPasswordText("");
  };

  const handleResetInduction = async (id: string) => {
    try {
      await onResetInduction(id);
      showToast(t("dt_induction_reset_complete"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("dt_reset_failed"), "error");
    }
  };

  const handleVerifyCert = async () => {
    if (!verifyCodeText.trim()) return;
    try {
      const res = await onVerifyCertificate(verifyCodeText.trim());
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ verified: false, valid: false, message: err instanceof Error ? err.message : t("dt_verify_fail") });
    }
  };

  const openRevokeModal = (driverId: string) => {
    setRevokeDriverId(driverId);
    setRevokeReason("");
  };

  const handleRevokeInduction = async () => {
    if (!revokeDriverId || !revokeReason.trim()) return;
    setRevoking(true);
    try {
      await onRevokeInduction(revokeDriverId, revokeReason);
      setRevokeDriverId(null);
      setRevokeReason("");
    } catch (err: any) {
      alert(err?.message || t("dt_revoke_fail"));
    } finally {
      setRevoking(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await onExportReport("csv");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bnt-driver-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || t("dt_csv_fail"));
    }
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
      {/* Table Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
            {t("dt_title")}
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            {t("dt_subtitle")}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              background: "rgba(99, 102, 241, 0.15)",
              color: "#818cf8",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <QrCode className="w-4 h-4" /> {t("dt_scan_qr")}
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            {t("dt_add_driver")}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              background: "var(--bg-elevated, rgba(255,255,255,0.06))",
              border: "1px solid var(--border, #334155)",
              color: "var(--text-secondary, #cbd5e1)",
              padding: "10px 16px",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Download className="w-4 h-4" /> {t("dt_export_csv")}
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <label htmlFor="driver-table-search" className="sr-only">{t("dt_search_label")}</label>
        <input
          id="driver-table-search"
          name="driverSearch"
          type="text"
          placeholder={t("dt_search_ph")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          style={{ flex: 1, minWidth: "240px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
        />

        <div style={{ display: "flex", gap: "4px", background: "rgba(148,163,184,0.1)", padding: "3px", borderRadius: "8px" }}>
          {["all", "Not Started", "In Progress", "Completed", "Archived"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.8rem",
                background: filterStatus === st ? "#1e3a5f" : "transparent",
                color: filterStatus === st ? "#ffffff" : "var(--color-muted)"
              }}
            >
              {filterLabels[st] ?? st}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "8px" }}>
          <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
            {selectedIds.size} {t("dt_selected")}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            {hasActiveSelected && (
              <button
                type="button"
                onClick={handleBulkArchive}
                disabled={loading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Archive className="w-3.5 h-3.5" /> {t("dt_bulk_archive")}
              </button>
            )}
            {hasArchivedSelected && (
              <button
                type="button"
                onClick={handleBulkRestore}
                disabled={loading}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> {t("dt_bulk_restore")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "transparent",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer"
              }}
            >
              {t("dt_clear_selection")}
            </button>
          </div>
        </div>
      )}

      {/* Driver Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border, #e2e8f0)" }}>
              <th style={{ padding: "12px 10px", width: "40px" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredDrivers.length && filteredDrivers.length > 0}
                  onChange={toggleSelectAll}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
              </th>
              <th style={{ padding: "12px 10px" }}>{t("dt_th_driver")}</th>
              <th style={{ padding: "12px 10px" }}>{t("dt_th_depot")}</th>
              <th style={{ padding: "12px 10px" }}>{t("dt_th_status")}</th>
              <th style={{ padding: "12px 10px" }}>{t("dt_th_progress")}</th>
              <th style={{ padding: "12px 10px" }}>{t("dt_th_quiz")}</th>
              <th style={{ padding: "12px 10px" }}>{t("dt_th_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--color-muted)" }}>
                  {t("dt_empty")}
                </td>
              </tr>
            ) : (
              filteredDrivers.map((d) => {
                const isArchived = !!d.archivedAt;
                const statusColor = isArchived ? "#64748b" : d.status === "Completed" ? "#22c55e" : d.status === "In Progress" ? "#d97706" : "#64748b";
                const statusLabel = isArchived ? t("dt_status_archived") : tStatus(d.status, t);
                return (
                <tr key={d.id} className="driver-row" style={{ borderBottom: "1px solid var(--border, #f1f5f9)", opacity: isArchived ? 0.6 : 1 }}>
                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelectId(d.id)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ padding: "12px 10px", borderLeft: `3px solid ${statusColor}` }}>
                    <strong>{d.fullName}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{d.email}</div>
                    {isArchived && (
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Archive className="w-3 h-3" style={{ flexShrink: 0 }} />
                        {t("dt_archived_on")} {d.archivedAt ? new Date(d.archivedAt).toLocaleDateString() : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div>{d.depotLocation || "—"}</div>
                    <small style={{ color: "var(--color-muted)" }}>{d.licenceClass ? t("dt_class_prefix", { class: d.licenceClass }) : t("dt_no_licence")} {d.issuingState ? `(${d.issuingState})` : ""}</small>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background:
                          isArchived
                            ? "rgba(100, 116, 139, 0.15)"
                            : d.status === "Completed"
                            ? "rgba(34, 197, 94, 0.15)"
                            : d.status === "In Progress"
                            ? "rgba(217, 119, 6, 0.15)"
                            : "rgba(100, 116, 139, 0.15)",
                        color:
                          isArchived
                            ? "#64748b"
                            : d.status === "Completed"
                            ? "#22c55e"
                            : d.status === "In Progress"
                            ? "#d97706"
                            : "#64748b"
                      }}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, background: "var(--border, #e2e8f0)", height: "6px", borderRadius: "3px", overflow: "hidden", minWidth: "60px" }}>
                        <div className="progress-gradient" style={{ width: `${d.completionPercentage || 0}%`, height: "100%" }} />
                      </div>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{d.completionPercentage || 0}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    {d.quizScore !== null && d.quizScore !== undefined ? (
                      <strong style={{ color: d.quizScore >= 80 ? "#16a34a" : "#dc2626" }}>
                        {d.quizScore}%
                      </strong>
                    ) : (
                      <span style={{ color: "var(--color-muted)" }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(d)}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.78rem" }}
                        >
                          {t("dt_edit")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setResetPassDriverId(d.id);
                          setNewPasswordText("");
                        }}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        title={t("dt_pass_title")}
                      >
                        <KeyRound className="w-3 h-3 text-indigo-500" /> {t("dt_pass")}
                      </button>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={() => void handleResetInduction(d.id)}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.78rem" }}
                        >
                          {t("dt_reset")}
                        </button>
                      )}
                      {!isArchived ? (
                        <button
                          type="button"
                          onClick={() => onArchiveDriver(d.id)}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #6366f1", color: "#6366f1", background: "transparent", cursor: "pointer", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          <Archive className="w-3 h-3" /> {t("dt_archive")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRestoreDriver(d.id)}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #16a34a", color: "#16a34a", background: "transparent", cursor: "pointer", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        >
                          <RotateCcw className="w-3 h-3" /> {t("dt_restore")}
                        </button>
                      )}
                      {d.status === "Completed" && !isArchived && (
                        <button
                          type="button"
                          onClick={() => openRevokeModal(d.id)}
                          style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #ef4444", color: "#ef4444", background: "transparent", cursor: "pointer", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                          title={t("dt_revoke_title")}
                        >
                          <ShieldX className="w-3 h-3" /> {t("dt_revoke")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteDriver(d.id)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #ef4444", color: "#ef4444", background: "transparent", cursor: "pointer", fontSize: "0.78rem" }}
                      >
                        {t("dt_delete")}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Certificate Verification Box */}
      <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
        <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Search style={{ width: 18, height: 18, color: "#3b82f6" }} /> {t("dt_public_verify")}
        </h4>
        <div style={{ display: "flex", gap: "10px", maxWidth: "420px" }}>
          <label htmlFor="public-verify-code-input" className="sr-only">{t("dt_verify_ph")}</label>
          <input
            id="public-verify-code-input"
            name="verificationCode"
            type="text"
            placeholder={t("dt_verify_ph")}
            value={verifyCodeText}
            onChange={(e) => setVerifyCodeText(e.target.value)}
            autoComplete="off"
            style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
          />
          <button
            type="button"
            onClick={handleVerifyCert}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}
          >
            {t("dt_verify_btn")}
          </button>
        </div>

        {verifyResult && (
          <div
            style={{
              marginTop: "14px",
              padding: "14px 18px",
              borderRadius: "12px",
              background: (verifyResult.verified || verifyResult.valid) ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
              border: (verifyResult.verified || verifyResult.valid) ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              fontSize: "0.88rem"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              {(verifyResult.verified || verifyResult.valid) ? (
                <CheckCircle2 style={{ width: 20, height: 20, color: "#16a34a" }} />
              ) : (
                <AlertCircle style={{ width: 20, height: 20, color: "#dc2626" }} />
              )}
              <strong style={{ fontSize: "0.98rem", color: (verifyResult.verified || verifyResult.valid) ? "#16a34a" : "#dc2626" }}>
                {(verifyResult.verified || verifyResult.valid) ? t("dt_verified_title") : t("dt_failed_title")}
              </strong>
            </div>

            {(verifyResult.verified || verifyResult.valid) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px", fontSize: "0.83rem" }}>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>{t("dt_certified_driver")}:</span>
                  <strong>{verifyResult.driverName || verifyResult.driver?.fullName || "—"}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>{t("dt_certificate_id")}:</span>
                  <strong style={{ fontFamily: "monospace" }}>{verifyResult.certificateId || verifyCodeText.toUpperCase()}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>{t("dt_licence_class")}:</span>
                  <strong>{verifyResult.licenceClass || "—"} {verifyResult.issuingState ? `(${verifyResult.issuingState})` : ""}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>{t("dt_depot_location")}:</span>
                  <strong>{verifyResult.depotLocation || "—"}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <DriverFormModal
          driver={selectedDriver}
          onSave={handleSaveModal}
          onClose={() => setIsModalOpen(false)}
          loading={loading}
        />
      )}

      {resetPassDriverId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px"
          }}
        >
          <div
            className="glass"
            style={{
              width: "100%",
              maxWidth: "420px",
              padding: "24px",
              borderRadius: "18px",
              background: "var(--bg-elevated, #1e293b)",
              border: "1px solid var(--border, #334155)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound className="w-4 h-4 text-indigo-400" /> {t("dt_reset_title")}
              </h4>
              <button
                type="button"
                onClick={() => setResetPassDriverId(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="muted" style={{ fontSize: "0.83rem", margin: "0 0 14px" }}>
              {t("dt_reset_sub")}
            </p>
            <input
              type="password"
              placeholder={t("dt_password_ph")}
              value={newPasswordText}
              onChange={(e) => setNewPasswordText(e.target.value)}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                marginBottom: "16px",
                fontSize: "0.9rem"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setResetPassDriverId(null)}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.85rem" }}
              >
                {t("dt_cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleExecuteResetPassword(resetPassDriverId)}
                disabled={newPasswordText.length < 8}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: newPasswordText.length >= 8 ? "#1e3a5f" : "#94a3b8",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: newPasswordText.length >= 8 ? "pointer" : "not-allowed",
                  fontSize: "0.85rem"
                }}
              >
                {t("dt_update_password")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Induction Modal */}
    {revokeDriverId && (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: "16px"
        }}
      >
        <div
          className="glass"
          style={{
            width: "100%",
            maxWidth: "480px",
            padding: "24px",
            borderRadius: "18px",
            background: "var(--bg-elevated, #1e293b)",
            border: "1px solid var(--border, #334155)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldX className="w-4 h-4 text-red-400" /> {t("dt_revoke_title")}
            </h4>
          </div>
          <p className="muted" style={{ fontSize: "0.83rem", margin: "0 0 14px" }}>
            {t("dt_revoke_sub", { driver: drivers.find(d => d.id === revokeDriverId)?.fullName || revokeDriverId })}
          </p>
          <textarea
            placeholder={t("dt_revoke_reason_ph")}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginBottom: "16px",
              fontSize: "0.9rem",
              fontFamily: "inherit",
              resize: "vertical",
              background: "var(--bg-elevated)",
              color: "var(--text)"
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setRevokeDriverId(null)}
              disabled={revoking}
              style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "transparent", cursor: revoking ? "not-allowed" : "pointer", fontSize: "0.85rem" }}
            >
              {t("v_cancel")}
            </button>
            <button
              type="button"
              onClick={handleRevokeInduction}
              disabled={revoking || !revokeReason.trim()}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: revoking || !revokeReason.trim() ? "#94a3b8" : "#ef4444",
                color: "#fff",
                fontWeight: 700,
                cursor: revoking || !revokeReason.trim() ? "not-allowed" : "pointer",
                fontSize: "0.85rem"
              }}
            >
              {revoking ? "⟳" : <ShieldX className="w-4 h-4" />}
              {revoking ? t("dt_revoking") : t("dt_revoke_confirm")}
            </button>
          </div>
        </div>
      </div>
    )}

    <CertificateScannerModal
      isOpen={isScannerOpen}
      onClose={() => setIsScannerOpen(false)}
      drivers={drivers}
      onVerifyCode={onVerifyCertificate}
    />
  </div>
);
}
