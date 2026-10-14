import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { PreTripInspectionRecord, PreTripCheckItem } from "../../types";
import { api } from "../../lib/api";
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

export const PreTripInspectionHub: React.FC<PreTripInspectionHubProps> = ({
  inspections,
  onSaveInspection,
  driverName,
  driverId
}) => {
  const { t } = useTranslation();

  const defaultCheckItems = (): Array<Omit<PreTripCheckItem, "status" | "notes">> => [
    { id: "chk_1", category: t("pt_cat_tyres"), label: t("pt_item_tyres") },
    { id: "chk_2", category: t("pt_cat_brakes"), label: t("pt_item_brakes") },
    { id: "chk_3", category: t("pt_cat_lights"), label: t("pt_item_lights") },
    { id: "chk_4", category: t("pt_cat_coupling"), label: t("pt_item_coupling") },
    { id: "chk_5", category: t("pt_cat_load"), label: t("pt_item_load") },
    { id: "chk_6", category: t("pt_cat_fluids"), label: t("pt_item_fluids") }
  ];

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [vehicleRego, setVehicleRego] = useState("");
  const [odometer, setOdometer] = useState("");
  const [trailerId, setTrailerId] = useState("");
  const [items, setItems] = useState<PreTripCheckItem[]>(
    defaultCheckItems().map((item) => ({ ...item, status: "Pass" as const, notes: "" }))
  );
  const [driverSignature, setDriverSignature] = useState(driverName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState<Record<string, boolean>>({});

  const hasDefects = items.some((item) => item.status === "Defect");
  const overallStatus = hasDefects ? "Minor Defect" : "Fit for Duty";

  const statusLabel = (s: string) =>
    s === "Pass" ? t("pt_pass") : s === "Defect" ? t("pt_defect") : s;

  const handleToggleStatus = (id: string, status: "Pass" | "Defect") => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, photos: status === "Pass" ? [] : item.photos } : item))
    );
  };

  const handleNotesChange = (id: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes } : item))
    );
  };

  const handlePhotosChange = (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadingPhotos(prev => ({ ...prev, [id]: true }));
    
    // Convert files to base64 for preview (in production, upload to Supabase Storage)
    const photoPromises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });
    
    Promise.all(photoPromises).then(photos => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, photos: [...(item.photos || []), ...photos] }
            : item
        )
      );
      setUploadingPhotos(prev => ({ ...prev, [id]: false }));
    });
  };

  const handleRemovePhoto = (itemId: string, photoIndex: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, photos: item.photos?.filter((_, i) => i !== photoIndex) || [] }
          : item
      )
    );
  };

  const handleSetAllPass = () => {
    setItems((prev) => prev.map((item) => ({ ...item, status: "Pass", notes: "", photos: [] })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleRego.trim()) {
      alert(t("pt_alert_rego"));
      return;
    }
    if (!odometer.trim()) {
      alert(t("pt_alert_odo"));
      return;
    }

    setIsSubmitting(true);
    const newRecord: PreTripInspectionRecord = {
      id: `insp_${Date.now()}`,
      driverId,
      driverName: driverName || t("common_driver"),
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
    setSuccessNotice(t("pt_success", { rego: newRecord.vehicleRego }));
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
            {t("pt_banner")}
          </div>
          <h2 className="text-2xl font-black text-white font-heading">
            {t("pt_title")}
          </h2>
          <p className="text-slate-300 text-xs mt-1">
            {t("pt_sub")}
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
            {t("pt_new_tab")}
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
            {t("pt_history_tab", { count: inspections.length })}
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
                {t("pt_vehicle_card")}
              </h3>
              <button
                type="button"
                onClick={handleSetAllPass}
                className="text-xs text-emerald-400 hover:underline font-bold"
              >
                {t("pt_mark_all_pass")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("pt_rego_label")}
                </label>
                <input
                  type="text"
                  placeholder={t("pt_rego_ph")}
                  value={vehicleRego}
                  onChange={(e) => setVehicleRego(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 uppercase font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("pt_odo_label")}
                </label>
                <input
                  type="number"
                  placeholder={t("pt_odo_ph")}
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("pt_trailer_label")}
                </label>
                <input
                  type="text"
                  placeholder={t("pt_trailer_ph")}
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
              {t("pt_checklist_card")}
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
                        {t("pt_pass")}
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
                        {t("pt_defect")}
                      </button>
                    </div>
                  </div>

                  {item.status === "Defect" && (
                    <div className="mt-3 pt-3 border-t border-rose-500/20">
                      <label className="block text-xs font-medium text-rose-400 mb-1">
                        {t("pt_defect_details")}
                      </label>
                      <input
                        type="text"
                        placeholder={t("pt_defect_notes_ph")}
                        value={item.notes || ""}
                        onChange={(e) => handleNotesChange(item.id, e.target.value)}
                        className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                        required
                      />
                      
                      {/* Photo Upload */}
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          {t("pt_defect_photos")}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePhotosChange(item.id, e.target.files)}
                          disabled={uploadingPhotos[item.id]}
                          className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700 disabled:opacity-50"
                        />
                        {uploadingPhotos[item.id] && (
                          <p className="text-xs text-amber-400 mt-1">{t("pt_uploading")}</p>
                        )}
                        
                        {/* Photo Previews */}
                        {(item.photos && item.photos.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.photos.map((photo, idx) => (
                              <div key={idx} className="relative group">
                                <img
                                  src={photo}
                                  alt={`Defect photo ${idx + 1}`}
                                  className="w-20 h-20 object-cover rounded-lg border border-slate-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(item.id, idx)}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  aria-label={t("pt_remove_photo")}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                {t("pt_decl_card")}
              </h3>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${
                  hasDefects
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}
              >
                {t("pt_overall", { status: hasDefects ? t("pt_overall_minor") : t("pt_overall_fit") })}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              {t("pt_certify")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t("pt_signature_label")}
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
                   {isSubmitting ? t("pt_submitting") : t("pt_submit")}
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
              <p className="text-slate-300 font-bold text-sm">{t("pt_empty_title")}</p>
              <p className="text-slate-500 text-xs mt-1">
                {t("pt_empty_sub")}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className="mt-4 px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4" />
                {t("pt_start")}
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
                        {t("pt_trailer", { id: insp.trailerId })}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-mono">
                      {t("pt_km", { n: Number(insp.odometer).toLocaleString() })}
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
                      {insp.overallStatus === "Fit for Duty" ? t("pt_overall_fit") : t("pt_overall_minor")}
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
                      <span className="font-bold">{it.category}:</span> {statusLabel(it.status)}
                      {it.notes && <div className="text-rose-400 text-[10px] mt-0.5">{it.notes}</div>}
                      {(it.photos && it.photos.length > 0) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.photos.map((photo, idx) => (
                            <img
                              key={idx}
                              src={photo}
                              alt={`Defect photo ${idx + 1}`}
                              className="w-14 h-14 object-cover rounded border border-slate-700"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
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
