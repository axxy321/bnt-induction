import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  ShieldCheck,
  Truck,
  Wrench
} from "lucide-react";
import { api } from "./lib/api";
import { tStatus } from "./i18n";
import { VehiclePassVerificationResult } from "./types";
import bntLogo from "./assets/bnt-logistics-logo.png";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function isExpired(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

export default function VehicleVerificationPage({ code }: { code: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VehiclePassVerificationResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.verifyVehiclePass(code);
        if (cancelled) return;
        if (!result?.verified) {
          setError(result?.message || t("vvp_err_default"));
          return;
        }
        setDetail(result);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : t("vvp_err_service")
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const vehicle = detail?.vehicle;
  const isGrounded = vehicle?.status === "Maintenance Required";
  const expiredDates = [
    { label: t("vvp_l_rego_exp"), value: vehicle?.regoExpiryDate },
    { label: t("vvp_l_dg_exp"), value: vehicle?.dgExpiryDate },
    { label: t("vvp_l_escba"), value: vehicle?.scbaServiceDueDate }
  ].filter((item) => isExpired(item.value));

  const items = vehicle
    ? [
        { label: t("vvp_l_pass"), value: vehicle.passCode, mono: true },
        { label: t("vvp_l_rego"), value: vehicle.rego, mono: true },
        { label: t("vvp_l_make"), value: vehicle.makeModel, icon: Truck },
        { label: t("vvp_l_status"), value: tStatus(vehicle.status, t), icon: FileCheck },
        { label: t("vvp_l_driver"), value: detail?.driver?.fullName || "—", icon: FileCheck },
        { label: t("vvp_l_branch"), value: vehicle.branchName || "—", icon: FileCheck },
        { label: t("vvp_l_rego_exp"), value: formatDate(vehicle.regoExpiryDate), icon: Clock },
        { label: t("vvp_l_dg_exp"), value: formatDate(vehicle.dgExpiryDate), icon: Clock },
        { label: t("vvp_l_escba"), value: formatDate(vehicle.scbaServiceDueDate), icon: Clock }
      ]
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#eef4ff 0%,#dbeafe 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        style={{
          maxWidth: "680px",
          width: "100%",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(148,163,184,0.22)",
          borderRadius: "28px",
          padding: "40px",
          boxShadow: "0 24px 60px rgba(37,99,235,0.14)"
        }}
      >
        {/* Brand header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
          <img
            src={bntLogo}
            alt="BNT Logistics"
            style={{ height: "52px", maxWidth: "180px", objectFit: "contain" }}
          />
          <div>
            <div
              style={{
                fontSize: "0.72rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5b6b84",
                fontWeight: 700
              }}
            >
              {t("vvp_system")}
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#10213a" }}>
              {t("vvp_title")}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Loader2
              className="animate-spin"
              style={{ width: 40, height: 40, color: "#2563eb", margin: "0 auto 16px" }}
            />
            <p style={{ color: "#5b6b84", margin: 0 }}>{t("vvp_verifying")}</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px"
              }}
            >
              <AlertTriangle style={{ width: 32, height: 32, color: "#dc2626" }} />
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.4rem", color: "#991b1b" }}>
              {t("vvp_not_found_title")}
            </h2>
            <p style={{ color: "#5b6b84", margin: "0 0 6px" }}>{error}</p>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "12px 0 0" }}>
              {t("vvp_retry_hint")}
            </p>
          </div>
        )}

        {detail && vehicle && !loading && !error && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: isGrounded ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px"
                }}
              >
                {isGrounded ? (
                  <Wrench style={{ width: 34, height: 34, color: "#dc2626" }} />
                ) : (
                  <CheckCircle2 style={{ width: 34, height: 34, color: "#16a34a" }} />
                )}
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: isGrounded ? "rgba(239,68,68,0.14)" : "rgba(34,197,94,0.14)",
                  color: isGrounded ? "#991b1b" : "#166534",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  marginBottom: "12px"
                }}
              >
                {isGrounded ? t("vvp_grounded_badge") : t("vvp_active_badge")}
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.5rem", color: "#10213a" }}>
                {vehicle.rego} — {vehicle.makeModel}
              </h2>
              <p style={{ color: "#5b6b84", margin: 0 }}>
                {t("vvp_driven_by", { name: detail.driver?.fullName || "—" })}
                {vehicle.branchName ? ` • ${vehicle.branchName}` : ""}
              </p>
            </div>

            {(isGrounded || expiredDates.length > 0) && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(217,119,6,0.1)",
                  border: "1px solid rgba(217,119,6,0.3)",
                  color: "#b45309",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>
                  {isGrounded
                    ? t("vvp_grounded_msg")
                    : t("vvp_expired_paperwork", { list: expiredDates.map((d) => d.label).join(", ") })}
                </span>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                marginTop: "8px"
              }}
            >
              {items.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "16px",
                    borderRadius: "18px",
                    background: "rgba(239,246,255,0.9)",
                    border: "1px solid rgba(148,163,184,0.18)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#5b6b84",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "6px"
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      color: "#10213a",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      wordBreak: "break-word",
                      fontFamily: item.mono ? "ui-monospace, monospace" : "inherit"
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: "24px",
                paddingTop: "18px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#5b6b84",
                fontSize: "0.85rem"
              }}
            >
              <ShieldCheck style={{ width: 16, height: 16, color: "#16a34a", flexShrink: 0 }} />
              <span>
                {t("vvp_register", { org: detail.organizationName || "BNT Logistics" })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
