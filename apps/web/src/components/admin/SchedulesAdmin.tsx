import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Play,
  Mail,
  Clock,
  ListOrdered,
  X
} from "lucide-react";
import { useAppState } from "../../state/AppContext";
import {
  InductionCourse,
  InductionSchedule,
  InductionScheduleEnrollment,
  InductionScheduleItem
} from "../../types";
import {
  getInductionSchedules,
  createInductionSchedule,
  updateInductionSchedule,
  deleteInductionSchedule,
  getScheduleItems,
  addScheduleItem,
  deleteScheduleItem,
  getScheduleEnrollments,
  enrollDriverInSchedule,
  unenrollDriverFromSchedule,
  cancelScheduleInvitation,
  processScheduleInvitations,
  getInductionCourses
} from "../../lib/api";
import { supabase } from "../../lib/supabase";

type DelayType = InductionScheduleItem["delayType"];

interface DriverOption {
  id: string;
  fullName: string;
  email: string;
}

const DELAY_TYPE_LABELS: Record<DelayType, string> = {
  after_completion: "schedules_item_delay_after_completion",
  after_enrollment: "schedules_item_delay_after_enrollment",
  fixed_date: "schedules_item_delay_fixed_date"
};

const STATUS_COLORS: Record<InductionScheduleEnrollment["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  completed: "bg-sky-500/10 text-sky-400 border border-sky-500/30",
  cancelled: "bg-slate-500/10 text-slate-400 border border-slate-500/30",
  paused: "bg-amber-500/10 text-amber-400 border border-amber-500/30"
};

export function SchedulesAdmin() {
  const { t } = useTranslation();
  const { session } = useAppState();

  // Schedule list state
  const [schedules, setSchedules] = useState<InductionSchedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Schedule form state
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<InductionSchedule | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Items (induction sequence) state
  const [items, setItems] = useState<InductionScheduleItem[]>([]);
  const [courses, setCourses] = useState<InductionCourse[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemCourseId, setItemCourseId] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDelayType, setItemDelayType] = useState<DelayType>("after_completion");
  const [itemDelayDays, setItemDelayDays] = useState("7");
  const [itemFixedDate, setItemFixedDate] = useState("");
  const [itemExpiryInterval, setItemExpiryInterval] = useState("");
  const [itemIsRequired, setItemIsRequired] = useState(true);
  const [addingItem, setAddingItem] = useState(false);

  // Enrollments state
  const [enrollments, setEnrollments] = useState<InductionScheduleEnrollment[]>([]);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Cancel invitation modal state
  const [cancelInviteEnrollment, setCancelInviteEnrollment] = useState<InductionScheduleEnrollment | null>(null);
  const [cancelInviteReason, setCancelInviteReason] = useState("");
  const [cancellingInvite, setCancellingInvite] = useState(false);

  const selectedSchedule = useMemo(
    () => schedules.find((s) => s.id === selectedScheduleId) ?? null,
    [schedules, selectedScheduleId]
  );

  // Load schedules + available induction courses on mount
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [scheduleRows, courseRows] = await Promise.all([
          getInductionSchedules(session),
          getInductionCourses(session).catch(() => [] as InductionCourse[])
        ]);
        if (cancelled) return;
        setSchedules(scheduleRows);
        setCourses(courseRows);
        if (scheduleRows.length > 0) {
          setSelectedScheduleId((prev) => prev ?? scheduleRows[0].id);
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message || t("schedules_error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, t]);

  // Load driver options (for the enrollment dropdown)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "driver")
          .order("full_name", { ascending: true })
          .limit(500);
        if (cancelled) return;
        if (error) throw error;
        setDriverOptions(
          (data ?? []).map((row: any) => ({
            id: String(row.id),
            fullName: String(row.full_name ?? row.email ?? ""),
            email: String(row.email ?? "")
          }))
        );
      } catch {
        if (!cancelled) setDriverOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load items and enrollments for the selected schedule
  useEffect(() => {
    if (!session || !selectedScheduleId) return;
    let cancelled = false;

    (async () => {
      setLoadingItems(true);
      setLoadingEnrollments(true);
      setActionError(null);
      try {
        const [itemRows, enrollmentRows] = await Promise.all([
          getScheduleItems(session, selectedScheduleId),
          getScheduleEnrollments(session, selectedScheduleId)
        ]);
        if (cancelled) return;
        setItems(itemRows);
        setEnrollments(enrollmentRows);
      } catch (err: any) {
        if (!cancelled) setActionError(err?.message || t("schedules_error"));
      } finally {
        if (!cancelled) {
          setLoadingItems(false);
          setLoadingEnrollments(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, selectedScheduleId, t]);

  const resetForm = () => {
    setEditingSchedule(null);
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setFormError(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (schedule: InductionSchedule) => {
    setEditingSchedule(schedule);
    setFormName(schedule.name);
    setFormDescription(schedule.description);
    setFormIsActive(schedule.isActive);
    setFormError(null);
    setShowForm(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setFormError(null);

    if (!formName.trim()) {
      setFormError(t("schedules_name_required"));
      return;
    }

    setSaving(true);
    try {
      if (editingSchedule) {
        const updated = await updateInductionSchedule(session, editingSchedule.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          isActive: formIsActive
        });
        setSchedules((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createInductionSchedule(session, {
          name: formName.trim(),
          description: formDescription.trim()
        });
        setSchedules((prev) => [created, ...prev]);
        setSelectedScheduleId(created.id);
      }
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || t("schedules_error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!session) return;
    if (!window.confirm(t("schedules_delete_confirm"))) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteInductionSchedule(session, scheduleId);
      setSchedules((prev) => {
        const next = prev.filter((s) => s.id !== scheduleId);
        setSelectedScheduleId(next.length > 0 ? next[0].id : null);
        return next;
      });
      setItems([]);
      setEnrollments([]);
      setActionSuccess(t("schedules_deleted"));
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedScheduleId) return;
    setActionError(null);
    setActionSuccess(null);

    if (!itemTitle.trim()) {
      setActionError(t("schedules_item_title_required"));
      return;
    }

    setAddingItem(true);
    try {
      await addScheduleItem(session, selectedScheduleId, {
        courseId: itemCourseId || undefined,
        title: itemTitle.trim(),
        sequenceOrder: items.length + 1,
        delayType: itemDelayType,
        delayDays: Math.max(0, parseInt(itemDelayDays || "0", 10) || 0),
        fixedDate: itemDelayType === "fixed_date" && itemFixedDate ? new Date(itemFixedDate).toISOString() : undefined,
        expiryInterval: itemExpiryInterval.trim() || undefined,
        isRequired: itemIsRequired
      });
      const refreshed = await getScheduleItems(session, selectedScheduleId);
      setItems(refreshed);
      setItemCourseId("");
      setItemTitle("");
      setItemDelayType("after_completion");
      setItemDelayDays("7");
      setItemFixedDate("");
      setItemExpiryInterval("");
      setActionSuccess(t("schedules_item_added"));
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!session || !selectedScheduleId) return;
    if (!window.confirm(t("schedules_item_delete_confirm"))) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteScheduleItem(session, selectedScheduleId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    }
  };

  const handleEnrollDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedScheduleId) return;
    setActionError(null);
    setActionSuccess(null);

    if (!selectedDriverId) {
      setEnrollError(t("schedules_item_course_required"));
      return;
    }
    setEnrollError(null);

    setEnrolling(true);
    try {
      await enrollDriverInSchedule(session, selectedScheduleId, selectedDriverId);
      const refreshed = await getScheduleEnrollments(session, selectedScheduleId);
      setEnrollments(refreshed);
      setSelectedDriverId("");
      setActionSuccess(t("schedules_enrolled"));
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async (enrollmentId: string) => {
    if (!session || !selectedScheduleId) return;
    if (!window.confirm(t("schedules_unenroll_confirm"))) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await unenrollDriverFromSchedule(session, selectedScheduleId, enrollmentId);
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
      setActionSuccess(t("schedules_unenrolled"));
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    }
  };

  const openCancelInviteModal = (enrollment: InductionScheduleEnrollment) => {
    setCancelInviteEnrollment(enrollment);
    setCancelInviteReason("");
  };

  const handleCancelInvitation = async () => {
    if (!session || !selectedScheduleId || !cancelInviteEnrollment) return;
    if (!cancelInviteReason.trim()) return;
    setCancellingInvite(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await cancelScheduleInvitation(session, selectedScheduleId, cancelInviteEnrollment.id, cancelInviteReason.trim());
      const refreshed = await getScheduleEnrollments(session, selectedScheduleId);
      setEnrollments(refreshed);
      setCancelInviteEnrollment(null);
      setActionSuccess(t("schedules_invite_cancelled"));
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    } finally {
      setCancellingInvite(false);
    }
  };

  const handleProcessInvitations = async () => {
    if (!session) return;
    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await processScheduleInvitations(session);
      setActionSuccess(t("schedules_processed"));
      if (selectedScheduleId) {
        const refreshed = await getScheduleEnrollments(session, selectedScheduleId);
        setEnrollments(refreshed);
      }
    } catch (err: any) {
      setActionError(err?.message || t("schedules_error"));
    } finally {
      setProcessing(false);
    }
  };

  const itemTitleDisplay = (item: InductionScheduleItem) => {
    if (item.title) return item.title;
    if (item.course?.title) return item.course.title;
    const match = courses.find((c) => c.id === item.courseId);
    return match?.title ?? item.courseId ?? t("schedules_item_no_course");
  };

  const driverLabel = (enrollment: InductionScheduleEnrollment) => {
    if (enrollment.driver) {
      return enrollment.driver.fullName || enrollment.driver.email;
    }
    const match = driverOptions.find((d) => d.id === enrollment.driverId);
    return match?.fullName ?? match?.email ?? enrollment.driverId;
  };

  const driverEmail = (enrollment: InductionScheduleEnrollment) =>
    enrollment.driver?.email ?? driverOptions.find((d) => d.id === enrollment.driverId)?.email ?? "";

  const currentItemTitle = (enrollment: InductionScheduleEnrollment) => {
    const item = items.find((i) => i.sequenceOrder === enrollment.currentItemIndex + 1);
    return item ? itemTitleDisplay(item) : t("status_completed");
  };

  // Drivers not yet enrolled in this schedule
  const enrolledDriverIds = new Set(enrollments.map((e) => e.driverId));
  const availableDrivers = driverOptions.filter((d) => !enrolledDriverIds.has(d.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div
        className="glass"
        style={{
          padding: "24px",
          borderRadius: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}
          >
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>{t("schedules_title")}</h2>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
              {t("schedules_sub")}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleProcessInvitations}
            disabled={processing}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid #f59e0b",
              background: "rgba(245, 158, 11, 0.1)",
              color: "#d97706",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: processing ? "not-allowed" : "pointer",
              opacity: processing ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {processing ? t("schedules_processing") : t("schedules_process_invitations")}
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              background: "#1e3a5f",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.88rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Plus className="w-4 h-4" /> {t("schedules_new")}
          </button>
        </div>
      </div>

      {/* Feedback banners */}
      {actionError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontWeight: 600,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <AlertTriangle className="w-4 h-4" /> {actionError}
        </div>
      )}
      {actionSuccess && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            color: "#16a34a",
            fontWeight: 600,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <CheckCircle2 className="w-4 h-4" /> {actionSuccess}
        </div>
      )}

      {/* Create / Edit schedule form */}
      {showForm && (
        <form className="glass" onSubmit={handleSaveSchedule} style={{ padding: "24px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: "1rem" }}>
              {editingSchedule ? t("schedules_edit") : t("schedules_new")}
            </strong>
            <button type="button" onClick={resetForm} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div style={{ color: "#ef4444", fontSize: "0.82rem", fontWeight: 600 }}>{formError}</div>
          )}

          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              {t("schedules_name")} *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t("schedules_name_ph")}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text)",
                fontSize: "0.9rem"
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
              {t("schedules_description")}
            </label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={t("schedules_description_ph")}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--text)",
                fontSize: "0.9rem",
                resize: "vertical"
              }}
            />
          </div>

          {editingSchedule && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", fontWeight: 600 }}>
              <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} />
              {t("schedules_active")}
            </label>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "none",
                background: saving ? "#94a3b8" : "#1e3a5f",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: saving ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editingSchedule
                ? saving ? t("schedules_updating") : t("schedules_update")
                : saving ? t("schedules_creating") : t("schedules_create")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                padding: "10px 20px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer"
              }}
            >
              {t("v_cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Main layout: schedule list (left) + details (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Schedule selector list */}
        <div className="glass" style={{ padding: "20px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <strong style={{ fontSize: "1rem" }}>{t("schedules_title")}</strong>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "0.85rem" }}>
              <RefreshCw className="w-4 h-4 animate-spin" /> {t("cms_loading")}
            </div>
          ) : loadError ? (
            <div style={{ color: "#ef4444", fontSize: "0.85rem", fontWeight: 600 }}>{loadError}</div>
          ) : schedules.length === 0 ? (
            <div className="muted" style={{ fontSize: "0.85rem", textAlign: "center", padding: "20px 0" }}>
              {t("schedules_no_schedules")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "520px", overflowY: "auto" }}>
              {schedules.map((schedule) => {
                const isSelected = schedule.id === selectedScheduleId;
                return (
                  <div
                    key={schedule.id}
                    onClick={() => setSelectedScheduleId(schedule.id)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid #f59e0b" : "1px solid var(--border)",
                      background: isSelected ? "rgba(245, 158, 11, 0.08)" : "var(--bg-elevated)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "0.9rem", color: isSelected ? "#d97706" : "var(--text)" }}>
                        {schedule.name}
                      </strong>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: schedule.isActive ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.15)",
                          color: schedule.isActive ? "#16a34a" : "var(--muted)",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {schedule.isActive ? t("schedules_active") : t("auda_inactive")}
                      </span>
                    </div>
                    {schedule.description && (
                      <span className="muted" style={{ fontSize: "0.78rem" }}>
                        {schedule.description}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openEditForm(schedule)}
                        title={t("schedules_edit")}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", padding: "2px", display: "inline-flex" }}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        title={t("schedules_delete")}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", padding: "2px", display: "inline-flex" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Schedule details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {!selectedSchedule ? (
            <div className="glass" style={{ padding: "40px", borderRadius: "20px", textAlign: "center" }}>
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                {t("schedules_no_schedules")}
              </p>
            </div>
          ) : (
            <div>
              {/* Section 1: Schedule items (induction sequence) */}
              <div className="glass" style={{ padding: "24px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <ListOrdered className="w-4 h-4 text-amber-500" /> {t("schedules_items_title")}
                    </strong>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </div>
                  </div>
                </div>

                {/* Existing items */}
                {loadingItems ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "0.85rem" }}>
                    <RefreshCw className="w-4 h-4 animate-spin" /> {t("cms_loading")}
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "var(--color-muted)" }}>
                    <strong style={{ display: "block", fontSize: "0.95rem", marginBottom: "4px" }}>{t("schedules_empty_title")}</strong>
                    <span className="muted" style={{ fontSize: "0.82rem" }}>{t("schedules_empty_sub")}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          background: "var(--bg-elevated, rgba(255,255,255,0.03))",
                          border: "1px solid var(--border, rgba(255,255,255,0.08))",
                          flexWrap: "wrap"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                          <span
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "50%",
                              background: "#f59e0b",
                              color: "#fff",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ fontSize: "0.88rem", display: "block" }}>{itemTitleDisplay(item)}</strong>
                            <span className="muted" style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <Clock className="w-3 h-3" />
                              {item.delayType === "fixed_date" && item.fixedDate
                                ? `${t("schedules_item_delay_fixed_date")}: ${new Date(item.fixedDate).toLocaleDateString("en-AU")}`
                                : `${t(DELAY_TYPE_LABELS[item.delayType])} · ${item.delayDays} ${item.delayDays === 1 ? "day" : "days"}`}
                              {item.isRequired && <span style={{ marginLeft: "8px", fontWeight: 700 }}>· {t("schedules_item_required")}</span>}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          title={t("schedules_item_delete")}
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", padding: "4px", display: "inline-flex" }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item form */}
                <form
                  onSubmit={handleAddItem}
                  style={{
                    background: "rgba(148,163,184,0.06)",
                    padding: "16px",
                    borderRadius: "14px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    alignItems: "end"
                  }}
                >
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      {t("schedules_item_title")} *
                    </label>
                    <input
                      type="text"
                      value={itemTitle}
                      onChange={(e) => setItemTitle(e.target.value)}
                      placeholder={t("schedules_item_title_ph")}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: "var(--text)",
                        fontSize: "0.85rem"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      {t("schedules_item_course")}
                    </label>
                    <select
                      value={itemCourseId}
                      onChange={(e) => setItemCourseId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: "var(--text)",
                        fontSize: "0.85rem"
                      }}
                    >
                      <option value="">{t("schedules_select_course")}</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      {t("schedules_item_delay_type")}
                    </label>
                    <select
                      value={itemDelayType}
                      onChange={(e) => setItemDelayType(e.target.value as DelayType)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: "var(--text)",
                        fontSize: "0.85rem"
                      }}
                    >
                      <option value="after_completion">{t("schedules_item_delay_after_completion")}</option>
                      <option value="after_enrollment">{t("schedules_item_delay_after_enrollment")}</option>
                      <option value="fixed_date">{t("schedules_item_delay_fixed_date")}</option>
                    </select>
                  </div>

                  {itemDelayType === "fixed_date" ? (
                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                        {t("schedules_item_fixed_date")}
                      </label>
                      <input
                        type="date"
                        value={itemFixedDate}
                        onChange={(e) => setItemFixedDate(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                          color: "var(--text)",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                        {t("schedules_item_delay_days")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={itemDelayDays}
                        onChange={(e) => setItemDelayDays(e.target.value)}
                        placeholder={t("schedules_item_delay_days_ph")}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "10px",
                          border: "1px solid var(--border)",
                          background: "var(--bg-elevated)",
                          color: "var(--text)",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      {t("schedules_item_expiry_interval")}
                    </label>
                    <input
                      type="text"
                      value={itemExpiryInterval}
                      onChange={(e) => setItemExpiryInterval(e.target.value)}
                      placeholder={t("schedules_item_expiry_interval_ph")}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: "var(--text)",
                        fontSize: "0.85rem"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={itemIsRequired} onChange={(e) => setItemIsRequired(e.target.checked)} />
                      {t("schedules_item_required")}
                    </label>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={addingItem}
                      style={{
                        width: "100%",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: addingItem ? "#94a3b8" : "#f59e0b",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        cursor: addingItem ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px"
                      }}
                    >
                      {addingItem ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {addingItem ? t("schedules_item_adding") : t("schedules_item_add")}
                    </button>
                  </div>
                </form>
              </div>

              {/* Section 2: Enrolled drivers */}
              <div className="glass" style={{ padding: "24px", borderRadius: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <strong style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <UserPlus className="w-4 h-4 text-emerald-500" /> {t("schedules_enrollments_title")}
                    </strong>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      {enrollments.length} {enrollments.length === 1 ? "driver" : "drivers"}
                    </div>
                  </div>

                  <form onSubmit={handleEnrollDriver} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      style={{
                        padding: "9px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-elevated)",
                        color: "var(--text)",
                        fontSize: "0.85rem",
                        minWidth: "200px"
                      }}
                    >
                      <option value="">{t("schedules_select_driver")}</option>
                      {availableDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.fullName} {driver.email ? `(${driver.email})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={enrolling || !selectedDriverId}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "10px",
                        border: "none",
                        background: enrolling || !selectedDriverId ? "#94a3b8" : "#16a34a",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        cursor: enrolling || !selectedDriverId ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      {enrolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {enrolling ? t("schedules_enrolling") : t("schedules_enroll_driver")}
                    </button>
                  </form>
                </div>

                {enrollError && <div style={{ color: "#ef4444", fontSize: "0.82rem", fontWeight: 600 }}>{enrollError}</div>}

                {loadingEnrollments ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)", fontSize: "0.85rem" }}>
                    <RefreshCw className="w-4 h-4 animate-spin" /> {t("cms_loading")}
                  </div>
                ) : enrollments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "var(--color-muted)" }}>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      {t("schedules_empty_sub")}
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {enrollments.map((enrollment) => (
                      <div
                        key={enrollment.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "12px",
                          background: "var(--bg-elevated, rgba(255,255,255,0.03))",
                          border: "1px solid var(--border, rgba(255,255,255,0.08))",
                          flexWrap: "wrap"
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: "0.88rem", display: "block" }}>{driverLabel(enrollment)}</strong>
                          <div className="muted" style={{ fontSize: "0.75rem", display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                            {driverEmail(enrollment) && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <Mail className="w-3 h-3" /> {driverEmail(enrollment)}
                              </span>
                            )}
                            <span>· {t("schedules_current_item")}: <strong style={{ fontWeight: 700 }}>{currentItemTitle(enrollment)}</strong></span>
                            <span>· {t("schedules_enrolled_at")}: {new Date(enrollment.enrolledAt).toLocaleDateString("en-AU")}</span>
                            {enrollment.completedAt && (
                              <span>· {t("schedules_completed_at")}: {new Date(enrollment.completedAt).toLocaleDateString("en-AU")}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            className={STATUS_COLORS[enrollment.status]}
                            style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700 }}
                          >
                            {t(`schedules_enrollment_status_${enrollment.status}`)}
                          </span>
                          {enrollment.status === "active" && (
                            <button
                              type="button"
                              onClick={() => openCancelInviteModal(enrollment)}
                              title={t("schedules_cancel_invitation")}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#f59e0b", padding: "4px", display: "inline-flex" }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUnenroll(enrollment.id)}
                            title={t("schedules_unenroll")}
                            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", padding: "4px", display: "inline-flex" }}
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
