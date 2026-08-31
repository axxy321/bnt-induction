import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { DriverSelfRegisterInput } from "../../types";

interface RegisterFormProps {
  onRegister: (input: DriverSelfRegisterInput) => Promise<void>;
  onSwitchToLogin: () => void;
  loading: boolean;
  error?: string | null;
}

export function RegisterForm({ onRegister, onSwitchToLogin, loading, error }: RegisterFormProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    preferredLanguage: "English",
    password: "",
    confirmPassword: "",
    licenceClass: "HC",
    issuingState: "VIC",
    licenceNumber: "",
    depotLocation: "Melbourne Hub"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = "Full legal name is required (minimum 2 characters).";
    }
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errs.email = "Please enter a complete email address (e.g. driver@domain.com.au).";
    }
    if (!formData.phone.trim() || formData.phone.trim().length < 8) {
      errs.phone = "Please enter a valid mobile number (e.g. 0400 123 456).";
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      errs.address = "Please enter your full residential address.";
    }
    if (formData.password.length < 8) {
      errs.password = "Password must be at least 8 characters long.";
    }
    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onRegister({
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      preferredLanguage: formData.preferredLanguage,
      password: formData.password,
      depotCode: formData.depotLocation,
      licenceClass: formData.licenceClass,
      issuingState: formData.issuingState,
      licenceNumber: formData.licenceNumber.trim()
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass"
      style={{
        maxWidth: "620px",
        margin: "24px auto",
        padding: "36px 32px",
        borderRadius: "24px"
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <span
          style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "999px",
            background: "rgba(37, 99, 235, 0.1)",
            color: "var(--primary)",
            fontWeight: 700,
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "10px"
          }}
        >
          Heavy Vehicle Driver Onboarding
        </span>
        <h2 style={{ fontSize: "1.65rem", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Driver Profile Registration
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          BNT Logistics • Australian HVNL Compliance Portal
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            marginBottom: "24px",
            fontSize: "0.88rem",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Section 1: Identity & Contact */}
        <div
          style={{
            background: "rgba(148, 163, 184, 0.05)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px"
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary)", marginBottom: "14px" }}>
            1. Driver Identity & Contact Details
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Full Legal Name *
              </label>
              <input
                type="text"
                className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
                placeholder="e.g. John Edward Citizen"
                value={formData.fullName}
                onChange={(e) => {
                  setFormData({ ...formData, fullName: e.target.value });
                  if (errors.fullName) setErrors({ ...errors, fullName: "" });
                }}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              />
              {errors.fullName && <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.fullName}</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  className={`form-input ${errors.email ? "form-input--error" : ""}`}
                  placeholder="driver@bntlogistics.com.au"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: "" });
                  }}
                  disabled={loading}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
                />
                {errors.email && <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.email}</span>}
              </div>

              <div>
                <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                  Mobile Phone *
                </label>
                <input
                  type="tel"
                  className={`form-input ${errors.phone ? "form-input--error" : ""}`}
                  placeholder="0400 123 456"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (errors.phone) setErrors({ ...errors, phone: "" });
                  }}
                  disabled={loading}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
                />
                {errors.phone && <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.phone}</span>}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Residential Address *
              </label>
              <input
                type="text"
                className={`form-input ${errors.address ? "form-input--error" : ""}`}
                placeholder="12 Logistics Way, Altona VIC 3018"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (errors.address) setErrors({ ...errors, address: "" });
                }}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              />
              {errors.address && <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.address}</span>}
            </div>
          </div>
        </div>

        {/* Section 2: Heavy Vehicle Compliance Details */}
        <div
          style={{
            background: "rgba(148, 163, 184, 0.05)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px"
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary)", marginBottom: "14px" }}>
            2. Heavy Vehicle Licence & Depot Hub Allocation
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Licence Class
              </label>
              <select
                className="form-input"
                value={formData.licenceClass}
                onChange={(e) => setFormData({ ...formData, licenceClass: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              >
                <option value="MC">MC - Multi-Combination</option>
                <option value="HC">HC - Heavy Combination</option>
                <option value="HR">HR - Heavy Rigid</option>
                <option value="MR">MR - Medium Rigid</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                State of Issue
              </label>
              <select
                className="form-input"
                value={formData.issuingState}
                onChange={(e) => setFormData({ ...formData, issuingState: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              >
                <option value="VIC">VIC - Victoria</option>
                <option value="NSW">NSW - New South Wales</option>
                <option value="QLD">QLD - Queensland</option>
                <option value="SA">SA - South Australia</option>
                <option value="WA">WA - Western Australia</option>
                <option value="TAS">TAS - Tasmania</option>
                <option value="NT">NT - Northern Territory</option>
                <option value="ACT">ACT - Capital Territory</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Licence Number
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 09876543"
                value={formData.licenceNumber}
                onChange={(e) => setFormData({ ...formData, licenceNumber: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              />
            </div>

            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Assigned Depot Hub
              </label>
              <select
                className="form-input"
                value={formData.depotLocation}
                onChange={(e) => setFormData({ ...formData, depotLocation: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              >
                <option value="Melbourne Hub">Melbourne Hub (Altona)</option>
                <option value="Sydney Hub">Sydney Hub (Eastern Creek)</option>
                <option value="Brisbane Hub">Brisbane Hub (Rocklea)</option>
                <option value="Adelaide Hub">Adelaide Hub (Regency Park)</option>
                <option value="Perth Hub">Perth Hub (Kewdale)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Password Security */}
        <div
          style={{
            background: "rgba(148, 163, 184, 0.05)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "20px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--primary)" }}>
              3. Account Security Credentials
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
            >
              {showPassword ? "👁️ Hide Passwords" : "👁️ Show Passwords"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Create Password *
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? "form-input--error" : ""}`}
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (errors.password) setErrors({ ...errors, password: "" });
                }}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              />
              {errors.password && <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.password}</span>}
            </div>

            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                Confirm Password *
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.confirmPassword ? "form-input--error" : ""}`}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: "" });
                }}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              />
              {errors.confirmPassword && (
                <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.confirmPassword}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
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
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 10px 24px rgba(37, 99, 235, 0.25)",
            transition: "all 0.18s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          {loading ? (
            <>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>🔄</span>
              <span>Creating Account & Setting Up Induction...</span>
            </>
          ) : (
            "Complete Registration & Begin Induction →"
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div style={{ marginTop: "24px", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
        <span className="muted" style={{ fontSize: "0.88rem", marginRight: "8px" }}>
          Already have an account?
        </span>
        <button
          type="button"
          onClick={onSwitchToLogin}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--primary)",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "0.88rem"
          }}
        >
          Return to Login →
        </button>
      </div>
    </motion.div>
  );
}
