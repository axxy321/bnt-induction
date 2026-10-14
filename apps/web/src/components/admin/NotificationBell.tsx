import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, FileWarning, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { AdminOverview } from "../../types";

interface NotificationBellProps {
  overview: AdminOverview | null;
}

interface NotificationItem {
  id: string;
  kind: "pending" | "expiring" | "stuck" | "followup";
  text: string;
}

const KIND_META = {
  pending: { icon: FileWarning, color: "#d97706" },
  expiring: { icon: Clock, color: "#2563eb" },
  stuck: { icon: AlertTriangle, color: "#dc2626" },
  followup: { icon: TrendingUp, color: "#6366f1" }
} as const;

export function NotificationBell({ overview }: NotificationBellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const items: NotificationItem[] = [];
  if (overview) {
    const today = new Date();
    for (const d of overview.drivers) {
      for (const doc of d.documents) {
        if (doc.status === "pending") {
          items.push({ id: `p-${doc.id}`, kind: "pending", text: `${doc.name} — ${d.fullName}` });
        } else if (doc.expiresAt) {
          const days = Math.ceil((new Date(doc.expiresAt).getTime() - today.getTime()) / 86400000);
          if (days >= 0 && days <= 14) {
            items.push({ id: `e-${doc.id}`, kind: "expiring", text: `${doc.name} — ${d.fullName} (${t("ntf_days_left", { days })})` });
          }
        }
      }
    }
    for (const d of overview.insights.stuckDrivers.slice(0, 5)) {
      items.push({ id: `s-${d.id}`, kind: "stuck", text: d.fullName });
    }
    for (const d of overview.insights.followUpDrivers.slice(0, 5)) {
      items.push({ id: `f-${d.id}`, kind: "followup", text: d.fullName });
    }
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const sections: Array<{ kind: NotificationItem["kind"]; label: string }> = [
    { kind: "pending", label: t("ntf_pending_docs") },
    { kind: "expiring", label: t("ntf_expiring") },
    { kind: "stuck", label: t("ntf_stuck") },
    { kind: "followup", label: t("ntf_followup") }
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("ntf_title")}
        style={{
          position: "relative",
          padding: "8px",
          borderRadius: "10px",
          border: "1px solid var(--border, #cbd5e1)",
          background: "var(--bg-elevated, #ffffff)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          color: "var(--text, #0f172a)"
        }}
      >
        <Bell className="w-4 h-4" />
        {items.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-6px",
              right: "-6px",
              minWidth: "18px",
              height: "18px",
              borderRadius: "9px",
              background: "#dc2626",
              color: "#ffffff",
              fontSize: "0.65rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px"
            }}
          >
            {items.length > 99 ? "99+" : items.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="glass"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "320px",
            maxWidth: "calc(100vw - 32px)",
            borderRadius: "14px",
            padding: "12px",
            zIndex: 90,
            boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
            maxHeight: "360px",
            overflowY: "auto"
          }}
        >
          <h4 style={{ margin: "0 0 10px", fontSize: "0.9rem", fontWeight: 800 }}>{t("ntf_title")}</h4>
          {items.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.83rem" }}>{t("ntf_empty")}</p>
          ) : (
            sections.map((section) => {
              const sectionItems = items.filter((item) => item.kind === section.kind);
              if (sectionItems.length === 0) return null;
              const meta = KIND_META[section.kind];
              const Icon = meta.icon;
              return (
                <div key={section.kind} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: meta.color,
                      marginBottom: "4px"
                    }}
                  >
                    <Icon className="w-3 h-3" /> {section.label}
                  </div>
                  {sectionItems.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        background: "rgba(148,163,184,0.08)",
                        marginBottom: "4px"
                      }}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
