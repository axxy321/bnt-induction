import React from "react";
import { DriverBundle, ComplianceAudit, SOPItem, ComplianceDocumentRequirement, VehicleRecord } from "../../types";
import { ClipboardCheck, GraduationCap, FileText, Truck, ArrowRight, Upload } from "lucide-react";

interface ComplianceDashboardViewProps {
  driverBundle: DriverBundle;
  audits: ComplianceAudit[];
  sops: SOPItem[];
  documents: ComplianceDocumentRequirement[];
  vehicles: VehicleRecord[];
  onNavigateTab: (tab: "dashboard" | "induction" | "documents" | "audits" | "learning" | "vehicles" | "contractor" | "incidents" | "checkin" | "pretrip") => void;
  onStartAudit: (audit: ComplianceAudit) => void;
  onStartSOP: (sop: SOPItem) => void;
  onUploadDoc: (doc: ComplianceDocumentRequirement) => void;
  onOpenGatePass?: () => void;
}

export const ComplianceDashboardView: React.FC<ComplianceDashboardViewProps> = ({
  driverBundle,
  audits,
  sops,
  documents,
  vehicles,
  onNavigateTab,
  onStartAudit,
  onStartSOP,
  onUploadDoc,
  onOpenGatePass
}) => {
  const driverName = driverBundle.driver.fullName || "Driver";
  const approvedDocs = documents.filter((d) => d.status === "Approved").length;
  const passedAudits = audits.filter((a) => a.status === "Passed").length;
  const passedSops = sops.filter((s) => s.status === "Passed").length;
  const totalPercentage = documents.length > 0 ? Math.round((approvedDocs / documents.length) * 100) : 100;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>●</span> CONTRACTING PORTAL • BNT LOGISTICS SITE OPERATIONS
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-heading">
            Welcome back, <span className="text-emerald-400">{driverName}</span>
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            All team members and contractors operating on BNT Logistics depots are required to be fully compliant with our Workplace Health, Safety & Environment standards.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onOpenGatePass && (
              <button
                type="button"
                onClick={onOpenGatePass}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                View Depot Gate Pass (QR)
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab("pretrip")}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-slate-700 flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              Daily Pre-Trip Inspection
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
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">OVERALL STATUS</div>
            <div className="text-sm font-bold text-emerald-400">
              {totalPercentage >= 100 ? "Fully Compliant" : "Action Required"}
            </div>
            <div className="text-xs text-slate-400">{approvedDocs} of {documents.length} Docs Validated</div>
          </div>
        </div>
      </div>

      {/* Quick Summary Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-emerald-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">My Audits</div>
            <div className="text-xl font-bold text-white">{passedAudits} / {audits.length} Passed</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-blue-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">SOP Learning</div>
            <div className="text-xl font-bold text-white">{passedSops} / {sops.length} Passed</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-purple-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Submitted Docs</div>
            <div className="text-xl font-bold text-white">{approvedDocs} / {documents.length} Valid</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl backdrop-blur-md flex items-center gap-4 hover:border-amber-500/40 transition-all">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Active Vehicles</div>
            <div className="text-xl font-bold text-white">{vehicles.filter(v => v.status === "Active").length} Fleet Ready</div>
          </div>
        </div>
      </div>

      {/* 2-Column Assessment & Learning Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">My Audits</h2>
                <p className="text-xs text-slate-400">Compliance & WHS Assessment Modules</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab("audits")}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              <span>View All Audits</span> <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 flex-1 space-y-4">
            {audits.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No compliance audits currently assigned to your account.
              </div>
            ) : (
              audits.map((audit) => (
                <div
                  key={audit.id}
                  className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{audit.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {audit.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{audit.description}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                      <span>Attempts: {audit.attemptsCount}</span>
                      <span>Comments: ({audit.commentsCount})</span>
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
                      {audit.status}
                    </span>
                    <button
                      onClick={() => onStartAudit(audit)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md"
                    >
                      {audit.status === "Passed" ? "Review" : "Start"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* QUADRANT 2: MY LEARNING */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">My Learning</h2>
                <p className="text-xs text-slate-400">SOPs, Policies & Product Inductions ({sops.length} Items)</p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab("learning")}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span>View Full Catalog</span> <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 flex-1 space-y-4 max-h-[420px] overflow-y-auto custom-scrollbar">
            {sops.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No additional SOP modules currently pending for your profile.
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
                      {sop.dueDate && <span className="text-amber-400/90 font-medium">Due: {sop.dueDate}</span>}
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
                      {sop.status}
                    </span>
                    <button
                      onClick={() => onStartSOP(sop)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md"
                    >
                      {sop.status === "Passed" ? "View" : "Start"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* QUADRANT 3: MY DOCUMENTS TO SUBMIT */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 bg-slate-800/60 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">My Documents to Submit</h2>
              <p className="text-xs text-slate-400">Compliance & Insurance Verification ({documents.length} Items)</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab("documents")}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
          >
            <span>Open Document Vault</span> <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5">
          {documents.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No pending documents required. You can upload custom licences or certificates in the Document Vault.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Requirement Name</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Expiry Date</th>
                    <th className="py-3 px-4 font-semibold">History Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
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
                        {doc.expiryDate ? doc.expiryDate : "N/A (Permanent)"}
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
                          {doc.historyStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onUploadDoc(doc)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 text-xs font-semibold transition-all"
                        >
                          {doc.uploadedFileName ? "Update File" : "+ Upload"}
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
    </div>
  );
};
