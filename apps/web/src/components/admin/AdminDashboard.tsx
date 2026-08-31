import { useState } from "react";
import { AdminOverview } from "../../types";
import { DriverTable } from "./DriverTable";
import { VerificationQueue } from "../VerificationQueue";
import { AdminCMS } from "../AdminCMS";

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
  const [activeTab, setActiveTab] = useState<"drivers" | "verification" | "cms">("drivers");

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
        className="glass"
        style={{
          padding: "8px 12px",
          borderRadius: "14px",
          marginBottom: "24px",
          display: "flex",
          gap: "8px",
          alignItems: "center"
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
            cursor: "pointer"
          }}
        >
          🚚 Driver Management
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
            cursor: "pointer"
          }}
        >
          📑 Document Verification Queue
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
            cursor: "pointer"
          }}
        >
          ⚙️ Content Management (CMS)
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
          🔄 Refresh Data
        </button>
      </div>

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
