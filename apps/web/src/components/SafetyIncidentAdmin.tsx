import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SafetyIncidentRecord, IncidentCategory, IncidentSeverity } from "../types";
import { AlertTriangle, Filter, X, CheckCircle2, Clock, MapPin, User, ShieldAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { tStatus } from "../i18n";

interface SafetyIncidentAdminProps {
  session: any;
}

export function SafetyIncidentAdmin({ session }: SafetyIncidentAdminProps) {
  const { t } = useTranslation();
  if (!session?.user?.id) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto mb-4"></div>
        <p>{t("sia_loading_session")}</p>
      </div>
    );
  }

  const [incidents, setIncidents] = useState<SafetyIncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterSeverity, setFilterSeverity] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const statuses = ["All", "Under Review", "Resolved"];
  const severities = ["All", "Low", "Medium", "High", "Critical"];
  const categories = ["All", "Near Miss", "Vehicle Defect", "Spill / Leak", "Safety Hazard", "Injury / Illness"];

  const statusLabels: Record<string, string> = {
    All: t("sia_all"),
    "Under Review": t("status_under_review"),
    Resolved: t("status_resolved")
  };
  const severityLabels: Record<string, string> = {
    All: t("sia_all"),
    Low: t("sia_sev_low"),
    Medium: t("sia_sev_medium"),
    High: t("sia_sev_high"),
    Critical: t("sia_sev_critical")
  };
  const categoryLabels: Record<string, string> = {
    All: t("sia_all"),
    "Near Miss": t("sia_cat_near_miss"),
    "Vehicle Defect": t("sia_cat_vehicle_defect"),
    "Spill / Leak": t("sia_cat_spill"),
    "Safety Hazard": t("sia_cat_hazard"),
    "Injury / Illness": t("sia_cat_injury")
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('safety_incidents')
        .select('*')
        .order('reported_at', { ascending: false });
      if (error) {
        console.error(t("sia_supabase_error"), error);
        throw new Error(t("sia_db_error", { message: error.message, code: error.code }));
      }
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        severity: row.severity,
        location: row.location,
        description: row.description,
        immediateActionsTaken: row.immediate_actions_taken,
        reportedBy: row.reported_by,
        reportedAt: row.reported_at,
        photoFileName: row.photo_file_name,
        status: row.status,
        riskScore: row.risk_score,
      }));
      setIncidents(mapped);
    } catch (err) {
      console.error("Failed to load incidents:", err);
      alert(t("sia_load_error", { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (incidentId: string, newStatus: "Under Review" | "Resolved") => {
    setUpdatingId(incidentId);
    try {
      const { error } = await supabase
        .from('safety_incidents')
        .update({
          status: newStatus,
          resolved_at: newStatus === "Resolved" ? new Date().toISOString() : null,
          resolved_by: session.user.id,
        })
        .eq('id', incidentId);
      if (error) throw error;
      setIncidents(prev => prev.map(inc => 
        inc.id === incidentId ? { ...inc, status: newStatus } : inc
      ));
    } catch (err) {
      console.error("Failed to update status:", err);
      alert(t("sia_update_error"));
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredIncidents = incidents.filter(inc => {
    if (filterStatus !== "All" && inc.status !== filterStatus) return false;
    if (filterSeverity !== "All" && inc.severity !== filterSeverity) return false;
    if (filterCategory !== "All" && inc.category !== filterCategory) return false;
    return true;
  });

  const getSeverityColor = (sev: IncidentSeverity) => {
    switch (sev) {
      case "Low": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Medium": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "High": return "bg-orange-500/10 text-orange-400 border-orange-500/30";
      case "Critical": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "Resolved" 
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : "bg-amber-500/10 text-amber-400 border-amber-500/30";
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <h2 className="text-2xl font-black text-white tracking-tight">{t("sia_title")}</h2>
            </div>
            <p className="text-slate-400 text-sm">
              {t("sia_subtitle")}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-slate-400">{t("sia_total")}</div>
            <div className="text-2xl font-bold text-white">{incidents.length}</div>
            <div className="text-slate-400 mt-1">{t("sia_under_review")}<strong className="text-amber-400">{incidents.filter(i => i.status === "Under Review").length}</strong></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-xl">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">{t("sia_filters")}</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
        >
          {statuses.map(s => <option key={s} value={s}>{statusLabels[s] ?? s}</option>)}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
        >
          {severities.map(s => <option key={s} value={s}>{severityLabels[s] ?? s}</option>)}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
        >
          {categories.map(c => <option key={c} value={c}>{categoryLabels[c] ?? c}</option>)}
        </select>
        {(filterStatus !== "All" || filterSeverity !== "All" || filterCategory !== "All") && (
          <button
            onClick={() => { setFilterStatus("All"); setFilterSeverity("All"); setFilterCategory("All"); }}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-xs hover:text-white"
          >
              <X className="w-3.5 h-3.5" /> {t("sia_clear")}
          </button>
        )}
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t("sia_loading")}</div>
      ) : filteredIncidents.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">{t("sia_no_match")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((inc) => (
            <div
              key={inc.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-rose-400">{inc.id}</span>
                  <h3 className="text-base font-bold text-white">{inc.title}</h3>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getSeverityColor(inc.severity)}`}>
                    {severityLabels[inc.severity] ?? inc.severity}{t("sia_risk_score", { n: inc.riskScore })}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusColor(inc.status)}`}>
                    {inc.status === "Under Review" ? "● " : "✓ "}{tStatus(inc.status, t)}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {categoryLabels[inc.category] ?? inc.category}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p>{inc.description}</p>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">{t("sia_immediate_actions")}</span>
                  <p className="text-slate-200 text-xs">{inc.immediateActionsTaken || t("sia_not_specified")}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-rose-400" /> <strong className="text-slate-300">{inc.location}</strong></span>
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> {t("sia_reported_by")}<strong className="text-slate-300">{inc.reportedBy}</strong></span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {new Date(inc.reportedAt).toLocaleString("en-AU")}</span>
                </div>

                <div className="flex items-center gap-2">
                  {inc.status === "Under Review" && (
                    <button
                      onClick={() => handleStatusChange(inc.id, "Resolved")}
                      disabled={updatingId === inc.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {updatingId === inc.id ? t("sia_resolving") : t("sia_mark_resolved")}
                    </button>
                  )}
                  {inc.status === "Resolved" && (
                    <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t("sia_resolved")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}