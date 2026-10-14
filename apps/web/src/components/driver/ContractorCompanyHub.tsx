import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ContractorCompanyRecord } from "../../types";
import { tStatus } from "../../i18n";
import { Building2, Edit, Truck, User, ShieldCheck, CheckCircle2, AlertTriangle, UploadCloud, FileText, Check, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { computeContractorStatus, daysUntil, formatABNDisplay, validateABN } from "../../lib/contractorUtils";

interface ContractorCompanyHubProps {
  contractor: ContractorCompanyRecord;
  onUpdateContractor: (updated: ContractorCompanyRecord) => void | Promise<void>;
  userId?: string;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  green: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  amber: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
  red: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
  grey: "bg-slate-500/10 text-slate-400 border border-slate-500/30"
};

export const ContractorCompanyHub: React.FC<ContractorCompanyHubProps> = ({
  contractor,
  onUpdateContractor,
  userId,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ContractorCompanyRecord>(contractor);
  const [saveMessage, setSaveMessage] = useState("");
  const [abnValidation, setAbnValidation] = useState(() => validateABN(contractor.abn));
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  const abnMsg = (msg: string) =>
    msg.startsWith("ABN checksum")
      ? t("cnt_abn_verified")
      : msg.startsWith("Invalid ABN")
      ? t("cnt_abn_invalid")
      : msg.startsWith("ABN must")
      ? t("cnt_abn_digits")
      : t("cnt_abn_required");

  const tierLabel = (tier: string) =>
    tier === "Basic Fatigue"
      ? t("cnt_tier_bfm")
      : tier === "Mass Management"
      ? t("cnt_tier_mass")
      : tier === "Maintenance Management"
      ? t("cnt_tier_maint")
      : tier === "None"
      ? t("cnt_tier_none")
      : tier;

  // Insurance upload state
  const [uploadingPolicy, setUploadingPolicy] = useState<string | null>(null);

  const contractorStatus = computeContractorStatus(contractor);
  const plDays = daysUntil(contractor.publicLiabilityExpiry);
  const wcDays = daysUntil(contractor.workersCompExpiry);

  const handleAbnChange = (val: string) => {
    const formatted = formatABNDisplay(val);
    setFormData((prev) => ({ ...prev, abn: formatted }));
    setAbnValidation(validateABN(formatted));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abnValidation.isValid) {
      alert(t("cnt_abn_required_alert"));
      return;
    }
    setSaving(true);
    try {
      await onUpdateContractor(formData);
      setIsEditing(false);
      setSaveMessage(t("cnt_saved"));
      setTimeout(() => setSaveMessage(""), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Upload a real insurance/accreditation document to cloud storage.
  // The upload is saved immediately so it survives even if the form is closed.
  const handlePolicyUpload = async (type: "publicLiability" | "workersComp", file: File) => {
    setUploadingPolicy(type);
    try {
      if (!userId) {
        alert(t("cnt_login_upload"));
        return;
      }
      const url = await api.uploadContractorDocument(userId, type, file);
      const updated = {
        ...formData,
        ...(type === "publicLiability"
          ? { publicLiabilityFileUrl: url }
          : { workersCompFileUrl: url })
      };
      setFormData(updated);
      await onUpdateContractor(updated);
      setSaveMessage(t("cnt_uploaded", { name: file.name }));
      setTimeout(() => setSaveMessage(""), 3500);
    } catch {
      alert(t("cnt_upload_failed"));
    } finally {
      setUploadingPolicy(null);
    }
  };

  // Warning line under a policy when its expiry date is passed or near.
  const policyWarning = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) {
      return (
        <div className="text-[11px] text-rose-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {t(Math.abs(days) === 1 ? "cnt_expired_ago_one" : "cnt_expired_ago_other", { count: Math.abs(days) })}
        </div>
      );
    }
    if (days <= 30) {
      return (
        <div className="text-[11px] text-amber-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {t(days === 1 ? "cnt_expires_in_one" : "cnt_expires_in_other", { count: days })}
        </div>
      );
    }
    return null;
  };

  const policyStateBadge = (days: number | null) => {
    if (days !== null && days < 0) {
      return (
        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
          {tStatus("Expired", t)}
        </span>
      );
    }
    if (days !== null && days <= 30) {
      return (
        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
          {tStatus("Expiring Soon", t)}
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
        {tStatus("Active", t)}
      </span>
    );
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
              <h2 className="text-2xl font-black text-white tracking-tight">{t("cnt_title")}</h2>
              <span className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_BADGE_STYLES[contractorStatus.tone]}`}>
                ● {tStatus(contractorStatus.label, t)}
              </span>
            </div>
            <p className="text-slate-400 text-sm">
              {t("cnt_sub")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              <span>{isEditing ? t("cnt_cancel_edit") : t("cnt_edit")}</span>
            </button>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" /> {saveMessage}
        </div>
      )}

      {/* Main Profile & Accreditation View */}
      {!isEditing ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Primary Company Details */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Truck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">{t("cnt_card1")}</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_legal_name")}</span>
                <span className="text-white font-bold">{contractor.companyName || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_trading_name")}</span>
                <span className="text-slate-200">{contractor.tradingName || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_abn")}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-emerald-400 font-bold">{contractor.abn || "—"}</span>
                  {contractor.abn && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <Check className="w-3 h-3" /> {t("cnt_abr_verified")}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_primary_depot")}</span>
                <span className="text-slate-200">{contractor.primaryDepot || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_depot_address")}</span>
                <span className="text-slate-300 text-xs">{contractor.address || "—"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Contact & Key Personnel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <User className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">{t("cnt_card2")}</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_auth_rep")}</span>
                <span className="text-white font-bold">{contractor.contactPerson || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_email")}</span>
                <span className="text-indigo-400 font-mono text-xs">{contractor.email || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_phone")}</span>
                <span className="text-slate-200 font-mono text-xs">{contractor.phone || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block font-medium">{t("cnt_nhvas_accred")}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/30 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> {tierLabel(contractor.nhvasAccreditation)} ({contractor.nhvasNumber || "—"})
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Insurance & WorkSafe Policies with File Drops */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">{t("cnt_card3")}</h3>
            </div>

            <div className="space-y-4 text-sm">
              {/* Public Liability */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-white">{t("cnt_pl")}</span>
                  {policyStateBadge(plDays)}
                </div>
                 <div className="text-xs text-slate-300 font-mono">{t("cnt_policy", { policy: contractor.publicLiabilityPolicy || "—" })}</div>
                 <div className="text-[11px] text-slate-400">
                   {t("cnt_expires")}{" "}
                   <strong className={plDays !== null && plDays < 0 ? "text-rose-400" : "text-emerald-400"}>
                     {contractor.publicLiabilityExpiry || "—"}
                   </strong>
                 </div>
                {policyWarning(plDays)}

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                   {contractor.publicLiabilityFileUrl ? (
                     <a
                       href={contractor.publicLiabilityFileUrl}
                       target="_blank"
                       rel="noreferrer"
                       className="flex items-center gap-1.5 text-xs text-indigo-400 truncate max-w-[180px] hover:text-indigo-300"
                     >
                       <FileText className="w-3.5 h-3.5 shrink-0" />
                       <span className="truncate font-mono text-[11px]">{t("cnt_view_doc")}</span>
                     </a>
                   ) : (
                     <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate max-w-[180px]">
                       <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                       <span className="truncate font-mono text-[11px]">{t("cnt_no_doc")}</span>
                     </div>
                   )}
                  <label className="cursor-pointer px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all flex items-center gap-1">
                    {uploadingPolicy === "publicLiability" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3 h-3" />
                    )}
                     {contractor.publicLiabilityFileUrl ? t("cnt_replace") : t("cnt_upload")}
                     <input
                       type="file"
                       accept=".pdf,.png,.jpg,.jpeg"
                       className="hidden"
                       disabled={uploadingPolicy !== null || !userId}
                       onChange={(e) => {
                         const f = e.target.files?.[0];
                         if (f) handlePolicyUpload("publicLiability", f);
                         e.target.value = "";
                       }}
                     />
                  </label>
                </div>
              </div>

              {/* Workers Comp */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-white">{t("cnt_wc")}</span>
                  {policyStateBadge(wcDays)}
                </div>
                 <div className="text-xs text-slate-300 font-mono">{t("cnt_policy", { policy: contractor.workersCompPolicy || "—" })}</div>
                 <div className="text-[11px] text-slate-400">
                   {t("cnt_expires")}{" "}
                   <strong className={wcDays !== null && wcDays < 0 ? "text-rose-400" : "text-emerald-400"}>
                     {contractor.workersCompExpiry || "—"}
                   </strong>
                 </div>
                {policyWarning(wcDays)}

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/40">
                   {contractor.workersCompFileUrl ? (
                     <a
                       href={contractor.workersCompFileUrl}
                       target="_blank"
                       rel="noreferrer"
                       className="flex items-center gap-1.5 text-xs text-indigo-400 truncate max-w-[180px] hover:text-indigo-300"
                     >
                       <FileText className="w-3.5 h-3.5 shrink-0" />
                       <span className="truncate font-mono text-[11px]">{t("cnt_view_doc")}</span>
                     </a>
                   ) : (
                     <div className="flex items-center gap-1.5 text-xs text-slate-300 truncate max-w-[180px]">
                       <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                       <span className="truncate font-mono text-[11px]">{t("cnt_no_doc")}</span>
                     </div>
                   )}
                  <label className="cursor-pointer px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all flex items-center gap-1">
                    {uploadingPolicy === "workersComp" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3 h-3" />
                    )}
                     {contractor.workersCompFileUrl ? t("cnt_replace") : t("cnt_upload")}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      disabled={uploadingPolicy !== null || !userId}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePolicyUpload("workersComp", f);
                        e.target.value = "";
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
          <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">{t("cnt_edit_form_title")}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label htmlFor="contractor-companyName" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_company")}</label>
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
               <label htmlFor="contractor-tradingName" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_trading")}</label>
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
                 {t("cnt_field_abn")}
              </label>
              <input
                id="contractor-abn"
                name="abn"
                type="text"
                value={formData.abn}
                onChange={(e) => handleAbnChange(e.target.value)}
                 placeholder={t("cnt_abn_ph")}
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
                     <CheckCircle2 className="w-3 h-3" /> {abnMsg(abnValidation.message)}
                   </span>
                 ) : (
                   <span className="text-rose-400 flex items-center gap-1">
                     <AlertTriangle className="w-3 h-3" /> {abnMsg(abnValidation.message)}
                  </span>
                )}
              </div>
            </div>
            <div>
               <label htmlFor="contractor-contactPerson" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_contact")}</label>
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
               <label htmlFor="contractor-email" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_email")}</label>
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
               <label htmlFor="contractor-phone" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_phone")}</label>
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
               <label htmlFor="contractor-nhvasAccreditation" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_tier")}</label>
              <select
                id="contractor-nhvasAccreditation"
                name="nhvasAccreditation"
                value={formData.nhvasAccreditation}
                onChange={(e) => setFormData({ ...formData, nhvasAccreditation: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                 <option value="Basic Fatigue">{t("cnt_tier_bfm")}</option>
                 <option value="Mass Management">{t("cnt_tier_mass")}</option>
                 <option value="Maintenance Management">{t("cnt_tier_maint")}</option>
                 <option value="None">{t("cnt_tier_none")}</option>
              </select>
            </div>
            <div>
               <label htmlFor="contractor-nhvasNumber" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_nhvas_num")}</label>
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
               <label htmlFor="contractor-primaryDepot" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_depot")}</label>
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
            <div className="md:col-span-2">
               <label htmlFor="contractor-address" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_address")}</label>
              <input
                id="contractor-address"
                name="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
               <label htmlFor="contractor-plPolicy" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_pl_policy")}</label>
              <input
                id="contractor-plPolicy"
                name="publicLiabilityPolicy"
                type="text"
                value={formData.publicLiabilityPolicy}
                onChange={(e) => setFormData({ ...formData, publicLiabilityPolicy: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
               <label htmlFor="contractor-plExpiry" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_pl_expiry")}</label>
              <input
                id="contractor-plExpiry"
                name="publicLiabilityExpiry"
                type="date"
                value={formData.publicLiabilityExpiry || ""}
                onChange={(e) => setFormData({ ...formData, publicLiabilityExpiry: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
               <label htmlFor="contractor-wcPolicy" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_wc_policy")}</label>
              <input
                id="contractor-wcPolicy"
                name="workersCompPolicy"
                type="text"
                value={formData.workersCompPolicy}
                onChange={(e) => setFormData({ ...formData, workersCompPolicy: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
               <label htmlFor="contractor-wcExpiry" className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_field_wc_expiry")}</label>
              <input
                id="contractor-wcExpiry"
                name="workersCompExpiry"
                type="date"
                value={formData.workersCompExpiry || ""}
                onChange={(e) => setFormData({ ...formData, workersCompExpiry: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="md:col-span-2">
               <label className="block text-xs font-bold text-slate-300 mb-1">{t("cnt_docs_label")}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="cursor-pointer px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:border-indigo-500 flex items-center gap-2">
                  {uploadingPolicy === "publicLiability" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                   <span className="truncate">
                     {uploadingPolicy === "publicLiability"
                       ? t("cnt_uploading")
                       : formData.publicLiabilityFileUrl
                       ? t("cnt_replace_pl")
                       : t("cnt_upload_pl")}
                   </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={uploadingPolicy !== null || !userId}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePolicyUpload("publicLiability", f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="cursor-pointer px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold hover:border-indigo-500 flex items-center gap-2">
                  {uploadingPolicy === "workersComp" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                   <span className="truncate">
                     {uploadingPolicy === "workersComp"
                       ? t("cnt_uploading")
                       : formData.workersCompFileUrl
                       ? t("cnt_replace_wc")
                       : t("cnt_upload_wc")}
                   </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    disabled={uploadingPolicy !== null || !userId}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePolicyUpload("workersComp", f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
               <p className="text-[11px] text-slate-500 mt-1">
                 {t("cnt_docs_note")}
               </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold"
            >
               {t("cnt_cancel")}
             </button>
             <button
               type="submit"
               disabled={saving}
               className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg flex items-center gap-2"
             >
               {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
               {saving ? t("cnt_saving") : t("cnt_save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
