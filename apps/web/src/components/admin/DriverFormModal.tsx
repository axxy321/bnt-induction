import React, { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, X } from "lucide-react";
import { AdminDriverRow, DriverFormInput } from "../../types";

interface DriverFormModalProps {
  driver?: AdminDriverRow | null;
  onSave: (input: DriverFormInput & { password?: string }) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function DriverFormModal({ driver, onSave, onClose, loading }: DriverFormModalProps) {
  const { t } = useTranslation();
  const isEditing = !!driver;

  const [formData, setFormData] = useState({
    fullName: driver?.fullName || "",
    email: driver?.email || "",
    phone: driver?.phone || "",
    address: driver?.address || "",
    preferredLanguage: driver?.preferredLanguage || "English",
    licenceClass: driver?.licenceClass || "HC",
    issuingState: driver?.issuingState || "VIC",
    licenceNumber: driver?.licenceNumber || "",
    depotLocation: driver?.depotLocation || "Melbourne Hub",
    password: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = t("drf_err_name");
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      errs.email = t("drf_err_email");
    }
    if (!formData.phone.trim() || formData.phone.trim().length < 5) {
      errs.phone = t("drf_err_phone");
    }
    if (!formData.address.trim() || formData.address.trim().length < 3) {
      errs.address = t("drf_err_address");
    }
    if (!/^[A-Z0-9]{8}$/.test(formData.licenceNumber.trim().toUpperCase())) {
      errs.licenceNumber = t("reg_err_licence");
    }
    if (!isEditing && (!formData.password || formData.password.length < 8)) {
      errs.password = t("drf_err_password");
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave(formData);
    } catch (err: any) {
      setSubmitError(err?.message || t("drf_err_save"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "16px"
      }}
    >
      <div
        className="glass responsive-modal-box"
        style={{
          width: "100%",
          maxWidth: "580px",
          padding: "clamp(16px, 4vw, 28px)",
          borderRadius: "20px",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
            {isEditing ? t("drf_edit_title", { name: driver.fullName }) : t("drf_add_title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <X className="w-5 h-5 text-slate-500 hover:text-slate-800" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {submitError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                padding: "10px 14px",
                borderRadius: "10px",
                marginBottom: "16px",
                fontSize: "0.85rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_full_name")}
              </label>
              <input
                type="text"
                placeholder={t("drf_name_ph")}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              {errors.fullName && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.fullName}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_email")}
              </label>
              <input
                type="email"
                placeholder="driver@bntlogistics.com.au"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`form-input ${errors.email ? "form-input--error" : ""}`}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              {errors.email && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.email}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_phone")}
              </label>
              <input
                type="tel"
                placeholder={t("drf_phone_ph")}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`form-input ${errors.phone ? "form-input--error" : ""}`}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              {errors.phone && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.phone}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_depot")}
              </label>
              <select
                value={formData.depotLocation}
                onChange={(e) => setFormData({ ...formData, depotLocation: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              >
                <option value="Melbourne Hub">{t("drf_depot_melbourne")}</option>
                <option value="Sydney Hub">{t("drf_depot_sydney")}</option>
                <option value="Brisbane Hub">{t("drf_depot_brisbane")}</option>
                <option value="Adelaide Hub">{t("drf_depot_adelaide")}</option>
                <option value="Perth Hub">{t("drf_depot_perth")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_licence_class")}
              </label>
              <select
                value={formData.licenceClass}
                onChange={(e) => setFormData({ ...formData, licenceClass: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              >
                <option value="MC">{t("drf_lc_mc")}</option>
                <option value="HC">{t("drf_lc_hc")}</option>
                <option value="HR">{t("drf_lc_hr")}</option>
                <option value="MR">{t("drf_lc_mr")}</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_state")}
              </label>
              <select
                value={formData.issuingState}
                onChange={(e) => setFormData({ ...formData, issuingState: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              >
                <option value="VIC">VIC</option>
                <option value="NSW">NSW</option>
                <option value="QLD">QLD</option>
                <option value="SA">SA</option>
                <option value="WA">WA</option>
                <option value="TAS">TAS</option>
                <option value="NT">NT</option>
                <option value="ACT">ACT</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_licence_number")}
              </label>
              <input
                type="text"
                placeholder={t("drf_licence_ph")}
                maxLength={8}
                minLength={8}
                value={formData.licenceNumber}
                onChange={(e) => setFormData({ ...formData, licenceNumber: e.target.value.toUpperCase() })}
                className={errors.licenceNumber ? "form-input form-input--error" : "form-input"}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              <span style={{ color: "#64748b", fontSize: "0.72rem" }}>Enter exactly 8 letters or numbers.</span>
              {errors.licenceNumber && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.licenceNumber}</span>}
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("drf_address")}
            </label>
            <input
              type="text"
              placeholder={t("drf_address_ph")}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={`form-input ${errors.address ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
            {errors.address && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.address}</span>}
          </div>

          {!isEditing && (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                {t("drf_password")}
              </label>
              <input
                type="password"
                placeholder={t("drf_password_ph")}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`form-input ${errors.password ? "form-input--error" : ""}`}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              {errors.password && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.password}</span>}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "transparent", cursor: "pointer" }}
            >
              {t("drf_cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loading}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#1e3a5f",
                color: "#fff",
                fontWeight: 700,
                cursor: isSubmitting || loading ? "not-allowed" : "pointer",
                opacity: isSubmitting || loading ? 0.7 : 1
              }}
            >
              {isSubmitting || loading
                ? isEditing
                  ? t("drf_updating")
                  : t("drf_creating")
                : isEditing
                ? t("drf_update")
                : t("drf_create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
