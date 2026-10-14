import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Palette,
  Trash2,
  Type
} from "lucide-react";
import { api } from "../../lib/api";
import { BrandingSettings, SessionState } from "../../types";
import { showToast } from "../ui/Toast";

interface BrandingAdminProps {
  session: SessionState;
  branding: BrandingSettings | null;
  onUpdated: (branding: BrandingSettings) => void;
}

export function BrandingAdmin({ session, branding, onUpdated }: BrandingAdminProps) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState(branding?.companyName ?? "");
  const [primaryColor, setPrimaryColor] = useState(branding?.primaryColor ?? "#1e3a5f");
  const [welcomeText, setWelcomeText] = useState(branding?.welcomeText ?? "");
  const [logoPath, setLogoPath] = useState<string | null>(branding?.logoPath ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(branding?.logoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setCompanyName(branding?.companyName ?? "");
    setPrimaryColor(branding?.primaryColor ?? "#1e3a5f");
    setWelcomeText(branding?.welcomeText ?? "");
    setLogoPath(branding?.logoPath ?? null);
    setLogoUrl(branding?.logoUrl ?? null);
  }, [branding]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "err", text: t("branding_error_image") });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "err", text: t("branding_error_size") });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      if (logoPath) await api.removeBrandingLogo(session, logoPath);
      const result = await api.uploadBrandingLogo(session, file);
      setLogoPath(result.path);
      setLogoUrl(result.url);
    } catch (err: any) {
      setMessage({ type: "err", text: err?.message || t("branding_error") });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setMessage(null);
    if (logoPath) await api.removeBrandingLogo(session, logoPath);
    setLogoPath(null);
    setLogoUrl(null);
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      setMessage({ type: "err", text: t("branding_error") });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api.saveBranding(session, { companyName, logoPath, primaryColor, welcomeText });
      onUpdated(saved);
      setMessage({ type: "ok", text: t("branding_saved") });
      showToast(t("branding_saved"));
    } catch (err: any) {
      setMessage({ type: "err", text: err?.message || t("branding_error") });
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 700,
    marginBottom: "6px"
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border, #cbd5e1)",
    background: "var(--bg-strong, #ffffff)",
    color: "var(--input-text, #0f172a)",
    fontSize: "0.9rem",
    outline: "none"
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
          {t("branding_title")}
        </h3>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {t("branding_sub")}
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.85rem",
            fontWeight: 600,
            background: message.type === "ok" ? "rgba(22,163,74,0.1)" : "rgba(244,63,94,0.1)",
            color: message.type === "ok" ? "#16a34a" : "#f43f5e",
            border: `1px solid ${message.type === "ok" ? "rgba(22,163,74,0.3)" : "rgba(244,63,94,0.3)"}`
          }}
        >
          {message.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
        {/* Company name */}
        <div>
          <label htmlFor="branding-company" style={labelStyle}>
            <Type className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> {t("branding_company_name")}
          </label>
          <input
            id="branding-company"
            type="text"
            maxLength={100}
            placeholder={t("branding_company_name_ph")}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={saving}
            style={inputStyle}
          />
        </div>

        {/* Logo */}
        <div>
          <label style={labelStyle}>
            <ImageIcon className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> {t("branding_logo")}
          </label>
          {logoUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <img
                src={logoUrl}
                alt={t("branding_current_logo")}
                style={{
                  height: "56px",
                  width: "auto",
                  maxWidth: "220px",
                  objectFit: "contain",
                  borderRadius: "10px",
                  border: "1px solid var(--border, #cbd5e1)",
                  padding: "6px",
                  background: "#ffffff"
                }}
              />
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <label
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #cbd5e1)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: uploading ? "wait" : "pointer",
                    background: "transparent"
                  }}
                >
                  {uploading ? t("branding_uploading") : t("branding_change_logo")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleLogoChange}
                    disabled={uploading || saving}
                    style={{ display: "none" }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploading || saving}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(244,63,94,0.4)",
                    background: "rgba(244,63,94,0.08)",
                    color: "#f43f5e",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t("branding_remove_logo")}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <label
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: `1px dashed var(--border, #cbd5e1)`,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: uploading ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                {uploading ? t("branding_uploading") : t("branding_logo_button")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  disabled={uploading || saving}
                  style={{ display: "none" }}
                />
              </label>
              <span className="muted" style={{ fontSize: "0.75rem" }}>{t("branding_logo_hint")}</span>
            </div>
          )}
        </div>

        {/* Primary colour */}
        <div>
          <label htmlFor="branding-color" style={labelStyle}>
            <Palette className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> {t("branding_color")}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              id="branding-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={saving}
              style={{
                width: "56px",
                height: "40px",
                padding: "2px",
                borderRadius: "10px",
                border: "1px solid var(--border, #cbd5e1)",
                background: "transparent",
                cursor: "pointer"
              }}
            />
            <input
              type="text"
              maxLength={7}
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={saving}
              style={{ ...inputStyle, maxWidth: "140px", fontFamily: "monospace" }}
            />
          </div>
        </div>

        {/* Welcome text */}
        <div>
          <label htmlFor="branding-welcome" style={labelStyle}>
            <Type className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> {t("branding_welcome")}
          </label>
          <input
            id="branding-welcome"
            type="text"
            maxLength={500}
            placeholder={t("branding_welcome_ph")}
            value={welcomeText}
            onChange={(e) => setWelcomeText(e.target.value)}
            disabled={saving}
            style={inputStyle}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploading}
          style={{
            padding: "12px 24px",
            borderRadius: "12px",
            border: "none",
            background: primaryColor,
            color: "#ffffff",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            alignSelf: "flex-start",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)"
          }}
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t("branding_saving") : t("branding_save")}
        </button>
      </div>
    </div>
  );
}
