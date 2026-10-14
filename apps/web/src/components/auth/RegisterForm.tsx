import { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { DriverSelfRegisterInput } from "../../types";

interface RegisterFormProps {
  onRegister: (input: DriverSelfRegisterInput) => Promise<void>;
  onSwitchToLogin: () => void;
  loading: boolean;
  error?: string | null;
}

export function RegisterForm({ onRegister, onSwitchToLogin, loading, error }: RegisterFormProps) {
  const { t } = useTranslation();
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
      errs.fullName = t("reg_err_name");
    }
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errs.email = t("reg_err_email");
    }
    if (!formData.phone.trim() || formData.phone.trim().length < 8) {
      errs.phone = t("reg_err_phone");
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      errs.address = t("reg_err_address");
    }
    if (!/^[A-Z0-9]{8}$/.test(formData.licenceNumber.trim().toUpperCase())) {
      errs.licenceNumber = t("reg_err_licence");
    }
    if (formData.password.length < 8) {
      errs.password = t("reg_err_password");
    }
    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = t("reg_err_confirm");
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
          {t("reg_badge")}
        </span>
        <h2 style={{ fontSize: "1.65rem", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {t("reg_title")}
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          {t("reg_subtitle")}
        </p>      </div>

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
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
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
            {t("reg_s1")}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                {t("reg_name")}
              </label>
              <input
                type="text"
                className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
                placeholder={t("reg_name_ph")}
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
                  {t("reg_email")}
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
                  {t("reg_phone")}
                </label>
                <input
                  type="tel"
                  className={`form-input ${errors.phone ? "form-input--error" : ""}`}
                  placeholder={t("reg_phone_ph")}
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
                {t("reg_address")}
              </label>
              <input
                type="text"
                className={`form-input ${errors.address ? "form-input--error" : ""}`}
                placeholder={t("reg_address_ph")}
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
            {t("reg_s2")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                {t("reg_licence_class")}
              </label>
              <select
                className="form-input"
                value={formData.licenceClass}
                onChange={(e) => setFormData({ ...formData, licenceClass: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              >
                <option value="MC">{t("reg_lc_mc")}</option>
                <option value="HC">{t("reg_lc_hc")}</option>
                <option value="HR">{t("reg_lc_hr")}</option>
                <option value="MR">{t("reg_lc_mr")}</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                {t("reg_state")}
              </label>
              <select
                className="form-input"
                value={formData.issuingState}
                onChange={(e) => setFormData({ ...formData, issuingState: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              >
                <option value="VIC">{t("reg_state_vic")}</option>
                <option value="NSW">{t("reg_state_nsw")}</option>
                <option value="QLD">{t("reg_state_qld")}</option>
                <option value="SA">{t("reg_state_sa")}</option>
                <option value="WA">{t("reg_state_wa")}</option>
                <option value="TAS">{t("reg_state_tas")}</option>
                <option value="NT">{t("reg_state_nt")}</option>
                <option value="ACT">{t("reg_state_act")}</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                {t("reg_licence_number")}
              </label>
              <input
                type="text"
                className="form-input"
                placeholder={t("reg_licence_ph")}
                maxLength={8}
                minLength={8}
                value={formData.licenceNumber}
                onChange={(e) => setFormData({ ...formData, licenceNumber: e.target.value.toUpperCase() })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              />
              <span style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "4px", display: "block" }}>Enter exactly 8 letters or numbers.</span>
              {errors.licenceNumber && <span style={{ color: "#ef4444", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>{errors.licenceNumber}</span>}
            </div>

            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                {t("reg_depot")}
              </label>
              <select
                className="form-input"
                value={formData.depotLocation}
                onChange={(e) => setFormData({ ...formData, depotLocation: e.target.value })}
                disabled={loading}
                style={{ width: "100%", padding: "10px 14px", borderRadius: "10px" }}
              >
                <option value="Melbourne Hub">{t("reg_depot_melbourne")}</option>
                <option value="Sydney Hub">{t("reg_depot_sydney")}</option>
                <option value="Brisbane Hub">{t("reg_depot_brisbane")}</option>
                <option value="Adelaide Hub">{t("reg_depot_adelaide")}</option>
                <option value="Perth Hub">{t("reg_depot_perth")}</option>
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
              {t("reg_s3")}
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
            >
              <span className="flex items-center gap-1">
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? t("reg_hide") : t("reg_show")}</span>
              </span>
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label className="form-label" style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px" }}>
                {t("reg_password")}
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? "form-input--error" : ""}`}
                placeholder={t("reg_password_ph")}
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
                {t("reg_confirm")}
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.confirmPassword ? "form-input--error" : ""}`}
                placeholder={t("reg_confirm_ph")}
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
              <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
              <span>{t("reg_creating")}</span>
            </>
          ) : (
            t("reg_submit")
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div style={{ marginTop: "24px", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
        <span className="muted" style={{ fontSize: "0.88rem", marginRight: "8px" }}>
          {t("reg_have_account")}
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
          {t("reg_return")}
        </button>
      </div>
    </motion.div>
  );
}
