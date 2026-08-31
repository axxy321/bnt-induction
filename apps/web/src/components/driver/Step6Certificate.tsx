import { useState } from "react";
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

  const handleDownload = async () => {
    setDownloading(true);
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
      console.error("Certificate download error", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    try {
      await onSubmitFeedback({ clarityRating: rating, issues: issuesText });
      setFeedbackSaved(true);
    } catch (err) {
      console.error("Feedback submit failed", err);
    }
  };

  return (
    <div className="glass" style={{ padding: "32px", borderRadius: "20px", maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎖️</div>
      <h3 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 8px" }}>
        Induction Successfully Completed!
      </h3>
      <p className="muted" style={{ margin: "0 0 24px", fontSize: "0.95rem" }}>
        Congratulations, <strong>{driver.fullName}</strong>. You are certified for Heavy Vehicle operations under BNT Logistics safety standards.
      </p>

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
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1e3a5f" }}>BNT LOGISTICS OFFICIAL COMPLIANCE CERTIFICATE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.88rem" }}>
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Verification Code:</span>
              <strong style={{ fontFamily: "monospace", fontSize: "1rem", color: "#1e3a5f" }}>
                {certificate.verificationCode}
              </strong>
            </div>
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Issued Date:</span>
              <strong>{new Date(certificate.issuedAt).toLocaleDateString("en-AU")}</strong>
            </div>
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Licence Class & State:</span>
              <strong>{driver.licenceClass || "HC"} ({driver.issuingState || "VIC"})</strong>
            </div>
            <div>
              <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>Depot Hub:</span>
              <strong>{driver.depotLocation || "Melbourne Hub"}</strong>
            </div>
          </div>
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
          {downloading ? "Generating PDF Certificate..." : "📥 Download Official PDF Certificate"}
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
          Driver Feedback & Training Rating
        </h4>
        <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 16px" }}>
          Help us continuously improve our safety induction program.
        </p>

        {feedbackSaved ? (
          <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", fontSize: "0.85rem", fontWeight: 600 }}>
            ✓ Thank you! Your feedback has been submitted to the compliance team.
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Training Clarity:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "1.4rem",
                    cursor: "pointer",
                    opacity: star <= rating ? 1 : 0.3
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>

            <div style={{ marginBottom: "14px" }}>
              <textarea
                placeholder="Any suggestions or questions about site safety?"
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
              Submit Feedback
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
