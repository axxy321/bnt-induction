import { useState, ChangeEvent } from "react";
import { DocumentType, UploadedDocument } from "../../types";

interface Step2DocumentsProps {
  documents: UploadedDocument[];
  onUpload: (type: DocumentType, file: File) => Promise<void>;
  onContinue: () => void;
  loading: boolean;
}

interface DocumentRequirement {
  type: DocumentType;
  title: string;
  description: string;
  required: boolean;
  icon: string;
}

const documentRequirements: DocumentRequirement[] = [
  {
    type: "driver_license",
    title: "Heavy Vehicle Driver Licence",
    description: "Front & back scan of your current HC, MC, HR, or MR driver licence.",
    required: true,
    icon: "🪪"
  },
  {
    type: "medical_certificate",
    title: "Commercial Driver Medical Certificate",
    description: "Current Fitness to Drive medical assessment under Austroads guidelines.",
    required: true,
    icon: "🏥"
  },
  {
    type: "right_to_work",
    title: "Right to Work / VEVO Check",
    description: "Australian Passport, Birth Certificate, or VEVO Work Visa confirmation.",
    required: true,
    icon: "🆔"
  },
  {
    type: "dangerous_goods_license",
    title: "Dangerous Goods (DG) Licence",
    description: "Mandatory if transporting hazardous substances or dangerous bulk cargo.",
    required: false,
    icon: "⚠️"
  },
  {
    type: "nhvas_bfm_certificate",
    title: "Fatigue Arrangement Evidence",
    description: "Provide current operator evidence only where your assigned task requires an accredited fatigue arrangement.",
    required: false,
    icon: "⏱️"
  },
  {
    type: "hrwl_forklift",
    title: "High Risk Work Licence (Forklift LF)",
    description: "HRWL Forklift Endorsement if operating yard equipment or self-loading.",
    required: false,
    icon: "🚜"
  }
];

export function Step2Documents({ documents, onUpload, onContinue, loading }: Step2DocumentsProps) {
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getDocStatus = (type: DocumentType) => {
    return documents.find((doc) => doc.type === type);
  };

  const handleFileSelect = async (type: DocumentType, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File size exceeds 5MB limit. Please upload a compressed PDF or image.");
      return;
    }

    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type)) {
      setErrorMsg("Unsupported file format. Please upload a PDF, JPG, or PNG document.");
      return;
    }

    setErrorMsg(null);
    setUploadingType(type);
    try {
      await onUpload(type, file);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Document upload failed. Please try again.");
    } finally {
      setUploadingType(null);
    }
  };

  const requiredApproved = documentRequirements
    .filter((req) => req.required)
    .every((req) => {
      const doc = getDocStatus(req.type);
      return doc && doc.status === "approved" && (!doc.expiresAt || new Date(doc.expiresAt) > new Date());
    });

  const pendingVerificationCount = documents.filter((doc) => doc.status === "pending").length;

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "760px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          Step 2: Upload Australian Freight Compliance Documents
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          BNT requires approved, current compliance documents before training can be completed or site access can be authorised.
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

      {pendingVerificationCount > 0 && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(217, 119, 6, 0.08)",
            border: "1px solid rgba(217, 119, 6, 0.25)",
            color: "#d97706",
            marginBottom: "20px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <span>⏳</span>
          <div>
            <strong>{pendingVerificationCount} Document(s) Awaiting Compliance Manager Review</strong>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
              Training unlocks once each mandatory document has been verified and approved.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
        {documentRequirements.map((req) => {
          const doc = getDocStatus(req.type);
          const isUploading = uploadingType === req.type;

          return (
            <div
              key={req.type}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "12px",
                background: "var(--bg-elevated, rgba(255,255,255,0.04))",
                border: "1px solid var(--border, #e2e8f0)",
                flexWrap: "wrap"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: "260px" }}>
                <span style={{ fontSize: "1.6rem" }}>{req.icon}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{req.title}</strong>
                    {req.required ? (
                      <span style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "0.7rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px" }}>
                        MANDATORY
                      </span>
                    ) : (
                      <span style={{ background: "rgba(100, 116, 139, 0.1)", color: "#64748b", fontSize: "0.7rem", fontWeight: 600, padding: "2px 6px", borderRadius: "4px" }}>
                        OPTIONAL
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
                    {req.description}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {doc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {doc.status === "approved" && (
                      <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px" }}>
                        ✓ APPROVED
                      </span>
                    )}
                    {doc.status === "pending" && (
                      <span style={{ background: "rgba(217, 119, 6, 0.15)", color: "#d97706", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px" }}>
                        ⏳ PENDING REVIEW
                      </span>
                    )}
                    {doc.status === "rejected" && (
                      <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px" }}>
                        ✕ REJECTED: {doc.rejectionReason || "Re-upload required"}
                      </span>
                    )}
                  </div>
                ) : null}

                <label
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #cbd5e1)",
                    background: doc ? "transparent" : "#1e3a5f",
                    color: doc ? "var(--color-text)" : "#ffffff",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: isUploading ? "wait" : "pointer",
                    opacity: isUploading ? 0.6 : 1
                  }}
                >
                  {isUploading ? "Uploading..." : doc ? "Replace Document" : "Upload File"}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileSelect(req.type, e)}
                    disabled={isUploading || loading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onContinue}
          disabled={!requiredApproved || loading}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: requiredApproved ? "#1e3a5f" : "#94a3b8",
            color: "#ffffff",
            fontWeight: 700,
            cursor: requiredApproved ? "pointer" : "not-allowed"
          }}
        >
          {requiredApproved ? "Proceed to Safety Modules →" : "Await Approval of Required Documents"}
        </button>
      </div>
    </div>
  );
}
