import React, { useState } from "react";
import QRCode from "qrcode";
import { VehicleRecord } from "../../types";
import { Truck, QrCode, Plus, CheckCircle2, AlertTriangle, Building2, Calendar, X } from "lucide-react";

interface VehicleManagementHubProps {
  vehicles: VehicleRecord[];
  onAddVehicle: (newVehicle: VehicleRecord) => void;
  driverName?: string;
  driverNumber?: string;
  contactNumber?: string;
}

export const VehicleManagementHub: React.FC<VehicleManagementHubProps> = ({
  vehicles,
  onAddVehicle,
  driverName,
  driverNumber,
  contactNumber,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPassVehicle, setSelectedPassVehicle] = useState<VehicleRecord | null>(null);

  const [rego, setRego] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [bodyType, setBodyType] = useState("Heavy B-Double Combination");
  const [branchName, setBranchName] = useState("Melbourne Freight Terminal - BNT Depot");
  const [regoExpiryDate, setRegoExpiryDate] = useState("2027-12-31");
  const [dgExpiryDate, setDgExpiryDate] = useState("2028-06-30");
  const [scbaServiceDueDate, setScbaServiceDueDate] = useState("2027-03-15");

  const handleCreateVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rego || !makeModel) return;

    const newVeh: VehicleRecord = {
      id: `veh-${Date.now()}`,
      rego: rego.toUpperCase(),
      makeModel,
      bodyType,
      branchName,
      driverNumber: driverNumber || `DRV-${rego.toUpperCase().slice(0, 4)}`,
      driverName: driverName || "Driver",
      regoExpiryDate,
      dgExpiryDate,
      scbaServiceDueDate,
      vehicleCheckApproved: true,
      regoCheckApproved: true,
      status: "Active",
      qrPassCode: `BNT-PASS-${rego.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      contactNumber: contactNumber || "",
    };

    onAddVehicle(newVeh);
    setShowAddModal(false);
    setRego("");
    setMakeModel("");
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Truck className="w-3.5 h-3.5" /> Vehicle & Site Access Management • BNT Logistics Standard
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Registered Heavy Vehicles & Site Access Passes ({vehicles.length})
          </h1>
          <p className="text-slate-400 text-sm">
            Maintain vehicle registration details, DG compliance dates, eSCBA service logs, and digital QR site entry passes.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-lg shrink-0 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Register New Vehicle
        </button>
      </div>

      {/* Vehicle Grid */}
      {vehicles.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
          <Truck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Registered Vehicles Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            You do not have any registered heavy vehicles or trailers linked to your account. Click below to add a vehicle and generate a site entry QR pass.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-lg inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Register New Vehicle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vehicles.map((veh) => (
            <div
              key={veh.id}
              className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">
                    REGO: {veh.rego}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      veh.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    {veh.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white">{veh.makeModel}</h3>
                  <p className="text-xs text-slate-400">{veh.bodyType}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="flex justify-between">
                    <span>Branch / Location:</span>
                    <span className="font-medium text-white truncate max-w-[200px]">{veh.branchName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>REGO Expiry:</span>
                    <span className="font-mono text-emerald-400">{veh.regoExpiryDate}</span>
                  </div>
                  {veh.dgExpiryDate && (
                    <div className="flex justify-between">
                      <span>DG Licence Expiry:</span>
                      <span className="font-mono text-amber-400">{veh.dgExpiryDate}</span>
                    </div>
                  )}
                  {veh.scbaServiceDueDate && (
                    <div className="flex justify-between">
                      <span>eSCBA Service Due:</span>
                      <span className="font-mono text-blue-400">{veh.scbaServiceDueDate}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span>Vehicle Check Approved:</span>
                    <span className={veh.vehicleCheckApproved ? "text-emerald-400 font-bold" : "text-rose-400"}>
                      {veh.vehicleCheckApproved ? "YES" : "NO"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Pass Code: {veh.qrPassCode}</span>
                <button
                  onClick={() => setSelectedPassVehicle(veh)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition-all"
                >
                  Digital Site Pass
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: REGISTER VEHICLE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white">Register Heavy Vehicle</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="veh-rego" className="text-xs font-semibold text-slate-300">Vehicle REGO Number *</label>
                <input
                  id="veh-rego"
                  name="rego"
                  type="text"
                  required
                  placeholder="e.g. BNT-9988"
                  value={rego}
                  onChange={(e) => setRego(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="veh-makeModel" className="text-xs font-semibold text-slate-300">Make & Model *</label>
                <input
                  id="veh-makeModel"
                  name="makeModel"
                  type="text"
                  required
                  placeholder="e.g. Kenworth K200 Prime Mover"
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="veh-regoExpiry" className="text-xs font-semibold text-slate-300">REGO Expiry Date</label>
                  <input
                    id="veh-regoExpiry"
                    name="regoExpiryDate"
                    type="date"
                    value={regoExpiryDate}
                    onChange={(e) => setRegoExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="veh-dgExpiry" className="text-xs font-semibold text-slate-300">DG Expiry Date</label>
                  <input
                    id="veh-dgExpiry"
                    name="dgExpiryDate"
                    type="date"
                    value={dgExpiryDate}
                    onChange={(e) => setDgExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg transition-all"
                >
                  Save & Activate Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIGITAL QR SITE PASS */}
      {selectedPassVehicle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider">
                ● Active Site Entry Pass
              </div>
              <h2 className="text-xl font-extrabold text-white">{selectedPassVehicle.rego}</h2>
              <p className="text-xs text-slate-400">{selectedPassVehicle.makeModel}</p>
            </div>

            {/* Offline Canvas QR Code Container */}
            <div className="p-6 rounded-2xl bg-white flex flex-col items-center justify-center shadow-inner mx-auto max-w-[220px]">
              <canvas
                ref={(el) => {
                  if (el && selectedPassVehicle) {
                    QRCode.toCanvas(
                      el,
                      `https://compliance.bntlogistics.com.au/#verify-${selectedPassVehicle.qrPassCode}`,
                      { width: 160, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } },
                      (err) => {
                        if (err) console.error("QR render error", err);
                      }
                    );
                  }
                }}
                className="w-40 h-40 rounded"
              />
              <span className="text-[10px] font-mono text-slate-800 font-bold mt-2 tracking-widest">
                {selectedPassVehicle.qrPassCode}
              </span>
            </div>

            <div className="text-xs text-slate-300 space-y-1 bg-slate-800/60 p-3 rounded-xl text-left border border-slate-800">
              <div className="flex justify-between">
                <span>Driver:</span>
                <span className="font-bold text-white">{selectedPassVehicle.driverName}</span>
              </div>
              <div className="flex justify-between">
                <span>Branch:</span>
                <span className="text-slate-300 truncate max-w-[160px]">{selectedPassVehicle.branchName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>WHS Compliance:</span>
                <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPassVehicle(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
