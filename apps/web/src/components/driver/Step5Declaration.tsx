import { useState } from "react";
import { SignaturePad } from "../SignaturePad";

interface Step5DeclarationProps {
  initialSignature?: string;
  initialAccepted?: boolean;
  onSaveDeclaration: (accepted: boolean, signature: string) => Promise<void>;
  onContinue: () => void;
  loading: boolean;
}

export function Step5Declaration({
  initialSignature = "",
  initialAccepted = false,
  onSaveDeclaration,
  onContinue,
  loading
}: Step5DeclarationProps) {
  const [accepted, setAccepted] = useState(initialAccepted);
  const [signature, setSignature] = useState(initialSignature);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!accepted) {
      setErrorMsg("You must accept the legal safety declaration before continuing.");
      return;
    }
    if (!signature || signature.trim().length === 0) {
      setErrorMsg("Please provide your digital signature.");
      return;
    }
    setErrorMsg(null);
    try {
      await onSaveDeclaration(accepted, signature);
      onContinue();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save declaration.");
    }
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "760px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          Step 5: Driver Safety Declaration & Digital Signature
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          Under HVNL Section 26C Chain of Responsibility, drivers must confirm their legal safety commitment.
        </p>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#ef4444",
            marginBottom: "20px",
            fontSize: "0.85rem"
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Declaration Terms */}
      <div
        style={{
          background: "var(--bg-elevated, rgba(255,255,255,0.03))",
          border: "1px solid var(--border, #cbd5e1)",
          borderRadius: "12px",
          padding: "20px",
          maxHeight: "260px",
          overflowY: "auto",
          fontSize: "0.85rem",
          lineHeight: 1.6,
          marginBottom: "20px"
        }}
      >
        <h5 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 10px" }}>
          BNT Logistics • Heavy Vehicle Driver Declaration
        </h5>
        <p>I hereby declare and confirm that:</p>
        <ol style={{ paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>
            I hold a valid Australian Heavy Vehicle Driver Licence corresponding to my vehicle combination (HC/MC/HR/MR).
          </li>
          <li>
            I understand my statutory duties under Section 26C of Heavy Vehicle National Law (HVNL) Chain of Responsibility.
          </li>
          <li>
            I will complete mandatory visual daily pre-start vehicle checks and tag out any Major Defect immediately.
          </li>
          <li>
            I will strictly comply with Heavy Vehicle Fatigue Management work/rest rules and keep accurate EWD/Work Diary entries.
          </li>
          <li>
            I will adhere to the Load Restraint Guide 2018 performance standards (0.8g forward, 0.5g lateral/rearward, 0.2g upward).
          </li>
          <li>
            I will obey all posted heavy vehicle speed limits, truck lane rules, and zero alcohol/drug policies.
          </li>
        </ol>
      </div>

      {/* Agreement Checkbox */}
      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            cursor: "pointer",
            fontSize: "0.88rem",
            lineHeight: 1.4
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span>
            <strong>I agree and accept the legal safety declaration above.</strong> I understand that false statements or willful non-compliance may result in immediate suspension of site access and referral to transport authorities.
          </span>
        </label>
      </div>

      {/* Signature Pad */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px" }}>
          Digital Signature (Sign with mouse or touch screen) *
        </label>
        <SignaturePad
          initialSignature={signature}
          onSignatureChange={(sig) => setSignature(sig)}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!accepted || !signature || loading}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: accepted && signature ? "#1e3a5f" : "#94a3b8",
            color: "#ffffff",
            fontWeight: 700,
            cursor: accepted && signature ? "pointer" : "not-allowed"
          }}
        >
          {loading ? "Signing Declaration..." : "Sign Declaration & Issue Certificate →"}
        </button>
      </div>
    </div>
  );
}
