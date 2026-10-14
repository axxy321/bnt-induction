import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Truck, Eye, EyeOff, AlertTriangle, ArrowRight, Loader2, Mail, Lock } from "lucide-react";
import bntTruckBg from "../../assets/bnt-truck-bg.jpg";
import { BrandingSettings } from "../../types";

type UserRole = "driver" | "admin";

interface LoginFormProps {
  branding?: BrandingSettings | null;
  onLogin: (email: string, pass: string, role: UserRole) => Promise<void>;
  onRequestPasswordHelp: (email: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function LoginForm({ branding, onLogin, onRequestPasswordHelp, loading, error }: LoginFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("driver");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordHelpLoading, setPasswordHelpLoading] = useState(false);
  const [passwordHelpMessage, setPasswordHelpMessage] = useState("");
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim() || !emailRegex.test(email.trim())) {
      errs.email = t("error_email");
    }
    if (!password) {
      errs.password = t("error_password");
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onLogin(email.trim(), password, role);
  };

  const handlePasswordHelp = async () => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFormErrors({ ...formErrors, email: t("error_email") });
      return;
    }
    setPasswordHelpLoading(true);
    setPasswordHelpMessage("");
    try {
      await onRequestPasswordHelp(cleanEmail);
      setPasswordHelpMessage(t("password_help_success"));
    } catch {
      setPasswordHelpMessage(t("password_help_error"));
    } finally {
      setPasswordHelpLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto flex items-center justify-center p-4 z-10 pt-16 font-sans">
      {/* Fullscreen Animated BNT Heavy Freight Truck Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <img
          src={bntTruckBg}
          alt="BNT Logistics Heavy Freight Prime Mover Truck"
          className="w-full h-full object-cover object-center animate-truck-bg opacity-90 scale-105"
        />
        {/* Cinematic Vignette Overlay & Gradient Blur */}
        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[1.5px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/30 to-slate-950/85" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-slate-950/80 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 shadow-[0_35px_100px_rgba(0,0,0,0.9)] relative z-10 space-y-6 my-auto"
      >
        {/* Ambient Glow Orbs */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding */}
        <div className="text-center relative z-10 space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black tracking-widest uppercase mb-1 shadow-sm">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.companyName || "Company"}
                className="h-4 w-auto object-contain"
              />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{branding?.companyName || "BNT LOGISTICS"} PORTAL</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight font-heading leading-tight">
            {t("login_title")}
          </h2>
          <p className="text-slate-300 text-xs font-medium leading-relaxed max-w-xs mx-auto">
            {branding?.welcomeText || t("login_subtitle")}
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="flex p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 relative z-10">
          <button
            type="button"
            onClick={() => setRole("driver")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              role === "driver"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/50 border border-emerald-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Truck className="w-4 h-4" /> {t("driver_access")}
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              role === "admin"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/50 border border-blue-500/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> {t("admin_access")}
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4 relative z-10">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> {t("email_address")}
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors({ ...formErrors, email: undefined });
              }}
              disabled={loading}
              style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none transition-all ${
                formErrors.email ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              }`}
            />
            {formErrors.email && <span className="text-rose-400 text-[11px] font-semibold mt-1 block">{formErrors.email}</span>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> {t("password")}
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-emerald-400 font-semibold hover:underline flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPassword ? t("hide") : t("show")}</span>
              </button>
            </div>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password) setFormErrors({ ...formErrors, password: undefined });
              }}
              disabled={loading}
              style={{ color: "#ffffff", backgroundColor: "#0f172a" }}
              className={`w-full px-4 py-3 rounded-xl border text-sm font-medium focus:outline-none transition-all ${
                formErrors.password ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              }`}
            />
            {formErrors.password && <span className="text-rose-400 text-[11px] font-semibold mt-1 block">{formErrors.password}</span>}
            {role === "driver" && (
              <div className="mt-2 flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={() => void handlePasswordHelp()}
                  disabled={passwordHelpLoading}
                  className="text-[11px] text-emerald-400 font-semibold hover:underline disabled:opacity-60"
                >
                  {passwordHelpLoading ? t("password_help_sending") : t("forgot_password")}
                </button>
                {passwordHelpMessage && <span className="text-[11px] text-slate-300">{passwordHelpMessage}</span>}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-sm text-white transition-all shadow-xl flex items-center justify-center gap-2 group ${
              role === "driver"
                ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-950/40"
                : "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 shadow-blue-950/40"
            }`}
            style={branding?.primaryColor ? { background: branding.primaryColor } : undefined}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{t("authenticating")}</span>
              </>
            ) : role === "driver" ? (
              <>
                <span>{t("enter_driver_portal")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            ) : (
              <>
                <span>{t("enter_admin_console")}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
          <span>{t("protected_by")}</span>
        </div>
      </motion.div>
    </div>
  );
}

