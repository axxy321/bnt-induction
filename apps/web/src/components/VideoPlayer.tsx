import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Info, Shield, Play, Pause } from "lucide-react";
import { motion } from "framer-motion";

interface VideoPlayerProps {
  src: string;
  onComplete: () => Promise<void> | void;
  onStart?: () => void;
  className?: string;
  savedPosition?: number;
  onPositionUpdate?: (seconds: number) => void;
  onDurationChange?: (seconds: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoPlayer({ src, onComplete, onStart, className = "", savedPosition, onPositionUpdate, onDurationChange }: VideoPlayerProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completionError, setCompletionError] = useState("");

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef(0);
  const isSeekingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout>();
  const completeFiredRef = useRef(false);
  const lastSavedPosRef = useRef(0);

  // Extract Youtube ID
  let videoId = "";
  if (src.includes("youtube.com/embed/")) {
    videoId = src.split("embed/")[1].split("?")[0];
  } else if (src.includes("watch?v=")) {
    videoId = src.split("watch?v=")[1].split("&")[0];
  } else if (src.includes("youtu.be/")) {
    videoId = src.split("youtu.be/")[1].split("?")[0];
  }

  const isMp4 = src.toLowerCase().endsWith(".mp4") || src.toLowerCase().endsWith(".webm");

  useEffect(() => {
    setProgress(0);
    setCompleted(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    maxWatchedRef.current = 0;
    completeFiredRef.current = false;

    if (!videoId) return;

    const loadYoutubeApi = () => {
      if (!window.YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }

        window.onYouTubeIframeAPIReady = () => {
          initPlayer(videoId);
        };
      } else if (window.YT && window.YT.Player) {
        initPlayer(videoId);
      } else {
        const pollYT = setInterval(() => {
          if (window.YT && window.YT.Player) {
            clearInterval(pollYT);
            initPlayer(videoId);
          }
        }, 100);
        intervalRef.current = pollYT;
      }
    };

    const initPlayer = (id: string) => {
      if (!containerRef.current) return;
      try {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1
          },
          events: {
            onReady: () => {
              if (savedPosition && savedPosition > 0 && playerRef.current?.seekTo) {
                try {
                  playerRef.current.seekTo(savedPosition, true);
                  onPositionUpdate?.(savedPosition);
                  lastSavedPosRef.current = savedPosition;
                } catch {}
              }
            },
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                onStart?.();
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.current = setInterval(() => {
                  if (playerRef.current?.getCurrentTime) {
                    const curr = playerRef.current.getCurrentTime();
                    const dur = playerRef.current.getDuration();
                    if (dur > 0) {
                      setCurrentTime(curr);
                      setDuration(dur);
                      onDurationChange?.(dur);
                      const pct = (curr / dur) * 100;
                      setProgress(pct);
                      if (onPositionUpdate && curr - lastSavedPosRef.current >= 5) {
                        lastSavedPosRef.current = curr;
                        onPositionUpdate(curr);
                      }
                      // Complete no earlier than 8s before the end so the
                      // server-side minimum-watch check is satisfied.
                      const completionThreshold = Math.max(90, ((dur - 8) / dur) * 100);
                      if (pct >= completionThreshold) void markCompleted();
                    }
                  }
                }, 1000);
              } else {
                setIsPlaying(false);
                if (event.data === window.YT.PlayerState.ENDED) {
                  void markCompleted();
                }
              }
            }
          }
        });
      } catch {}
    };

    loadYoutubeApi();

    return () => {
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch {}
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const markCompleted = async () => {
    if (completed || completeFiredRef.current) return;

    completeFiredRef.current = true;
    setCompleted(true);
    setProgress(100);
    setCompletionError("");

    try {
      await onComplete();
    } catch (err) {
      completeFiredRef.current = false;
      setCompleted(false);
      setProgress(90);
      const message = err instanceof Error && err.message
        ? err.message
        : t("vid_error_default");
      setCompletionError(message);    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isSeekingRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration;

    if (dur > 0) {
      if (curr > maxWatchedRef.current + 2) {
        isSeekingRef.current = true;
        videoRef.current.currentTime = maxWatchedRef.current;
        setTimeout(() => { isSeekingRef.current = false; }, 300);
        return;
      }
      if (curr > maxWatchedRef.current) {
        maxWatchedRef.current = curr;
      }
      setCurrentTime(curr);
      setDuration(dur);
      const pct = (curr / dur) * 100;
      setProgress(pct);
      if (onPositionUpdate && curr - lastSavedPosRef.current >= 5) {
        lastSavedPosRef.current = curr;
        onPositionUpdate(curr);
      }
      // Complete no earlier than 8s before the end so the server-side
      // minimum-watch check (duration - 10s buffer) is satisfied.
      const completionThreshold = Math.max(90, ((dur - 8) / dur) * 100);
      if (pct >= completionThreshold) markCompleted();
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur > 0) {
      setDuration(dur);
      onDurationChange?.(dur);
    }
    if (savedPosition && savedPosition > 0 && dur > 0) {
      const target = Math.min(savedPosition, Math.max(0, dur - 5));
      videoRef.current.currentTime = target;
      maxWatchedRef.current = target;
      setCurrentTime(target);
      const pct = (target / dur) * 100;
      setProgress(pct);
      onPositionUpdate?.(target);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`
    : null;

  return (
    <div className={`video-container ${className}`} style={{ marginBottom: "24px" }}>
      <div
        style={{
          borderRadius: "20px",
          overflow: "hidden",
          background: "#090d16",
          border: "1px solid var(--border, #334155)",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.3)",
          color: "#ffffff"
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(90deg, #0f172a, #1e293b)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.92rem", color: "#f8fafc" }}>
                {t("vid_stream")}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                {t("vid_branding")}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "4px 12px",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: completed ? "rgba(34, 197, 94, 0.2)" : "rgba(37, 99, 235, 0.2)",
              color: completed ? "#4ade80" : "#60a5fa",
              border: `1px solid ${completed ? "rgba(34, 197, 94, 0.4)" : "rgba(37, 99, 235, 0.4)"}`,
              display: "inline-flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {completed ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> {t("vid_completed")}</>
            ) : isPlaying ? (
              <><Play className="w-3.5 h-3.5 fill-current" /> {t("vid_playing")}</>
            ) : (
              <><Pause className="w-3.5 h-3.5 fill-current" /> {t("vid_ready")}</>
            )}
          </div>
        </div>

        {/* Video Player Display */}
        {embedUrl ? (
          /* Official YouTube Embed Player */
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingTop: "56.25%",
              background: "#000000"
            }}
          >
            <iframe
              src={embedUrl}
              title={t("vid_embed_title")}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "none"
              }}
            />
          </div>
        ) : isMp4 ? (
          /* Native HTML5 Video Player */
          <div style={{ position: "relative", width: "100%", background: "#000000" }}>
            <video
              ref={videoRef}
              src={src}
              controls
              controlsList="nodownload"
              playsInline
              preload="metadata"
              style={{ width: "100%", maxHeight: "420px", display: "block" }}
              onPlay={() => {
                setIsPlaying(true);
                onStart?.();
              }}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => void markCompleted()}
            />
          </div>
        ) : null}

        {/* Footer Progress & Action Button */}
        <div style={{ padding: "16px 20px", background: "#0f172a" }}>
          {duration > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}>
                <span>{t("vid_progress", { current: formatTime(currentTime), total: formatTime(duration) })}</span>
                <span>{t("vid_watched", { pct: Math.round(progress) })}</span>
              </div>

              <div style={{ height: "6px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "3px", overflow: "hidden" }}>
                <motion.div
                  style={{ height: "100%", background: completed ? "#22c55e" : "#3b82f6", borderRadius: "3px" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            {completed ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#4ade80", fontSize: "0.85rem", fontWeight: 700 }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{t("vid_clear")}</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", fontSize: "0.8rem" }}>
                <Info className="w-4 h-4 text-blue-400" />
                <span>{t("vid_instruction")}</span>
              </div>
            )}

          </div>
          {completionError && (
            <p role="alert" style={{ color: "#fca5a5", fontSize: "0.82rem", margin: "12px 0 0" }}>
              {completionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
