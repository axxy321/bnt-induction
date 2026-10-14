import type { CSSProperties } from "react";

interface SkeletonProps {
  style?: CSSProperties;
}

export function Skeleton({ style }: SkeletonProps) {
  return <div className="skeleton" style={style} />;
}
