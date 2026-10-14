import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Image as ImageIcon,
  FileText,
  Volume2,
  Play,
  Pause,
  Lock,
  Unlock,
  CheckCircle2,
  HelpCircle,
  Paperclip,
  Clock
} from "lucide-react";
import { LearningSectionProgress, SlideExtras, SlideQuestion } from "../../types";

interface ModuleExtrasProps {
  module: LearningSectionProgress;
  onSatisfied: () => Promise<void> | void;
  disabled?: boolean;
}

const TEXT_SIZE_MAP: Record<string, string> = {
  small: "0.88rem",
  regular: "1rem",
  large: "1.12rem",
  xlarge: "1.35rem",
  headline: "1.6rem"
};

function isQuestionCorrect(q: SlideQuestion, answer: unknown): boolean {
  const type = q.questionType ?? "single_choice";

  if (type === "text_input") {
    const text = typeof answer === "string" ? answer.trim().toLowerCase() : "";
    if (!text) return false;
    const accepted = (q.acceptedAnswers ?? []).map((a) => String(a).trim().toLowerCase()).filter(Boolean);
    if (accepted.length === 0) return true; // no configured answers: any response counts
    return accepted.includes(text);
  }

  if (type === "multiple_choice") {
    const selected = Array.isArray(answer) ? answer : [];
    const expected = (q.correctAnswers ?? []).map(Number);
    if (expected.length === 0) return false;
    if (selected.length !== expected.length) return false;
    const normalised = new Set(selected.map(Number));
    return expected.every((v) => normalised.has(v));
  }

  return Number(answer) === Number(q.correctAnswer ?? 0);
}

/**
 * ModuleExtras — optional content blocks rendered underneath the existing
 * video/text module. Everything here is additive:
 *
 *  - a module with no mediaJson renders nothing at all
 *  - completion still happens through the same `onSatisfied` channel that the
 *    video uses, so the `allCompleted` gate in Step 3 is unchanged
 *  - nothing here can un-complete a module
 */
export function ModuleExtras({ module, onSatisfied, disabled = false }: ModuleExtrasProps) {
  const { t } = useTranslation();
  const media = (module.mediaJson ?? null) as SlideExtras | null;

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [readDocs, setReadDocs] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const firedRef = useRef(false);

  const waitSeconds = Number(media?.forcedWaitSeconds ?? 0) || 0;
  const documents = media?.documents ?? [];
  const requiredDocs = documents.filter((d) => d.requireRead);
  const questions = (media?.questions ?? []).filter((q) => q.placement !== "separate_page");
  const images = media?.images ?? [];
  const attachments = media?.attachments ?? [];

  // Only auto-complete when this slide actually imposes a requirement.
  const shouldGate = waitSeconds > 0 || requiredDocs.length > 0 || questions.length > 0;

  const dwellDone = waitSeconds === 0 || secondsLeft <= 0;
  const docsDone = requiredDocs.every((d, i) => readDocs[`${d.url}-${i}`]);
  const questionsDone = questions.length === 0
    ? true
    : questions.every((q) => q.id in answers && isQuestionCorrect(q, answers[q.id]));

  const satisfied = dwellDone && docsDone && questionsDone;

  // Reset per-module state when the driver switches slides.
  useEffect(() => {
    firedRef.current = false;
    setSecondsLeft(waitSeconds);
    setReadDocs({});
    setAnswers({});
    setIsPlaying(false);
    audioRef.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.sectionId]);

  // Countdown for the forced-wait lock.
  useEffect(() => {
    if (waitSeconds <= 0 || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds, secondsLeft]);

  // Fire completion exactly once, through the same channel the video uses.
  useEffect(() => {
    if (!shouldGate || !satisfied || module.completed || disabled) return;
    if (firedRef.current) return;
    firedRef.current = true;
    void Promise.resolve(onSatisfied()).catch(() => {
      firedRef.current = false;
    });
  }, [shouldGate, satisfied, module.completed, disabled, onSatisfied]);

  const toggleAudio = () => {
    if (!audioRef.current && media?.voiceover?.url) {
      audioRef.current = new Audio(media.voiceover.url);
      audioRef.current.ontimeupdate = () => {
        if (!audioRef.current) return;
        setAudioProgress(audioRef.current.currentTime);
      };
      audioRef.current.onended = () => setIsPlaying(false);
      setAudioDuration(audioRef.current.duration || 0);
    }
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const hasAnyContent =
    Boolean(media?.warning) ||
    images.length > 0 ||
    documents.length > 0 ||
    Boolean(media?.voiceover?.url) ||
    questions.length > 0 ||
    waitSeconds > 0 ||
    attachments.length > 0;

  const textSize = media?.textSize ? TEXT_SIZE_MAP[media.textSize] : undefined;

  if (!media || !hasAnyContent) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
      {/* Warning callout */}
      {media.warning && (
        <div
          style={{
            background: "rgba(239,68,68,.09)",
            border: "1px solid rgba(239,68,68,.4)",
            borderLeft: "4px solid #ef4444",
            borderRadius: "11px",
            padding: "13px 16px",
            display: "flex",
            gap: "10px",
            alignItems: "flex-start"
          }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }} />
          <strong style={{ fontSize: textSize ?? "0.88rem", fontWeight: 700, color: "#fca5a5", lineHeight: 1.5 }}>
            {media.warning}
          </strong>
        </div>
      )}

      {/* Forced-wait lock */}
      {waitSeconds > 0 && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            alignSelf: "flex-start",
            padding: "7px 13px",
            borderRadius: "999px",
            fontSize: "0.76rem",
            fontWeight: 800,
            background: secondsLeft > 0 ? "rgba(249,115,22,.13)" : "rgba(22,163,74,.13)",
            border: `1px solid ${secondsLeft > 0 ? "rgba(249,115,22,.35)" : "rgba(22,163,74,.4)"}`,
            color: secondsLeft > 0 ? "#fdba74" : "#6ee7b7"
          }}
        >
          {secondsLeft > 0 ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {secondsLeft > 0
            ? t("mx_locked", { seconds: secondsLeft })
            : t("mx_unlocked")}
        </div>
      )}

      {/* Audio voiceover */}
      {media.voiceover?.url && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "13px",
            background: "rgba(168,85,247,.09)",
            border: "1px solid rgba(168,85,247,.32)",
            borderRadius: "11px",
            padding: "12px 15px"
          }}
        >
          <button
            type="button"
            onClick={toggleAudio}
            aria-label="Play voiceover"
            style={{
              width: "36px", height: "36px", borderRadius: "50%", border: "none",
              background: "#9333ea", color: "#fff", cursor: "pointer", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.8rem", fontWeight: 700, marginBottom: "6px" }}>
              <Volume2 className="w-3.5 h-3.5" style={{ color: "#c084fc" }} />
              {t("mx_voiceover")}
            </div>
            <div style={{ height: "5px", borderRadius: "99px", background: "rgba(148,163,184,.25)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  background: "#9333ea",
                  width: audioDuration > 0 ? `${Math.min(100, (audioProgress / audioDuration) * 100)}%` : "0%",
                  transition: "width .25s linear"
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.76rem", fontWeight: 800, color: "var(--color-muted)", marginBottom: "9px" }}>
            <ImageIcon className="w-3.5 h-3.5" /> {t("mx_images")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
            {images.map((img, i) => (
              <figure key={`${img.url}-${i}`} style={{ margin: 0, borderRadius: "11px", overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg-elevated, rgba(255,255,255,.03))" }}>
                <img
                  src={img.url}
                  alt={img.alt || img.caption || "Slide image"}
                  style={{ width: "100%", height: "130px", objectFit: "cover", display: "block" }}
                />
                {img.caption && (
                  <figcaption className="muted" style={{ padding: "8px 10px", fontSize: "0.73rem" }}>{img.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {documents.map((doc, i) => {
            const key = `${doc.url}-${i}`;
            const acked = Boolean(readDocs[key]);
            return (
              <div key={key} style={{ border: "1px solid var(--border)", borderRadius: "11px", overflow: "hidden", background: "var(--bg-elevated, rgba(255,255,255,.03))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", fontWeight: 700, minWidth: 0 }}>
                    <FileText className="w-3.5 h-3.5" style={{ color: "#fdba74", flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name ?? t("mx_document")}</span>
                  </div>
                  {doc.pages ? <span className="muted" style={{ fontSize: "0.73rem", whiteSpace: "nowrap" }}>{t("mx_pages", { pages: doc.pages })}</span> : null}
                </div>
                <iframe
                  src={doc.url}
                  title={doc.name ?? "Document"}
                  style={{ width: "100%", height: "220px", border: "none", display: "block", background: "#fff" }}
                />
                {doc.requireRead && (
                  <label style={{ display: "flex", alignItems: "center", gap: "9px", padding: "11px 14px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={acked}
                      onChange={(e) => setReadDocs((prev) => ({ ...prev, [key]: e.target.checked }))}
                      style={{ width: "17px", height: "17px", accentColor: "#16a34a" }}
                    />
                    {t("mx_read_ack")}
                    {acked ? <CheckCircle2 className="w-4 h-4" style={{ color: "#16a34a" }} /> : null}
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Inline knowledge checks */}
      {questions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.76rem", fontWeight: 800, color: "var(--color-muted)" }}>
            <HelpCircle className="w-3.5 h-3.5" /> {t("mx_checks")}
          </div>
          {questions.map((q) => (
            <InlineQuestion
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
            />
          ))}
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {attachments.map((file, i) => (
            <a
              key={`${file.url}-${i}`}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "8px 13px", borderRadius: "9px", fontSize: "0.78rem", fontWeight: 700,
                border: "1px solid var(--border)", color: "var(--text)", textDecoration: "none"
              }}
            >
              <Paperclip className="w-3.5 h-3.5" /> {file.name ?? t("mx_attachment")}
            </a>
          ))}
        </div>
      )}

      {/* Progress hint while gated */}
      {shouldGate && !module.completed && (
        <div className="muted" style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "0.75rem", fontWeight: 700 }}>
          <Clock className="w-3.5 h-3.5" />
          {satisfied ? t("mx_requirements_met") : t("mx_requirements_pending")}
        </div>
      )}
    </div>
  );
}

interface InlineQuestionProps {
  question: SlideQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}

function InlineQuestion({ question, value, onChange }: InlineQuestionProps) {
  const { t } = useTranslation();
  const type = question.questionType ?? "single_choice";
  const options = question.options ?? [];

  const answered =
    value === undefined || value === null
      ? false
      : type === "text_input"
        ? String(value).trim().length > 0
        : type === "multiple_choice"
          ? Array.isArray(value) && value.length > 0
          : true;

  const isCorrect = answered && isQuestionCorrect(question, value);
  const attempted = answered && !isCorrect;

  const selectedList = Array.isArray(value) ? (value as number[]) : [];
  const expected = (question.correctAnswers ?? []).map(Number);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "11px", padding: "15px", background: "var(--bg-elevated, rgba(255,255,255,.03))" }}>
      <strong style={{ display: "block", fontSize: "0.88rem", marginBottom: "11px" }}>{question.prompt || question.question}</strong>

      {type === "text_input" ? (
        <>
          <input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("mx_type_answer")}
            style={{
              width: "100%", padding: "10px 13px", borderRadius: "9px",
              border: "1px solid var(--border)", background: "var(--bg-elevated)",
              color: "var(--text)", fontSize: "0.86rem"
            }}
          />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {options.map((opt, idx) => {
            const isSelected = type === "multiple_choice" ? selectedList.includes(idx) : Number(value) === idx;
            const isExpected = type === "multiple_choice" ? expected.includes(idx) : Number(question.correctAnswer ?? 0) === idx;
            const reveal = attempted || isCorrect;

            let style: React.CSSProperties = {
              display: "flex", alignItems: "center", gap: "9px",
              padding: "8px 11px", borderRadius: "9px", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: 600,
              border: "1px solid transparent", background: "transparent"
            };
            if (isSelected) style = { ...style, background: "rgba(37,99,235,.1)", borderColor: "rgba(37,99,235,.4)" };
            if (reveal && isExpected) style = { ...style, background: "rgba(22,163,74,.13)", borderColor: "rgba(22,163,74,.4)", color: "#86efac" };
            if (reveal && isSelected && !isExpected) style = { ...style, background: "rgba(239,68,68,.13)", borderColor: "rgba(239,68,68,.4)", color: "#fca5a5" };

            return (
              <label key={idx} style={style}>
                <input
                  type={type === "multiple_choice" ? "checkbox" : "radio"}
                  name={`mx-q-${question.id}`}
                  checked={isSelected}
                  onChange={() => {
                    if (type === "multiple_choice") {
                      const next = selectedList.includes(idx)
                        ? selectedList.filter((v) => v !== idx)
                        : [...selectedList, idx];
                      onChange(next);
                    } else {
                      onChange(idx);
                    }
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {attempted && question.explanation && (
        <div
          style={{
            marginTop: "11px", padding: "10px 13px", borderRadius: "9px",
            fontSize: "0.79rem", fontWeight: 600,
            background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)", color: "#fbbf24"
          }}
        >
          {question.explanation}
        </div>
      )}

      {attempted && !question.explanation && (
        <div className="muted" style={{ marginTop: "11px", fontSize: "0.78rem", fontWeight: 600 }}>
          {t("mx_try_again")}
        </div>
      )}
    </div>
  );
}

export default ModuleExtras;
