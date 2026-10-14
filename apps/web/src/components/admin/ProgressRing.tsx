interface ProgressRingProps {
  value: number;
  label: string;
  detail?: string;
  size?: number;
  strokeWidth?: number;
}

function ringColor(value: number): string {
  if (value >= 80) return "#16a34a";
  if (value >= 50) return "#d97706";
  return "#dc2626";
}

export function ProgressRing({ value, label, detail, size = 120, strokeWidth = 12 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const offset = circumference * (1 - clamped / 100);
  const color = ringColor(clamped);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.25)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <strong style={{ fontSize: "1.5rem", lineHeight: 1, color }}>{clamped}%</strong>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text, #0f172a)" }}>{label}</div>
        {detail ? (
          <div style={{ fontSize: "0.7rem", marginTop: "2px", color: "var(--muted, #475569)" }}>{detail}</div>
        ) : null}
      </div>
    </div>
  );
}
