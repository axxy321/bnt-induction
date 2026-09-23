import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { DriverBundle } from "../../types";
import { X, ShieldCheck, Truck, Calendar, MapPin, AlertTriangle, Printer, CheckCircle2 } from "lucide-react";

interface DepotGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverBundle: DriverBundle;
}

export const DepotGatePassModal: React.FC<DepotGatePassModalProps> = ({
  isOpen,
  onClose,
  driverBundle
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const driver = driverBundle.driver;
  const isCompleted = driverBundle.progress?.completedStepIds?.length === 6;
  const verificationCode = driverBundle.certificate?.verificationCode || `BNT-${driver.id.slice(0, 8).toUpperCase()}`;
  const verifyUrl = `${window.location.origin}/#verify-${verificationCode}`;
  const validUntilDate = new Date();
  validUntilDate.setFullYear(validUntilDate.getFullYear() + 1);
  const expiryFormatted = validUntilDate.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, verifyUrl, {
        width: 160,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      }).catch((err) => {
        console.error("Failed to render QR Code on canvas", err);
      });
    }
  }, [isOpen, verifyUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative"
        >
          {/* Top Bar Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 p-5 text-white flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200">
                  BNT Logistics Site Access
                </span>
                <h3 className="text-lg font-black tracking-tight">Depot Gate Pass</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-colors text-white"
              aria-label="Close gate pass modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Status Pulse Banner */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isCompleted
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <div className="relative flex items-center justify-center">
                {isCompleted ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75"></span>
                    <CheckCircle2 className="relative inline-flex w-5 h-5 text-emerald-400" />
                  </>
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                )}
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider">
                  {isCompleted ? "Access Authorised • Active" : "Induction Incomplete"}
                </div>
                <div className="text-[11px] opacity-80">
                  {isCompleted
                    ? "Verified for heavy vehicle depot gates & dock bays"
                    : "Complete induction steps to unlock unrestricted site entry"}
                </div>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner space-y-3">
              <div className="p-2 bg-white rounded-xl shadow-lg flex items-center justify-center">
                <canvas ref={canvasRef} className="rounded-lg" />
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">
                  Gate Scanner Verification Code
                </span>
                <span className="text-sm font-mono font-bold text-white tracking-wider">
                  {verificationCode}
                </span>
              </div>
            </div>

            {/* Driver Particulars Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Driver Name</span>
                <strong className="text-white text-sm block truncate">{driver.fullName || "Unassigned"}</strong>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Licence Class</span>
                <strong className="text-emerald-400 text-sm block font-mono">
                  {driver.licenceClass || "HC Heavy Combination"}
                </strong>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Primary Terminal</span>
                <div className="flex items-center gap-1 text-slate-200 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">Melbourne Freight</span>
                </div>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Valid Until</span>
                <div className="flex items-center gap-1 text-slate-200 mt-0.5 font-mono">
                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{expiryFormatted}</span>
                </div>
              </div>
            </div>

            {/* Footer Notice & Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>HVNL Compliant</span>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-2 border border-slate-700 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save Pass
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
