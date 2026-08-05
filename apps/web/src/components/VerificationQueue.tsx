import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "../state/AppProvider";
import { apiBaseUrl } from "../lib/supabase";

interface PendingDocument {
  id: string;
  user_id: string;
  type: string;
  file_name: string | null;
  mime_type: string | null;
  status: "pending" | "approved" | "rejected";
  uploaded_at: string;
  expires_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  };
}

const TYPE_LABELS: Record<string, string> = {
  driver_license: "Driver Licence",
  medical_certificate: "Medical Certificate",
  identity_proof: "Identity Proof"
};

export function VerificationQueue() {
  const { session } = useAppState();
  const [docs, setDocs] = useState<PendingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchQueue = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/verification-queue`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }
      });
      const data = await res.json() as { documents: PendingDocument[] };
      setDocs(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      showToast("Failed to load verification queue.", false);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  async function handleAction(docId: string, action: "approve" | "reject") {
    if (!session?.accessToken) return;
    setProcessing(docId + action);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/documents/${docId}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ action })
      });
      const data = await res.json() as { message: string };
      showToast(data.message ?? (action === "approve" ? "Document approved." : "Document rejected."), res.ok);
      void fetchQueue();
    } catch {
      showToast("Action failed. Please try again.", false);
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
          <h2 style={{ margin: "0 0 4px", fontSize: "1.4rem" }}>Verification Queue</h2>
          <p className="muted" style={{ margin: 0 }}>Review and approve driver-submitted documents to unlock training.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {docs.length > 0 && (
            <span style={{
              background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: "0.78rem",
              padding: "4px 10px", borderRadius: "999px"
            }}>{docs.length} PENDING</span>
          )}
          <button onClick={() => void fetchQueue()}
            style={{ padding: "8px 16px", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", background: "transparent", fontWeight: 600 }}>
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              background: toast.ok ? "#22c55e" : "#ef4444",
              color: "#fff", padding: "10px 18px", borderRadius: "10px", marginBottom: "16px", fontWeight: 600
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status machine badge */}
      <div style={{
        display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px", padding: "14px 18px",
        background: "rgba(37,99,235,0.07)", borderRadius: "14px", border: "1px solid rgba(37,99,235,0.15)"
      }}>
        {["[PROFILE & UPLOAD]", "→", "[PENDING VERIFICATION]", "→", "[APPROVE]", "→", "[TRAINING UNLOCKED]"].map((node, i) => (
          <span key={i} style={{
            fontWeight: node.startsWith("[") ? 700 : 400,
            color: node === "[PENDING VERIFICATION]" ? "#d97706" : node === "[APPROVE]" ? "#16a34a" : "inherit",
            fontSize: "0.8rem", opacity: node === "→" ? 0.5 : 1
          }}>{node}</span>
        ))}
      </div>

      {loading && <p className="muted">Loading queue...</p>}

      {!loading && docs.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.5 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>✅</div>
          <p style={{ fontWeight: 600, margin: 0 }}>No documents pending verification.</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.88rem" }}>All uploaded documents have been reviewed.</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {Object.entries(groupedByDriver).map(([driverId, driverDocs]) => {
          const profile = driverDocs[0]?.profiles;
          return (
            <div key={driverId} className="glass" style={{ borderRadius: "18px", padding: "20px", border: "1px solid rgba(217,119,6,0.25)", background: "rgba(255,251,235,0.04)" }}>
              {/* Driver row */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.9rem", flexShrink: 0 }}>
                  {(profile?.full_name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{profile?.full_name ?? "Unknown Driver"}</strong>
                  <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>{profile?.email ?? driverId}</p>
                </div>
                <span style={{
                  marginLeft: "auto", padding: "4px 12px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700,
                  background: "rgba(217,119,6,0.15)", color: "#d97706"
                }}>⏳ AWAITING VERIFICATION</span>
              </div>

              {/* Documents */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {driverDocs.map((doc) => (
                  <div key={doc.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                    padding: "12px 16px", borderRadius: "12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", flexWrap: "wrap"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "1.2rem" }}>
                        {doc.type === "driver_license" ? "🪪" : doc.type === "medical_certificate" ? "🏥" : "🆔"}
                      </span>
                      <div>
                        <strong style={{ fontSize: "0.88rem" }}>{TYPE_LABELS[doc.type] ?? doc.type}</strong>
                        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
                          {doc.file_name ?? "Uploaded document"} • {new Date(doc.uploaded_at).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button
                        onClick={() => void handleAction(doc.id, "approve")}
                        disabled={processing === doc.id + "approve"}
                        style={{
                          padding: "7px 18px", borderRadius: "9px", border: "none", cursor: "pointer",
                          background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: "0.85rem",
                          opacity: processing === doc.id + "approve" ? 0.6 : 1
                        }}>
                        {processing === doc.id + "approve" ? "..." : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => void handleAction(doc.id, "reject")}
                        disabled={processing === doc.id + "reject"}
                        style={{
                          padding: "7px 18px", borderRadius: "9px", border: "1px solid #ef4444", cursor: "pointer",
                          background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: "0.85rem",
                          opacity: processing === doc.id + "reject" ? 0.6 : 1
                        }}>
                        {processing === doc.id + "reject" ? "..." : "✕ Reject"}
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
