import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string; type: "success" | "error"; exiting?: boolean };

let pushFn: ((message: string, type: "success" | "error") => void) | null = null;

export function showToast(message: string, type: "success" | "error" = "success") {
  pushFn?.(message, type);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (message, type) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.map((item) => item.id === id ? { ...item, exiting: true } : item));
        window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 280);
      }, 2700);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
        maxWidth: "min(320px, calc(100vw - 32px))"
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-slide${toast.exiting ? " toast-slide-out" : ""}`}
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            background: toast.type === "success" ? "rgba(22,163,74,0.95)" : "rgba(220,38,38,0.95)",
            color: "#ffffff"
          }}
        >
          <span style={{ fontSize: "1rem", lineHeight: 1 }}>{toast.type === "success" ? "✓" : "!"}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
