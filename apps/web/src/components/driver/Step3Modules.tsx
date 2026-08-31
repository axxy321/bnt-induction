import { useState } from "react";
import { LearningSectionProgress } from "../../types";
import { VideoPlayer } from "../VideoPlayer";

interface Step3ModulesProps {
  modules: LearningSectionProgress[];
  onToggleModule: (module: LearningSectionProgress) => Promise<void>;
  onStartModule: (module: LearningSectionProgress) => Promise<void>;
  onContinue: () => void;
  loading: boolean;
}

export function Step3Modules({ modules, onToggleModule, onStartModule, onContinue, loading }: Step3ModulesProps) {
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const currentModule = modules[activeModuleIndex] || modules[0];

  const allCompleted = modules.length > 0 && modules.every((m) => m.completed);
  const completedCount = modules.filter((m) => m.completed).length;

  const handleVideoComplete = async () => {
    if (currentModule && !currentModule.completed) {
      await onToggleModule(currentModule);
    }
  };

  let parsedContent: { intro?: string; bullets?: string[]; scenario?: string } = {};
  if (currentModule?.summary) {
    try {
      parsedContent = JSON.parse(currentModule.summary);
    } catch {
      parsedContent = { intro: currentModule.summary };
    }
  }

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "860px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
            Step 3: Heavy Vehicle Safety & Compliance Curriculum
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            Complete all mandatory HVNL, NHVR, and BNT Freight safety standards.
          </p>
        </div>
        <div style={{ background: "rgba(30, 58, 95, 0.08)", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, fontSize: "0.85rem", color: "#1e3a5f" }}>
          {completedCount} of {modules.length} Modules Completed
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "24px" }}>
        {modules.map((mod, idx) => {
          const isActive = activeModuleIndex === idx;
          const isDone = mod.completed;

          return (
            <button
              key={mod.sectionId || idx}
              onClick={() => {
                setActiveModuleIndex(idx);
                onStartModule?.(mod);
              }}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: isActive
                  ? "2px solid #2563eb"
                  : isDone
                  ? "1px solid rgba(34, 197, 94, 0.4)"
                  : "1px solid #cbd5e1",
                background: isActive
                  ? "#2563eb"
                  : isDone
                  ? "rgba(34, 197, 94, 0.12)"
                  : "var(--bg-elevated, #ffffff)",
                color: isActive
                  ? "#ffffff"
                  : isDone
                  ? "#166534"
                  : "#1e293b",
                fontSize: "0.85rem",
                fontWeight: isActive ? 800 : 700,
                whiteSpace: "nowrap",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: isActive ? "0 6px 16px rgba(37,99,235,0.25)" : "none",
                transition: "all 0.18s ease"
              }}
            >
              <span style={{ color: isActive ? "#ffffff" : isDone ? "#166534" : "#1e293b", fontWeight: 800 }}>
                {isDone ? "✅" : `${idx + 1}.`}
              </span>
              <span style={{ color: isActive ? "#ffffff" : isDone ? "#166534" : "#1e293b", fontWeight: 700 }}>
                {mod.title.length > 24 ? mod.title.slice(0, 24) + "…" : mod.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Module Display */}
      {currentModule && (
        <div style={{ background: "var(--bg-elevated, #ffffff)", borderRadius: "14px", padding: "28px", border: "1px solid var(--border, #cbd5e1)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", marginBottom: "24px", color: "var(--text, #0f172a)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#3b82f6" }}>
                Module {activeModuleIndex + 1} of {modules.length}
              </span>
              <h4 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "6px 0 0", color: "var(--text, #0f172a)" }}>
                {currentModule.title}
              </h4>
            </div>
            {currentModule.completed && (
              <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#16a34a", fontWeight: 800, fontSize: "0.82rem", padding: "6px 14px", borderRadius: "20px" }}>
                ✓ COMPLETED
              </span>
            )}
          </div>

          {currentModule.videoUrl && (
            <VideoPlayer
              src={currentModule.videoUrl}
              onComplete={handleVideoComplete}
              onStart={() => void onStartModule(currentModule)}
            />
          )}

          {parsedContent.intro && (
            <p className="module-content-text" style={{ fontSize: "1rem", lineHeight: 1.65, marginBottom: "20px", fontWeight: 600 }}>
              {parsedContent.intro}
            </p>
          )}

          {parsedContent.bullets && parsedContent.bullets.length > 0 && (
            <ul style={{ paddingLeft: "22px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {parsedContent.bullets.map((b, i) => (
                <li key={i} className="module-content-text" style={{ fontSize: "0.93rem", lineHeight: 1.6, fontWeight: 600 }}>
                  {b}
                </li>
              ))}
            </ul>
          )}

          {parsedContent.scenario && (
            <div
              className="module-scenario-box"
              style={{
                padding: "16px 20px",
                borderRadius: "12px",
                fontSize: "0.92rem",
                lineHeight: 1.6,
                marginTop: "20px"
              }}
            >
              <strong className="module-scenario-title" style={{ fontSize: "0.95rem", display: "block", marginBottom: "4px" }}>Operational Example / Scenario:</strong>
              <p className="module-scenario-text" style={{ margin: 0, fontWeight: 600 }}>{parsedContent.scenario}</p>
            </div>
          )}

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {!currentModule.videoUrl && <button
              type="button"
              onClick={() => onToggleModule(currentModule)}
              disabled={loading}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "1px solid #1e3a5f",
                background: currentModule.completed ? "transparent" : "#1e3a5f",
                color: currentModule.completed ? "#1e3a5f" : "#ffffff",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
            >
              {currentModule.completed ? "Mark as Incomplete" : "Mark Module Complete ✓"}
            </button>}

            {activeModuleIndex < modules.length - 1 && (
              <button
                type="button"
                onClick={() => setActiveModuleIndex((prev) => Math.min(modules.length - 1, prev + 1))}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #cbd5e1)",
                  background: "transparent",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                Next Module →
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onContinue}
          disabled={!allCompleted || loading}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: allCompleted ? "#1e3a5f" : "#94a3b8",
            color: "#ffffff",
            fontWeight: 700,
            cursor: allCompleted ? "pointer" : "not-allowed"
          }}
        >
          {allCompleted ? "Proceed to Knowledge Quiz →" : `Complete All ${modules.length} Modules to Continue`}
        </button>
      </div>
    </div>
  );
}
