import { useState, FormEvent } from "react";
import { DriverProfile, DriverFormInput } from "../../types";

interface Step1ProfileProps {
  driver: DriverProfile;
  onSave: (input: DriverFormInput) => Promise<void>;
  loading: boolean;
}

export function Step1Profile({ driver, onSave, loading }: Step1ProfileProps) {
  const [formData, setFormData] = useState<DriverFormInput>({
    fullName: driver.fullName || "",
    email: driver.email || "",
    phone: driver.phone || "",
    address: driver.address || "",
    preferredLanguage: driver.preferredLanguage || "English",
    licenceClass: driver.licenceClass || "HC",
    issuingState: driver.issuingState || "VIC",
    licenceNumber: driver.licenceNumber || "",
    depotLocation: driver.depotLocation || "Melbourne Hub"
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = "Full name is required.";
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      errs.email = "Valid email is required.";
    }
    if (!formData.phone.trim() || formData.phone.trim().length < 5) {
      errs.phone = "Valid mobile number is required.";
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      errs.address = "Home address is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "16px", maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          Step 1: Confirm Identity & Contact Details
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          Ensure your legal details match your Australian Heavy Vehicle Driver Licence.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              Full Legal Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
            />
            {errors.fullName && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.fullName}</span>}
          </div>
          <div>
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`form-input ${errors.email ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
            />
            {errors.email && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.email}</span>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
          <div>
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              Mobile Phone *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`form-input ${errors.phone ? "form-input--error" : ""}`}
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
            />
            {errors.phone && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.phone}</span>}
          </div>
          <div>
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              Depot Hub
            </label>
            <select
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
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              Licence Class
            </label>
            <select
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
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              State of Issue
            </label>
            <select
              className="form-input"
              value={formData.issuingState}
              onChange={(e) => setFormData({ ...formData, issuingState: e.target.value })}
              style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", fontSize: "0.88rem" }}
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
            <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
              Licence Number
            </label>
            <input
              type="text"
              placeholder="e.g. 09876543"
              value={formData.licenceNumber}
              onChange={(e) => setFormData({ ...formData, licenceNumber: e.target.value })}
              className="form-input"
              style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label className="form-label" style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, marginBottom: "4px" }}>
            Residential Address *
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className={`form-input ${errors.address ? "form-input--error" : ""}`}
            style={{ width: "100%", padding: "9px 12px", borderRadius: "8px" }}
          />
          {errors.address && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.address}</span>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              background: "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Saving Details..." : "Confirm & Continue to Document Uploads →"}
          </button>
        </div>
      </form>
    </div>
  );
}
