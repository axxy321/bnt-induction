import React from "react";
import { useTranslation } from "react-i18next";
import { DriverBundle, AuditAssignment, SOPItem, ComplianceDocumentRequirement, VehicleRecord, PolicyRecord } from "../../types";
import { ClipboardCheck, GraduationCap, FileText, Truck, ArrowRight, Upload, FileSignature } from "lucide-react";
import { tStatus } from "../../i18n";
import { FadeIn } from "../ui/FadeIn";

interface ComplianceDashboardViewProps {
  driverBundle: DriverBundle;
  audits: AuditAssignment[];
  sops: SOPItem[];
  documents: ComplianceDocumentRequirement[];
  vehicles: VehicleRecord[];
  policies?: PolicyRecord[];
  onNavigateTab: (tab: "dashboard" | "induction" | "documents" | "audits" | "learning" | "vehicles" | "contractor" | "incidents" | "checkin" | "pretrip") => void;
  onStartAudit: (assignment: AuditAssignment) => void;
  onStartSOP: (sop: SOPItem) => void;
  onUploadDoc: (doc: ComplianceDocumentRequirement) => void;
  onOpenGatePass?: () => void;
  onSignPolicy?: (policy: PolicyRecord) => void;
}

export const ComplianceDashboardView: React.FC<ComplianceDashboardViewProps> = ({
  driverBundle,
  audits,
  sops,
  documents,
  vehicles,
  policies = [],
  onNavigateTab,
  onStartAudit,
  onStartSOP,
  onUploadDoc,
  onOpenGatePass,
  onSignPolicy
}) => {
  const { t } = useTranslation();
  const driverName = driverBundle.driver.fullName || t("common_driver");
  const approvedDocs = documents.filter((d) => d.status === "Approved").length;
  const passedAudits = audits.filter((a) => a.status === "Passed").length;
  const passedSops = sops.filter((s) => s.status === "Passed").length;
  const totalPercentage = documents.length > 0 ? Math.round((approvedDocs / documents.length) * 100) : 100;
  const unsignedPolicies = policies.filter((p) => !p.signed && p.versionId);

  return (
    <div className="driver-dashboard space-y-8 animate-fadeIn">
      {/* Welcome Hero Banner */}
      <FadeIn>
      <div className="dashboard-hero bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>●</span> {t("dash_banner")}
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-heading">
            {t("dash_welcome")} <span className="gradient-text">{driverName}</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            {t("dash_welcome_sub")}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onOpenGatePass && (
              <button
                type="button"
                onClick={onOpenGatePass}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                {t("dash_gate_pass")}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab("pretrip")}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              {t("dash_pretrip")}
            </button>
          </div>
        </div>

        {/* Status Circular Meter */}
        <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700/60 p-4 rounded-2xl shrink-0 self-start md:self-auto backdrop-blur-md">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-700"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-400"
                strokeDasharray={`${totalPercentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-sm font-black text-white font-mono">{totalPercentage}%</span>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("dash_overall")}</div>
            <div className="text-sm font-bold text-emerald-400">
              {totalPercentage >= 100 ? t("dash_fully_compliant") : t("dash_action_required")}
            </div>
            <div className="text-xs text-slate-400">{t("dash_docs_validated", { x: approvedDocs, y: documents.length })}</div>
          </div>
        </div>
      </div>
      </FadeIn>

      {/* Policy Signature Banner */}
      {unsignedPolicies.length > 0 && onSignPolicy && (
        <div
          className="bg-amber-500/10 border border-amber-500/40 p-4 md:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn"
          style={{ boxShadow: "0 8px 30px rgba(217,119,6,0.12)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-300">
                {t("policy_banner", { count: unsignedPolicies.length })}
              </div>
              <div className="text-xs text-slate-300 truncate">
                {unsignedPolicies.map((p) => `${p.name} (v${p.versionLabel})`).join(", ")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSignPolicy(unsignedPolicies[0])}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-2 shrink-0"
          >
            <FileSignature className="w-4 h-4" />
            {t("policy_banner_sign")}
          </button>
        </div>
      )}

      {/* Quick Summary Cards Row */}
      <FadeIn delay={0.05}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="dashboard-stat-card lift-hover bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-emerald-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">{t("dash_my_audits")}</div>
            <div className="text-xl font-bold text-white">{passedAudits} / {audits.length} {t("dash_passed")}</div>
          </div>
        </div>

        <div className="dashboard-stat-card lift-hover bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-blue-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">{t("dash_sop_learning")}</div>
            <div className="text-xl font-bold text-white">{passedSops} / {sops.length} {t("dash_passed")}</div>
          </div>
        </div>

        <div className="dashboard-stat-card lift-hover bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-purple-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">{t("dash_submitted_docs")}</div>
            <div className="text-xl font-bold text-white">{approvedDocs} / {documents.length} {t("dash_valid")}</div>
          </div>
        </div>

        <div className="dashboard-stat-card lift-hover bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-amber-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">{t("dash_active_vehicles")}</div>
            <div className="text-xl font-bold text-white">{vehicles.filter(v => v.status === "Active").length} {t("dash_fleet_ready")}</div>
          </div>
        </div>
      </div>
      </FadeIn>

      {/* 2-Column Assessment & Learning Row */}
      <FadeIn delay={0.1}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="dashboard-panel bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t("dash_my_audits")}</h2>
                <p className="text-xs text-slate-400">{t("dash_audits_sub")}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab("audits")}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              <span>{t("dash_view_all_audits")}</span> <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 flex-1 space-y-4">
            {audits.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                {t("dash_no_audits")}
              </div>
            ) : (
              audits.map((audit) => (
                <div
                  key={audit.id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                   <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{audit.audit.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {audit.audit.category}
                      </span>
                    </div>
                    {audit.audit.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{audit.audit.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <span>{t("dash_attempts", { n: audit.attemptsCount })}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        audit.status === "Passed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : audit.status === "In Progress"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-slate-700/50 text-slate-300 border border-slate-600"
                      }`}
                    >
                      {tStatus(audit.status, t)}
                    </span>
                    <button
                      onClick={() => onStartAudit(audit)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md"
                    >
                      {audit.status === "Passed" ? t("dash_review") : t("dash_start")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* QUADRANT 2: MY LEARNING */}
        <div className="dashboard-panel bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{t("dash_my_learning")}</h2>
                <p className="text-xs text-slate-400">{t("dash_learning_sub", { n: sops.length })}</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab("learning")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span>{t("dash_view_catalog")}</span> <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 flex-1 space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar">
            {sops.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                {t("dash_no_sops")}
              </div>
            ) : (
              sops.slice(0, 6).map((sop) => (
                <div
                  key={sop.id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-blue-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{sop.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {sop.category}
                      </span>
                      {sop.dueDate && <span className="text-amber-400/90 font-medium">{t("dash_due", { date: sop.dueDate })}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        sop.status === "Passed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-700/50 text-slate-300 border border-slate-600"
                      }`}
                    >
                      {tStatus(sop.status, t)}
                    </span>
                    <button
                      onClick={() => onStartSOP(sop)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md"
                    >
                      {sop.status === "Passed" ? t("dash_view") : t("dash_start")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </FadeIn>

      {/* QUADRANT 3: MY DOCUMENTS TO SUBMIT */}
      <FadeIn delay={0.15}>
      <div className="dashboard-panel bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 bg-slate-800/60 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t("dash_docs_title")}</h2>
              <p className="text-xs text-slate-400">{t("dash_docs_sub", { n: documents.length })}</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("documents")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
          >
            <span>{t("dash_open_vault")}</span> <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          {documents.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                {t("dash_no_docs")}
              </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">{t("dash_th_name")}</th>
                    <th className="py-3 px-4 font-semibold">{t("dash_th_category")}</th>
                    <th className="py-3 px-4 font-semibold">{t("dash_th_expiry")}</th>
                    <th className="py-3 px-4 font-semibold">{t("dash_th_history")}</th>
                    <th className="py-3 px-4 font-semibold text-right">{t("dash_th_action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {documents.slice(0, 7).map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <span className={doc.isMandatory ? "text-rose-400" : "text-slate-500"}>●</span>
                        {doc.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-1 rounded text-xs bg-slate-800 border border-slate-700 text-slate-300">
                          {doc.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-300">
                        {doc.expiryDate ? doc.expiryDate : t("dash_na_permanent")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            doc.status === "Approved"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : doc.status === "Pending"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {tStatus(doc.historyStatus, t)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onUploadDoc(doc)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 text-xs font-semibold transition-all"
                        >
                          {doc.uploadedFileName ? t("dash_update_file") : t("dash_upload")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </FadeIn>
    </div>
  );
};
