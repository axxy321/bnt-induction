import { useState } from "react";
import { QuizQuestion, QuizSubmitResult } from "../../types";

interface Step4QuizProps {
  questions: QuizQuestion[];
  onSubmitQuiz: (answers: Record<number, number>) => Promise<QuizSubmitResult>;
  onContinue: () => void;
  loading: boolean;
}

export function Step4Quiz({ questions, onSubmitQuiz, onContinue, loading }: Step4QuizProps) {
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const handleOptionSelect = (questionId: number, optionIdx: number) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIdx }));
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Check for unanswered questions
    const unanswered = questions.find((q) => userAnswers[q.id] === undefined);
    if (unanswered) {
      const idx = questions.findIndex((q) => q.id === unanswered.id);
      setErrorMsg(`Please answer Question ${idx + 1} before submitting.`);
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
      if (res.passed) {
        onContinue();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Quiz submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass quiz-card" style={{ padding: "28px", borderRadius: "16px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 className="quiz-header-title" style={{ fontSize: "1.4rem", fontWeight: 800, margin: "0 0 6px" }}>
          Step 4: Heavy Vehicle Knowledge Check
        </h3>
        <p className="quiz-header-subtitle" style={{ margin: 0, fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.5 }}>
          Demonstrate your understanding of Australian Heavy Vehicle National Law, Fatigue, Load Restraint, and Site Safety rules.
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
            <span style={{ fontSize: "1.4rem" }}>{result.passed ? "🎉" : "❌"}</span>
            <div>
              <strong style={{ fontSize: "1.1rem", color: result.passed ? "#16a34a" : "#dc2626" }}>
                {result.passed ? "Quiz Passed Successfully!" : "Passing Score Not Achieved"}
              </strong>
              <p className="quiz-header-subtitle" style={{ margin: "2px 0 0", fontSize: "0.9rem", fontWeight: 600 }}>
                Your Score: {result.score}% {result.passed ? "(Passing standard achieved)" : "(Passing standard not achieved)"}
              </p>
            </div>
          </div>

          {!result.passed && (
            <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#dc2626", fontWeight: 600 }}>
              Please review the modules and try again. You can re-submit answers below.
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "24px" }}>
        {questions.map((q, qIdx) => {
          const selectedOption = userAnswers[q.id];

          return (
            <div
              key={q.id || qIdx}
              id={`question-${q.id}`}
              className="quiz-card"
              style={{
                padding: "22px",
                borderRadius: "14px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.03)"
              }}
            >
              <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
                <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#2563eb" }}>
                  Q{qIdx + 1}.
                </span>
                <strong className="quiz-question-title" style={{ fontSize: "1.02rem", lineHeight: 1.5 }}>
                  {q.question}
                </strong>
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
            </div>
          );
        })}
      </div>

      {errorMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            marginBottom: "16px",
            fontSize: "0.9rem",
            fontWeight: 600,
            textAlign: "right"
          }}
        >
          ⚠️ {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || submitting}
          style={{
            padding: "12px 28px",
            borderRadius: "8px",
            border: "none",
            background: loading || submitting ? "#94a3b8" : "#1e3a5f",
            color: "#ffffff",
            fontWeight: 700,
            cursor: loading || submitting ? "not-allowed" : "pointer"
          }}
        >
          {loading || submitting ? "Grading Knowledge Check..." : "Submit Knowledge Check →"}
        </button>
      </div>
    </div>
  );
}
