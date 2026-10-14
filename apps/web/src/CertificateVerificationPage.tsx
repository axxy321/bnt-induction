import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  ShieldCheck
} from "lucide-react";
import { api } from "./lib/api";
import { CertificateVerificationResult } from "./types";
import bntLogo from "./assets/bnt-logistics-logo.png";

interface NormalizedCertificate {
  driverName: string;
  certificateId: string;
  verificationCode: string;
  issuedAt: string | null;
  expiresAt: string | null;
  licenceClass: string | null;
  issuingState: string | null;
  depotLocation: string | null;
  organizationName: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export default function CertificateVerificationPage({ code }: { code: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<NormalizedCertificate | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result: CertificateVerificationResult = await api.verifyCertificate(code);
        if (cancelled) return;

        if (!result?.verified && !result?.valid) {
          setError(result?.message || t("cvp_err_default"));
          return;
        }

        setDetail({
          driverName:
            result.driver?.fullName ||
            result.driverName ||
            t("cvp_driver_default"),
          certificateId:
            result.certificate?.completionId ||
            result.certificateId ||
            code,
          verificationCode:
            result.certificate?.verificationCode ||
            result.verificationCode ||
            code,
          issuedAt: result.certificate?.issuedAt || result.issuedAt || null,
          expiresAt:
            result.certificate?.expiresAt ?? result.expiresAt ?? null,
          licenceClass: result.licenceClass ?? null,
          issuingState: result.issuingState ?? null,
          depotLocation: result.depotLocation ?? null,
          organizationName: result.organizationName || t("cvp_org_default")
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Verification service is unavailable. Please try again."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const isExpired = detail?.expiresAt
    ? new Date(detail.expiresAt).getTime() < Date.now()
    : false;

  const items = detail
    ? [
        { label: t("cvp_l_id"), value: detail.certificateId, mono: true },
        { label: t("cvp_l_code"), value: detail.verificationCode, mono: true },
        { label: t("cvp_l_issued"), value: formatDate(detail.issuedAt), icon: Clock },
        {
          label: t("cvp_l_valid"),
          value: formatDate(detail.expiresAt),
          icon: Clock
        }
      ]
    : [];

  if (detail?.licenceClass) {
    items.push({
      label: t("cvp_l_licence"),
      value: `${detail.licenceClass}${
        detail.issuingState ? ` · ${detail.issuingState}` : ""
      }`,
      icon: FileCheck
    });
  }
  if (detail?.depotLocation) {
    items.push({ label: t("cvp_l_depot"), value: detail.depotLocation, icon: FileCheck });
  }

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
              {t("cvp_system")}
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#10213a" }}>
              {t("cvp_title")}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Loader2
              className="animate-spin"
              style={{ width: 40, height: 40, color: "#2563eb", margin: "0 auto 16px" }}
            />
            <p style={{ color: "#5b6b84", margin: 0 }}>{t("cvp_verifying")}</p>
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
              {t("cvp_not_found_title")}
            </h2>
            <p style={{ color: "#5b6b84", margin: "0 0 6px" }}>{error}</p>
            <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "12px 0 0" }}>
              {t("cvp_retry_hint")}
            </p>
          </div>
        )}

        {detail && !loading && !error && (
          <div>
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(34,197,94,0.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px"
                }}
              >
                <CheckCircle2 style={{ width: 34, height: 34, color: "#16a34a" }} />
              </div>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.14)",
                  color: "#166534",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  marginBottom: "12px"
                }}
              >
                {t("cvp_verified_badge")}
              </div>
              <h2 style={{ margin: "0 0 4px", fontSize: "1.5rem", color: "#10213a" }}>
                {detail.driverName}
              </h2>
              <p style={{ color: "#5b6b84", margin: 0 }}>
                {t("cvp_completed_text")}
              </p>
            </div>

            {isExpired && (
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
                  {t("cvp_expired", { date: formatDate(detail.expiresAt) })}
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
                {t("cvp_register", { org: detail.organizationName })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
