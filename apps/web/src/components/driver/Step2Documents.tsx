import React, { useRef, useState, ChangeEvent, DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { DocumentType, UploadedDocument } from "../../types";
import { FileText, Stethoscope, ShieldCheck, AlertTriangle, Clock, Truck, CheckCircle2, Upload, XCircle, Check, Image as ImageIcon, FileBox, CloudUpload } from "lucide-react";

interface Step2DocumentsProps {
  documents: UploadedDocument[];
  onUpload: (type: DocumentType, file: File, onProgress?: (progress: number) => void) => Promise<void>;
  onContinue: () => Promise<void>;
  loading: boolean;
}

interface DocumentRequirement {
  type: DocumentType;
  title: string;
  description: string;
  required: boolean;
  IconComponent: React.ComponentType<{ className?: string }>;
}

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function Step2Documents({ documents, onUpload, onContinue, loading }: Step2DocumentsProps) {
  const { t } = useTranslation();
  const documentRequirements: DocumentRequirement[] = [
    {
      type: "driver_license",
      title: t("doc_licence_title"),
      description: t("doc_licence_desc"),
      required: true,
      IconComponent: FileText
    },
    {
      type: "medical_certificate",
      title: t("doc_medical_title"),
      description: t("doc_medical_desc"),
      required: true,
      IconComponent: Stethoscope
    },
    {
      type: "right_to_work",
      title: t("doc_rtw_title"),
      description: t("doc_rtw_desc"),
      required: true,
      IconComponent: ShieldCheck
    },
    {
      type: "dangerous_goods_license",
      title: t("doc_dg_title"),
      description: t("doc_dg_desc"),
      required: false,
      IconComponent: AlertTriangle
    },
    {
      type: "nhvas_bfm_certificate",
      title: t("doc_fatigue_title"),
      description: t("doc_fatigue_desc"),
      required: false,
      IconComponent: Clock
    },
    {
      type: "hrwl_forklift",
      title: t("doc_forklift_title"),
      description: t("doc_forklift_desc"),
      required: false,
      IconComponent: Truck
    }
  ];
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [uploadCompleteType, setUploadCompleteType] = useState<DocumentType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [dragOverType, setDragOverType] = useState<DocumentType | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const [savingStep, setSavingStep] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getDocStatus = (type: DocumentType) => {
    return documents.find((doc) => doc.type === type);
  };

  const buildPreview = (file: File, type: DocumentType) => {
    if (file.type === "image/jpeg" || file.type === "image/png") {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewMap((prev) => ({ ...prev, [type]: String(reader.result) }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE_BYTES) {
      return t("err_file_size");
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return t("err_file_format");
    }
    return null;
  };

  const startUpload = async (type: DocumentType, file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setErrorMsg(null);
    setUploadingType(type);
    setProgressMap((prev) => ({ ...prev, [type]: 0 }));
    buildPreview(file, type);

    try {
      await onUpload(type, file, (p) => {
        setProgressMap((prev) => ({ ...prev, [type]: p }));
      });
      setProgressMap((prev) => ({ ...prev, [type]: 100 }));
      setUploadCompleteType(type);
      window.setTimeout(() => {
        setUploadCompleteType((current) => current === type ? null : current);
      }, 1800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("err_upload_failed"));
      setProgressMap((prev) => ({ ...prev, [type]: 0 }));
    } finally {
      setUploadingType(null);
      if (fileInputRefs.current[type]) {
        fileInputRefs.current[type]!.value = "";
      }
    }
  };

  const handleFileSelect = (type: DocumentType, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void startUpload(type, file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, type: DocumentType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(type);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, type: DocumentType) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverType === type) {
      setDragOverType(null);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, type: DocumentType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverType(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    void startUpload(type, file);
  };

  const requiredApproved = documentRequirements
    .filter((req) => req.required)
    .every((req) => {
      const doc = getDocStatus(req.type);
      return doc && doc.status === "approved" && (!doc.expiresAt || new Date(doc.expiresAt) > new Date());
    });

  const pendingVerificationCount = documents.filter((doc) => doc.status === "pending").length;

  const getPreviewSrc = (type: DocumentType, doc: UploadedDocument | undefined): string | null => {
    if (previewMap[type]) return previewMap[type];
    if (doc && (doc.mimeType === "image/jpeg" || doc.mimeType === "image/png") && doc.fileUrl) {
      return doc.fileUrl;
    }
    return null;
  };

  const isDragging = (type: DocumentType) => dragOverType === type;
  const isUploading = (type: DocumentType) => uploadingType === type;

  const handleContinue = async () => {
    if (savingStep) return;
    setSavingStep(true);
    setErrorMsg(null);
    try {
      await onContinue();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("err_save_progress"));
    } finally {
      setSavingStep(false);
    }
  };

  return (
    <div className="glass" style={{ padding: "clamp(14px, 4vw, 28px)", borderRadius: "16px", maxWidth: "760px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          {t("s2_title")}
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          {t("s2_sub")}
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
            <strong>{t("s2_pending_banner", { n: pendingVerificationCount })}</strong>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
              {t("s2_pending_note")}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
        {documentRequirements.map((req) => {
          const doc = getDocStatus(req.type);
          const uploading = isUploading(req.type);
          const progress = progressMap[req.type] ?? 0;
          const dragging = isDragging(req.type);
          const previewSrc = getPreviewSrc(req.type, doc);
          const { IconComponent } = req;

          return (
            <div
              key={req.type}
              onDragOver={(e) => handleDragOver(e, req.type)}
              onDragLeave={(e) => handleDragLeave(e, req.type)}
              onDrop={(e) => handleDrop(e, req.type)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "clamp(12px, 3vw, 18px)",
                borderRadius: "12px",
                border: dragging
                  ? "2px dashed #2563eb"
                  : "1px solid var(--border, #cbd5e1)",
                background: dragging
                  ? "rgba(37, 99, 235, 0.06)"
                  : "var(--bg-elevated, #ffffff)",
                flexWrap: "wrap",
                gap: "12px",
                transition: "border-color 0.15s ease, background 0.15s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                {previewSrc ? (
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      flexShrink: 0,
                      border: "1px solid var(--border, #cbd5e1)",
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <img
                      src={previewSrc}
                      alt={req.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : doc && doc.mimeType === "application/pdf" ? (
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
                    <FileBox className="w-5 h-5" />
                  </div>
                ) : (
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
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.95rem" }}>{req.title}</strong>
                    {req.required && (
                      <span style={{ fontSize: "0.72rem", padding: "2px 6px", borderRadius: "4px", background: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>
                        {t("s2_required")}
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ fontSize: "0.82rem", margin: "2px 0 0" }}>
                    {req.description}
                  </p>
                  {doc?.expiresAt && (
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {t("s2_expires", { date: new Date(doc.expiresAt).toLocaleDateString("en-AU") })}
                    </span>
                  )}
                  {uploading && (
                    <div style={{ marginTop: "8px", maxWidth: "280px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#2563eb", marginBottom: "4px", fontWeight: 700 }}>
                        <span>{t("s2_uploading")}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", borderRadius: "999px", background: "rgba(37, 99, 235, 0.15)", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: "100%",
                            borderRadius: "999px",
                            background: "linear-gradient(90deg, #2563eb, #16a34a)",
                            transition: "width 0.25s ease"
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {uploadCompleteType === req.type && (
                  <span className="document-upload-success" role="status">
                    <CheckCircle2 className="document-upload-success-icon" aria-hidden="true" />
                    {t("s2_upload_complete")}
                  </span>
                )}
                {doc ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {doc.status === "approved" && (
                      <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Check className="w-3.5 h-3.5" /> {t("s2_approved")}
                      </span>
                    )}
                    {doc.status === "pending" && (
                      <span style={{ background: "rgba(217, 119, 6, 0.15)", color: "#d97706", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Clock className="w-3.5 h-3.5" /> {t("s2_pending_review")}
                      </span>
                    )}
                    {doc.status === "rejected" && (
                      <span style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <XCircle className="w-3.5 h-3.5" /> {t("s2_rejected")}: {doc.rejectionReason || t("s2_reupload_required")}
                      </span>
                    )}
                  </div>
                ) : null}

                {dragging ? (
                  <div
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "2px dashed #2563eb",
                      background: "rgba(37, 99, 235, 0.1)",
                      color: "#2563eb",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <CloudUpload className="w-4 h-4" /> {t("s2_drop")}
                  </div>
                ) : (
                  <label
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #cbd5e1)",
                      background: doc ? "transparent" : "#1e3a5f",
                      color: doc ? "var(--color-text)" : "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      cursor: uploading || loading ? "wait" : "pointer",
                      opacity: uploading || loading ? 0.6 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? t("s2_uploading") : doc ? (doc.status === "rejected" ? t("s2_reupload") : t("s2_replace")) : t("s2_upload_file")}
                    <input
                      ref={(el) => { fileInputRefs.current[req.type] = el; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileSelect(req.type, e)}
                      disabled={uploading || loading}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!requiredApproved || loading || savingStep}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: requiredApproved ? "#1e3a5f" : "#94a3b8",
            color: "#ffffff",
            fontWeight: 700,
            cursor: requiredApproved ? "pointer" : "not-allowed",
            opacity: savingStep ? 0.7 : 1
          }}
        >
          {savingStep ? t("s2_saving") : requiredApproved ? t("s2_proceed") : t("s2_await")}
        </button>
      </div>
    </div>
  );
}
