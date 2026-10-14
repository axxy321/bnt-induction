import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, PenLine, X } from "lucide-react";
import { api } from "../../lib/api";
import { PolicyRecord, SessionState } from "../../types";
import { showToast } from "../ui/Toast";

interface PolicySignModalProps {
  policy: PolicyRecord;
  session: SessionState;
  onClose: () => void;
  onSigned: () => void;
}

export function PolicySignModal({ policy, session, onClose, onSigned }: PolicySignModalProps) {
  const { t } = useTranslation();
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handleSign = async () => {
    if (!signature.trim()) {
      setError(t("policy_signature_required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.signPolicy(policy.versionId, signature);
      showToast(t("policy_signed_success"));
      onSigned();
    } catch (e: any) {
      setError(e?.message || t("policy_error_sign"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 60
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "28px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileSignature className="w-5 h-5 text-amber-400" />
            <strong style={{ color: "#ffffff", fontSize: "1.05rem" }}>{t("policy_sign_title")}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "4px" }}
            aria-label={t("policy_close")}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.95rem" }}>
            {policy.name}
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
            {t("policies_latest")} v{policy.versionLabel}
            {policy.publishedAt ? ` • ${t("policies_published_on")} ${new Date(policy.publishedAt).toLocaleDateString("en-AU")}` : ""}
          </div>
        </div>

        <div
          style={{
            maxHeight: "260px",
            overflowY: "auto",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "16px",
            color: "#cbd5e1",
            fontSize: "0.85rem",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
            marginBottom: "16px"
          }}
        >
          {policy.content}
        </div>

        <p style={{ color: "#94a3b8", fontSize: "0.78rem", margin: "0 0 12px" }}>
          {t("policy_sign_sub")}
        </p>

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              marginBottom: "12px",
              background: "rgba(244,63,94,0.1)",
              border: "1px solid rgba(244,63,94,0.3)",
              color: "#f43f5e",
              fontSize: "0.8rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label
          htmlFor="policy-signature"
          style={{ display: "block", color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 700, marginBottom: "6px" }}
        >
          <PenLine className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> {t("policy_signature_label")}
        </label>
        <input
          id="policy-signature"
          type="text"
          maxLength={120}
          placeholder={t("policy_signature_ph")}
          value={signature}
          onChange={(e) => {
            setSignature(e.target.value);
            if (error) setError(null);
          }}
          disabled={saving}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "#0f172a",
            color: "#ffffff",
            fontSize: "0.9rem",
            outline: "none",
            marginBottom: "16px",
            boxSizing: "border-box"
          }}
        />

        <button
          type="button"
          onClick={handleSign}
          disabled={saving}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => {
            setHover(false);
            setPressed(false);
          }}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: saving
              ? "#334155"
              : pressed
                ? "#0b2540"
                : hover
                  ? "#16406e"
                  : "#0f2a4a",
            color: "#ffffff",
            fontSize: "0.9rem",
            fontWeight: 800,
            cursor: saving ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transform: pressed ? "scale(0.98)" : hover ? "translateY(-1px)" : "none",
            boxShadow: hover && !saving ? "0 8px 20px rgba(15, 42, 74, 0.5)" : "none",
            transition: "background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease"
          }}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("policy_signing")}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>{t("policy_agree_sign")}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
