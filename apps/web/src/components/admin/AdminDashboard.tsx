import { useState } from "react";
import { Users, FileCheck, Settings, RefreshCw, CalendarClock, Activity } from "lucide-react";
import { AdminOverview } from "../../types";
import { DriverTable } from "./DriverTable";
import { VerificationQueue } from "../VerificationQueue";
import { AdminCMS } from "../AdminCMS";
import { AdminExpiryMatrix } from "./AdminExpiryMatrix";

interface AdminDashboardProps {
  overview: AdminOverview | null;
  onRefresh: () => Promise<void>;
  onCreateDriver: (input: any) => Promise<void>;
  onUpdateDriver: (id: string, input: any) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
  onResetInduction: (id: string) => Promise<void>;
  onDeleteDriver: (id: string) => Promise<void>;
  onExportReport: (format: "csv" | "pdf", options?: any) => Promise<Blob>;
  onVerifyCertificate: (code: string) => Promise<any>;
  loading: boolean;
}

export function AdminDashboard({
  overview,
  onRefresh,
  onCreateDriver,
  onUpdateDriver,
  onResetPassword,
  onResetInduction,
  onDeleteDriver,
  onExportReport,
  onVerifyCertificate,
  loading
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"drivers" | "verification" | "cms" | "expiries" | "activity">("drivers");

  const metrics = overview?.metrics || {
    totalDrivers: 0,
    completedDrivers: 0,
    pendingDrivers: 0,
    inProgressDrivers: 0,
    completionRate: 0,
    averageQuizScore: 0
  };

  return (
    <div style={{ width: "100%", maxWidth: "1140px", margin: "0 auto", padding: "0 16px" }}>
      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px"
        }}
      >
        <div className="glass" style={{ padding: "20px", borderRadius: "14px" }}>
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Total Registered Drivers</span>
          <strong style={{ fontSize: "1.8rem", color: "#1e3a5f" }}>{metrics.totalDrivers}</strong>
        </div>
        <div className="glass" style={{ padding: "20px", borderRadius: "14px" }}>
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Completed Inductions</span>
          <strong style={{ fontSize: "1.8rem", color: "#16a34a" }}>{metrics.completedDrivers}</strong>
        </div>
        <div className="glass" style={{ padding: "20px", borderRadius: "14px" }}>
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>In Progress</span>
          <strong style={{ fontSize: "1.8rem", color: "#d97706" }}>{metrics.inProgressDrivers}</strong>
        </div>
        <div className="glass" style={{ padding: "20px", borderRadius: "14px" }}>
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Completion Rate</span>
          <strong style={{ fontSize: "1.8rem", color: "#2563eb" }}>{metrics.completionRate}%</strong>
        </div>
        <div className="glass" style={{ padding: "20px", borderRadius: "14px" }}>
          <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 600, display: "block" }}>Avg Knowledge Score</span>
          <strong style={{ fontSize: "1.8rem", color: "#9333ea" }}>{metrics.averageQuizScore}%</strong>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        className="glass admin-nav-tabs"
        style={{
          padding: "8px 12px",
          borderRadius: "14px",
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          overflowX: "auto",
          maxWidth: "100%",
          WebkitOverflowScrolling: "touch"
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("drivers")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "drivers" ? "#1e3a5f" : "transparent",
            color: activeTab === "drivers" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Users className="w-4 h-4" /> Driver Management
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("verification")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "verification" ? "#1e3a5f" : "transparent",
            color: activeTab === "verification" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <FileCheck className="w-4 h-4" /> Document Verification Queue
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cms")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "cms" ? "#1e3a5f" : "transparent",
            color: activeTab === "cms" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Settings className="w-4 h-4" /> Content Management (CMS)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("expiries")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "expiries" ? "#1e3a5f" : "transparent",
            color: activeTab === "expiries" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <CalendarClock className="w-4 h-4" /> Expiry &amp; Renewals
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: activeTab === "activity" ? "#1e3a5f" : "transparent",
            color: activeTab === "activity" ? "#ffffff" : "var(--color-muted)",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Activity className="w-4 h-4" /> Audit &amp; Activity Log
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
            fontSize: "0.82rem"
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "expiries" && (
        <AdminExpiryMatrix drivers={overview?.drivers || []} />
      )}

      {activeTab === "activity" && (
        <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
                System Activity &amp; Audit Trail
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Immutable compliance event log under NHVR &amp; HVNL regulations.
              </p>
            </div>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, padding: "4px 12px", borderRadius: "999px", background: "rgba(37,99,235,0.1)", color: "#2563eb" }}>
              {(overview?.recentActivity || []).length} Logged Events
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(overview?.recentActivity || []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--color-muted)" }}>
                No recent system activity recorded yet.
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
                        User ID: <span style={{ fontFamily: "monospace" }}>{log.userId.slice(0, 8)}...</span>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span> • {JSON.stringify(log.metadata).slice(0, 60)}</span>
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
          onExportReport={onExportReport}
          onVerifyCertificate={onVerifyCertificate}
          loading={loading}
        />
      )}

      {activeTab === "verification" && <VerificationQueue />}

      {activeTab === "cms" && <AdminCMS />}
    </div>
  );
}
