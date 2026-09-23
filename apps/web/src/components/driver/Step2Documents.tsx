import React, { useState, ChangeEvent } from "react";
import { DocumentType, UploadedDocument } from "../../types";
import { FileText, Stethoscope, ShieldCheck, AlertTriangle, Clock, Truck, CheckCircle2, Upload, XCircle, Check } from "lucide-react";

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
  IconComponent: React.ComponentType<{ className?: string }>;
}

const documentRequirements: DocumentRequirement[] = [
  {
    type: "driver_license",
    title: "Heavy Vehicle Driver Licence",
    description: "Front & back scan of your current HC, MC, HR, or MR driver licence.",
    required: true,
    IconComponent: FileText
  },
  {
    type: "medical_certificate",
    title: "Commercial Driver Medical Certificate",
    description: "Current Fitness to Drive medical assessment under Austroads guidelines.",
    required: true,
    IconComponent: Stethoscope
  },
  {
    type: "right_to_work",
    title: "Right to Work / VEVO Check",
    description: "Australian Passport, Birth Certificate, or VEVO Work Visa confirmation.",
    required: true,
    IconComponent: ShieldCheck
  },
  {
    type: "dangerous_goods_license",
    title: "Dangerous Goods (DG) Licence",
    description: "Mandatory if transporting hazardous substances or dangerous bulk cargo.",
    required: false,
    IconComponent: AlertTriangle
  },
  {
    type: "nhvas_bfm_certificate",
    title: "Fatigue Arrangement Evidence",
    description: "Provide current operator evidence only where your assigned task requires an accredited fatigue arrangement.",
    required: false,
    IconComponent: Clock
  },
  {
    type: "hrwl_forklift",
    title: "High Risk Work Licence (Forklift LF)",
    description: "HRWL Forklift Endorsement if operating yard equipment or self-loading.",
    required: false,
    IconComponent: Truck
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
            borderRadius: "10px",
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
          <Clock className="w-5 h-5 flex-shrink-0 text-amber-500" />
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
          const { IconComponent } = req;

          return (
            <div
              key={req.type}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "var(--bg-elevated, #ffffff)",
                flexWrap: "wrap",
                gap: "12px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: doc?.status === "approved" ? "rgba(34, 197, 94, 0.12)" : "rgba(37, 99, 235, 0.08)",
                    color: doc?.status === "approved" ? "#16a34a" : "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{req.title}</strong>
                    {req.required && (
                      <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "4px", background: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>
                        Required
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ fontSize: "0.82rem", margin: "2px 0 0" }}>
                    {req.description}
                  </p>
                  {doc?.expiresAt && (
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Expires: {new Date(doc.expiresAt).toLocaleDateString("en-AU")}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {doc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {doc.status === "approved" && (
                      <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Check className="w-3.5 h-3.5" /> APPROVED
                      </span>
                    )}
                    {doc.status === "pending" && (
                      <span style={{ background: "rgba(217, 119, 6, 0.15)", color: "#d97706", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Clock className="w-3.5 h-3.5" /> PENDING REVIEW
                      </span>
                    )}
                    {doc.status === "rejected" && (
                      <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <XCircle className="w-3.5 h-3.5" /> REJECTED: {doc.rejectionReason || "Re-upload required"}
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
