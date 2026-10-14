interface SparklineProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = "#16a34a", height = 36 }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 120;
  const step = width / (data.length - 1);
  const y = (v: number) => height - 3 - ((v - min) / range) * (height - 6);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = ((values.length - 1) * step).toFixed(1);
  const lastY = y(values[values.length - 1]).toFixed(1);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: "block", overflow: "visible", flexShrink: 0 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}
