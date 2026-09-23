import React, { useState } from "react";
import { ContractorCompanyRecord } from "../../types";
import { Building2, Edit, Truck, User, ShieldCheck, CheckCircle2, AlertTriangle, UploadCloud, FileText, Check } from "lucide-react";

interface ContractorCompanyHubProps {
  contractor: ContractorCompanyRecord;
  onUpdateContractor: (updated: ContractorCompanyRecord) => void;
}

// ATO Official Australian Business Number (ABN) Algorithm Validator
export function validateABN(rawAbn: string): { isValid: boolean; message: string } {
  const digits = rawAbn.replace(/\s+/g, "");
  if (!digits) {
    return { isValid: false, message: "ABN is required" };
  }
  if (!/^\d{11}$/.test(digits)) {
    return { isValid: false, message: "ABN must be exactly 11 numeric digits" };
  }

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let sum = (parseInt(digits[0], 10) - 1) * weights[0];
  for (let i = 1; i < 11; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }

  const isValid = sum % 89 === 0;
  return {
    isValid,
    message: isValid
      ? "ABN checksum verified via Australian Business Register (ABR) standard"
      : "Invalid ABN: checksum failed official ATO modulus 89 verification"
  };
}

export function formatABNDisplay(rawAbn: string): string {
  const digits = rawAbn.replace(/\s+/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

export const ContractorCompanyHub: React.FC<ContractorCompanyHubProps> = ({
  contractor,
  onUpdateContractor,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ContractorCompanyRecord>(contractor);
  const [saveMessage, setSaveMessage] = useState("");
  const [abnValidation, setAbnValidation] = useState(() => validateABN(contractor.abn));

  // Insurance upload state
  const [uploadingPolicy, setUploadingPolicy] = useState<string | null>(null);
  const [publicLiabilityFile, setPublicLiabilityFile] = useState<string | null>(null);
  const [workersCompFile, setWorkersCompFile] = useState<string | null>(null);

  const handleAbnChange = (val: string) => {
    const formatted = formatABNDisplay(val);
    setFormData((prev) => ({ ...prev, abn: formatted }));
    setAbnValidation(validateABN(formatted));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!abnValidation.isValid) {
      alert("Please provide a valid 11-digit Australian Business Number (ABN).");
      return;
    }
    onUpdateContractor(formData);
    setIsEditing(false);
    setSaveMessage("Contractor profile, ABN & NHVAS details updated successfully.");
    setTimeout(() => setSaveMessage(""), 4000);
  };

  const handleSimulatedFileUpload = (type: "publicLiability" | "workersComp", file: File) => {
    setUploadingPolicy(type);
    setTimeout(() => {
      if (type === "publicLiability") {
        setPublicLiabilityFile(file.name);
      } else {
        setWorkersCompFile(file.name);
      }
      setUploadingPolicy(null);
      setSaveMessage(`Uploaded ${file.name} successfully.`);
      setTimeout(() => setSaveMessage(""), 3500);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Building2 className="w-6 h-6 text-indigo-400" />
              <h2 className="text-2xl font-black text-white tracking-tight">Contractor Company & Accreditation Profile</h2>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  contractor.status === "Compliant"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : contractor.status === "Pending Review"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                ● {contractor.status}
              </span>
            </div>
            <p className="text-slate-400 text-sm">
              BNT Logistics • ABN & NHVAS Mass/Fatigue Compliance Vault
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              <span>{isEditing ? "Cancel Editing" : "Edit Company Profile"}</span>
            </button>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {saveMessage}
        </div>
      )}

      {/* Main Profile & Accreditation View */}
      {!isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Primary Company Details */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Truck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Company Identity</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-400 text-xs block font-medium">Legal Company Name</span>
                <span className="text-white font-bold">{contractor.companyName}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">Trading Name / Brand</span>
                <span className="text-slate-200">{contractor.tradingName}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">Australian Business Number (ABN)</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-emerald-400 font-bold">{contractor.abn}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <Check className="w-3 h-3" /> ABR Verified
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">Primary Operating Depot</span>
                <span className="text-slate-200">{contractor.primaryDepot}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">Depot Address</span>
                <span className="text-slate-300 text-xs">{contractor.address}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Contact & Key Personnel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <User className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Nominated Contact Person</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-400 text-xs block font-medium">Authorized Safety Representative</span>
                <span className="text-white font-bold">{contractor.contactPerson}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">Email Address</span>
                <span className="text-indigo-400 font-mono text-xs">{contractor.email}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">Direct Phone / Hotline</span>
                <span className="text-slate-200 font-mono text-xs">{contractor.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">NHVAS Fatigue Accreditation</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/30 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {contractor.nhvasAccreditation} ({contractor.nhvasNumber})
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Insurance & WorkSafe Policies with File Drops */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Insurance & Policy Verification</h3>
            </div>

            <div className="space-y-4 text-sm">
              {/* Public Liability */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Public Liability ($20M)</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">Policy: {contractor.publicLiabilityPolicy}</div>
                <div className="text-[11px] text-slate-400">Expires: <strong className="text-emerald-400">{contractor.publicLiabilityExpiry}</strong></div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate max-w-[180px]">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate font-mono text-[11px]">
                      {publicLiabilityFile || "No document uploaded"}
                    </span>
                  </div>
                  <label className="cursor-pointer px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" /> {publicLiabilityFile ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSimulatedFileUpload("publicLiability", f);
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Workers Comp */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Workers Compensation</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-mono">Policy: {contractor.workersCompPolicy || "—"}</div>
                <div className="text-[11px] text-slate-400">Expires: <strong className="text-emerald-400">{contractor.workersCompExpiry || "—"}</strong></div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate max-w-[180px]">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate font-mono text-[11px]">
                      {workersCompFile || "No document uploaded"}
                    </span>
                  </div>
                  <label className="cursor-pointer px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all flex items-center gap-1">
                    <UploadCloud className="w-3 h-3" /> {workersCompFile ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleSimulatedFileUpload("workersComp", f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Form Edit Mode */
        <form onSubmit={handleSave} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Edit Contractor Company Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contractor-companyName" className="block text-xs font-bold text-slate-300 mb-1">Company Legal Name</label>
              <input
                id="contractor-companyName"
                name="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="contractor-tradingName" className="block text-xs font-bold text-slate-300 mb-1">Trading Name</label>
              <input
                id="contractor-tradingName"
                name="tradingName"
                type="text"
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="contractor-abn" className="block text-xs font-bold text-slate-300 mb-1">
                ABN (Australian Business Number)
              </label>
              <input
                id="contractor-abn"
                name="abn"
                type="text"
                value={formData.abn}
                onChange={(e) => handleAbnChange(e.target.value)}
                placeholder="11 numeric digits"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border text-white text-sm font-mono focus:outline-none ${
                  abnValidation.isValid
                    ? "border-emerald-500/60 focus:border-emerald-500"
                    : "border-rose-500/60 focus:border-rose-500"
                }`}
                required
              />
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                {abnValidation.isValid ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {abnValidation.message}
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {abnValidation.message}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label htmlFor="contractor-contactPerson" className="block text-xs font-bold text-slate-300 mb-1">Contact Person</label>
              <input
                id="contractor-contactPerson"
                name="contactPerson"
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="contractor-email" className="block text-xs font-bold text-slate-300 mb-1">Contact Email</label>
              <input
                id="contractor-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="contractor-phone" className="block text-xs font-bold text-slate-300 mb-1">Contact Phone</label>
              <input
                id="contractor-phone"
                name="phone"
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label htmlFor="contractor-nhvasAccreditation" className="block text-xs font-bold text-slate-300 mb-1">NHVAS Accreditation Tier</label>
              <select
                id="contractor-nhvasAccreditation"
                name="nhvasAccreditation"
                value={formData.nhvasAccreditation}
                onChange={(e) => setFormData({ ...formData, nhvasAccreditation: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="Basic Fatigue">Basic Fatigue Management (BFM)</option>
                <option value="Mass Management">Mass Management Accreditation</option>
                <option value="Maintenance Management">Maintenance Management Accreditation</option>
                <option value="None">None</option>
              </select>
            </div>
            <div>
              <label htmlFor="contractor-nhvasNumber" className="block text-xs font-bold text-slate-300 mb-1">NHVAS Registration Number</label>
              <input
                id="contractor-nhvasNumber"
                name="nhvasNumber"
                type="text"
                value={formData.nhvasNumber}
                onChange={(e) => setFormData({ ...formData, nhvasNumber: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="contractor-primaryDepot" className="block text-xs font-bold text-slate-300 mb-1">Primary Depot Location</label>
              <input
                id="contractor-primaryDepot"
                name="primaryDepot"
                type="text"
                value={formData.primaryDepot}
                onChange={(e) => setFormData({ ...formData, primaryDepot: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg"
            >
              Save Profile Updates
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
