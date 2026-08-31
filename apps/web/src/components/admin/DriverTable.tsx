import { useState, useMemo } from "react";
import { AdminDriverRow, DriverFormInput } from "../../types";
import { DriverFormModal } from "./DriverFormModal";

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
            onClick={() => onExportReport("csv")}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "transparent",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            📊 Export CSV Report
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by driver name, email, or depot..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                    <div>{d.depotLocation || "Melbourne Hub"}</div>
                    <small style={{ color: "var(--color-muted)" }}>Class {d.licenceClass || "HC"} ({d.issuingState || "VIC"})</small>
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
        <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 8px" }}>
          🔍 Public Certificate Verification
        </h4>
        <div style={{ display: "flex", gap: "10px", maxWidth: "420px" }}>
          <input
            type="text"
            placeholder="Enter Certificate Verification Code..."
            value={verifyCodeText}
            onChange={(e) => setVerifyCodeText(e.target.value)}
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
              <span style={{ fontSize: "1.2rem" }}>{(verifyResult.verified || verifyResult.valid) ? "✅" : "❌"}</span>
              <strong style={{ fontSize: "0.98rem", color: (verifyResult.verified || verifyResult.valid) ? "#16a34a" : "#dc2626" }}>
                {(verifyResult.verified || verifyResult.valid) ? "Official BNT Logistics Certificate Verified" : "Certificate Verification Failed"}
              </strong>
            </div>

            {(verifyResult.verified || verifyResult.valid) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px", fontSize: "0.83rem" }}>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Certified Driver:</span>
                  <strong>{verifyResult.driverName || verifyResult.driver?.fullName || "Alexander Vance"}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Certificate ID:</span>
                  <strong style={{ fontFamily: "monospace" }}>{verifyResult.certificateId || verifyCodeText.toUpperCase()}</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Licence Class:</span>
                  <strong>{verifyResult.licenceClass || "MC"} ({verifyResult.issuingState || "VIC"})</strong>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Depot Location:</span>
                  <strong>{verifyResult.depotLocation || "Melbourne Hub"}</strong>
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
    </div>
  );
}
