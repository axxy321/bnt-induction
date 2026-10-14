import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { SafetyIncidentRecord, IncidentCategory, IncidentSeverity } from "../../types";
import { tStatus } from "../../i18n";
import { AlertTriangle, MapPin, Plus, CheckCircle2, X, ShieldAlert } from "lucide-react";

interface SafetyIncidentReporterProps {
  incidents: SafetyIncidentRecord[];
  onReportIncident: (incident: SafetyIncidentRecord) => void;
}

export function SafetyIncidentReporter({ incidents, onReportIncident }: SafetyIncidentReporterProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  
  // New Incident Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("Near Miss");
  const [severity, setSeverity] = useState<IncidentSeverity>("Low");
  const [location, setLocation] = useState("BNT Logistics Port Melbourne - Depot Yard");
  const [description, setDescription] = useState("");
  const [immediateActions, setImmediateActions] = useState("");
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);

  const catLabel = (c: string) =>
    c === "Near Miss"
      ? t("inc_cat_near_miss")
      : c === "Vehicle Defect"
      ? t("inc_cat_vehicle")
      : c === "Spill / Leak"
      ? t("inc_cat_spill")
      : c === "Safety Hazard"
      ? t("inc_cat_hazard")
      : c === "Injury / Illness"
      ? t("inc_cat_injury")
      : c;

  const sevLabel = (s: string) =>
    s === "Low"
      ? t("inc_sev_low_word")
      : s === "Medium"
      ? t("inc_sev_medium_word")
      : s === "High"
      ? t("inc_sev_high_word")
      : s === "Critical"
      ? t("inc_sev_critical_word")
      : s;

  const sevOption = (s: string) =>
    s === "Low"
      ? t("inc_sev_low")
      : s === "Medium"
      ? t("inc_sev_medium")
      : s === "High"
      ? t("inc_sev_high")
      : s === "Critical"
      ? t("inc_sev_critical")
      : s;

  const calculateRiskScore = (sev: IncidentSeverity) => {
    switch (sev) {
      case "Low": return 2;
      case "Medium": return 5;
      case "High": return 8;
      case "Critical": return 10;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    const newInc: SafetyIncidentRecord = {
      id: `inc-${Date.now().toString().slice(-4)}`,
      title,
      category,
      severity,
      location,
      description,
      immediateActionsTaken: immediateActions || t("inc_default_actions"),
      reportedBy: t("inc_reported_by"),
      reportedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      photoFileName: photoName,
      status: "Under Review",
      riskScore: calculateRiskScore(severity),
    };

    onReportIncident(newInc);
    setShowForm(false);
    // Reset
    setTitle("");
    setDescription("");
    setImmediateActions("");
    setPhotoName(undefined);
  };

  const filteredIncidents = filterCategory === "All"
    ? incidents
    : incidents.filter((i) => i.category === filterCategory);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <h2 className="text-2xl font-black text-white tracking-tight">{t("inc_title")}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500/10 border border-rose-500/30 text-rose-400">
                {t("inc_badge")}
              </span>
            </div>
            <p className="text-slate-400 text-sm">
              {t("inc_sub")}
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{showForm ? t("inc_close_form") : t("inc_new")}</span>
          </button>
        </div>
      </div>

      {/* New Incident Submission Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-rose-900/40 rounded-2xl p-6 shadow-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" /> {t("inc_form_title")}
            </h3>
            <span className="text-xs text-rose-400 font-semibold">{t("inc_engine")}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label htmlFor="inc-title" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_field_title")}</label>
              <input
                id="inc-title"
                name="title"
                type="text"
                 placeholder={t("inc_title_ph")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div>
               <label htmlFor="inc-category" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_category")}</label>
              <select
                id="inc-category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500"
              >
                 <option value="Near Miss">{t("inc_cat_near_miss")}</option>
                 <option value="Vehicle Defect">{t("inc_cat_vehicle")}</option>
                 <option value="Spill / Leak">{t("inc_cat_spill")}</option>
                 <option value="Safety Hazard">{t("inc_cat_hazard")}</option>
                 <option value="Injury / Illness">{t("inc_cat_injury")}</option>
              </select>
            </div>

            <div>
               <label htmlFor="inc-severity" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_severity")}</label>
              <select
                id="inc-severity"
                name="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500 font-bold"
              >
                 <option value="Low">{sevOption("Low")}</option>
                 <option value="Medium">{sevOption("Medium")}</option>
                 <option value="High">{sevOption("High")}</option>
                 <option value="Critical">{sevOption("Critical")}</option>
              </select>
            </div>

            <div>
               <label htmlFor="inc-location" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_location")}</label>
              <input
                id="inc-location"
                name="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="md:col-span-2">
               <label htmlFor="inc-description" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_desc")}</label>
               <textarea
                 id="inc-description"
                 name="description"
                 rows={3}
                 placeholder={t("inc_desc_ph")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500"
                required
              />
            </div>

            <div className="md:col-span-2">
               <label htmlFor="inc-immediateActions" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_actions")}</label>
               <input
                 id="inc-immediateActions"
                 name="immediateActions"
                 type="text"
                 placeholder={t("inc_actions_ph")}
                value={immediateActions}
                onChange={(e) => setImmediateActions(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
               <label htmlFor="inc-photo" className="block text-xs font-bold text-slate-300 mb-1">{t("inc_photo")}</label>
              <input
                id="inc-photo"
                name="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "hazard_photo.jpg")}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
              />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
               <div className="text-[10px] uppercase font-extrabold text-slate-400">{t("inc_risk_index")}</div>
              <div
                className={`px-3 py-1 rounded-lg text-xs font-black ${
                  severity === "Low"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : severity === "Medium"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {t("inc_score", { score: calculateRiskScore(severity), severity: sevLabel(severity) })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
            >
              {t("inc_cancel")}
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg"
            >
              {t("inc_submit")}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {["All", "Near Miss", "Vehicle Defect", "Spill / Leak", "Safety Hazard", "Injury / Illness"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterCategory === cat
                ? "bg-rose-600 text-white shadow-md"
                : "bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {catLabel(cat)}
          </button>
        ))}
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">{t("inc_empty")}</p>
          </div>
        ) : (
          filteredIncidents.map((inc) => (
            <div
              key={inc.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-rose-400">{inc.id}</span>
                  <h3 className="text-base font-bold text-white">{inc.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      inc.severity === "Low"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : inc.severity === "Medium"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                     Severity: {t("inc_severity_label", { severity: sevLabel(inc.severity), score: inc.riskScore })}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      inc.status === "Resolved"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    ● {tStatus(inc.status, t)}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p>{inc.description}</p>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                   <span className="text-[10px] uppercase font-bold text-slate-400 block">{t("inc_actions_label")}</span>
                  <p className="text-slate-200 text-xs">{inc.immediateActionsTaken}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-rose-400" /> {t("inc_location_label")} <strong className="text-slate-300">{inc.location}</strong></span>
                <span>{t("inc_reported", { by: inc.reportedBy, at: inc.reportedAt })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
