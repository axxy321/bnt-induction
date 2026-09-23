import React, { useState, useMemo } from "react";
import { AdminDriverRow } from "../../types";
import {
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Bell,
  Search,
  Truck,
  FileText,
  Send
} from "lucide-react";

interface AdminExpiryMatrixProps {
  drivers: AdminDriverRow[];
  onNotifyDriver?: (driverId: string, email: string, message: string) => void;
}

interface ExpiryItem {
  driverId: string;
  driverName: string;
  driverEmail: string;
  docType: string;
  expiryDateStr: string;
  daysRemaining: number;
  urgency: "Expired" | "Urgent (< 14d)" | "Upcoming (< 30d)" | "Valid";
}

export const AdminExpiryMatrix: React.FC<AdminExpiryMatrixProps> = ({
  drivers,
  onNotifyDriver
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUrgency, setFilterUrgency] = useState<string>("All");
  const [notifiedDrivers, setNotifiedDrivers] = useState<Set<string>>(new Set());

  // Derive real-time expiry computations from live driver records
  const expiryItems = useMemo(() => {
    const items: ExpiryItem[] = [];
    const now = new Date().getTime();

    drivers.forEach((driver) => {
      // Check each uploaded document on the driver
      if (driver.documents && driver.documents.length > 0) {
        driver.documents.forEach((doc) => {
          if (doc.expiresAt) {
            const expTime = new Date(doc.expiresAt).getTime();
            const diffDays = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
            let urgency: ExpiryItem["urgency"] = "Valid";
            if (diffDays < 0) urgency = "Expired";
            else if (diffDays <= 14) urgency = "Urgent (< 14d)";
            else if (diffDays <= 30) urgency = "Upcoming (< 30d)";

            const docLabel =
              doc.type === "driver_license"
                ? "Driver Licence"
                : doc.type === "medical_certificate"
                ? "Medical Assessment"
                : doc.type === "dangerous_goods_license"
                ? "Dangerous Goods Licence"
                : "Compliance Document";

            items.push({
              driverId: driver.id,
              driverName: driver.fullName,
              driverEmail: driver.email,
              docType: docLabel,
              expiryDateStr: doc.expiresAt.split("T")[0],
              daysRemaining: diffDays,
              urgency
            });
          }
        });
      }

      // If driver has an induction completion timestamp, compute annual refresher expiry (365 days)
      if (driver.completedAt) {
        const completedTime = new Date(driver.completedAt).getTime();
        const refresherDueTime = completedTime + 365 * 24 * 60 * 60 * 1000;
        const diffDays = Math.ceil((refresherDueTime - now) / (1000 * 60 * 60 * 24));
        let urgency: ExpiryItem["urgency"] = "Valid";
        if (diffDays < 0) urgency = "Expired";
        else if (diffDays <= 14) urgency = "Urgent (< 14d)";
        else if (diffDays <= 30) urgency = "Upcoming (< 30d)";

        items.push({
          driverId: driver.id,
          driverName: driver.fullName,
          driverEmail: driver.email,
          docType: "Annual Induction Refresher",
          expiryDateStr: new Date(refresherDueTime).toISOString().split("T")[0],
          daysRemaining: diffDays,
          urgency
        });
      }
    });

    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [drivers]);

  const filteredItems = useMemo(() => {
    return expiryItems.filter((item) => {
      const matchesSearch =
        item.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.docType.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (filterUrgency === "All") return true;
      if (filterUrgency === "ActionRequired") return item.daysRemaining <= 30;
      return item.urgency === filterUrgency;
    });
  }, [expiryItems, searchTerm, filterUrgency]);

  const expiredCount = expiryItems.filter((i) => i.daysRemaining < 0).length;
  const urgentCount = expiryItems.filter((i) => i.daysRemaining >= 0 && i.daysRemaining <= 14).length;
  const upcomingCount = expiryItems.filter((i) => i.daysRemaining > 14 && i.daysRemaining <= 30).length;

  const handleSendReminder = (item: ExpiryItem) => {
    setNotifiedDrivers((prev) => new Set([...prev, `${item.driverId}_${item.docType}`]));
    if (onNotifyDriver) {
      onNotifyDriver(
        item.driverId,
        item.driverEmail,
        `Attention: Your ${item.docType} is due for compliance renewal.`
      );
    } else {
      alert(`Automated renewal notification dispatched to ${item.driverEmail}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Expiry Overview Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-4 rounded-2xl border border-rose-500/30 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Expired Documents</span>
            <strong className="text-2xl font-black text-rose-400 block">{expiredCount}</strong>
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-amber-500/30 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Urgent (&lt; 14 Days)</span>
            <strong className="text-2xl font-black text-amber-400 block">{urgentCount}</strong>
          </div>
        </div>

        <div className="glass p-4 rounded-2xl border border-blue-500/30 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-bold uppercase">Upcoming (&lt; 30 Days)</span>
            <strong className="text-2xl font-black text-blue-400 block">{upcomingCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <label htmlFor="expiry-search-input" className="sr-only">Search driver or document</label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="expiry-search-input"
            name="expirySearch"
            type="text"
            placeholder="Search driver or document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["All", "ActionRequired", "Expired", "Urgent (< 14d)", "Upcoming (< 30d)"].map((urg) => (
            <button
              key={urg}
              type="button"
              onClick={() => setFilterUrgency(urg)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filterUrgency === urg
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {urg === "ActionRequired" ? "Action Required (≤ 30d)" : urg}
            </button>
          ))}
        </div>
      </div>

      {/* Expiry Table */}
      <div className="glass rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">Driver</th>
                <th className="p-3.5">Requirement / Item</th>
                <th className="p-3.5">Expiry Date</th>
                <th className="p-3.5">Days Left</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                    No expiring compliance documents found for this filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isNotified = notifiedDrivers.has(`${item.driverId}_${item.docType}`);
                  return (
                    <tr key={`${item.driverId}_${item.docType}_${idx}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white text-sm">{item.driverName}</div>
                        <div className="text-slate-400 text-[11px]">{item.driverEmail}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2 font-medium text-slate-200">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span>{item.docType}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {item.expiryDateStr}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-mono font-bold ${
                            item.daysRemaining < 0
                              ? "text-rose-400"
                              : item.daysRemaining <= 14
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                        >
                          {item.daysRemaining < 0
                            ? `${Math.abs(item.daysRemaining)} days ago`
                            : `${item.daysRemaining} days`}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            item.urgency === "Expired"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              : item.urgency === "Urgent (< 14d)"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : item.urgency === "Upcoming (< 30d)"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {item.urgency}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(item)}
                          disabled={isNotified}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                            isNotified
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-500 text-white"
                          }`}
                        >
                          {isNotified ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              Alerted
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              Send Alert
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
