import React, { useState } from "react";
import { ComplianceAudit, SOPItem } from "../../types";
import { ClipboardCheck, GraduationCap, FileText, CheckCircle2, Clock, Play, MessageSquare, Award, X, ArrowRight } from "lucide-react";

interface AuditAndSOPManagerProps {
  audits: ComplianceAudit[];
  sops: SOPItem[];
  activeTab: "audits" | "learning";
  onCompleteAudit: (auditId: string) => void;
  onCompleteSOP: (sopId: string) => void;
}

export const AuditAndSOPManager: React.FC<AuditAndSOPManagerProps> = ({
  audits,
  sops,
  activeTab,
  onCompleteAudit,
  onCompleteSOP,
}) => {
  const [currentView, setCurrentView] = useState<"audits" | "learning">(activeTab);
  const [activeAuditModal, setActiveAuditModal] = useState<ComplianceAudit | null>(null);
  const [activeSOPModal, setActiveSOPModal] = useState<SOPItem | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [auditAnswers, setAuditAnswers] = useState<Record<number, boolean>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const sampleAuditQuestions = [
    "Driver holds current heavy vehicle licence class valid for assigned rig?",
    "Pre-trip vehicle circle check completed and registered in maintenance log?",
    "3-Point contact rule understood for cabin entry & egress?",
    "Load restraint rating meets National Transport Commission Heavy Vehicle Code?",
    "Fatigue management rest hours logged and verified within maximum legal limits?",
  ];

  const handleAuditSubmit = () => {
    if (!activeAuditModal) return;
    onCompleteAudit(activeAuditModal.id);
    setActiveAuditModal(null);
    setAuditAnswers({});
  };

  const handleSOPQuizSubmit = () => {
    if (!activeSOPModal) return;
    setQuizScore(100);
    setTimeout(() => {
      onCompleteSOP(activeSOPModal.id);
      setActiveSOPModal(null);
      setQuizScore(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {currentView === "audits" ? "My Compliance Audits & Checks" : "My Learning SOPs & Policies"}
          </h1>
          <p className="text-slate-400 text-sm">
            {currentView === "audits"
              ? "Complete mandatory transport safety audits and work health safety compliance checks."
              : "Review standard operating procedures, safety videos, and policy modules required for BNT Logistics sites."}
          </p>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800 border border-slate-700">
          <button
            onClick={() => setCurrentView("audits")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              currentView === "audits" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" /> My Audits ({audits.length})
          </button>
          <button
            onClick={() => setCurrentView("learning")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              currentView === "learning" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> My Learning ({sops.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: AUDITS GRID */}
      {currentView === "audits" && (
        audits.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
            <ClipboardCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Compliance Audits Assigned</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your profile currently has no pending transport safety audits or annual compliance checks.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {audits.map((audit) => (
              <div
                key={audit.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      {audit.category}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        audit.status === "Passed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : audit.status === "In Progress"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {audit.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white leading-snug">{audit.name}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{audit.description}</p>

                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Assigned Module:</span>
                      <span className="font-semibold text-white">{audit.assignedModule}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Attempts:</span>
                      <span>{audit.attemptsCount} Attempts</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> {audit.commentsCount} Comments logged
                  </span>
                  <button
                    onClick={() => setActiveAuditModal(audit)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg"
                  >
                    {audit.status === "Passed" ? "Review Audit" : "Start Audit Assessment"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* VIEW 2: LEARNING SOPS GRID */}
      {currentView === "learning" && (
        sops.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
            <GraduationCap className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Learning SOPs Pending</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              You are up to date on all standard operating procedures and required learning modules.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sops.map((sop) => (
            <div
              key={sop.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    {sop.category}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      sop.status === "Passed"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {sop.status}
                  </span>
                </div>

                <div className="text-xs font-mono text-blue-400 font-bold">{sop.code}</div>
                <h3 className="text-lg font-bold text-white leading-snug">{sop.name}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{sop.contentSummary}</p>

                {sop.dueDate && (
                  <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Due for Renewal: {sop.dueDate}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">{sop.quizQuestionsCount} Interactive Questions</span>
                <button
                  onClick={() => setActiveSOPModal(sop)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg"
                >
                  {sop.status === "Passed" ? "Review Module" : "Start Learning"}
                </button>
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* AUDIT MODAL */}
      {activeAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {activeAuditModal.category} Audit
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{activeAuditModal.name}</h2>
              </div>
              <button
                onClick={() => setActiveAuditModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-300 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                {activeAuditModal.description}
              </p>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Verification Questions (All Required)
              </h3>

              <div className="space-y-3">
                {sampleAuditQuestions.map((q, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-200 font-medium">{idx + 1}. {q}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAuditAnswers({ ...auditAnswers, [idx]: true })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          auditAnswers[idx] === true ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        YES
                      </button>
                      <button
                        onClick={() => setAuditAnswers({ ...auditAnswers, [idx]: false })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          auditAnswers[idx] === false ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        NO
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Driver / Auditor Comments</label>
                <textarea
                  rows={2}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Note any site or equipment issues found..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  onClick={() => setActiveAuditModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuditSubmit}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  Submit Audit Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOP LEARNING MODAL */}
      {activeSOPModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-blue-400">{activeSOPModal.code}</span>
                <h2 className="text-xl font-bold text-white">{activeSOPModal.name}</h2>
              </div>
              <button
                onClick={() => setActiveSOPModal(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {activeSOPModal.videoUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black">
                  <video controls className="w-full h-full object-cover">
                    <source src={activeSOPModal.videoUrl} type="video/mp4" />
                    Your browser does not support HTML5 video.
                  </video>
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white">SOP Summary & Protocol Instructions</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{activeSOPModal.contentSummary}</p>
              </div>

              {quizScore !== null ? (
                <div className="p-6 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                    <Award className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Module Completed Successfully!</h3>
                  <p className="text-xs text-emerald-300">You scored {quizScore}% on the SOP assessment.</p>
                </div>
              ) : (
                <div className="pt-2 text-right">
                  <button
                    onClick={handleSOPQuizSubmit}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-all inline-flex items-center gap-1.5"
                  >
                    Complete & Verify SOP <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
