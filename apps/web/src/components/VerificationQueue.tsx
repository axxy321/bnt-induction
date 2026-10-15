import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileCheck, CheckCircle2, Clock, Check, X, ExternalLink, Eye, AlertCircle } from "lucide-react";
import { useAppState } from "../state/AppContext";
import { apiBaseUrl, supabase } from "../lib/supabase";
import { showToast } from "./ui/Toast";

interface PendingDocument {
  id: string;
  user_id: string;
  type: string;
  file_url?: string | null;
  file_name: string | null;
  mime_type: string | null;
  status: "pending" | "approved" | "rejected";
  uploaded_at: string;
  expires_at: string | null;
  signed_url?: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  };
}

interface VerificationQueueProps {
  onRefresh?: () => void;
}

export function VerificationQueue({ onRefresh }: VerificationQueueProps) {
  const { t } = useTranslation();
  const { session } = useAppState();

  const TYPE_LABELS: Record<string, string> = {
    driver_license: t("vq_type_licence", "Driver Licence"),
    medical_certificate: t("vq_type_medical", "Medical Certificate"),
    identity_proof: t("vq_type_identity", "Identity Proof"),
    right_to_work: t("doc_rtw_title", "Visa / Right to Work"),
    dangerous_goods_license: t("doc_dg_title", "Dangerous Goods Licence"),
    nhvas_bfm_certificate: t("doc_fatigue_title", "NHVAS Fatigue Certificate"),
    hrwl_forklift: t("doc_forklift_title", "High Risk Work Licence (Forklift)")
  };

  const NODE_LABELS: Record<string, string> = {
    "[PROFILE & UPLOAD]": t("vq_node_1", "Profile & Upload"),
    "[PENDING VERIFICATION]": t("vq_node_2", "Pending Verification"),
    "[APPROVE]": t("vq_node_3", "Approve & Verify"),
    "[TRAINING UNLOCKED]": t("vq_node_4", "Training Unlocked")
  };

  const [docs, setDocs] = useState<PendingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expiryByDocument, setExpiryByDocument] = useState<Record<string, string>>({});
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Backend proxy via serverless API
      if (session?.accessToken) {
        const res = await fetch(`${apiBaseUrl}/admin/verification-queue`, {
          headers: { Authorization: `Bearer ${session.accessToken}` }
        }).catch(() => null);

        if (res && res.ok) {
          const data = (await res.json()) as { documents: PendingDocument[] };
          if (Array.isArray(data.documents)) {
            setDocs(data.documents);
            return;
          }
        }
      }

      // 2. Direct Supabase query fallback (with explicit FK to avoid PGRST201)
      let supaDocs: any[] | null = null;
      const { data, error } = await supabase
        .from("documents")
        .select(`
          id,
          user_id,
          file_url,
          type,
          file_name,
          mime_type,
          status,
          verified_by_admin,
          uploaded_at,
          expires_at,
          profiles!documents_user_id_fkey(full_name, email)
        `)
        .eq("status", "pending")
        .order("uploaded_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        supaDocs = data;
      } else {
        // Fallback: fetch documents and profiles separately
        const { data: rawDocs } = await supabase
          .from("documents")
          .select("id, user_id, file_url, type, file_name, mime_type, status, verified_by_admin, uploaded_at, expires_at")
          .eq("status", "pending")
          .order("uploaded_at", { ascending: false });

        if (Array.isArray(rawDocs) && rawDocs.length > 0) {
          const userIds = [...new Set(rawDocs.map((d: any) => d.user_id))];
          const { data: userProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds);
          const profileMap = new Map((userProfiles ?? []).map((p: any) => [p.id, p]));
          supaDocs = rawDocs.map((d: any) => ({
            ...d,
            profiles: profileMap.get(d.user_id) ?? { full_name: null, email: null }
          }));
        } else if (!rawDocs || rawDocs.length === 0) {
          supaDocs = [];
        }
      }

      if (supaDocs) {
        // Enrich with signed URLs so admin can view/download immediately
        const enriched = await Promise.all(
          supaDocs.map(async (doc: any) => {
            let signedUrl = doc.signed_url || "";
            if (!signedUrl && doc.file_url) {
              try {
                const { data: urlData } = await supabase.storage.from("driver-documents").createSignedUrl(doc.file_url, 3600);
                signedUrl = urlData?.signedUrl ?? "";
              } catch {}
            }
            return { ...doc, signed_url: signedUrl };
          })
        );
        setDocs(enriched);
        return;
      }

      setDocs([]);
    } catch (err) {
      console.warn("Could not load verification queue:", err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  async function handleViewDocument(doc: PendingDocument) {
    if (doc.signed_url) {
      window.open(doc.signed_url, "_blank", "noopener,noreferrer");
      return;
    }

    if (!doc.file_url) {
      showToast(t("vq_no_file", "No file URL associated with this document."), "error");
      return;
    }

    setOpeningDocId(doc.id);
    try {
      const { data, error } = await supabase.storage.from("driver-documents").createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Failed to generate signed URL");
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      showToast(err?.message || "Could not open document preview", "error");
    } finally {
      setOpeningDocId(null);
    }
  }

  async function handleAction(docId: string, action: "approve" | "reject") {
    let reason: string | undefined = undefined;
    if (action === "reject") {
      const inputReason = window.prompt(t("vq_reject_prompt", "Please enter a reason for rejection (optional):"));
      if (inputReason === null) {
        // User clicked cancel on prompt
        return;
      }
      reason = inputReason.trim() || undefined;
    }

    setProcessing(docId + action);
    try {
      let isSuccess = false;
      let msg = action === "approve" ? t("vq_approved") : t("vq_rejected");

      if (session?.accessToken) {
        const res = await fetch(`${apiBaseUrl}/admin/documents/${docId}/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`
          },
          body: JSON.stringify({
            action,
            ...(action === "approve" && expiryByDocument[docId]
              ? { expiresAt: new Date(`${expiryByDocument[docId]}T00:00:00.000Z`).toISOString() }
              : {}),
            ...(reason ? { reason } : {})
          })
        }).catch(() => null);

        if (res && res.ok) {
          const data = (await res.json()) as { message?: string };
          isSuccess = true;
          if (data.message) msg = data.message;
        }
      }

      if (!isSuccess) {
        // Direct Supabase fallback
        const updateData: Record<string, any> = {
          status: action === "approve" ? "approved" : "rejected",
          verified_by_admin: action === "approve",
          verified_at: new Date().toISOString(),
          verified_by_user_id: session?.user?.id
        };
        if (action === "approve" && expiryByDocument[docId]) {
          updateData.expires_at = new Date(`${expiryByDocument[docId]}T00:00:00.000Z`).toISOString();
        }
        if (action === "reject" && reason) {
          updateData.rejection_reason = reason;
        }

        const { error } = await supabase.from("documents").update(updateData).eq("id", docId);
        if (error) throw error;
        isSuccess = true;
      }

      showToast(msg, "success");
      void fetchQueue();
      onRefresh?.();
    } catch {
      showToast(t("vq_fail"), "error");
    } finally {
      setProcessing(null);
    }
  }

  const groupedByDriver = docs.reduce<Record<string, PendingDocument[]>>((acc, doc) => {
    const key = doc.user_id;
    acc[key] = acc[key] ? [...acc[key], doc] : [doc];
    return acc;
  }, {});

  return (
    <div className="glass" style={{ padding: "32px", marginTop: "24px", borderRadius: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.4rem" }}>{t("vq_title")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("vq_subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {docs.length > 0 && (
            <span
              style={{
                background: "#f59e0b",
                color: "#000",
                fontWeight: 700,
                fontSize: "0.8rem",
                padding: "4px 12px",
                borderRadius: "999px"
              }}
            >
              {t(docs.length === 1 ? "vq_pending_one" : "vq_pending_other", { count: docs.length })}
            </span>
          )}
          <button
            onClick={() => void fetchQueue()}
            disabled={loading}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              cursor: "pointer",
              background: "transparent",
              fontWeight: 600,
              fontSize: "0.85rem"
            }}
          >
            {t("vq_refresh")}
          </button>
        </div>
      </div>

      {/* Status machine flow banner */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "24px",
          padding: "14px 18px",
          background: "rgba(37,99,235,0.07)",
          borderRadius: "14px",
          border: "1px solid rgba(37,99,235,0.15)"
        }}
      >
        {["[PROFILE & UPLOAD]", "→", "[PENDING VERIFICATION]", "→", "[APPROVE]", "→", "[TRAINING UNLOCKED]"].map((node, i) => (
          <span
            key={i}
            style={{
              fontWeight: node.startsWith("[") ? 700 : 400,
              color: node === "[PENDING VERIFICATION]" ? "#d97706" : node === "[APPROVE]" ? "#16a34a" : "inherit",
              fontSize: "0.8rem",
              opacity: node === "→" ? 0.5 : 1
            }}
          >
            {NODE_LABELS[node] ?? node}
          </span>
        ))}
      </div>

      {loading && <p className="muted">{t("vq_loading")}</p>}

      {!loading && docs.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.8 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <p style={{ fontWeight: 600, margin: 0, fontSize: "1.05rem" }}>{t("vq_empty_title")}</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>{t("vq_empty_sub")}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {Object.entries(groupedByDriver).map(([driverId, driverDocs]) => {
          const profile = driverDocs[0]?.profiles;
          return (
            <div
              key={driverId}
              className="glass card-hover"
              style={{
                borderRadius: "18px",
                padding: "20px",
                border: "1px solid rgba(217,119,6,0.25)",
                background: "rgba(255,251,235,0.04)"
              }}
            >
              {/* Driver row */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#f59e0b,#d97706)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    flexShrink: 0
                  }}
                >
                  {(profile?.full_name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <strong style={{ fontSize: "1rem" }}>{profile?.full_name ?? t("vq_unknown_driver")}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>{profile?.email ?? driverId}</p>
                </div>
                <span
                  style={{
                    marginLeft: "auto",
                    padding: "4px 12px",
                    borderRadius: "999px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    background: "rgba(217,119,6,0.15)",
                    color: "#d97706",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <Clock className="w-3.5 h-3.5" /> {driverDocs.length} {t("vq_awaiting", "Awaiting Verification")}
                </span>
              </div>

              {/* Documents for this driver */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {driverDocs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px",
                      padding: "14px 18px",
                      borderRadius: "14px",
                      background: "var(--bg-elevated, rgba(255,255,255,0.03))",
                      border: "1px solid var(--border, rgba(255,255,255,0.1))",
                      flexWrap: "wrap"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "220px" }}>
                      <FileCheck className="w-6 h-6 text-indigo-400 flex-shrink-0" />
                      <div>
                        <strong style={{ fontSize: "0.92rem", display: "block" }}>{TYPE_LABELS[doc.type] ?? doc.type}</strong>
                        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
                          {doc.file_name ?? t("vq_uploaded_doc")} • {new Date(doc.uploaded_at).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    </div>

                    {/* View / Download Button */}
                    <button
                      type="button"
                      onClick={() => void handleViewDocument(doc)}
                      disabled={openingDocId === doc.id}
                      style={{
                        padding: "7px 14px",
                        borderRadius: "8px",
                        border: "1px solid rgba(99,102,241,0.3)",
                        background: "rgba(99,102,241,0.1)",
                        color: "#818cf8",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                      title="Inspect uploaded document in new tab"
                    >
                      <Eye className="w-4 h-4" />
                      {openingDocId === doc.id ? "Opening..." : "View Document"}
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>

                    {/* Expiry Date Input */}
                    <label
                      htmlFor={`doc-expiry-${doc.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.8rem",
                        color: "var(--color-muted)"
                      }}
                    >
                      {t("vq_expiry_label", "Expiry:")}
                      <input
                        id={`doc-expiry-${doc.id}`}
                        name={`expiry_${doc.id}`}
                        type="date"
                        value={expiryByDocument[doc.id] ?? ""}
                        onChange={(event) => setExpiryByDocument((current) => ({ ...current, [doc.id]: event.target.value }))}
                        disabled={processing?.startsWith(doc.id)}
                        autoComplete="off"
                        style={{
                          padding: "5px 8px",
                          borderRadius: "6px",
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "0.8rem"
                        }}
                      />
                    </label>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        onClick={() => void handleAction(doc.id, "approve")}
                        disabled={processing?.startsWith(doc.id)}
                        style={{
                          padding: "8px 18px",
                          borderRadius: "9px",
                          border: "none",
                          cursor: "pointer",
                          background: "#16a34a",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          opacity: processing?.startsWith(doc.id) ? 0.6 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        {processing === doc.id + "approve" ? "..." : (
                          <>
                            <Check className="w-4 h-4" /> {t("vq_approve", "Approve")}
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => void handleAction(doc.id, "reject")}
                        disabled={processing?.startsWith(doc.id)}
                        style={{
                          padding: "8px 18px",
                          borderRadius: "9px",
                          border: "1px solid #ef4444",
                          cursor: "pointer",
                          background: "transparent",
                          color: "#ef4444",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          opacity: processing?.startsWith(doc.id) ? 0.6 : 1,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        {processing === doc.id + "reject" ? "..." : (
                          <>
                            <X className="w-4 h-4" /> {t("vq_reject", "Reject")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
