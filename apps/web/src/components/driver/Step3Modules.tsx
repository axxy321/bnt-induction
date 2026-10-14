import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ArrowRight, Check, Download, PlayCircle, Circle, Clock } from "lucide-react";
import { LearningSectionProgress } from "../../types";
import { VideoPlayer } from "../VideoPlayer";
import { ModuleExtras } from "./ModuleExtras";
import { buildTranscriptPdf } from "../../lib/transcript";
import { organizationName } from "../../lib/supabase";

interface Step3ModulesProps {
  modules: LearningSectionProgress[];
  onToggleModule: (module: LearningSectionProgress) => Promise<void>;
  onStartModule: (module: LearningSectionProgress) => Promise<void>;
  onContinue: () => Promise<void>;
  loading: boolean;
  driverId?: string;
  driverName?: string;
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function positionKey(driverId: string, sectionId: string) {
  return `bnt-module-pos-${driverId}-${sectionId}`;
}

export function Step3Modules({ modules, onToggleModule, onStartModule, onContinue, loading, driverId, driverName }: Step3ModulesProps) {
  const { t } = useTranslation();
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const currentModule = modules[activeModuleIndex] || modules[0];

  const [activeProgress, setActiveProgress] = useState(0);
  const [activeTime, setActiveTime] = useState(0);
  const [activeDuration, setActiveDuration] = useState(0);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [proceeding, setProceeding] = useState(false);
  const [proceedError, setProceedError] = useState<string | null>(null);

  const currentSectionId = currentModule?.sectionId;

  const savedPosition = useMemo(() => {
    if (!driverId || !currentSectionId) return 0;
    try {
      const raw = window.localStorage.getItem(positionKey(driverId, currentSectionId));
      const parsed = raw ? Number(raw) : 0;
      return parsed && !isNaN(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }, [driverId, currentSectionId]);

  useEffect(() => {
    setActiveProgress(0);
    setActiveTime(0);
    setActiveDuration(0);
    if (savedPosition > 0) {
      setResumeNotice(t("s3_resumed", { time: formatTime(savedPosition) }));
      const timer = setTimeout(() => setResumeNotice(null), 4000);
      return () => clearTimeout(timer);
    }
    setResumeNotice(null);
  }, [currentSectionId, savedPosition]);

  const allCompleted = modules.length > 0 && modules.every((m) => m.completed);
  const completedCount = modules.filter((m) => m.completed).length;

  const goToModule = (index: number) => {
    setJustCompletedId(null);
    setActiveModuleIndex(Math.max(0, Math.min(modules.length - 1, index)));
  };

  const handleVideoComplete = async () => {
    if (currentModule && !currentModule.completed) {
      await onToggleModule(currentModule);
      setJustCompletedId(currentModule.sectionId);
    }
  };

  // Auto-advance to the next module shortly after a successful completion.
  useEffect(() => {
    if (!justCompletedId || activeModuleIndex >= modules.length - 1) return;
    const timer = setTimeout(() => {
      setActiveModuleIndex((prev) => {
        if (modules[prev]?.sectionId === justCompletedId) {
          return Math.min(modules.length - 1, prev + 1);
        }
        return prev;
      });
      setJustCompletedId(null);
    }, 1800);
    return () => clearTimeout(timer);
  }, [justCompletedId, activeModuleIndex, modules]);

  const handleProceed = async () => {
    if (proceeding) return;
    setProceeding(true);
    setProceedError(null);
    try {
      await onContinue();
    } catch (err) {
      setProceedError(err instanceof Error ? err.message : t("err_save_module"));
    } finally {
      setProceeding(false);
    }
  };

  const handlePositionUpdate = (seconds: number) => {
    setActiveTime(seconds);
    if (activeDuration > 0) {
      setActiveProgress(Math.min(100, Math.round((seconds / activeDuration) * 100)));
    }
    if (driverId && currentSectionId) {
      try {
        window.localStorage.setItem(positionKey(driverId, currentSectionId), String(Math.floor(seconds)));
      } catch {}
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

  const handleDownloadTranscript = () => {
    if (!currentModule) return;
    try {
      const pdfBase64 = buildTranscriptPdf({
        moduleTitle: currentModule.title,
        driverName: driverName || t("common_driver"),
        date: new Date().toISOString(),
        organizationName,
        intro: parsedContent.intro,
        bullets: parsedContent.bullets,
        scenario: parsedContent.scenario
      });
      const binary = atob(pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BNT-Module-Transcript-${currentModule.sectionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert(t("err_transcript"));
    }
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "1060px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
            {t("s3_title")}
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            {t("s3_sub")}
          </p>
        </div>
        <div style={{ background: "rgba(30, 58, 95, 0.08)", padding: "6px 14px", borderRadius: "20px", fontWeight: 700, fontSize: "0.85rem", color: "#1e3a5f" }}>
          {t("s3_modules_completed", { done: completedCount, total: modules.length })}
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
              type="button"
              onClick={() => goToModule(idx)}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: isActive
                  ? "2px solid #2563eb"
                  : isDone
                  ? "1.5px solid #16a34a"
                  : "1px solid var(--border, #cbd5e1)",
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
              <span style={{ color: isActive ? "#ffffff" : isDone ? "#166534" : "#1e293b", fontWeight: 800, display: "inline-flex", alignItems: "center" }}>
                {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : `${idx + 1}.`}
              </span>
              <span style={{ color: isActive ? "#ffffff" : isDone ? "#166534" : "#1e293b", fontWeight: 700 }}>
                {mod.title.length > 24 ? mod.title.slice(0, 24) + "…" : mod.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Content Layout: Sidebar + Module */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px", alignItems: "start" }}>
        {/* Progress Sidebar */}
        <aside
          style={{
            background: "var(--bg-elevated, #ffffff)",
            border: "1px solid var(--border, #cbd5e1)",
            borderRadius: "14px",
            padding: "16px",
            position: "sticky",
            top: "20px"
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: "12px" }}>
            {t("s3_module_progress")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {modules.map((mod, idx) => {
              const isActive = idx === activeModuleIndex;
              const isDone = mod.completed;
              return (
                <button
                  key={mod.sectionId || idx}
                  type="button"
                  onClick={() => goToModule(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: isActive ? "1.5px solid #2563eb" : "1px solid transparent",
                    background: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%"
                  }}
                >
                  <span style={{ flexShrink: 0 }}>
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#16a34a" }} />
                    ) : isActive ? (
                      <PlayCircle className="w-4 h-4" style={{ color: "#2563eb" }} />
                    ) : (
                      <Circle className="w-4 h-4" style={{ color: "#cbd5e1" }} />
                    )}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: "0.8rem", fontWeight: isActive ? 800 : 600, color: "var(--text, #0f172a)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {idx + 1}. {mod.title}
                    </span>
                    <span style={{ display: "block", fontSize: "0.7rem", color: isDone ? "#16a34a" : isActive ? "#2563eb" : "#94a3b8", fontWeight: 600, marginTop: "2px" }}>
                      {isDone ? t("status_completed") : isActive ? t("s3_watching", { p: activeProgress > 0 ? activeProgress : 0 }) : t("status_not_started")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--border, #cbd5e1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
              <Clock className="w-3.5 h-3.5" />
              <span>
                {activeTime > 0 ? t("s3_time_watched", { cur: formatTime(activeTime), dur: formatTime(activeDuration) }) : t("s3_no_playback")}
              </span>
            </div>
          </div>
        </aside>

        {/* Active Module Display */}
        {currentModule && (
          <div style={{ background: "var(--bg-elevated, #ffffff)", borderRadius: "14px", padding: "28px", border: "1px solid var(--border, #cbd5e1)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", marginBottom: "24px", color: "var(--text, #0f172a)", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ minWidth: 0 }}>
                <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#3b82f6" }}>
                  {t("s3_module_of", { n: activeModuleIndex + 1, total: modules.length })}
                </span>
                <h4 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "6px 0 0" }}>
                  {currentModule.title}
                </h4>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {resumeNotice && (
                  <span style={{ background: "rgba(37, 99, 235, 0.12)", color: "#2563eb", fontWeight: 700, fontSize: "0.75rem", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <PlayCircle className="w-3.5 h-3.5" /> {resumeNotice}
                  </span>
                )}
                {currentModule.completed && (
                  <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "#16a34a", fontWeight: 800, fontSize: "0.82rem", padding: "6px 14px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                     <Check className="w-4 h-4" /> {t("status_completed")}
                  </span>
                )}
              </div>
            </div>

            {currentModule.videoUrl && (
              <VideoPlayer
                src={currentModule.videoUrl}
                onComplete={handleVideoComplete}
                onStart={() => void onStartModule(currentModule)}
                savedPosition={savedPosition}
                onPositionUpdate={handlePositionUpdate}
                onDurationChange={setActiveDuration}
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
                <strong className="module-scenario-title" style={{ fontSize: "0.95rem", display: "block", marginBottom: "4px" }}>{t("s3_scenario_title")}</strong>
                <p className="module-scenario-text" style={{ margin: 0, fontWeight: 600 }}>{parsedContent.scenario}</p>
              </div>
            )}

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                onClick={() => void onToggleModule(currentModule)}
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
                {currentModule.completed ? t("s3_mark_incomplete") : t("s3_mark_complete")}
              </button>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleDownloadTranscript}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #cbd5e1)",
                    background: "transparent",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                   <Download className="w-3.5 h-3.5" /> {t("s3_download_transcript")}
                </button>

                {activeModuleIndex < modules.length - 1 && (
                  <button
                    type="button"
                    onClick={() => goToModule(activeModuleIndex + 1)}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #cbd5e1)",
                      background: "transparent",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {t("s3_next_module")} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Optional extras (images, documents, voiceover, inline checks, dwell lock).
            Renders nothing at all unless the module carries media data, and
            completion still flows through the same onToggleModule the video uses. */}
        {currentModule && (
          <ModuleExtras
            key={currentModule.sectionId}
            module={currentModule}
            disabled={loading}
            onSatisfied={() => onToggleModule(currentModule)}
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
        {proceedError && (
          <span style={{ color: "#ef4444", fontSize: "0.82rem", fontWeight: 600 }}>{proceedError}</span>
        )}
        <button
          type="button"
          onClick={handleProceed}
          disabled={!allCompleted || loading || proceeding}
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            background: allCompleted ? "#1e3a5f" : "#94a3b8",
            color: "#ffffff",
            fontWeight: 700,
            cursor: allCompleted ? "pointer" : "not-allowed",
            opacity: proceeding ? 0.7 : 1
          }}
        >
          {proceeding ? t("s2_saving") : allCompleted ? t("s3_proceed") : t("s3_complete_all", { n: modules.length })}
        </button>
      </div>
    </div>
  );
}
