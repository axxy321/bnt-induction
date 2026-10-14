import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { PreTripInspectionRecord, PreTripCheckItem } from "../types";
import { ClipboardCheck, Filter, X, Truck, AlertTriangle, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../lib/supabase";

interface PreTripInspectionAdminProps {
  session: any;
}

export function PreTripInspectionAdmin({ session }: PreTripInspectionAdminProps) {
  const { t } = useTranslation();
  if (!session?.user?.id) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
        <p>{t("pta_loading_session")}</p>
      </div>
    );
  }

  const [inspections, setInspections] = useState<PreTripInspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterVehicle, setFilterVehicle] = useState<string>("");
  const [filterDriver, setFilterDriver] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statuses = ["All", "Fit for Duty", "Minor Defect", "Out of Service"];

  const statusLabels: Record<string, string> = {
    All: t("pta_status_all"),
    "Fit for Duty": t("pta_status_fit"),
    "Minor Defect": t("pta_status_minor"),
    "Out of Service": t("pta_status_oos")
  };

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    if (!session?.user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pre_trip_inspections')
        .select('*')
        .order('inspected_at', { ascending: false })
        .limit(200);
      if (error) {
        console.error(t("sia_supabase_error"), error);
        throw new Error(t("pta_db_error", { message: error.message, code: error.code }));
      }
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        driverId: row.user_id,
        driverName: row.driver_signature,
        vehicleRego: row.vehicle_rego,
        odometer: row.odometer,
        trailerId: row.trailer_id,
        overallStatus: row.overall_status,
        items: row.items,
        driverSignature: row.driver_signature,
        inspectedAt: row.inspected_at,
      }));
      setInspections(mapped);
    } catch (err) {
      console.error("Failed to load pre-trip inspections:", err);
      alert(t("pta_load_error", { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const filteredInspections = inspections.filter(insp => {
    if (filterStatus !== "All" && insp.overallStatus !== filterStatus) return false;
    if (filterVehicle && !insp.vehicleRego.toLowerCase().includes(filterVehicle.toLowerCase())) return false;
    if (filterDriver && !insp.driverName.toLowerCase().includes(filterDriver.toLowerCase())) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Fit for Duty": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Minor Defect": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "Out of Service": return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Fit for Duty": return <ClipboardCheck className="w-3.5 h-3.5" />;
      case "Minor Defect": return <AlertTriangle className="w-3.5 h-3.5" />;
      case "Out of Service": return <Truck className="w-3.5 h-3.5" />;
      default: return <ClipboardCheck className="w-3.5 h-3.5" />;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const renderItems = (items: PreTripCheckItem[]) => {
    return items.map((item, idx) => (
      <div key={idx} className={`p-3 rounded-lg border transition-colors ${item.status === "Defect" ? "bg-rose-950/20 border-rose-500/40" : "bg-slate-950/60 border-slate-800/80"}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{item.category}</p>
            <p className="text-sm text-white font-medium truncate">{item.label}</p>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === "Defect" ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}`}>
            {item.status === "Defect" ? t("pt_defect") : t("pt_pass")}
          </span>
        </div>
        {item.status === "Defect" && item.notes && (
          <div className="mt-2 p-2 bg-rose-500/10 rounded text-xs text-rose-300">
            <strong>{t("pta_notes")}</strong> {item.notes}
          </div>
        )}
        {item.status === "Defect" && item.photos && item.photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {(item.photos as string[]).slice(0, 3).map((photo: string, pIdx: number) => (
              <img key={pIdx} src={photo} alt={t("pta_defect_photo", { count: pIdx + 1 })} className="w-14 h-14 object-cover rounded border border-slate-700" />
            ))}
            {item.photos.length > 3 && (
              <div className="w-14 h-14 rounded border border-slate-700 flex items-center justify-center text-xs text-slate-400 bg-slate-800">
                +{item.photos.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ClipboardCheck className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-black text-white tracking-tight">{t("pta_title")}</h2>
            </div>
            <p className="text-slate-400 text-sm">
              {t("pta_subtitle")}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-slate-400">{t("pta_total")}</div>
            <div className="text-2xl font-bold text-white">{inspections.length}</div>
            <div className="text-slate-400 mt-1">
              {t("pta_defects")}<strong className="text-amber-400">{inspections.filter(i => i.overallStatus !== "Fit for Duty").length}</strong>
              | {t("pta_fit")}<strong className="text-emerald-400">{inspections.filter(i => i.overallStatus === "Fit for Duty").length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-xl">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">{t("pta_filters")}</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
        >
          {statuses.map(s => <option key={s} value={s}>{statusLabels[s] ?? s}</option>)}
        </select>
        <input
          type="text"
          placeholder={t("pta_vehicle_ph")}
          value={filterVehicle}
          onChange={(e) => setFilterVehicle(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 w-40"
        />
        <input
          type="text"
          placeholder={t("pta_driver_ph")}
          value={filterDriver}
          onChange={(e) => setFilterDriver(e.target.value)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 w-40"
        />
        {(filterStatus !== "All" || filterVehicle || filterDriver) && (
          <button
            onClick={() => { setFilterStatus("All"); setFilterVehicle(""); setFilterDriver(""); }}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-xs hover:text-white"
          >
            <X className="w-3.5 h-3.5" /> {t("pta_clear")}
          </button>
        )}
      </div>

      {/* Inspections List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t("pta_loading")}</div>
      ) : filteredInspections.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <ClipboardCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">{t("pta_no_match")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInspections.map((insp) => {
            const isExpanded = expandedId === insp.id;
            const defectItems = insp.items.filter((item: PreTripCheckItem) => item.status === "Defect");
            const hasDefects = defectItems.length > 0;

            return (
              <div
                key={insp.id}
                className={`bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl transition-all ${isExpanded ? "border-emerald-500/30" : ""}`}
              >
                {/* Summary Row - Always Visible */}
                <button
                  onClick={() => toggleExpand(insp.id)}
                  className="w-full p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <Truck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-emerald-400">{insp.id.slice(0, 8)}...</span>
                        <h3 className="text-base font-bold text-white">{insp.vehicleRego}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusColor(insp.overallStatus)}`}>
                          {getStatusIcon(insp.overallStatus)} {statusLabels[insp.overallStatus] ?? insp.overallStatus}
                        </span>
                        {insp.trailerId && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          {t("pta_trailer", { id: insp.trailerId })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {t("pta_odo", { value: insp.odometer })}</span>
                        <span className="flex items-center gap-1">{t("pta_driver")}<strong className="text-slate-300">{insp.driverName}</strong></span>
                        <span className="flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" /> {new Date(insp.inspectedAt).toLocaleString("en-AU")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasDefects && (
                      <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {t(defectItems.length === 1 ? "pta_defects_count_one" : "pta_defects_count_other", { count: defectItems.length })}
                      </span>
                    )}
                    <span className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    </span>
                  </div>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-5 pb-5 border-t border-slate-800/60"
                    >
                      <div className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{t("pta_checklist_items")}</span>
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400 border border-slate-700">
                            {t(insp.items.length === 1 ? "pta_items_count_one" : "pta_items_count_other", { count: insp.items.length })}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {renderItems(insp.items)}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-800/60">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">{t("pta_driver_signature")}</span>
                              <p className="text-slate-200 text-sm">{insp.driverSignature}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">{t("pta_inspection_id")}</span>
                              <p className="text-slate-200 text-sm font-mono">{insp.id}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">{t("pta_driver_id")}</span>
                              <p className="text-slate-200 text-sm font-mono">{insp.driverId.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}