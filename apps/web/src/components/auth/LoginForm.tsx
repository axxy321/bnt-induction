import { useState, FormEvent } from "react";
import { motion } from "framer-motion";

interface LoginFormProps {
  onLogin: (input: { email: string; password: string; role: "driver" | "admin" }) => Promise<void>;
  loading: boolean;
  error?: string | null;
}

export function LoginForm({ onLogin, loading, error }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"driver" | "admin">("driver");
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = "Please enter a valid email address (e.g. driver@domain.com.au).";
    }
    if (!password) {
      errs.password = "Password is required.";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onLogin({ email: email.trim(), password, role });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass"
      style={{
        maxWidth: "460px",
        margin: "36px auto",
        padding: "36px 32px",
        borderRadius: "24px"
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 800,
            color: "var(--primary)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "10px"
          }}
        >
          BNT Logistics
        </span>
        <h2 style={{ fontSize: "1.65rem", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Driver Safety Portal
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Internal Heavy Vehicle Induction & Compliance System
        </p>
      </div>

      {/* Role Switcher */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          background: "rgba(148, 163, 184, 0.14)",
          padding: "4px",
          borderRadius: "14px",
          marginBottom: "24px"
        }}
      >
        <button
          type="button"
          onClick={() => setRole("driver")}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.85rem",
            background: role === "driver" ? "var(--primary, #2563eb)" : "transparent",
            color: role === "driver" ? "#ffffff" : "var(--muted)",
            transition: "all 0.18s ease"
          }}
        >
          Heavy Vehicle Driver
        </button>
        <button
          type="button"
          onClick={() => setRole("admin")}
          style={{
            flex: 1,
            padding: "10px 14px",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.85rem",
            background: role === "admin" ? "var(--primary, #2563eb)" : "transparent",
            color: role === "admin" ? "#ffffff" : "var(--muted)",
            transition: "all 0.18s ease"
          }}
        >
          Compliance Manager
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
            Email Address *
          </label>
          <input
            type="email"
            className={`form-input ${formErrors.email ? "form-input--error" : ""}`}
            placeholder="driver@bntlogistics.com.au"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
            }}
            disabled={loading}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
          />
          {formErrors.email && (
            <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>
              {formErrors.email}
            </span>
          )}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <label className="form-label" style={{ fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>
              Password *
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
            >
              {showPassword ? "👁️ Hide" : "👁️ Show"}
            </button>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            className={`form-input ${formErrors.password ? "form-input--error" : ""}`}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
            }}
            disabled={loading}
            style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
          />
          {formErrors.password && (
            <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>
              {formErrors.password}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            border: "none",
            background: "linear-gradient(135deg, var(--primary, #2563eb), #1d4ed8)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "0.98rem",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)",
            marginTop: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          {loading ? (
            <>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>🔄</span>
              <span>Authenticating...</span>
            </>
          ) : role === "driver" ? (
            "Start Driver Induction →"
          ) : (
            "Sign In to Management Portal →"
          )}
        </button>
      </form>

      {role === "driver" && (
        <div style={{ marginTop: "24px", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
          <p className="muted" style={{ fontSize: "0.88rem", margin: "0 0 8px" }}>
            New drivers must receive an induction account from a compliance manager.
          </p>
        </div>
      )}
    </motion.div>
  );
}
