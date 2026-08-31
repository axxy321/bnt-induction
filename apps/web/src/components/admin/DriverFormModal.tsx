import { useState, FormEvent } from "react";
import { AdminDriverRow, DriverFormInput } from "../../types";

interface DriverFormModalProps {
  driver?: AdminDriverRow | null;
  onSave: (input: DriverFormInput & { password?: string }) => Promise<void>;
  onClose: () => void;
  loading: boolean;
}

export function DriverFormModal({ driver, onSave, onClose, loading }: DriverFormModalProps) {
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
    if (!isEditing && (!formData.password || formData.password.length < 8)) {
      errs.password = "Password must be at least 8 characters.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(formData);
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
        className="glass"
        style={{
          width: "100%",
          maxWidth: "580px",
          padding: "28px",
          borderRadius: "20px",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
            {isEditing ? `Edit Driver: ${driver.fullName}` : "Add New Heavy Vehicle Driver"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                Full Name *
              </label>
              <input
                type="text"
                placeholder="Driver full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className={`form-input ${errors.fullName ? "form-input--error" : ""}`}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              {errors.fullName && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.fullName}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                Email Address *
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                Mobile Phone *
              </label>
              <input
                type="tel"
                placeholder="0400 000 000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`form-input ${errors.phone ? "form-input--error" : ""}`}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              {errors.phone && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>{errors.phone}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                Depot Hub
              </label>
              <select
                value={formData.depotLocation}
                onChange={(e) => setFormData({ ...formData, depotLocation: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              >
                <option value="Melbourne Hub">Melbourne Hub</option>
                <option value="Sydney Hub">Sydney Hub</option>
                <option value="Brisbane Hub">Brisbane Hub</option>
                <option value="Adelaide Hub">Adelaide Hub</option>
                <option value="Perth Hub">Perth Hub</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                Licence Class
              </label>
              <select
                value={formData.licenceClass}
                onChange={(e) => setFormData({ ...formData, licenceClass: e.target.value })}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              >
                <option value="MC">MC - Multi-Combination</option>
                <option value="HC">HC - Heavy Combination</option>
                <option value="HR">HR - Heavy Rigid</option>
                <option value="MR">MR - Medium Rigid</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
                State of Issue
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
                Licence Number
              </label>
              <input
                type="text"
                placeholder="Licence #"
                value={formData.licenceNumber}
                onChange={(e) => setFormData({ ...formData, licenceNumber: e.target.value })}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "4px" }}>
              Address *
            </label>
            <input
              type="text"
              placeholder="Residential address"
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
                Initial Password *
              </label>
              <input
                type="password"
                placeholder="At least 8 characters"
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "8px 20px", borderRadius: "8px", border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Saving..." : isEditing ? "Update Driver Profile" : "Create Driver Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
