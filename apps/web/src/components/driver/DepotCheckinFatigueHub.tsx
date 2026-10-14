import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SiteCheckinRecord, VehicleRecord } from "../../types";
import { tStatus } from "../../i18n";
import { Building2, AlertTriangle, LogOut, MapPin, Clock, CheckCircle2, Truck, History } from "lucide-react";

interface DepotCheckinFatigueHubProps {
  checkins: SiteCheckinRecord[];
  vehicles: VehicleRecord[];
  driverName: string;
  onCheckin: (checkin: SiteCheckinRecord) => void;
  onCheckout: (checkinId: string) => void;
}

export function DepotCheckinFatigueHub({
  checkins,
  vehicles,
  driverName,
  onCheckin,
  onCheckout,
}: DepotCheckinFatigueHubProps) {
  const activeCheckin = checkins.find((c) => c.status === "Active");

  // Live fatigue countdown: NHVAS Basic Fatigue Management allows
  // a maximum 12-hour duty window, followed by a mandatory 10-hour rest.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const checkinDate = activeCheckin
    ? new Date(activeCheckin.checkinTime.replace(" ", "T"))
    : null;
  const hoursOnDuty =
    checkinDate && !Number.isNaN(checkinDate.getTime())
      ? (Date.now() - checkinDate.getTime()) / 3600000
      : 0;
  const MAX_DUTY_HOURS = 12;
  const dutyRemaining = MAX_DUTY_HOURS - hoursOnDuty;

  // Form State for new checkin
  const [selectedDepot, setSelectedDepot] = useState("BNT Logistics Port Melbourne Hub");
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]?.rego || "BNT-9988");
  const [hoursDriven, setHoursDriven] = useState<number>(3.5);
  const [hoursRested, setHoursRested] = useState<number>(11.0);
  const [fitnessAgreed, setFitnessAgreed] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleCheckinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fitnessAgreed) {
      setErrorMessage(t("chk_err_fitness"));
      return;
    }
    if (hoursDriven > 12) {
      setErrorMessage(t("chk_err_hours"));
      return;
    }

    const targetVeh = vehicles.find((v) => v.rego === selectedVehicle);
    if (targetVeh && targetVeh.status === "Maintenance Required") {
      setErrorMessage(t("chk_err_grounded", { rego: selectedVehicle }));
      return;
    }

    const newRecord: SiteCheckinRecord = {
      id: `chk-${Date.now().toString().slice(-4)}`,
      depotName: selectedDepot,
      driverName,
      vehicleRego: selectedVehicle,
      checkinTime: new Date().toISOString().replace("T", " ").slice(0, 16),
      checkoutTime: null,
      hoursDrivenToday: hoursDriven,
      hoursRestedLast24h: hoursRested,
      fitnessDeclaration: true,
      status: "Active",
    };

    onCheckin(newRecord);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Building2 className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-black text-white tracking-tight">{t("chk_title")}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/10 border border-emerald-500/30 text-emerald-100">
                {t("chk_badge")}
              </span>
            </div>
            <p className="text-slate-200 text-sm">
              {t("chk_sub")}
            </p>
          </div>

          {activeCheckin && (
            <div className="flex items-center gap-3 bg-emerald-950/60 border border-emerald-500/30 px-4 py-2 rounded-xl">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <div className="text-xs">
                <span className="text-slate-400 block font-medium">{t("chk_active_visit")}</span>
                <span className="text-emerald-400 font-bold">{activeCheckin.depotName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4" /> {errorMessage}
        </div>
      )}

      {/* Active Check-in Card if Signed In */}
      {activeCheckin ? (
        <>
        {dutyRemaining <= 0 ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t("chk_duty_exceeded")}
          </div>
        ) : dutyRemaining <= 2 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {t("chk_duty_low", { hours: dutyRemaining.toFixed(1) })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
            <Clock className="w-4 h-4 shrink-0" />
            {t("chk_duty_ok", { hours: dutyRemaining.toFixed(1) })}
          </div>
        )}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950/30 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30">
                  ● {t("chk_checked_in")}
                </span>
                 <span className="text-xs text-slate-400 font-mono">{t("chk_id", { id: activeCheckin.id })}</span>
              </div>
              <h3 className="text-xl font-bold text-white mt-2">{activeCheckin.depotName}</h3>
            </div>

            <button
              onClick={() => onCheckout(activeCheckin.id)}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg self-start sm:self-auto flex items-center gap-2"
            >
               <LogOut className="w-4 h-4" /> {t("chk_signout")}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
               <span className="text-slate-400 block font-medium">{t("chk_vehicle")}</span>
              <span className="text-emerald-400 font-extrabold font-mono text-sm">{activeCheckin.vehicleRego}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
               <span className="text-slate-400 block font-medium">{t("chk_timestamp")}</span>
              <span className="text-white font-bold">{activeCheckin.checkinTime}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
               <span className="text-slate-400 block font-medium">{t("chk_hours_driven")}</span>
               <span className="text-white font-bold">{t("chk_hrs_bfm", { n: activeCheckin.hoursDrivenToday })}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
               <span className="text-slate-400 block font-medium">{t("chk_fitness")}</span>
               <span className="text-emerald-400 font-bold">{t("chk_confirmed")}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
               <span className="text-slate-400 block font-medium">{t("chk_hours_duty")}</span>
               <span className={`font-extrabold text-sm ${dutyRemaining <= 0 ? "text-rose-400" : dutyRemaining <= 2 ? "text-amber-400" : "text-white"}`}>
                 {t("chk_hrs", { n: hoursOnDuty.toFixed(1) })}
               </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
               <span className="text-slate-400 block font-medium">{t("chk_duty_remaining")}</span>
               <span className={`font-extrabold text-sm ${dutyRemaining <= 0 ? "text-rose-400" : dutyRemaining <= 2 ? "text-amber-400" : "text-emerald-400"}`}>
                 {t("chk_hrs", { n: Math.max(0, dutyRemaining).toFixed(1) })}
               </span>
            </div>
          </div>
        </div>
        </>
      ) : (
        /* New Check-In Form */
        <form onSubmit={handleCheckinSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" /> {t("chk_form_title")}
            </h3>
            <span className="text-xs text-slate-400">{t("chk_ruleset")}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
               <label htmlFor="checkin-depot" className="block text-xs font-bold text-slate-300 mb-1">{t("chk_depot_label")}</label>
              <select
                id="checkin-depot"
                name="depotName"
                value={selectedDepot}
                onChange={(e) => setSelectedDepot(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                 <option value="BNT Logistics Port Melbourne Hub">{t("chk_depot_melbourne")}</option>
                 <option value="BNT Logistics Chipping Norton Freight Centre">{t("chk_depot_norton")}</option>
                 <option value="BNT Logistics Acacia Ridge Logistics Terminal">{t("chk_depot_acacia")}</option>
                 <option value="BNT Logistics Regency Park Depot">{t("chk_depot_regency")}</option>
                 <option value="BNT Logistics Welshpool Logistics Hub">{t("chk_depot_welshpool")}</option>
              </select>
            </div>

            <div>
               <label htmlFor="checkin-vehicle" className="block text-xs font-bold text-slate-300 mb-1">{t("chk_vehicle_label")}</label>
              <select
                id="checkin-vehicle"
                name="vehicleRego"
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
              >
                {vehicles.length === 0 ? (
                   <option value="UNREGISTERED">{t("chk_no_vehicle")}</option>
                ) : (
                  vehicles.map((v) => (
                    <option key={v.id} value={v.rego}>
                      {v.rego} — {v.makeModel} {v.status === "Maintenance Required" ? t("chk_grounded") : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
               <label htmlFor="checkin-hoursDriven" className="block text-xs font-bold text-slate-300 mb-1">{t("chk_hours_driven_label")}</label>
              <input
                id="checkin-hoursDriven"
                name="hoursDriven"
                type="number"
                step="0.5"
                min="0"
                max="14"
                value={hoursDriven}
                onChange={(e) => setHoursDriven(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
               <span className="text-[10px] text-slate-400 mt-1 block">{t("chk_max_12")}</span>
            </div>

            <div>
               <label htmlFor="checkin-hoursRested" className="block text-xs font-bold text-slate-300 mb-1">{t("chk_hours_rested_label")}</label>
              <input
                id="checkin-hoursRested"
                name="hoursRested"
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={hoursRested}
                onChange={(e) => setHoursRested(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                required
              />
               <span className="text-[10px] text-slate-400 mt-1 block">{t("chk_min_7")}</span>
            </div>

            <div className="md:col-span-2 p-4 rounded-xl bg-slate-800/70 border border-slate-700 space-y-3">
              <label htmlFor="checkin-fitnessAgreed" className="flex items-start gap-3 cursor-pointer">
                <input
                  id="checkin-fitnessAgreed"
                  name="fitnessAgreed"
                  type="checkbox"
                  checked={fitnessAgreed}
                  onChange={(e) => setFitnessAgreed(e.target.checked)}
                  className="mt-1 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <div className="text-xs text-slate-300">
                   <strong className="text-white block mb-0.5">{t("chk_fitness_decl")}</strong>
                   {t("chk_fitness_text")}
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg flex items-center gap-2"
            >
               <CheckCircle2 className="w-4 h-4" /> {t("chk_submit")}
            </button>
          </div>
        </form>
      )}

      {/* Historical Check-In Logs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
           <History className="w-4 h-4 text-emerald-400" /> {t("chk_history")}
        </h3>

        {checkins.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            {t("chk_empty")}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {checkins.map((chk) => (
              <div key={chk.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">{chk.depotName}</span>
                  <span className="text-slate-400 text-[11px]">
                    Vehicle: <strong className="text-emerald-400 font-mono">{chk.vehicleRego}</strong> • {t("chk_hrs_driven", { n: chk.hoursDrivenToday })}
                  </span>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      chk.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tStatus(chk.status, t)}
                  </span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">{chk.checkinTime}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
