import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuditAssignment, SOPItem } from "../../types";
import { tStatus } from "../../i18n";
import { ClipboardCheck, GraduationCap, Upload, CheckCircle2, AlertTriangle, X, Play } from "lucide-react";

interface AuditAndSOPManagerProps {
  audits: AuditAssignment[];
  sops: SOPItem[];
  activeTab: "audits" | "learning";
  onCompleteAudit: (assignment: AuditAssignment, answers: Record<number, boolean>) => Promise<void>;
  onCompleteSOP: (sopId: string) => void;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function DueBadge({ date }: { date: string | null }) {
  const { t } = useTranslation();
  const days = daysUntil(date);
  if (days === null) return null;
  const label =
    days < 0
      ? t("status_overdue")
      : days === 0
      ? t("status_due_today")
      : t(days === 1 ? "aud_d_left_one" : "aud_d_left_other", { count: days });
  const cls =
    days < 0 || days <= 7
      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
      : days <= 14
      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`} title={date || undefined}>
      {label}
    </span>
  );
}

export const AuditAndSOPManager: React.FC<AuditAndSOPManagerProps> = ({
  audits,
  sops,
  activeTab,
  onCompleteAudit,
  onCompleteSOP,
}) => {
  const [currentView, setCurrentView] = useState<"audits" | "learning">(activeTab);
  const [activeAuditModal, setActiveAuditModal] = useState<AuditAssignment | null>(null);
  const [activeSOPModal, setActiveSOPModal] = useState<SOPItem | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [auditAnswers, setAuditAnswers] = useState<Record<number, boolean>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { t } = useTranslation();

  const overdueAudits = audits.filter((a) => {
    const days = daysUntil(a.dueDate);
    return days !== null && days < 0 && a.status !== "Passed";
  });

  const handleOpenAudit = (assignment: AuditAssignment) => {
    setActiveAuditModal(assignment);
    setAuditAnswers({});
    setCommentInput("");
    setSubmitError(null);
  };

  const handleAuditSubmit = async () => {
    if (!activeAuditModal) return;
    const questions = activeAuditModal.audit.questions;
    if (Object.keys(auditAnswers).length < questions.length) {
      setSubmitError(t("aud_err_required"));
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onCompleteAudit(activeAuditModal, auditAnswers);
      setActiveAuditModal(null);
      setAuditAnswers({});
      setCommentInput("");
    } catch (err: any) {
      setSubmitError(err?.message || t("aud_err_submit"));
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {currentView === "audits" ? t("aud_title_audits") : t("aud_title_learning")}
          </h1>
          <p className="text-slate-400 text-sm">
            {currentView === "audits" ? t("aud_sub_audits") : t("aud_sub_learning")}
          </p>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800 border border-slate-700">
          <button
            onClick={() => setCurrentView("audits")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              currentView === "audits" ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" /> {t("aud_my_audits", { count: audits.length })}
          </button>
          <button
            onClick={() => setCurrentView("learning")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              currentView === "learning" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> {t("aud_my_learning", { count: sops.length })}
          </button>
        </div>
      </div>

      {/* Overdue Warning Banner */}
      {currentView === "audits" && overdueAudits.length > 0 && (
        <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-300">
            <span className="font-bold">{t("aud_overdue_banner")}</span>
            <span className="block mt-1">
              {overdueAudits.map((a) => `${a.audit.name} (${a.dueDate || t("aud_no_due")})`).join(" • ")}
            </span>
          </div>
        </div>
      )}

      {/* VIEW 1: AUDITS GRID */}
      {currentView === "audits" && (
        audits.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
            <ClipboardCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">{t("aud_empty_audits_title")}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {t("aud_empty_audits_sub")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {audits.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      {assignment.audit.category}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        assignment.status === "Passed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : assignment.status === "In Progress"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : assignment.status === "Action Required"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {tStatus(assignment.status, t)}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-lg leading-snug">{assignment.audit.name}</h3>

                  {assignment.audit.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">{assignment.audit.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <DueBadge date={assignment.dueDate} />
                    {assignment.attemptsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {t(assignment.attemptsCount === 1 ? "aud_attempts_one" : "aud_attempts_other", { count: assignment.attemptsCount })}
                      </span>
                    )}
                    {assignment.audit.questions.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {t(assignment.audit.questions.length === 1 ? "aud_questions_one" : "aud_questions_other", { count: assignment.audit.questions.length })}
                      </span>
                    )}
                  </div>

                  {assignment.lastAttemptDate && (
                    <div className="text-[11px] text-slate-500">
                      {t("aud_last_attempt", { date: new Date(assignment.lastAttemptDate).toLocaleString("en-AU") })}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => handleOpenAudit(assignment)}
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {assignment.status === "No Attempt"
                        ? t("aud_start")
                        : assignment.status === "Passed"
                        ? t("aud_review")
                        : t("aud_continue")}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* VIEW 2: LEARNING SOPs GRID */}
      {currentView === "learning" && (
        sops.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
            <GraduationCap className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">{t("aud_empty_sops_title")}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {t("aud_empty_sops_sub")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sops.map((sop) => (
              <div
                key={sop.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-500/10 border border-blue-500/30 text-blue-400">
                      {sop.category}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        sop.status === "Passed"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : sop.status === "In Progress"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : sop.status === "Expired"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {tStatus(sop.status, t)}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-lg leading-snug">
                    <span className="text-slate-500 text-xs font-mono mr-2">{sop.code}</span>
                    {sop.name}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">{sop.contentSummary}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {sop.isMandatory && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        {t("aud_mandatory")}
                      </span>
                    )}
                    {sop.quizQuestionsCount ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                        {t(sop.quizQuestionsCount === 1 ? "aud_quiz_qs_one" : "aud_quiz_qs_other", { count: sop.quizQuestionsCount })}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => setActiveSOPModal(sop)}
                    className="w-full px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>{t("aud_open_module")}</span>
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
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-400" />
                  {activeAuditModal.audit.name}
                </h2>
                <p className="text-xs text-emerald-400">
                  {activeAuditModal.audit.category}
                  {activeAuditModal.audit.description ? ` • ${activeAuditModal.audit.description}` : ""}
                </p>
              </div>
              <button
                onClick={() => setActiveAuditModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {t("aud_answer_all")}{" "}
                <span className="text-emerald-400 font-semibold">{t("aud_pass_hint")}</span>
              </p>
              {activeAuditModal.audit.questions.map((question, index) => (
                <div
                  key={index}
                  className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3"
                >
                  <p className="text-sm text-white font-medium">
                    <span className="text-slate-500 mr-2">{index + 1}.</span>
                    {question}
                  </p>
                  <div className="flex gap-3">
                    {(["Yes", "No"] as const).map((option) => {
                      const value = option === "Yes";
                      const selected = auditAnswers[index] === value;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setAuditAnswers((prev) => ({ ...prev, [index]: value }))}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            selected
                              ? value
                                ? "bg-emerald-600 text-white shadow-md"
                                : "bg-rose-600 text-white shadow-md"
                              : "bg-slate-700 text-slate-300 hover:text-white"
                          }`}
                        >
                          {value ? t("aud_yes") : t("aud_no")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {activeAuditModal.audit.questions.length === 0 && (
                <p className="text-xs text-slate-500 italic">
                  {t("aud_no_questions")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {t("aud_comments")}
              </label>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                rows={2}
                placeholder={t("aud_comments_ph")}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {submitError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                {submitError}
              </div>
            )}

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveAuditModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                {t("aud_cancel")}
              </button>
              <button
                type="button"
                disabled={isSubmitting || activeAuditModal.audit.questions.length === 0}
                onClick={handleAuditSubmit}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? t("aud_submitting") : t("aud_submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOP MODAL (unchanged screen-only flow) */}
      {activeSOPModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-blue-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-400" />
                  {activeSOPModal.name}
                </h2>
                <p className="text-xs text-blue-400 font-mono">{activeSOPModal.code}</p>
              </div>
              <button
                onClick={() => setActiveSOPModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                <p className="text-xs text-slate-300 leading-relaxed">{activeSOPModal.contentSummary}</p>
              </div>

              {activeSOPModal.videoUrl && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
                  <Play className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">{t("aud_video_note")}</p>
                </div>
              )}

              {quizScore !== null && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-emerald-400 font-bold">{t("aud_quiz_passed", { score: quizScore })}</p>
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveSOPModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                {t("aud_close")}
              </button>
              <button
                type="button"
                onClick={handleSOPQuizSubmit}
                disabled={quizScore !== null}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {t("aud_complete_module")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
