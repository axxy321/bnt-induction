import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppState } from "../state/AppProvider";
import { InductionVersionsPanel } from "./InductionVersionsPanel";
import { apiBaseUrl } from "../lib/supabase";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  sort_order: number;
  category?: string;
  is_critical?: boolean;
}

interface LearningSection {
  id: string;
  title: string;
  format: string;
  summary: string;
  video_url: string | null;
  video_duration_seconds?: number;
  require_full_watch?: boolean;
  sort_order: number;
  _isJson?: boolean;
  _intro?: string;
  _bullets?: string;
  _scenario?: string;
}

export function AdminCMS() {
  const { session } = useAppState();
  const [activeTab, setActiveTab] = useState<"modules" | "quizzes" | "versions">("modules");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [editingSection, setEditingSection] = useState<LearningSection | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const token = session?.accessToken;

  const headers = {
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": `Bearer ${token}`
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const fetchQuestions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/quiz_questions?order=sort_order.asc`, { headers });
      if (!res.ok) throw new Error("Failed to load quiz questions.");
      const data = await res.json() as QuizQuestion[];
      setQuestions(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error loading questions.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchSections = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/learning_sections?order=sort_order.asc`, { headers });
      if (!res.ok) throw new Error("Failed to load learning sections.");
      const data = await res.json() as LearningSection[];
      setSections(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error loading sections.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "quizzes") void fetchQuestions();
    else if (activeTab === "modules") void fetchSections();
    // "versions" tab loads its own data inside InductionVersionsPanel
  }, [activeTab, fetchQuestions, fetchSections]);

  async function saveQuestion(q: QuizQuestion) {
    setSaving(q.id);
    try {
      const res = await fetch(`${apiBaseUrl}/admin/cms/questions/${q.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          category: q.category || "General",
          is_critical: Boolean(q.is_critical)
        })
      });
      if (!res.ok) throw new Error("Failed to save question.");
      setEditingQuestion(null);
      showToast("Question saved successfully.");
      void fetchQuestions();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error saving question.");
    } finally {
      setSaving(null);
    }
  }

  async function saveSection(s: LearningSection) {
    setSaving(s.id);
    try {
      let updatedSummary = s.summary;
      if (s._isJson) {
        updatedSummary = JSON.stringify({
          intro: s._intro,
          bullets: (s._bullets || "").split("\n").filter((b: string) => b.trim() !== ""),
          scenario: s._scenario
        });
      }

      const res = await fetch(`${apiBaseUrl}/admin/cms/sections/${s.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          summary: updatedSummary,
          format: s.format,
          video_url: s.video_url || null,
          video_duration_seconds: s.video_duration_seconds ? Number(s.video_duration_seconds) : 0,
          require_full_watch: Boolean(s.require_full_watch)
        })
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setEditingSection(null);
      showToast("Module saved.");
      void fetchSections();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error saving module.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="glass" style={{ padding: "32px", marginTop: "24px", borderRadius: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "1.4rem" }}>Content Management</h2>
          <p className="muted" style={{ margin: 0 }}>Edit safety modules and quiz questions directly.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", background: "rgba(148,163,184,0.1)", padding: "4px", borderRadius: "12px" }}>
          {(["modules", "quizzes", "versions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 18px", border: "none", borderRadius: "9px", cursor: "pointer", fontWeight: 600,
                background: activeTab === tab ? "var(--color-primary, #1e3a5f)" : "transparent",
                color: activeTab === tab ? "#fff" : "var(--color-muted, #666)"
              }}
            >
              {tab === "modules" ? "Safety Modules" : tab === "quizzes" ? "Quiz Questions" : "Versions"}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ background: "#22c55e", color: "#fff", padding: "10px 18px", borderRadius: "10px", marginBottom: "16px", fontWeight: 600 }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && <p className="muted">Loading...</p>}

      {/* Safety Modules Tab */}
      {activeTab === "modules" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {sections.map((section) => (
            <div key={section.id} className="glass" style={{ padding: "20px", borderRadius: "16px" }}>
              {editingSection?.id === section.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <strong style={{ fontSize: "1rem" }}>{section.title}</strong>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Format</label>
                  <input value={editingSection.format} onChange={(e) => setEditingSection({ ...editingSection, format: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />
                  
                  {editingSection._isJson ? (
                    <>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Intro</label>
                      <textarea rows={2} value={editingSection._intro} onChange={(e) => setEditingSection({ ...editingSection, _intro: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                      
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Bullets (one per line)</label>
                      <textarea rows={4} value={editingSection._bullets} onChange={(e) => setEditingSection({ ...editingSection, _bullets: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                      
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Scenario</label>
                      <textarea rows={2} value={editingSection._scenario} onChange={(e) => setEditingSection({ ...editingSection, _scenario: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                    </>
                  ) : (
                    <>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Summary</label>
                      <textarea rows={3} value={editingSection.summary} onChange={(e) => setEditingSection({ ...editingSection, summary: e.target.value })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                    </>
                  )}

                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Video URL (optional)</label>
                  <input placeholder="https://..." value={editingSection.video_url ?? ""} onChange={(e) => setEditingSection({ ...editingSection, video_url: e.target.value || null })}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem" }} />

                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)", display: "block" }}>Required Video Duration (Seconds)</label>
                      <input type="number" min="0" value={editingSection.video_duration_seconds ?? 0} onChange={(e) => setEditingSection({ ...editingSection, video_duration_seconds: Number(e.target.value) })}
                        style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", width: "100%" }} />
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", marginTop: "18px" }}>
                      <input type="checkbox" id="require_full_watch" checked={Boolean(editingSection.require_full_watch)} onChange={(e) => setEditingSection({ ...editingSection, require_full_watch: e.target.checked })} />
                      <label htmlFor="require_full_watch" style={{ fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}>Enforce Anti-Cheat Full Watch</label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => void saveSection(editingSection)} disabled={saving === section.id}
                      style={{ padding: "8px 20px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                      {saving === section.id ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingSection(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                  <div>
                    <strong>{section.title}</strong>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                      {(() => {
                        try {
                          const parsed = JSON.parse(section.summary);
                          return parsed.intro || "JSON Content (Expand to edit)";
                        } catch {
                          return section.summary;
                        }
                      })()}
                    </p>
                    {section.video_url && <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#3b82f6" }}>Video attached</p>}
                  </div>
                  <button onClick={() => {
                    const toEdit = { ...section, _isJson: false, _intro: "", _bullets: "", _scenario: "" };
                    try {
                      const parsed = JSON.parse(section.summary);
                      if (parsed && typeof parsed === "object") {
                        toEdit._isJson = true;
                        toEdit._intro = parsed.intro || "";
                        toEdit._bullets = (parsed.bullets || []).join("\n");
                        toEdit._scenario = parsed.scenario || "";
                      }
                    } catch {}
                    setEditingSection(toEdit as any);
                  }}
                    style={{ padding: "6px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", background: "transparent" }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quiz Questions Tab */}
      {activeTab === "quizzes" && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {questions.map((q, idx) => (
            <div key={q.id} className="glass" style={{ padding: "20px", borderRadius: "16px" }}>
              {editingQuestion?.id === q.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Question {idx + 1}</label>
                  <textarea rows={2} value={editingQuestion.question} onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                  {editingQuestion.options.map((opt, oi) => (
                    <div key={oi} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="radio" checked={editingQuestion.correct_answer === oi} onChange={() => setEditingQuestion({ ...editingQuestion, correct_answer: oi })} />
                      <input value={opt} onChange={(e) => {
                        const opts = [...editingQuestion.options];
                        opts[oi] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: opts });
                      }} style={{ flex: 1, padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Category</label>
                      <select
                        value={editingQuestion.category || "General"}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
                      >
                        {["Chain of Responsibility", "Fatigue Management", "Load Restraint", "Speed & Compliance", "Vehicle Checks & Defects", "Site Safety & Loading Zones", "Incident Reporting", "Mass & Dimension", "WHS & PPE", "Drug & Alcohol", "HVNL Law", "General"].map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingTop: "18px" }}>
                      <input
                        type="checkbox"
                        id={`critical-${q.id}`}
                        checked={Boolean(editingQuestion.is_critical)}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, is_critical: e.target.checked })}
                      />
                      <label htmlFor={`critical-${q.id}`} style={{ fontSize: "0.85rem", fontWeight: 600, color: "#dc2626", cursor: "pointer" }}>
                        ⚠️ Critical Question (Instant Fail)
                      </label>
                    </div>
                  </div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-muted)" }}>Explanation</label>
                  <textarea rows={2} value={editingQuestion.explanation} onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                    style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", resize: "vertical" }} />
                  <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", margin: 0 }}>Select the radio button next to the correct answer.</p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => void saveQuestion(editingQuestion)} disabled={saving === q.id}
                      style={{ padding: "8px 20px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                      {saving === q.id ? "Saving..." : "Save Question"}
                    </button>
                    <button onClick={() => setEditingQuestion(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                      <small className="muted">Q{idx + 1}</small>
                      <span className="badge badge--archived" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>{q.category || "General"}</span>
                      {q.is_critical && (
                        <span className="badge alert--error" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>⚠️ Critical Safety</span>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 6px", fontWeight: 600 }}>{q.question}</p>
                    <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>Correct: {q.options[q.correct_answer]}</p>
                  </div>
                  <button onClick={() => setEditingQuestion({ ...q })}
                    style={{ padding: "6px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap", background: "transparent" }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Induction Versions Tab — Milestone 1 */}
      {activeTab === "versions" && session && (
        <InductionVersionsPanel session={session} />
      )}
    </div>
  );
}
