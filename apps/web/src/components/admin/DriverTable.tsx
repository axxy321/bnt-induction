import { useState, useMemo } from "react";
import { Download, Search, CheckCircle2, AlertCircle, QrCode, KeyRound, X } from "lucide-react";
import { AdminDriverRow, DriverFormInput } from "../../types";
import { DriverFormModal } from "./DriverFormModal";
import { CertificateScannerModal } from "./CertificateScannerModal";

interface DriverTableProps {
  drivers: AdminDriverRow[];
  onCreateDriver: (input: DriverFormInput & { password?: string }) => Promise<void>;
  onUpdateDriver: (id: string, input: DriverFormInput) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
  onResetInduction: (id: string) => Promise<void>;
  onDeleteDriver: (id: string) => Promise<void>;
  onExportReport: (format: "csv" | "pdf", options?: any) => Promise<Blob>;
  onVerifyCertificate: (code: string) => Promise<any>;
  loading: boolean;
}

export function DriverTable({
  drivers,
  onCreateDriver,
  onUpdateDriver,
  onResetPassword,
  onResetInduction,
  onDeleteDriver,
  onExportReport,
  onVerifyCertificate,
  loading
}: DriverTableProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDriver, setSelectedDriver] = useState<AdminDriverRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [resetPassDriverId, setResetPassDriverId] = useState<string | null>(null);
  const [newPasswordText, setNewPasswordText] = useState("");
  const [verifyCodeText, setVerifyCodeText] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const matchStatus = filterStatus === "all" || d.status === filterStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        d.fullName.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        (d.depotLocation && d.depotLocation.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [drivers, filterStatus, searchQuery]);

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
      await onCreateDriver(input);
    }
    setIsModalOpen(false);
  };

  const handleExecuteResetPassword = async (id: string) => {
    if (!newPasswordText || newPasswordText.length < 8) return;
    await onResetPassword(id, newPasswordText);
    setResetPassDriverId(null);
    setNewPasswordText("");
  };

  const handleVerifyCert = async () => {
    if (!verifyCodeText.trim()) return;
    try {
      const res = await onVerifyCertificate(verifyCodeText.trim());
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ verified: false, valid: false, message: err instanceof Error ? err.message : "Verification failed." });
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
      alert(err?.message || "CSV export failed.");
    }
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
      {/* Table Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
            Heavy Vehicle Driver Registry
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Audit compliance, verify documents, and issue certificates.
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
            <QrCode className="w-4 h-4" /> Scan Certificate QR
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
            + Add New Driver
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
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <label htmlFor="driver-table-search" className="sr-only">Search drivers</label>
        <input
          id="driver-table-search"
          name="driverSearch"
          type="text"
          placeholder="Search by driver name, email, or depot..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
          style={{ flex: 1, minWidth: "240px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
        />

        <div style={{ display: "flex", gap: "4px", background: "rgba(148,163,184,0.1)", padding: "3px", borderRadius: "8px" }}>
          {["all", "Not Started", "In Progress", "Completed"].map((st) => (
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
              {st === "all" ? "All Drivers" : st}
            </button>
          ))}
        </div>
      </div>

      {/* Driver Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border, #e2e8f0)" }}>
              <th style={{ padding: "12px 10px" }}>Driver</th>
              <th style={{ padding: "12px 10px" }}>Depot / Licence</th>
              <th style={{ padding: "12px 10px" }}>Status</th>
              <th style={{ padding: "12px 10px" }}>Progress</th>
              <th style={{ padding: "12px 10px" }}>Quiz Score</th>
              <th style={{ padding: "12px 10px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--color-muted)" }}>
                  No driver records match the selected filter.
                </td>
              </tr>
            ) : (
              filteredDrivers.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border, #f1f5f9)" }}>
                  <td style={{ padding: "12px 10px" }}>
                    <strong>{d.fullName}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>{d.email}</div>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div>{d.depotLocation || "—"}</div>
                    <small style={{ color: "var(--color-muted)" }}>{d.licenceClass ? `Class ${d.licenceClass}` : "No licence"} {d.issuingState ? `(${d.issuingState})` : ""}</small>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background:
                          d.status === "Completed"
                            ? "rgba(34, 197, 94, 0.15)"
                            : d.status === "In Progress"
                            ? "rgba(217, 119, 6, 0.15)"
                            : "rgba(100, 116, 139, 0.15)",
                        color:
                          d.status === "Completed"
                            ? "#22c55e"
                            : d.status === "In Progress"
                            ? "#d97706"
                            : "#64748b"
                      }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, background: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden", minWidth: "60px" }}>
                        <div style={{ width: `${d.completionPercentage || 0}%`, background: "#16a34a", height: "100%" }} />
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
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(d)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.78rem" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetPassDriverId(d.id);
                          setNewPasswordText("");
                        }}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "3px" }}
                        title="Reset Driver Password"
                      >
                        <KeyRound className="w-3 h-3 text-indigo-500" /> Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetInduction(d.id)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer", fontSize: "0.78rem" }}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDriver(d.id)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #ef4444", color: "#ef4444", background: "transparent", cursor: "pointer", fontSize: "0.78rem" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Certificate Verification Box */}
      <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
        <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 8px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Search style={{ width: 18, height: 18, color: "#3b82f6" }} /> Public Certificate Verification
        </h4>
        <div style={{ display: "flex", gap: "10px", maxWidth: "420px" }}>
          <label htmlFor="public-verify-code-input" className="sr-only">Certificate Verification Code</label>
          <input
            id="public-verify-code-input"
            name="verificationCode"
            type="text"
            placeholder="Enter Certificate Verification Code..."
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
            Verify
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
                {(verifyResult.verified || verifyResult.valid) ? "Official BNT Logistics Certificate Verified" : "Certificate Verification Failed"}
              </strong>
            </div>

            {(verifyResult.verified || verifyResult.valid) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px", fontSize: "0.83rem" }}>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Certified Driver:</span>
                  <strong>{verifyResult.driverName || verifyResult.driver?.fullName || "—"}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Certificate ID:</span>
                  <strong style={{ fontFamily: "monospace" }}>{verifyResult.certificateId || verifyCodeText.toUpperCase()}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Licence Class:</span>
                  <strong>{verifyResult.licenceClass || "—"} {verifyResult.issuingState ? `(${verifyResult.issuingState})` : ""}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Depot Location:</span>
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
                <KeyRound className="w-4 h-4 text-indigo-400" /> Reset Driver Password
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
              Enter a new secure temporary password for this driver account (minimum 8 characters).
            </p>
            <input
              type="password"
              placeholder="Enter at least 8 characters..."
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
                Cancel
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
                Update Password
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
