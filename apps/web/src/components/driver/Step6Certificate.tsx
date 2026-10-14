import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Award, Download, Star, Check, AlertTriangle } from "lucide-react";
import { CertificateRecord, DriverFeedback, DriverProfile } from "../../types";
import bntLogo from "../../assets/bnt-logistics-logo.png";

interface Step6CertificateProps {
  driver: DriverProfile;
  certificate: CertificateRecord | null;
  feedback: DriverFeedback | null;
  onGenerateCertificate: () => Promise<{ pdfBase64: string }>;
  onSubmitFeedback: (input: { clarityRating: number; issues: string }) => Promise<void>;
  loading: boolean;
}

export function Step6Certificate({
  driver,
  certificate,
  feedback,
  onGenerateCertificate,
  onSubmitFeedback,
  loading
}: Step6CertificateProps) {
  const [rating, setRating] = useState(feedback?.clarityRating || 5);
  const [issuesText, setIssuesText] = useState(feedback?.issues || "");
  const [feedbackSaved, setFeedbackSaved] = useState(!!feedback);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleDownload = async () => {
    setDownloading(true);
    setErrorMsg(null);
    try {
      const res = await onGenerateCertificate();
      if (res.pdfBase64) {
        const link = document.createElement("a");
        link.href = res.pdfBase64.startsWith("data:")
          ? res.pdfBase64
          : `data:application/pdf;base64,${res.pdfBase64}`;
        link.download = `BNT-Driver-Induction-${driver.fullName.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t("err_cert_download")
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    setErrorMsg(null);
    try {
      await onSubmitFeedback({ clarityRating: rating, issues: issuesText });
      setFeedbackSaved(true);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t("err_feedback")
      );
    }
  };

  return (
    <div className="glass" style={{ padding: "32px", borderRadius: "20px", maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
        <Award className="w-16 h-16 text-amber-400" />
      </div>
      <h3 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 8px" }}>
        {t("s6_title")}
      </h3>
      <p className="muted" style={{ margin: "0 0 24px", fontSize: "0.95rem" }}>
        {t("s6_congrats", { name: driver.fullName })}
      </p>

      {errorMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#ef4444",
            marginBottom: "20px",
            fontSize: "0.85rem",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {certificate && (
        <div
          style={{
            background: "var(--bg-elevated, rgba(255,255,255,0.04))",
            border: "1px solid var(--border, #cbd5e1)",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            textAlign: "left"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border, #cbd5e1)" }}>
            <img src={bntLogo} alt="BNT Logistics" style={{ height: "34px", objectFit: "contain" }} />
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e3a5f" }}>{t("s6_official")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.88rem" }}>
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{t("s6_verify_code")}</span>
              <strong style={{ fontFamily: "monospace", fontSize: "1rem", color: "#1e3a5f" }}>
                {certificate.verificationCode}
              </strong>
            </div>
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{t("s6_issued")}</span>
              <strong>{new Date(certificate.issuedAt).toLocaleDateString("en-AU")}</strong>
            </div>
            {certificate.expiresAt && (
              <div>
                <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{t("s6_valid_until")}</span>
                <strong>{new Date(certificate.expiresAt).toLocaleDateString("en-AU")}</strong>
              </div>
            )}
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{t("s6_licence")}</span>
              <strong>{driver.licenceClass || "HC"} ({driver.issuingState || "VIC"})</strong>
            </div>
            <div>
                <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{t("s6_depot")}</span>
              <strong>{driver.depotLocation || "Melbourne Hub"}</strong>
            </div>
          </div>

          {certificate.expiresAt &&
            (() => {
              const daysLeft = Math.ceil(
                (new Date(certificate.expiresAt).getTime() - Date.now()) / 86400000
              );
              return daysLeft <= 60 ? (
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: "0.8rem",
                    color: "#d97706",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
                    {t(daysLeft === 1 ? "s6_expires_one" : "s6_expires_other", { count: daysLeft })}
                </p>
              ) : null;
            })()}

          {certificate.verificationUrl && (
            <div
              style={{
                marginTop: "16px",
                paddingTop: "14px",
                borderTop: "1px solid var(--border, #cbd5e1)"
              }}
            >
              <span className="muted" style={{ display: "block", fontSize: "0.75rem", marginBottom: "4px" }}>
                {t("s6_verify_this")}
              </span>
              <a
                href={certificate.verificationUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#2563eb",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  wordBreak: "break-all"
                }}
              >
                {certificate.verificationUrl}
              </a>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading || loading}
          style={{
            padding: "14px 32px",
            borderRadius: "10px",
            border: "none",
            background: "#16a34a",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: downloading ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)"
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
            <Download style={{ width: 18, height: 18 }} />
            {downloading ? t("s6_downloading") : t("s6_download")}
          </span>
        </button>
      </div>

      {/* Driver Feedback Rating */}
      <div
        style={{
          borderTop: "1px solid var(--border, #e2e8f0)",
          paddingTop: "24px",
          textAlign: "left"
        }}
      >
        <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 6px" }}>
          {t("s6_feedback_title")}
        </h4>
        <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 16px" }}>
          {t("s6_feedback_sub")}
        </p>

        {feedbackSaved ? (
          <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <Check className="w-4 h-4" /> {t("s6_thanks")}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{t("s6_clarity")}</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "2px",
                    cursor: "pointer"
                  }}
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating
                        ? "text-amber-400 fill-amber-400"
                        : "text-slate-300 fill-transparent"
                    }`}
                  />
                </button>
              ))}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <textarea
                placeholder={t("s6_suggest")}
                rows={2}
                value={issuesText}
                onChange={(e) => setIssuesText(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              />
            </div>

            <button
              type="button"
              onClick={handleFeedbackSubmit}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "1px solid #1e3a5f",
                background: "#1e3a5f",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer"
              }}
            >
              {t("s6_submit_feedback")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
