import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck, CalendarClock, Wrench, AlertTriangle } from "lucide-react";
import { VehicleRecord } from "../../types";
import { api } from "../../lib/api";
import { tStatus } from "../../i18n";

interface FleetVehicle extends VehicleRecord {
  userName: string;
  userEmail: string;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function ExpiryBadge({ date }: { date: string | null | undefined }) {
  const { t } = useTranslation();
  const days = daysUntil(date);
  if (days === null) return <span className="text-slate-400">—</span>;
  const label = days < 0
    ? t(Math.abs(days) === 1 ? "flt_expired_ago_one" : "flt_expired_ago_other", { count: Math.abs(days) })
    : days === 0
    ? t("flt_expires_today")
    : t(days === 1 ? "flt_days_left_one" : "flt_days_left_other", { count: days });
  const cls =
    days < 0
      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
      : days <= 30
      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`} title={date || undefined}>
      {label}
    </span>
  );
}

export function FleetAdmin() {
  const { t } = useTranslation();
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getAdminFleetData();
      setVehicles(data.vehicles);
    } catch (err: any) {
      setLoadError(err?.message || t("flt_load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = vehicles.filter((v) => v.status === "Active").length;
  const maintenanceCount = vehicles.filter((v) => v.status === "Maintenance Required").length;
  const expiringSoon = vehicles.filter((v) => {
    const dates = [daysUntil(v.regoExpiryDate), daysUntil(v.dgExpiryDate), daysUntil(v.scbaServiceDueDate)];
    return dates.some((d) => d !== null && d <= 30);
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-400" />
            {t("flt_title")}
          </h3>
          <p className="text-xs text-slate-400">
            {t("flt_subtitle")}
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold"
        >
          {t("flt_refresh")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">{t("flt_total_vehicles")}</div>
          <div className="text-xl font-bold text-white">{vehicles.length}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">{t("flt_active")}</div>
          <div className="text-xl font-bold text-emerald-400">{activeCount}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">{t("flt_maintenance")}</div>
          <div className="text-xl font-bold text-rose-400">{maintenanceCount}</div>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
          <div className="text-xs text-slate-400 font-medium">{t("flt_expiring_30")}</div>
          <div className="text-xl font-bold text-amber-400">{expiringSoon}</div>
        </div>
      </div>

      {loading ? (
        <div className="glass" style={{ padding: "28px", borderRadius: "20px", textAlign: "center", color: "var(--color-muted)", fontSize: "0.85rem" }}>
          {t("flt_loading")}
        </div>
      ) : loadError ? (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
          {loadError}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="glass" style={{ padding: "40px", borderRadius: "20px", textAlign: "center" }}>
          <Truck className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-muted)" }} />
          <p className="text-sm font-bold">{t("flt_empty_title")}</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            {t("flt_empty_sub")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase" style={{ color: "var(--color-muted)" }}>
              <tr className="border-b" style={{ borderColor: "var(--border, rgba(255,255,255,0.08))" }}>
                <th className="py-3 px-4 font-semibold">{t("flt_th_driver")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_rego")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_vehicle")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_branch")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_rego_expiry")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_dg_expiry")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_escba")}</th>
                <th className="py-3 px-4 font-semibold">{t("flt_th_status")}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((veh) => (
                <tr
                  key={veh.id}
                  className="border-b"
                  style={{ borderColor: "var(--border, rgba(255,255,255,0.06))" }}
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white">{veh.userName}</div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>{veh.userEmail}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-amber-400">{veh.rego}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{veh.makeModel}</div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>{veh.bodyType}</div>
                  </td>
                  <td className="py-3 px-4 text-xs" style={{ color: "var(--color-muted)" }}>
                    {veh.branchName || "—"}
                  </td>
                  <td className="py-3 px-4"><ExpiryBadge date={veh.regoExpiryDate} /></td>
                  <td className="py-3 px-4"><ExpiryBadge date={veh.dgExpiryDate} /></td>
                  <td className="py-3 px-4"><ExpiryBadge date={veh.scbaServiceDueDate} /></td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        veh.status === "Active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : veh.status === "Maintenance Required"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-slate-700/50 text-slate-300 border border-slate-600"
                      }`}
                    >
                      {tStatus(veh.status, t)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {maintenanceCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <Wrench className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-300">
            {t(maintenanceCount === 1 ? "flt_grounded_one" : "flt_grounded_other", { count: maintenanceCount })}
          </p>
        </div>
      )}

      {expiringSoon > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <CalendarClock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300">
            {t(expiringSoon === 1 ? "flt_paperwork_one" : "flt_paperwork_other", { count: expiringSoon })}
          </p>
        </div>
      )}

      {vehicles.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700">
          <AlertTriangle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            {t("flt_legend")}
          </p>
        </div>
      )}
    </div>
  );
}
