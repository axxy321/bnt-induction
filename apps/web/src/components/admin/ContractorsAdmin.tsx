import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, RefreshCw, AlertTriangle, FileText } from "lucide-react";
import { api } from "../../lib/api";
import { ContractorCompanyRecord } from "../../types";
import { computeContractorStatus } from "../../lib/contractorUtils";

type ContractorRow = ContractorCompanyRecord & { userName: string; userEmail: string };

function toneBox(tone: "green" | "amber" | "red" | "grey"): React.CSSProperties {
  switch (tone) {
    case "green":
      return { background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.35)" };
    case "amber":
      return { background: "rgba(217,119,6,0.12)", color: "#d97706", border: "1px solid rgba(217,119,6,0.35)" };
    case "red":
      return { background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.35)" };
    default:
      return { background: "rgba(100,116,139,0.12)", color: "#64748b", border: "1px solid rgba(100,116,139,0.35)" };
  }
}

function isExpired(dateStr?: string): boolean {
  if (!dateStr) return false;
  const parsed = new Date(`${dateStr}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

export function ContractorsAdmin() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ContractorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .getAdminContractorData()
      .then((data) => setRows(data.contractors))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "12px",
          flexWrap: "wrap"
        }}
      >
        <div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 className="w-5 h-5" /> {t("cnta_title")}
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            {t("cnta_subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.82rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> {t("cnta_refresh")}
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--color-muted)" }}>
          {t("cnta_loading")}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--color-muted)" }}>
          {t("cnta_empty")}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_company")}</th>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_driver")}</th>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_abn")}</th>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_nhvas")}</th>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_pl")}</th>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_wc")}</th>
                <th style={{ padding: "10px 12px" }}>{t("cnta_th_status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = computeContractorStatus(row);
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <strong>{row.companyName || "—"}</strong>
                      {row.tradingName && (
                        <div className="muted" style={{ fontSize: "0.75rem" }}>{row.tradingName}</div>
                      )}
                      <div className="muted" style={{ fontSize: "0.72rem" }}>{row.primaryDepot || ""}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {row.userName}
                      <div className="muted" style={{ fontSize: "0.75rem" }}>{row.userEmail}</div>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{row.abn || "—"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {row.nhvasAccreditation !== "None" ? row.nhvasAccreditation : "—"}
                      {row.nhvasNumber && (
                        <div className="muted" style={{ fontSize: "0.72rem", fontFamily: "monospace" }}>{row.nhvasNumber}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div>{row.publicLiabilityPolicy || "—"}</div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: isExpired(row.publicLiabilityExpiry) ? "#dc2626" : "var(--color-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {isExpired(row.publicLiabilityExpiry) && <AlertTriangle className="w-3 h-3" style={{ color: "#dc2626", flexShrink: 0 }} />}
                        {row.publicLiabilityExpiry || t("cnta_no_date")}
                      </div>
                      {row.publicLiabilityFileUrl && (
                        <a
                          href={row.publicLiabilityFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px", color: "#2563eb" }}
                        >
                          <FileText className="w-3 h-3" /> {t("cnta_policy_doc")}
                        </a>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div>{row.workersCompPolicy || "—"}</div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: isExpired(row.workersCompExpiry) ? "#dc2626" : "var(--color-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        {isExpired(row.workersCompExpiry) && <AlertTriangle className="w-3 h-3" style={{ color: "#dc2626", flexShrink: 0 }} />}
                        {row.workersCompExpiry || t("cnta_no_date")}
                      </div>
                      {row.workersCompFileUrl && (
                        <a
                          href={row.workersCompFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.72rem", display: "inline-flex", alignItems: "center", gap: "3px", color: "#2563eb" }}
                        >
                          <FileText className="w-3 h-3" /> {t("cnta_policy_doc")}
                        </a>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          ...toneBox(status.tone)
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
