import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ComplianceDocumentRequirement } from "../../types";
import { tStatus } from "../../i18n";
import { FileText, Search, Upload, X, AlertTriangle, ShieldCheck } from "lucide-react";

interface DocumentComplianceVaultProps {
  documents: ComplianceDocumentRequirement[];
  onUploadDocument: (
    docId: string,
    fileName: string,
    file: File | null,
    expiryDate: string | null
  ) => void | Promise<void>;
}

function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${dateStr}T00:00:00`);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

function effectiveStatus(
  doc: ComplianceDocumentRequirement
): ComplianceDocumentRequirement["status"] {
  if (doc.status !== "Approved") return doc.status;
  const days = daysUntilExpiry(doc.expiryDate);
  if (days !== null && days < 0) return "Expired";
  return doc.status;
}

function complianceScore(docs: ComplianceDocumentRequirement[]): number {
  const mandatory = docs.filter((d) => d.isMandatory);
  if (mandatory.length === 0) return 0;
  let earned = 0;
  for (const doc of mandatory) {
    const status = effectiveStatus(doc);
    if (status === "Approved") {
      const days = daysUntilExpiry(doc.expiryDate);
      earned += days !== null && days <= 30 ? 0.5 : 1;
    }
  }
  return Math.round((earned / mandatory.length) * 100);
}

function scoreColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 70) return "#f59e0b";
  return "#f43f5e";
}

function ExpiryBadge({ doc }: { doc: ComplianceDocumentRequirement }) {
  const { t } = useTranslation();
  const days = daysUntilExpiry(doc.expiryDate);
  if (days === null) {
    return <span className="font-mono text-slate-200">{t("v_permanent")}</span>;
  }
  const label =
    days < 0
      ? t("status_expired")
      : t(days === 1 ? "v_left_one" : "v_left_other", { count: days });
  const cls =
    days < 0 || days <= 30
      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
      : days <= 90
      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}
      title={doc.expiryDate || undefined}
    >
      {label}
    </span>
  );
}

export const DocumentComplianceVault: React.FC<DocumentComplianceVaultProps> = ({
  documents,
  onUploadDocument,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedDocForUpload, setSelectedDocForUpload] = useState<ComplianceDocumentRequirement | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [simulatedFileName, setSimulatedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { t } = useTranslation();

  const categories: string[] = ["All", "Licence", "Insurance", "Certificates", "SLA / Contract"];

  const catLabel = (cat: string) =>
    cat === "All"
      ? t("v_cat_all")
      : cat === "Licence"
      ? t("v_cat_licence")
      : cat === "Insurance"
      ? t("v_cat_insurance")
      : cat === "Certificates"
      ? t("v_cat_certificates")
      : cat === "SLA / Contract"
      ? t("v_cat_sla")
      : cat;

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const score = complianceScore(documents);
  const ringColor = scoreColor(score);
  const expiringSoon = documents
    .map((doc) => ({ doc, days: daysUntilExpiry(doc.expiryDate) }))
    .filter((item) => item.days !== null && item.days <= 30)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  const handleOpenUpload = (doc: ComplianceDocumentRequirement) => {
    setSelectedDocForUpload(doc);
    setNewExpiryDate(doc.expiryDate || "");
    setSimulatedFileName("");
    setSelectedFile(null);
  };

  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForUpload) return;
    setIsUploading(true);
    try {
      await onUploadDocument(
        selectedDocForUpload.id,
        simulatedFileName || `${selectedDocForUpload.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        selectedFile,
        newExpiryDate || null
      );
      setSelectedDocForUpload(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" /> {t("v_badge")}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {t("v_title", { count: documents.length })}
          </h1>
          <p className="text-slate-400 text-sm">
            {t("v_sub")}
          </p>
        </div>

        {/* Stats Pills + Compliance Score Ring */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center">
            <span className="block font-bold text-lg">
              {documents.filter((d) => effectiveStatus(d) === "Approved").length}
            </span>
            <span>{tStatus("Approved", t)}</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs text-center">
            <span className="block font-bold text-lg">
              {documents.filter((d) => effectiveStatus(d) === "Pending").length}
            </span>
            <span>{tStatus("Pending", t)}</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs text-center">
            <span className="block font-bold text-lg">{documents.filter((d) => d.isMandatory).length}</span>
            <span>{t("v_mandatory")}</span>
          </div>

          {/* Compliance score ring */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke="#1e293b"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9155"
                fill="none"
                stroke={ringColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${score}, 100`}
              />
            </svg>
            <div>
              <div className="text-xl font-extrabold text-white leading-none">{score}%</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">
                {t("v_compliance")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Soon Warning Banner */}
      {expiringSoon.length > 0 && (
        <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-300">
            <span className="font-bold">
              {expiringSoon.some((i) => (i.days ?? 0) < 0)
                ? t("v_expired_now")
                : t("v_expiring")}
            </span>
            <span className="block mt-1">
              {expiringSoon
                .map((i) =>
                  (i.days ?? 0) < 0
                    ? t("v_list_expired", { name: i.doc.name })
                    : t((i.days ?? 0) === 1 ? "v_list_left_one" : "v_list_left_other", {
                        name: i.doc.name,
                        count: i.days ?? 0
                      })
                )
                .join(" • ")}
            </span>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="w-4 h-4 text-purple-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("v_search")}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 w-full sm:w-56"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {(["All", "Licence", "Insurance", "Certificates", "SLA / Contract"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {catLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Compliance Documents Grid View */}
      {filteredDocs.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
          <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">{t("v_empty_title")}</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {t("v_empty_sub", { category: selectedCategory, all: t("v_cat_all") })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const status = effectiveStatus(doc);
            return (
              <div
                key={doc.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300">
                      {doc.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        status === "Approved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : status === "Pending"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {tStatus(status, t)}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base leading-snug flex items-center gap-1.5">
                    {doc.isMandatory && <span className="text-rose-400 text-xs" title={t("v_mandatory")}>●</span>}
                    {doc.name}
                  </h3>

                  <div className="text-xs text-slate-400 space-y-1 pt-1">
                    <div className="flex justify-between items-center gap-2">
                      <span>{t("v_expiry_date")}</span>
                      <ExpiryBadge doc={doc} />
                    </div>
                    <div className="flex justify-between">
                      <span>{t("v_file_status")}</span>
                      <span className="text-slate-300 truncate max-w-[160px]">
                        {doc.uploadedFileName || t("v_no_file")}
                      </span>
                    </div>
                    {doc.rejectionReason && (
                      <div className="flex justify-between gap-2">
                        <span>{t("v_reason")}</span>
                        <span className="text-rose-400 truncate max-w-[160px]" title={doc.rejectionReason}>
                          {doc.rejectionReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {doc.uploadedAt ? t("v_updated", { date: doc.uploadedAt }) : t("v_upload_required")}
                  </span>
                  <button
                    onClick={() => handleOpenUpload(doc)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{doc.uploadedFileName ? t("v_replace") : t("v_upload_file")}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Document Upload */}
      {selectedDocForUpload && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  {t("v_modal_title")}
                </h2>
                <p className="text-xs text-purple-400">{selectedDocForUpload.name}</p>
              </div>
              <button
                onClick={() => setSelectedDocForUpload(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {t("v_select_file")}
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-6 text-center cursor-pointer bg-slate-800/50 transition-colors">
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-300 block font-medium">{t("v_drag_drop")}</span>
                  <input
                    type="file"
                    className="hidden"
                    id="file-upload-input"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setSimulatedFileName(e.target.files[0].name);
                      }
                    }}
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t("v_select_local")}
                  </label>
                  {simulatedFileName && (
                    <div className="mt-2 text-xs text-emerald-400 font-medium">{t("v_selected", { name: simulatedFileName })}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  {t("v_expiry_label")}
                </label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDocForUpload(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  {t("v_cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? t("v_uploading") : t("v_submit_verify")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
