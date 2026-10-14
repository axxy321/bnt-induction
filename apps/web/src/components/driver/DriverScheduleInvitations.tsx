import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Clock, AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, Info } from "lucide-react";
import { useAppState } from "../../state/AppContext";
import { InductionScheduleInvitation } from "../../types";
import { getMyScheduleInvitations } from "../../lib/api";
import { SessionState } from "../../types";

interface DriverScheduleInvitationsProps {
  session: SessionState;
  onStartInduction?: (scheduleItemId: string, itemTitle: string) => void;
}

export function DriverScheduleInvitations({ session, onStartInduction }: DriverScheduleInvitationsProps) {
  const { t } = useTranslation();
  // const { setLoading } = useAppState();  // Not needed

  const [invitations, setInvitations] = useState<InductionScheduleInvitation[]>([]);
  const [loading, setInvitationsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInvitationsLoading(true);
      setError(null);
      try {
        const data = await getMyScheduleInvitations(session);
        console.log('[DriverScheduleInvitations] Fetched invitations:', data);
        if (!cancelled) setInvitations(data);
      } catch (err: any) {
        console.error('[DriverScheduleInvitations] Error:', err);
        if (!cancelled) setError(err?.message || t("schedules_error"));
      } finally {
        if (!cancelled) setInvitationsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session, t]);

  const getStatusColor = (status: InductionScheduleInvitation["status"]) => {
    switch (status) {
      case "pending":
      case "sent":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
      case "delivered":
      case "opened":
      case "clicked":
        return "bg-sky-500/10 text-sky-400 border border-sky-500/30";
      case "failed":
      case "bounced":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/30";
    }
  };

  const getStatusIcon = (status: InductionScheduleInvitation["status"]) => {
    switch (status) {
      case "pending":
      case "sent":
        return <Clock className="w-4 h-4" />;
      case "delivered":
      case "opened":
      case "clicked":
        return <CheckCircle2 className="w-4 h-4" />;
      case "failed":
      case "bounced":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  const parseStyleString = (styleStr: string): React.CSSProperties => {
    const style: React.CSSProperties = {};
    styleStr.split(";").forEach((part) => {
      const [prop, val] = part.split(":").map((s) => s.trim());
      if (prop && val) {
        const camelProp = prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        (style as any)[camelProp] = val;
      }
    });
    return style;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div className="glass" style={{ padding: "24px", borderRadius: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}
          >
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>{t("driver_schedule_invitations_title")}</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {t("driver_schedule_invitations_sub")}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontWeight: 600,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Invitations List */}
      <div className="glass" style={{ padding: "24px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "0.85rem" }}>
            <RefreshCw className="w-4 h-4 animate-spin" /> {t("cms_loading")}
          </div>
        ) : invitations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <Mail className="w-12 h-12 mx-auto mb-4" style={{ opacity: 0.3 }} />
            <strong style={{ display: "block", fontSize: "1rem", marginBottom: "8px" }}>
              {t("driver_schedule_invitations_empty_title")}
            </strong>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {t("driver_schedule_invitations_empty_sub")}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {invitations.map((inv) => {
              const meta = inv.metadata || {};
              const itemTitle = meta.item_title || t("driver_schedule_invitations_no_title");
              const scheduleName = meta.schedule_name || t("driver_schedule_invitations_no_schedule");
              const dueDate = meta.due_date ? new Date(meta.due_date) : null;

              return (
                <div
                  key={inv.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    padding: "16px",
                    borderRadius: "14px",
                    background: "var(--bg-elevated, rgba(255,255,255,0.03))",
                    border: `1px solid var(--border, rgba(255,255,255,0.08))`,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: "rgba(245, 158, 11, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <Mail className="w-5 h-5" style={{ color: "#f59e0b" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: "0.95rem", display: "block" }}>{itemTitle}</strong>
                      <div className="muted" style={{ fontSize: "0.78rem", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Info className="w-3 h-3" /> {scheduleName}
                        </span>
                        {dueDate && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock className="w-3 h-3" />
                            {t("driver_schedule_invitations_due")} {formatDate(dueDate.toISOString())}
                          </span>
                        )}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Clock className="w-3 h-3" />
                          {t("driver_schedule_invitations_sent")} {formatDate(inv.sentAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: "999px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        ...parseStyleString(getStatusColor(inv.status))
                      }}
                    >
                      {getStatusIcon(inv.status)}
                      {t(`driver_schedule_invitations_status_${inv.status}`)}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        onStartInduction?.(inv.scheduleItemId, meta.item_title || t("driver_schedule_invitations_no_title"));
                      }}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "10px",
                        border: "1px solid #f59e0b",
                        background: "rgba(245, 158, 11, 0.1)",
                        color: "#f59e0b",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f59e0b"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245, 158, 11, 0.1)"; e.currentTarget.style.color = "#f59e0b"; }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t("driver_schedule_invitations_start")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
