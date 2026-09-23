import React, { useState } from "react";
import { PreTripInspectionRecord, PreTripCheckItem } from "../../types";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Truck,
  ShieldAlert,
  Save,
  Clock,
  History,
  Info
} from "lucide-react";

interface PreTripInspectionHubProps {
  inspections: PreTripInspectionRecord[];
  onSaveInspection: (record: PreTripInspectionRecord) => void;
  driverName: string;
  driverId: string;
}

const DEFAULT_CHECK_ITEMS: Array<Omit<PreTripCheckItem, "status" | "notes">> = [
  { id: "chk_1", category: "Tyres & Wheels", label: "Tyre tread depth (min 1.5mm), inflation pressure & wheel nuts secure" },
  { id: "chk_2", category: "Brakes & Air", label: "Air pressure gauge buildup, audible air leaks & park brake test" },
  { id: "chk_3", category: "Lights & Visual", label: "Headlights, indicators, clearance lights, reflectors & mirrors clean" },
  { id: "chk_4", category: "Coupling & Pin", label: "Turn table / kingpin safety locking lever engaged and secure" },
  { id: "chk_5", category: "Load Restraint", label: "Load restraint equipment (chains, dogs, straps, curtains) undamaged" },
  { id: "chk_6", category: "Fluids & Engine", label: "Engine oil, coolant level, windscreen wash & no visible ground leaks" }
];

export const PreTripInspectionHub: React.FC<PreTripInspectionHubProps> = ({
  inspections,
  onSaveInspection,
  driverName,
  driverId
}) => {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [vehicleRego, setVehicleRego] = useState("");
  const [odometer, setOdometer] = useState("");
  const [trailerId, setTrailerId] = useState("");
  const [items, setItems] = useState<PreTripCheckItem[]>(
    DEFAULT_CHECK_ITEMS.map((item) => ({ ...item, status: "Pass" as const, notes: "" }))
  );
  const [driverSignature, setDriverSignature] = useState(driverName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const hasDefects = items.some((item) => item.status === "Defect");
  const overallStatus = hasDefects ? "Minor Defect" : "Fit for Duty";

  const handleToggleStatus = (id: string, status: "Pass" | "Defect") => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleNotesChange = (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  };

  const handleSetAllPass = () => {
    setItems((prev) => prev.map((item) => ({ ...item, status: "Pass", notes: "" })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleRego.trim()) {
      alert("Please enter a vehicle registration number.");
      return;
    }
    if (!odometer.trim()) {
      alert("Please enter the current odometer reading.");
      return;
    }

    setIsSubmitting(true);
    const newRecord: PreTripInspectionRecord = {
      id: `insp_${Date.now()}`,
      driverId,
      driverName: driverName || "Driver",
      vehicleRego: vehicleRego.toUpperCase().trim(),
      odometer: odometer.trim(),
      trailerId: trailerId.trim() || undefined,
      inspectedAt: new Date().toISOString(),
      overallStatus,
      items,
      driverSignature: driverSignature.trim() || driverName
    };

    onSaveInspection(newRecord);
    setIsSubmitting(false);
    setSuccessNotice(`Pre-Trip Inspection logged successfully for ${newRecord.vehicleRego}.`);
    // Reset form
    setVehicleRego("");
    setOdometer("");
    setTrailerId("");
    handleSetAllPass();

    setTimeout(() => {
      setSuccessNotice(null);
      setActiveTab("history");
    }, 1800);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-800 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <ClipboardCheck className="w-3.5 h-3.5" />
            HVNL Section 26C • Daily Pre-Start Walk-Around
          </div>
          <h2 className="text-2xl font-black text-white font-heading">
            Daily Pre-Trip Vehicle Inspection
          </h2>
          <p className="text-slate-300 text-xs mt-1">
            Ensure heavy vehicle roadworthiness before commencing transit. Log defect reports to avoid Chain of Responsibility breaches.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "new"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            New Inspection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            Inspection Log ({inspections.length})
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {activeTab === "new" ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Particulars Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                1. Vehicle Particulars
              </h3>
              <button
                type="button"
                onClick={handleSetAllPass}
                className="text-xs text-emerald-400 hover:underline font-bold"
              >
                Mark All Items Pass
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Prime Mover / Rigid Rego *
                </label>
                <input
                  type="text"
                  placeholder="e.g. BNT-882"
                  value={vehicleRego}
                  onChange={(e) => setVehicleRego(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Current Odometer (km) *
                </label>
                <input
                  type="number"
                  placeholder="e.g. 248500"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Trailer ID / Rego (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRL-404"
                  value={trailerId}
                  onChange={(e) => setTrailerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Checklist Items Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              2. Roadworthiness Checkpoints
            </h3>

            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    item.status === "Defect"
                      ? "bg-rose-950/20 border-rose-500/40"
                      : "bg-slate-950/60 border-slate-800/80"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        {item.category}
                      </span>
                      <p className="text-sm text-white font-medium">{item.label}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, "Pass")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.status === "Pass"
                            ? "bg-emerald-500 text-slate-950 font-black shadow"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.id, "Defect")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.status === "Defect"
                            ? "bg-rose-500 text-white font-black shadow"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        Defect
                      </button>
                    </div>
                  </div>

                  {item.status === "Defect" && (
                    <div className="mt-3 pt-3 border-t border-rose-500/20">
                      <label className="block text-xs font-medium text-rose-400 mb-1">
                        Defect Details & Action Taken *
                      </label>
                      <input
                        type="text"
                        placeholder="Describe issue (e.g. Left indicator globe blown, tagged for repair)"
                        value={item.notes || ""}
                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                        className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                        required
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Declaration & Sign-off Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                3. Driver Declaration & Sign-Off
              </h3>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                  hasDefects
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}
              >
                Overall: {overallStatus}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              I certify that I have conducted a physical walk-around check of the heavy vehicle combination listed above in accordance with National Heavy Vehicle Regulator (NHVR) standards.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Driver Name Signature *
                </label>
                <input
                  type="text"
                  value={driverSignature}
                  onChange={(e) => setDriverSignature(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? "Submitting..." : "Submit Pre-Trip Inspection"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* History View */
        <div className="space-y-4">
          {inspections.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <Info className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-300 font-bold text-sm">No Pre-Trip Inspections Logged Yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Complete your first daily walk-around check to populate this compliance register.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className="mt-4 px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4" />
                Start Today's Check
              </button>
            </div>
          ) : (
            inspections.map((insp) => (
              <div
                key={insp.id}
                className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-white font-mono font-bold text-xs border border-slate-700">
                      {insp.vehicleRego}
                    </span>
                    {insp.trailerId && (
                      <span className="text-xs text-slate-400 font-mono">
                        Trailer: {insp.trailerId}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      {Number(insp.odometer).toLocaleString()} km
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                        insp.overallStatus === "Fit for Duty"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {insp.overallStatus}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {new Date(insp.inspectedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Items Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {insp.items.map((it) => (
                    <div
                      key={it.id}
                      className={`p-2 rounded-lg border text-[11px] ${
                        it.status === "Defect"
                          ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                          : "bg-slate-950/40 border-slate-800 text-slate-400"
                      }`}
                    >
                      <span className="font-bold">{it.category}:</span> {it.status}
                      {it.notes && <div className="text-rose-400 text-[10px] mt-0.5">{it.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
