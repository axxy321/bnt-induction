import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  Loader2,
  Plus,
  ScrollText,
  X
} from "lucide-react";
import { api } from "../../lib/api";
import { PolicyListItem, PolicySignatureSummary, PolicyPendingDriver, SessionState } from "../../types";
import { showToast } from "../ui/Toast";

interface PoliciesAdminProps {
  session: SessionState;
}

type SignatureReport = {
  signed: PolicySignatureSummary[];
  pending: PolicyPendingDriver[];
  versionLabel: string;
  policyName: string;
};

export function PoliciesAdmin({ session }: PoliciesAdminProps) {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // New policy form
  const [name, setName] = useState("");
  const [versionLabel, setVersionLabel] = useState("1.0");
  const [content, setContent] = useState("");
  const [publishing, setPublishing] = useState(false);

  // New version form (per policy)
  const [versionFormPolicyId, setVersionFormPolicyId] = useState<string | null>(null);
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [newContent, setNewContent] = useState("");

  // Signature report
  const [report, setReport] = useState<SignatureReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      setPolicies(await api.getPolicyList());
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || t("policies_error") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePolicy = async () => {
    if (!name.trim()) {
      setMessage({ type: "err", text: t("policies_name_required") });
      return;
    }
    if (!content.trim()) {
      setMessage({ type: "err", text: t("policies_content_required") });
      return;
    }
    setPublishing(true);
    setMessage(null);
    try {
      await api.createPolicy({ name, versionLabel, content });
      setName("");
      setVersionLabel("1.0");
      setContent("");
      await loadPolicies();
      setMessage({ type: "ok", text: t("policies_published") });
      showToast(t("policies_published"));
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || t("policies_error") });
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishVersion = async (policyId: string, currentLabel: string) => {
    const label = newVersionLabel.trim() || nextVersionLabel(currentLabel);
    if (!newContent.trim()) {
      setMessage({ type: "err", text: t("policies_content_required") });
      return;
    }
    setPublishing(true);
    setMessage(null);
    try {
      await api.publishPolicyVersion(session, policyId, label, newContent);
      setVersionFormPolicyId(null);
      setNewVersionLabel("");
      setNewContent("");
      await loadPolicies();
      setMessage({ type: "ok", text: t("policies_published_version") });
      showToast(t("policies_published_version"));
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || t("policies_error") });
    } finally {
      setPublishing(false);
    }
  };

  const handleShowSignatures = async (policy: PolicyListItem) => {
    setReportLoading(true);
    setMessage(null);
    try {
      const result = await api.getPolicySignatureReport(policy.policyId);
      setReport({ ...result, policyName: policy.name });
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || t("policies_error") });
    } finally {
      setReportLoading(false);
    }
  };

  const nextVersionLabel = (current: string): string => {
    const num = parseFloat(current);
    return Number.isFinite(num) ? `${(num + 0.1).toFixed(1)}` : "1.0";
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border, #cbd5e1)",
    background: "var(--bg-strong, #ffffff)",
    color: "var(--input-text, #0f172a)",
    fontSize: "0.9rem",
    outline: "none"
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 700,
    marginBottom: "6px"
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          {t("policies_title")}
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {t("policies_sub")}
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.85rem",
            fontWeight: 600,
            background: message.type === "ok" ? "rgba(22,163,74,0.1)" : "rgba(244,63,94,0.1)",
            color: message.type === "ok" ? "#16a34a" : "#f43f5e",
            border: `1px solid ${message.type === "ok" ? "rgba(22,163,74,0.3)" : "rgba(244,63,94,0.3)"}`
          }}
        >
          {message.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* New policy form */}
      <div
        style={{
          border: "1px solid var(--border, #cbd5e1)",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "24px",
          background: "var(--bg-elevated, #ffffff)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Plus className="w-4 h-4" />
          <strong style={{ fontSize: "0.95rem" }}>{t("policies_new")}</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
            <div>
              <label htmlFor="policy-name" style={labelStyle}>{t("policies_name")}</label>
              <input
                id="policy-name"
                type="text"
                maxLength={100}
                placeholder={t("policies_name_ph")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={publishing}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="policy-version" style={labelStyle}>{t("policies_version")}</label>
              <input
                id="policy-version"
                type="text"
                maxLength={16}
                placeholder="1.0"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                disabled={publishing}
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label htmlFor="policy-content" style={labelStyle}>{t("policies_content")}</label>
            <textarea
              id="policy-content"
              rows={6}
              maxLength={10000}
              placeholder={t("policies_content_ph")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={publishing}
              style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5" }}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={handleCreatePolicy}
              disabled={publishing}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: "#1e3a5f",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: publishing ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
              {publishing ? t("policies_publishing") : t("policies_publish")}
            </button>
          </div>
        </div>
      </div>

      {/* Policy list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px", color: "var(--color-muted)" }}>
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px", color: "var(--color-muted)" }}>
          {t("policies_no_policies")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {policies.map((policy) => (
            <div
              key={policy.policyId}
              style={{
                border: "1px solid var(--border, #cbd5e1)",
                borderRadius: "14px",
                padding: "16px 20px",
                background: "var(--bg-elevated, #ffffff)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <ScrollText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div>
                    <strong style={{ fontSize: "0.95rem" }}>{policy.name}</strong>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {t("policies_latest")} v{policy.versionLabel}
                      {policy.publishedAt ? ` • ${t("policies_published_on")} ${new Date(policy.publishedAt).toLocaleDateString("en-AU")}` : ""}
                      {` • ${policy.signedCount} ${t("policies_signed").toLowerCase()}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setVersionFormPolicyId(versionFormPolicyId === policy.policyId ? null : policy.policyId);
                      setNewVersionLabel(nextVersionLabel(policy.versionLabel));
                      setNewContent("");
                    }}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #cbd5e1)",
                      background: "transparent",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    {t("policies_new_version")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShowSignatures(policy)}
                    disabled={reportLoading}
                    style={{
                      padding: "7px 14px",
                      borderRadius: "8px",
                      border: "1px solid #1e3a5f",
                      background: "rgba(30,58,95,0.06)",
                      color: "#1e3a5f",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <FileSignature className="w-3.5 h-3.5" /> {t("policies_signatures")}
                  </button>
                </div>
              </div>

              {versionFormPolicyId === policy.policyId && (
                <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed var(--border, #cbd5e1)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 4fr", gap: "14px", marginBottom: "12px" }}>
                    <div>
                      <label style={labelStyle}>{t("policies_version")}</label>
                      <input
                        type="text"
                        maxLength={16}
                        value={newVersionLabel}
                        onChange={(e) => setNewVersionLabel(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <label style={labelStyle}>{t("policies_content")}</label>
                  <textarea
                    rows={5}
                    maxLength={10000}
                    placeholder={t("policies_content_ph")}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: "1.5", marginBottom: "12px" }}
                  />
                  <button
                    type="button"
                    onClick={() => handlePublishVersion(policy.policyId, policy.versionLabel)}
                    disabled={publishing}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#1e3a5f",
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {t("policies_publish_version")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Signature report panel */}
      {report && (
        <div
          style={{
            marginTop: "24px",
            border: "1px solid var(--border, #cbd5e1)",
            borderRadius: "14px",
            padding: "20px",
            background: "var(--bg-elevated, #ffffff)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <strong style={{ fontSize: "1rem" }}>
              {t("policies_signatures")} — {report.policyName} (v{report.versionLabel})
            </strong>
            <button
              type="button"
              onClick={() => setReport(null)}
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: "4px" }}
              aria-label={t("policies_close_report")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "8px", color: "#16a34a" }}>
                {t("policies_signed_drivers")} ({report.signed.length})
              </div>
              {report.signed.length === 0 ? (
                <div className="muted" style={{ fontSize: "0.78rem" }}>{t("policies_no_signatures")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
                  {report.signed.map((sig) => (
                    <div
                      key={`${sig.driverId}-${sig.signedAt}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid rgba(22,163,74,0.25)",
                        background: "rgba(22,163,74,0.05)",
                        fontSize: "0.8rem"
                      }}
                    >
                      <strong>{sig.driverName}</strong>
                      <span className="muted"> {sig.driverEmail}</span>
                      <div className="muted" style={{ fontSize: "0.72rem", marginTop: "2px" }}>
                        "{sig.signatureText}" • {new Date(sig.signedAt).toLocaleString("en-AU")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "8px", color: "#d97706" }}>
                {t("policies_pending_drivers")} ({report.pending.length})
              </div>
              {report.pending.length === 0 ? (
                <div className="muted" style={{ fontSize: "0.78rem" }}>{t("policies_all_signed")}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" }}>
                  {report.pending.map((driver) => (
                    <div
                      key={driver.driverId}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid rgba(217,119,6,0.25)",
                        background: "rgba(217,119,6,0.05)",
                        fontSize: "0.8rem"
                      }}
                    >
                      <strong>{driver.driverName}</strong>
                      <span className="muted"> {driver.driverEmail}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
