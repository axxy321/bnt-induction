import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, XCircle } from "lucide-react";
import { QuizQuestion, QuizSubmitResult } from "../../types";

interface Step4QuizProps {
  questions: QuizQuestion[];
  onSubmitQuiz: (answers: Record<number, number>) => Promise<QuizSubmitResult>;
  onContinue: () => void;
  loading: boolean;
}

export function Step4Quiz({ questions, onSubmitQuiz, onContinue, loading }: Step4QuizProps) {
  const { t } = useTranslation();
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryingAt, setRetryingAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Live clock for the attempt-lock countdown.
  useEffect(() => {
    if (!retryingAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryingAt]);

  const answeredCount = Object.keys(userAnswers).length;
  const allAnswered = answeredCount === questions.length;
  const isLocked = Boolean(retryingAt);

  const retryInMs = retryingAt ? new Date(retryingAt).getTime() - now : 0;
  const lockRemaining = retryInMs > 0 ? retryInMs : 0;
  const lockHours = Math.floor(lockRemaining / 3600000);
  const lockMinutes = Math.floor((lockRemaining % 3600000) / 60000);
  const lockSeconds = Math.floor((lockRemaining % 60000) / 1000);

  const handleOptionSelect = (questionId: number, optionIdx: number) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (submitting || isLocked) return;

    const unanswered = questions.find((q) => userAnswers[q.id] === undefined);
    if (unanswered) {
      const idx = questions.findIndex((q) => q.id === unanswered.id);
      setErrorMsg(t("s4_q_required", { n: idx + 1 }));
      const el = document.getElementById(`question-${unanswered.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await onSubmitQuiz(userAnswers);
      setResult(res);
      // Intentionally do NOT auto-advance: the driver sees the result first.
    } catch (err) {
      const retryAt = (err as any)?.retryAt;
      if (retryAt) {
        setRetryingAt(retryAt);
        setErrorMsg(null);
      } else {
        setErrorMsg(err instanceof Error ? err.message : t("err_quiz_submit"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resultsById = useMemo(() => {
    const map = new Map<number, any>();
    for (const r of result?.results ?? []) {
      map.set(r.id, r);
    }
    return map;
  }, [result]);

  // Wrong question numbers in the display order (fail only, no answers leaked).
  const wrongQuestionNumbers = useMemo(() => {
    if (!result?.results) return [];
    const wrong: number[] = [];
    questions.forEach((q, idx) => {
      const r = resultsById.get(q.id);
      if (r && !r.correct) wrong.push(idx + 1);
    });
    return wrong;
  }, [result, questions, resultsById]);

  const categoryScores = result?.categoryScores ?? {};
  const categoryKeys = Object.keys(categoryScores);

  return (
    <div className="glass quiz-card" style={{ padding: "28px", borderRadius: "16px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 className="quiz-header-title" style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px" }}>
          {t("s4_title")}
        </h3>
        <p className="quiz-header-subtitle" style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.5 }}>
          {t("s4_sub")}
        </p>
      </div>

      {/* Answered progress */}
      {!result?.passed && !isLocked && (
        <div style={{ marginBottom: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#64748b", fontWeight: 700, marginBottom: "6px" }}>
            <span>{t("s4_answered", { n: answeredCount, total: questions.length })}</span>
            <span>{Math.round((answeredCount / Math.max(1, questions.length)) * 100)}%</span>
          </div>
          <div style={{ height: "6px", borderRadius: "999px", background: "rgba(37, 99, 235, 0.12)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(answeredCount / Math.max(1, questions.length)) * 100}%`,
                background: "linear-gradient(90deg, #2563eb, #16a34a)",
                transition: "width 0.25s ease"
              }}
            />
          </div>
        </div>
      )}

      {/* Attempt-limit locked banner with live countdown */}
      {isLocked && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "12px",
            background: "rgba(217, 119, 6, 0.1)",
            border: "1px solid rgba(217, 119, 6, 0.3)",
            marginBottom: "24px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#d97706", fontWeight: 800, fontSize: "1.05rem" }}>
            <Lock style={{ width: 22, height: 22, flexShrink: 0 }} />
            <span>{t("s4_attempt_limit")}</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "0.9rem", color: "#92400e", fontWeight: 600 }}>
            {t("s4_attempt_msg")}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "0.95rem", color: "#92400e", fontWeight: 800 }}>
            {t("s4_next_attempt", { h: lockHours, m: lockMinutes, s: lockSeconds })}
          </p>
        </div>
      )}

      {/* Error banner (single place) */}
      {errorMsg && !isLocked && (
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

      {/* Result banner */}
      {result && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "12px",
            background: result.passed ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: result.passed ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
            marginBottom: "24px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            {result.passed ? (
              <CheckCircle2 className="quiz-success-check" style={{ width: 24, height: 24, color: "#16a34a", flexShrink: 0 }} />
            ) : (
              <XCircle style={{ width: 24, height: 24, color: "#dc2626", flexShrink: 0 }} />
            )}
            <div>
              <strong style={{ fontSize: "1.1rem", color: result.passed ? "#16a34a" : "#dc2626" }}>
                {result.passed ? t("s4_passed_title") : t("s4_failed_title")}
              </strong>
              <p className="quiz-header-subtitle" style={{ margin: "2px 0 0", fontSize: "0.9rem", fontWeight: 600 }}>
                {t("s4_score", { score: result.score })} {result.passed ? t("s4_pass_achieved") : t("s4_pass_not_achieved")}
              </p>
            </div>
          </div>

          {/* Category breakdown */}
          {categoryKeys.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: "6px" }}>
                {t("s4_category_breakdown")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {categoryKeys.map((cat) => {
                  const score = categoryScores[cat];
                  const good = score >= 70;
                  return (
                    <span
                      key={cat}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        background: good ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                        color: good ? "#16a34a" : "#dc2626"
                      }}
                    >
                      {cat}: {score}%
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Critical failure reason */}
          {result.failedCritical && result.failedCriticalReason && (
            <p style={{ margin: "10px 0 0", fontSize: "0.88rem", color: "#dc2626", fontWeight: 700 }}>
              <AlertTriangle style={{ width: 16, height: 16, display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
              {result.failedCriticalReason}
            </p>
          )}

          {/* Fail: which questions were wrong (no answers leaked) */}
          {!result.passed && wrongQuestionNumbers.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#dc2626", fontWeight: 600 }}>
              {t("s4_incorrect", { list: wrongQuestionNumbers.join(", ") })}
            </p>
          )}

          {!result.passed && (
            <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#dc2626", fontWeight: 600 }}>
              {t("s4_review_try")}
            </p>
          )}
        </div>
      )}

      {/* Questions (editable) — shown until passed, hidden when locked or passed */}
      {!result?.passed && !isLocked && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "24px" }}>
          {questions.map((q, qIdx) => {
            const selectedOption = userAnswers[q.id];
            const qResult = resultsById.get(q.id);

            return (
              <div
                key={q.id || qIdx}
                id={`question-${q.id}`}
                className="quiz-card"
                style={{ padding: "22px", borderRadius: "14px", boxShadow: "0 6px 20px rgba(0,0,0,0.03)" }}
              >
                <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                  <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#2563eb" }}>
                    Q{qIdx + 1}.
                  </span>
                  <strong className="quiz-question-title" style={{ fontSize: "1.02rem", lineHeight: 1.5 }}>
                    {q.question}
                  </strong>
                  {q.isCritical && (
                    <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#dc2626", background: "rgba(239, 68, 68, 0.1)", padding: "2px 6px", borderRadius: "4px", alignSelf: "flex-start", whiteSpace: "nowrap" }}>
                      {t("s4_critical")}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingLeft: "26px" }}>
                  {q.options.map((opt, optIdx) => (
                    <label
                      key={optIdx}
                      className={`quiz-option-label ${selectedOption === optIdx ? "quiz-option-selected" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "0.95rem",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        checked={selectedOption === optIdx}
                        onChange={() => handleOptionSelect(q.id, optIdx)}
                        style={{ width: "18px", height: "18px", accentColor: "#2563eb" }}
                      />
                      <span className="quiz-option-text">{opt}</span>
                    </label>
                  ))}
                </div>

                {/* After a failed submit, mark which of these the driver got wrong (no answer reveal). */}
                {qResult && !qResult.correct && (
                  <p style={{ margin: "10px 0 0", fontSize: "0.82rem", color: "#dc2626", fontWeight: 700 }}>
                    <XCircle style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle", marginRight: "5px" }} />
                    {t("s4_answer_wrong")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pass review: full per-question recap with answers + explanations */}
      {result?.passed && (
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: "12px" }}>
            {t("s4_answer_review")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {questions.map((q, qIdx) => {
              const r = resultsById.get(q.id);
              const selected = userAnswers[q.id];
              const correctAnswer = r?.correctAnswer;

              return (
                <div
                  key={q.id || qIdx}
                  style={{
                    padding: "16px 18px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, #cbd5e1)",
                    background: "var(--bg-elevated, #ffffff)"
                  }}
                >
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    {r?.correct ? (
                      <CheckCircle2 style={{ width: 20, height: 20, color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <XCircle style={{ width: 20, height: 20, color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                        <span style={{ color: "#2563eb" }}>Q{qIdx + 1}.</span> {q.question}
                      </div>
                      <div style={{ fontSize: "0.9rem", marginBottom: "3px" }}>
                        <span style={{ color: "#64748b" }}>{t("s4_your_answer")} </span>
                        <span style={{ fontWeight: 600 }}>{selected !== undefined ? q.options[selected] : "—"}</span>
                      </div>
                      {correctAnswer !== undefined && (
                        <div style={{ fontSize: "0.9rem", marginBottom: "3px" }}>
                          <span style={{ color: "#16a34a", fontWeight: 700 }}>{t("s4_correct_answer")} </span>
                          <span style={{ fontWeight: 600 }}>{q.options[correctAnswer]}</span>
                        </div>
                      )}
                      {r?.isCritical && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#dc2626", background: "rgba(239, 68, 68, 0.1)", padding: "2px 6px", borderRadius: "4px", display: "inline-block", marginTop: "4px" }}>
                          {t("s4_critical")}
                        </span>
                      )}
                      {r?.explanation && (
                        <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
                          {r.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {result?.passed ? (
          <button
            type="button"
            onClick={onContinue}
            disabled={loading}
            style={{
              padding: "12px 28px",
              borderRadius: "8px",
              border: "none",
              background: "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {t("s4_continue_signoff")} <ArrowRight style={{ width: 18, height: 18 }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || submitting || isLocked || !allAnswered}
            style={{
              padding: "12px 28px",
              borderRadius: "8px",
              border: "none",
              background: loading || submitting || isLocked || !allAnswered ? "#94a3b8" : "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading || submitting || isLocked || !allAnswered ? "not-allowed" : "pointer"
            }}
          >
            {isLocked
              ? t("s4_attempt_limit_btn")
              : loading || submitting
              ? t("s4_grading")
              : result
              ? t("s4_update_try")
              : t("s4_submit")}
          </button>
        )}
      </div>
    </div>
  );
}
