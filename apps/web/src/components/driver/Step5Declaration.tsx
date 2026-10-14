import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const [hasInk, setHasInk] = useState(
    Boolean(initialSignature && initialSignature.startsWith("data:image"))
  );
  const [typedName, setTypedName] = useState("");
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [contentOverflows, setContentOverflows] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { t } = useTranslation();

  const termsRef = useRef<HTMLDivElement>(null);

  // A returning driver who already accepted is not forced to re-read.
  useEffect(() => {
    if (initialAccepted) {
      setAccepted(true);
      setHasReadToBottom(true);
    }
  }, [initialAccepted]);

  // Measure whether the terms box is scrollable, and treat
  // non-overflowing (short) content as already "read".
  useEffect(() => {
    const el = termsRef.current;
    if (!el) return;

    const measure = () => {
      const overflows = el.scrollHeight > el.clientHeight + 4;
      setContentOverflows(overflows);
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      if (atBottom) setHasReadToBottom(true);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (atBottom) setHasReadToBottom(true);
  };

  const handleSignatureStateChange = (ink: boolean) => {
    setHasInk(ink);
  };

  // The checkbox is only enabled once the driver has read the
  // declaration (scrolled to the bottom), unless it is short
  // enough to fit without scrolling or was already accepted.
  const canAccept = hasReadToBottom || !contentOverflows;

  // A signature is valid if the driver drew one OR typed their name.
  const typedNameTrimmed = typedName.trim();
  const signatureValid = hasInk || typedNameTrimmed.length >= 2;

  const handleSubmit = async () => {
    if (!accepted) {
      setErrorMsg(t("err_accept"));
      return;
    }
    if (!signatureValid) {
      setErrorMsg(t("err_signature"));
      return;
    }
    setErrorMsg(null);
    try {
      // A typed name is stored as the signature; otherwise the canvas image is used.
      const finalSignature = typedNameTrimmed.length >= 2 ? typedNameTrimmed : signature;
      await onSaveDeclaration(accepted, finalSignature);
      onContinue();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("err_decl_save"));
    }
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "760px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          {t("s5_title")}
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          {t("s5_sub")}
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
        ref={termsRef}
        onScroll={handleTermsScroll}
        style={{
          background: "var(--bg-elevated, rgba(255,255,255,0.03))",
          border: "1px solid var(--border, #cbd5e1)",
          borderRadius: "12px",
          padding: "20px",
          maxHeight: "260px",
          overflowY: "auto",
          fontSize: "0.85rem",
          lineHeight: 1.6,
          marginBottom: "12px"
        }}
      >
        <h5 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 10px" }}>
          {t("s5_decl_title")}
        </h5>
        <p>{t("s5_hereby")}</p>
        <ol style={{ paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <li>{t("s5_t1")}</li>
          <li>{t("s5_t2")}</li>
          <li>{t("s5_t3")}</li>
          <li>{t("s5_t4")}</li>
          <li>{t("s5_t5")}</li>
          <li>{t("s5_t6")}</li>
        </ol>
      </div>

      {!hasReadToBottom && contentOverflows && !initialAccepted && (
        <p style={{ margin: "0 0 16px", fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
          {t("s5_scroll")}
        </p>
      )}

      {/* Agreement Checkbox */}
      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            cursor: canAccept ? "pointer" : "not-allowed",
            fontSize: "0.88rem",
            lineHeight: 1.4,
            opacity: canAccept ? 1 : 0.55
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            disabled={!canAccept}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span>
            <strong>{t("s5_agree")}</strong> {t("s5_agree_note")}
          </span>
        </label>
      </div>

      {/* Signature Pad */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px" }}>
          {t("s5_signature")}
        </label>
        <SignaturePad
          initialSignature={signature}
          onSignatureChange={(sig) => setSignature(sig)}
          onSignatureStateChange={handleSignatureStateChange}
        />
      </div>

      {/* Typed-name fallback (accessibility) */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "8px" }}>
          {t("s5_or_type")} <span style={{ fontWeight: 400, color: "#64748b" }}>{t("s5_if_cannot")}</span>
        </label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={t("s5_placeholder")}
          autoComplete="name"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border, #cbd5e1)",
            fontSize: "0.95rem",
            fontFamily: "'Segoe Script', 'Brush Script MT', cursive"
          }}
        />
        {hasInk && typedNameTrimmed.length >= 2 && (
          <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
            {t("s5_typed_used")}
          </p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!accepted || !signatureValid || loading}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: accepted && signatureValid ? "#1e3a5f" : "#94a3b8",
            color: "#ffffff",
            fontWeight: 700,
            cursor: accepted && signatureValid ? "pointer" : "not-allowed"
          }}
        >
          {loading ? t("s5_signing") : t("s5_sign_submit")}
        </button>
      </div>
    </div>
  );
}
