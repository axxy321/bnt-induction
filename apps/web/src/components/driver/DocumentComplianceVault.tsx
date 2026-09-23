import React, { useState } from "react";
import { ComplianceDocumentRequirement } from "../../types";
import { FileText, Search, Upload, X, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Filter } from "lucide-react";

interface DocumentComplianceVaultProps {
  documents: ComplianceDocumentRequirement[];
  onUploadDocument: (docId: string, fileName: string, expiryDate: string | null) => void;
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
  const [isUploading, setIsUploading] = useState(false);

  const categories: string[] = ["All", "Licence", "Insurance", "Certificates", "SLA / Contract"];

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenUpload = (doc: ComplianceDocumentRequirement) => {
    setSelectedDocForUpload(doc);
    setNewExpiryDate(doc.expiryDate || "");
    setSimulatedFileName("");
  };

  const handleConfirmUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocForUpload) return;
    setIsUploading(true);

    setTimeout(() => {
      onUploadDocument(
        selectedDocForUpload.id,
        simulatedFileName || `${selectedDocForUpload.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        newExpiryDate || null
      );
      setIsUploading(false);
      setSelectedDocForUpload(null);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5" /> Compliance Document Vault • BNT Logistics Standard
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            My Documents to Submit ({documents.length} Items)
          </h1>
          <p className="text-slate-400 text-sm">
            Upload and maintain mandatory licenses, liability insurance, police clearances, and signed SLAs for BNT Logistics site clearance.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs text-center">
            <span className="block font-bold text-lg">{documents.filter((d) => d.status === "Approved").length}</span>
            <span>Approved</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs text-center">
            <span className="block font-bold text-lg">{documents.filter((d) => d.status === "Pending").length}</span>
            <span>Pending</span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs text-center">
            <span className="block font-bold text-lg">{documents.filter((d) => d.isMandatory).length}</span>
            <span>Mandatory</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Filter Category:</span>
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
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Compliance Documents Grid View */}
      {filteredDocs.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
          <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Documents Match Your Filter</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            No compliance requirements found for category "{selectedCategory}". Select "All" to view all records.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
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
                    doc.status === "Approved"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : doc.status === "Pending"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {doc.historyStatus}
                </span>
              </div>

              <h3 className="font-bold text-white text-base leading-snug flex items-center gap-1.5">
                {doc.isMandatory && <span className="text-rose-400 text-xs" title="Mandatory Requirement">●</span>}
                {doc.name}
              </h3>

              <div className="text-xs text-slate-400 space-y-1 pt-1">
                <div className="flex justify-between">
                  <span>Expiry Date:</span>
                  <span className="font-mono text-slate-200">{doc.expiryDate || "Permanent / No Expiry"}</span>
                </div>
                <div className="flex justify-between">
                  <span>File Status:</span>
                  <span className="text-slate-300 truncate max-w-[160px]">
                    {doc.uploadedFileName || "No File Attached"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">
                {doc.uploadedAt ? `Updated ${doc.uploadedAt}` : "Upload required"}
              </span>
              <button
                onClick={() => handleOpenUpload(doc)}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{doc.uploadedFileName ? "Replace File" : "Upload File"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Modal for Document Upload */}
      {selectedDocForUpload && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Upload Compliance Document</h2>
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
                  Select File (PDF, PNG, JPG)
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-6 text-center cursor-pointer bg-slate-800/50 transition-colors">
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-300 block font-medium">Drag and drop file here or click to browse</span>
                  <input
                    type="file"
                    className="hidden"
                    id="file-upload-input"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSimulatedFileName(e.target.files[0].name);
                      }
                    }}
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Select Local File
                  </label>
                  {simulatedFileName && (
                    <div className="mt-2 text-xs text-emerald-400 font-medium">Selected: {simulatedFileName}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Document Expiry Date (If applicable)
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2"
                >
                  {isUploading ? "Uploading..." : "Submit for Verification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
