import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";
import { SessionState } from "../../types";

interface PasswordHelpRequest {
  id: string;
  email: string;
  status: "pending" | "handled";
  created_at: string;
  handled_at: string | null;
  driver: { full_name: string | null; phone: string | null } | null;
}

interface PasswordHelpRequestsAdminProps {
  session: SessionState;
  onPendingCountChange: (count: number) => void;
}

export function PasswordHelpRequestsAdmin({ session, onPendingCountChange }: PasswordHelpRequestsAdminProps) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<PasswordHelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setError("");
      const rows = await api.getPasswordHelpRequests(session);
      const ordered = [...rows].sort((a, b) => {
        if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setRequests(ordered);
      onPendingCountChange(ordered.filter((request) => request.status === "pending").length);
    } catch {
      setError(t("password_help_admin_load_error"));
    } finally {
      setLoading(false);
    }
  }, [onPendingCountChange, session, t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const markHandled = async (requestId: string) => {
    setBusyId(requestId);
    setError("");
    try {
      await api.markPasswordHelpRequestHandled(session, requestId);
      await loadRequests();
    } catch {
      setError(t("password_help_admin_update_error"));
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <section className="glass" style={{ padding: "24px", borderRadius: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 750 }}>{t("password_help_admin_title")}</h3>
          <p className="muted" style={{ margin: "5px 0 0", fontSize: "0.84rem" }}>{t("password_help_admin_subtitle")}</p>
        </div>
        <button type="button" onClick={() => void loadRequests()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "inherit", cursor: "pointer" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {t("adm_refresh")}
        </button>
      </div>

      <div style={{ padding: "12px 14px", borderRadius: "10px", marginBottom: "16px", background: "rgba(37, 99, 235, 0.08)", border: "1px solid rgba(37, 99, 235, 0.18)", fontSize: "0.82rem" }}>
        <strong>{t("password_help_admin_instruction_title")}</strong> {t("password_help_admin_instruction")}
      </div>

      {error && <div role="alert" style={{ color: "#dc2626", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}><AlertCircle className="w-4 h-4" />{error}</div>}

      {loading ? (
        <p className="muted">{t("password_help_loading")}</p>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: "42px 16px" }}>
          <KeyRound className="w-8 h-8" style={{ margin: "0 auto 10px", color: "#64748b" }} />
          <p className="muted" style={{ margin: 0 }}>{t("password_help_admin_empty")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {requests.map((request) => (
            <article key={request.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-elevated, rgba(255,255,255,0.025))" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <KeyRound className="w-4 h-4" style={{ marginTop: "3px", color: request.status === "pending" ? "#d97706" : "#16a34a" }} />
                <div>
                  <strong>{request.driver?.full_name || request.email}</strong>
                  <div className="muted" style={{ fontSize: "0.82rem" }}>{request.email}{request.driver?.phone ? ` | ${request.driver.phone}` : ""}</div>
                  <div className="muted" style={{ fontSize: "0.76rem", marginTop: "4px" }}>{t("password_help_requested_at", { date: new Date(request.created_at).toLocaleString() })}</div>
                </div>
              </div>
              {request.status === "pending" ? (
                <button type="button" onClick={() => void markHandled(request.id)} disabled={busyId === request.id} style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "9px 12px", borderRadius: "8px", border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  <CheckCircle2 className="w-4 h-4" /> {busyId === request.id ? t("password_help_marking") : t("password_help_mark_handled")}
                </button>
              ) : (
                <span style={{ color: "#16a34a", fontSize: "0.8rem", fontWeight: 700 }}>{t("password_help_handled")}</span>
              )}
            </article>
          ))}
        </div>
      )}
      <span className="sr-only">{t("password_help_pending_count", { count: pendingCount })}</span>
    </section>
  );
}
