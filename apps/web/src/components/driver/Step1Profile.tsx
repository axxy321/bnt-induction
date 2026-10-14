import { useEffect, useRef, useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { DriverProfile, DriverFormInput } from "../../types";
import { useAppState } from "../../state/AppContext";
import { api } from "../../lib/api";

interface Step1ProfileProps {
  driver: DriverProfile;
  onSave: (input: DriverFormInput) => Promise<void>;
  loading: boolean;
}

const LICENCE_FORMATS: Record<string, { regex: RegExp; hint: string }> = Object.fromEntries(
  ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map((state) => [
    state,
    { regex: /^[A-Z0-9]{8}$/, hint: "Exactly 8 letters or numbers (e.g. 09876543)." }
  ])
);

const AU_PHONE_REGEX = /^(?:\+?61|0)4\d{8}$/;

function formatAustralianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("61") ? `0${digits.slice(3)}` : digits.startsWith("0") ? digits : `0${digits}`;
  if (normalized.length <= 4) return normalized;
  if (normalized.length <= 7) return `${normalized.slice(0, 4)} ${normalized.slice(4)}`;
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)}`;
}

export function Step1Profile({ driver, onSave, loading }: Step1ProfileProps) {
  const { t } = useTranslation();
  const { session } = useAppState();
  const authEmail = session?.user?.email || driver.email || "";

  const [formData, setFormData] = useState<DriverFormInput>({
    fullName: driver.fullName || "",
    email: authEmail,
    phone: driver.phone || "",
    address: driver.address || "",
    preferredLanguage: driver.preferredLanguage || "English",
    licenceClass: driver.licenceClass || "HC",
    issuingState: driver.issuingState || "VIC",
    licenceNumber: driver.licenceNumber || "",
    depotLocation: driver.depotLocation || "Melbourne Hub"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licenceChecking, setLicenceChecking] = useState(false);
  const [licenceUnique, setLicenceUnique] = useState<boolean | null>(null);
  const licenceCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const licenceCheckAbort = useRef(0);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, email: authEmail }));
  }, [authEmail]);

  const validateLicenceFormat = (licenceNumber: string, issuingState: string): string | null => {
    const trimmed = licenceNumber.trim().toUpperCase();
    if (!trimmed) return t("err_licence_required");
    const format = LICENCE_FORMATS[issuingState || "VIC"];
    if (format && !format.regex.test(trimmed)) {
      return t("err_licence_format", { state: issuingState, hint: format.hint });
    }
    return null;
  };

  const checkLicenceDuplicate = (licenceNumber: string, issuingState: string) => {
    if (licenceCheckTimer.current) {
      clearTimeout(licenceCheckTimer.current);
    }

    const trimmed = licenceNumber.trim().toUpperCase();
    const formatError = validateLicenceFormat(trimmed, issuingState);
    if (formatError || !trimmed) {
      setLicenceUnique(null);
      setLicenceChecking(false);
      return;
    }

    setLicenceChecking(true);
    licenceCheckTimer.current = setTimeout(async () => {
      const checkId = ++licenceCheckAbort.current;
      try {
        const result = await api.checkLicenceUnique(trimmed, issuingState, session?.user?.id);
        if (checkId === licenceCheckAbort.current) {
          setLicenceUnique(result.unique);
        }
      } catch {
        if (checkId === licenceCheckAbort.current) {
          setLicenceUnique(null);
        }
      } finally {
        if (checkId === licenceCheckAbort.current) {
          setLicenceChecking(false);
        }
      }
    }, 500);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = t("err_full_name");
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = t("err_email_valid");
    }
    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (!AU_PHONE_REGEX.test(formData.phone.trim()) && phoneDigits.length !== 10) {
      errs.phone = t("err_phone");
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      errs.address = t("err_address");
    }

    const licenceFormatError = validateLicenceFormat(formData.licenceNumber || "", formData.issuingState || "VIC");
    if (licenceFormatError) {
      errs.licenceNumber = licenceFormatError;
    } else if (licenceUnique === false) {
      errs.licenceNumber = t("err_licence_dup");
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...formData, email: authEmail });
  };

  const formatHint = LICENCE_FORMATS[formData.issuingState || "VIC"]?.hint;

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          {t("s1_title")}
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          {t("s1_sub")}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label htmlFor="driver-fullName" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_full_name")}
            </label>
            <input
              id="driver-fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
            />
            {errors.fullName && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.fullName}</span>}
          </div>
          <div>
            <label htmlFor="driver-email" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_email")}
            </label>
            <input
              id="driver-email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              readOnly
              className="form-input"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", background: "rgba(148, 163, 184, 0.08)", cursor: "not-allowed" }}
              title={t("s1_email_note")}
            />
            <span style={{ color: "#64748b", fontSize: "0.72rem" }}>
              {t("s1_email_note")}
            </span>
            {errors.email && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.email}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label htmlFor="driver-phone" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_phone")}
            </label>
            <input
              id="driver-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="0412 345 678"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: formatAustralianPhone(e.target.value) })}
              className={`form-input ${errors.phone ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
            />
            {errors.phone && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.phone}</span>}
          </div>
          <div>
            <label htmlFor="driver-depot" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_depot")}
            </label>
            <select
              id="driver-depot"
              name="depotLocation"
              className="form-input"
              value={formData.depotLocation}
              onChange={(e) => setFormData({ ...formData, depotLocation: e.target.value })}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", fontSize: "0.88rem" }}
            >
              <option value="Melbourne Hub">Melbourne Hub</option>
              <option value="Sydney Hub">Sydney Hub</option>
              <option value="Brisbane Hub">Brisbane Hub</option>
              <option value="Adelaide Hub">Adelaide Hub</option>
              <option value="Perth Hub">Perth Hub</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label htmlFor="driver-licenceClass" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_licence_class")}
            </label>
            <select
              id="driver-licenceClass"
              name="licenceClass"
              className="form-input"
              value={formData.licenceClass}
              onChange={(e) => setFormData({ ...formData, licenceClass: e.target.value })}
              style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", fontSize: "0.88rem" }}
            >
              <option value="MC">MC - Multi-Combination</option>
              <option value="HC">HC - Heavy Combination</option>
              <option value="HR">HR - Heavy Rigid</option>
              <option value="MR">MR - Medium Rigid</option>
            </select>
          </div>
          <div>
            <label htmlFor="driver-issuingState" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_state")}
            </label>
            <select
              id="driver-issuingState"
              name="issuingState"
              className="form-input"
              value={formData.issuingState}
              onChange={(e) => {
                const newState = e.target.value;
                setFormData({ ...formData, issuingState: newState });
                setLicenceUnique(null);
                if (formData.licenceNumber) {
                  checkLicenceDuplicate(formData.licenceNumber, newState);
                }
              }}              style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", fontSize: "0.88rem" }}
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
            <label htmlFor="driver-licenceNumber" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_licence_number")}
            </label>
            <input
              id="driver-licenceNumber"
              name="licenceNumber"
              type="text"
              autoComplete="off"
              maxLength={8}
              minLength={8}
              placeholder={formatHint || "e.g. 09876543"}
              value={formData.licenceNumber}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setFormData({ ...formData, licenceNumber: value });
                setLicenceUnique(null);
                checkLicenceDuplicate(value, formData.issuingState || "VIC");
              }}
              className={`form-input ${errors.licenceNumber ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", textTransform: "uppercase" }}
            />
            {licenceChecking && (
              <span style={{ color: "#d97706", fontSize: "0.72rem" }}>{t("s1_checking")}</span>
            )}
            {!licenceChecking && licenceUnique === true && !errors.licenceNumber && (
              <span style={{ color: "#16a34a", fontSize: "0.72rem" }}>{t("s1_available")}</span>
            )}
            {!licenceChecking && licenceUnique === false && !errors.licenceNumber && (
              <span style={{ color: "#ef4444", fontSize: "0.72rem" }}>{t("s1_registered")}</span>
            )}
            {formatHint && !errors.licenceNumber && (
              <span style={{ color: "#64748b", fontSize: "0.72rem" }}>{formatHint}</span>
            )}
            {errors.licenceNumber && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.licenceNumber}</span>}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="driver-address" className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              {t("s1_address")}
            </label>
          <input
            id="driver-address"
            name="address"
            type="text"
            autoComplete="street-address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className={`form-input ${errors.address ? "form-input--error" : ""}`}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
          />
          {errors.address && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.address}</span>}
        </div>

        {Object.keys(errors).length > 0 && (
          <div
            role="alert"
            style={{
              marginBottom: "16px",
              padding: "10px 14px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#991b1b",
              fontSize: "0.82rem",
              fontWeight: 500
            }}
          >
            Please correct the highlighted field(s) above to continue:
            <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
              {Object.entries(errors).map(([key, msg]) => (
                <li key={key}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={loading || licenceChecking}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              background: loading || licenceChecking ? "#94a3b8" : "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading || licenceChecking ? "not-allowed" : "pointer"
            }}
          >
            {loading ? t("s1_saving") : t("s1_continue")}
          </button>
        </div>
      </form>
    </div>
  );
}
