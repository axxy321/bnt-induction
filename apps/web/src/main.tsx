import React, { Component, ErrorInfo, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./state/AppProvider";
import "./styles.css";
import "./i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#f8fafc", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "32px", maxWidth: "560px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⚠️</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 12px", color: "#f43f5e" }}>
              Application Initialization Warning
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 20px" }}>
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </p>
            <div style={{ background: "#0f172a", padding: "12px 16px", borderRadius: "8px", fontSize: "0.8rem", color: "#cbd5e1", textAlign: "left", marginBottom: "20px", wordBreak: "break-word" }}>
              <strong>Vercel Deployment Checklist:</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
                <li>Set <code>VITE_SUPABASE_URL</code> in Vercel Environment Variables</li>
                <li>Set <code>VITE_SUPABASE_ANON_KEY</code> in Vercel Environment Variables</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#1e3a5f", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
            >
              🔄 Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

