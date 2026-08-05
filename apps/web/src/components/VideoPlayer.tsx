import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface VideoPlayerProps {
  src: string;
  onComplete: () => void;
  onStart?: () => void;
  className?: string;
}

export function VideoPlayer({ src, onComplete, onStart, className = "" }: VideoPlayerProps) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxWatchedRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Prevent scrubbing forward
    const handleSeeking = () => {
      // Allow a 1-second buffer for browser rounding
      if (video.currentTime > maxWatchedRef.current + 1) {
        video.currentTime = maxWatchedRef.current;
      }
    };

    video.addEventListener("seeking", handleSeeking);
    
    const handlePlay = () => {
      if (!started) {
        setStarted(true);
        if (onStart) onStart();
      }
    };
    video.addEventListener("play", handlePlay);
    
    return () => {
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("play", handlePlay);
    };
  }, [started, onStart]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;
    
    // Track the FURTHEST point the user has watched legitimately
    if (current > maxWatchedRef.current) {
      maxWatchedRef.current = current;
    }

    if (total > 0) {
      const MathPercentage = (current / total) * 100;
      setProgress(MathPercentage);

      // Mark complete if within 1 second of the end
      if (total - current <= 1 && !completed) {
        setCompleted(true);
        onComplete();
      }
    }
  };

  return (
    <div className={`video-container ${className}`} style={{ marginBottom: '24px' }}>
      <video
        ref={videoRef}
        src={src}
        controls
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        onTimeUpdate={handleTimeUpdate}
        style={{ width: "100%", borderRadius: "12px", background: "#000", border: '1px solid #334155' }}
      />
      <div style={{ marginTop: "12px", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: 'hidden' }}>
        <motion.div
          style={{ height: "100%", background: completed ? "#22c55e" : "#3b82f6", borderRadius: "3px" }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>
      {completed ? (
        <p style={{ marginTop: "12px", color: "#16a34a", fontSize: "0.875rem", fontWeight: 600 }}>
          ✓ Video requirements met. You may continue to the next section.
        </p>
      ) : (
        <p style={{ marginTop: "12px", color: "#64748b", fontSize: "0.800rem", fontStyle: "italic" }}>
          You must watch this video in full. Fast-forwarding is disabled.
        </p>
      )}
    </div>
  );
}
