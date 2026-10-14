import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Plus, X, AlertTriangle, CheckCircle2, Clock, Users } from "lucide-react";
import { AdminAuditAssignmentRow, AdminDriverRow, AuditAssignment, ComplianceAuditRecord } from "../../types";
import { api } from "../../lib/api";
import { tStatus } from "../../i18n";

const AUDIT_CATEGORIES = ["Transport", "Work Health & Safety", "Operational Risk", "Fleet Compliance"];

interface ComplianceAuditsAdminProps {
  drivers: AdminDriverRow[];
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function DueBadge({ date }: { date: string | null }) {
  const { t } = useTranslation();
  const days = daysUntil(date);
  if (days === null) return <span className="text-slate-400">{t("auda_no_due")}</span>;
  const label = days < 0
    ? t(Math.abs(days) === 1 ? "auda_overdue_by_one" : "auda_overdue_by_other", { count: Math.abs(days) })
    : days === 0
    ? t("auda_due_today")
    : t(days === 1 ? "auda_days_left_one" : "auda_days_left_other", { count: days });
  const cls =
    days < 0
      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
      : days <= 14
      ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{label}</span>
  );
}

export function ComplianceAuditsAdmin({ drivers }: ComplianceAuditsAdminProps) {
  const { t } = useTranslation();
  const [audits, setAudits] = useState<ComplianceAuditRecord[]>([]);
  const [assignments, setAssignments] = useState<AdminAuditAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState(AUDIT_CATEGORIES[0]);
  const [formDescription, setFormDescription] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formQuestions, setFormQuestions] = useState<string[]>([""]);
  const [assignAll, setAssignAll] = useState(true);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);

  const categoryLabels: Record<string, string> = {
    Transport: t("auda_cat_transport"),
    "Work Health & Safety": t("auda_cat_whs"),
    "Operational Risk": t("auda_cat_operational"),
    "Fleet Compliance": t("auda_cat_fleet")
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getAdminAuditData();
      setAudits(data.audits);
      setAssignments(data.assignments);
    } catch (err: any) {
      setLoadError(err?.message || t("auda_load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleDriver = (driverId: string) => {
    setSelectedDrivers((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const questions = formQuestions.map((q) => q.trim()).filter(Boolean);
    if (!formName.trim()) {
      setFormError(t("auda_err_name"));
      return;
    }
    if (questions.length === 0) {
      setFormError(t("auda_err_questions"));
      return;
    }
    if (!assignAll && selectedDrivers.length === 0) {
      setFormError(t("auda_err_drivers"));
      return;
    }

    setSaving(true);
    try {
      const auditId = await api.createAudit({
        name: formName.trim(),
        category: formCategory,
        description: formDescription.trim(),
        questions,
        dueDate: formDueDate || null
      });

      const userIds = assignAll
        ? drivers.map((driver) => driver.id)
        : selectedDrivers;
      await api.assignAudit(auditId, userIds);

      setFormSuccess(t(userIds.length === 1 ? "auda_published_one" : "auda_published_other", { count: userIds.length }));
      setFormName("");
      setFormDescription("");
      setFormDueDate("");
      setFormQuestions([""]);
      setAssignAll(true);
      setSelectedDrivers([]);
      setShowCreateForm(false);
      await load();
    } catch (err: any) {
      setFormError(err?.message || t("auda_err_publish"));
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: audits.length,
    passed: assignments.filter((a) => a.status === "Passed").length,
    actionRequired: assignments.filter((a) => a.status === "Action Required").length,
    overdue: assignments.filter((a) => {
      const days = daysUntil(a.dueDate);
      return days !== null && days < 0 && a.status !== "Passed";
    }).length
  };

  return (
    <div className="glass" style={{ padding: "28px", borderRadius: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px" }}>
            {t("auda_title")}
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            {t("auda_subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            border: "none",
            background: "#16a34a",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Plus className="w-4 h-4" /> {t("auda_new")}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: t("auda_stat_active"), value: stats.total, color: "#2563eb" },
          { label: t("auda_stat_passed"), value: stats.passed, color: "#16a34a" },
          { label: t("auda_stat_action"), value: stats.actionRequired, color: "#d97706" },
          { label: t("auda_stat_overdue"), value: stats.overdue, color: "#dc2626" }
        ].map((item) => (
          <div key={item.label} className="glass card-hover" style={{ padding: "16px", borderRadius: "12px" }}>
            <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block" }}>{item.label}</span>
            <strong style={{ fontSize: "1.5rem", color: item.color }}>{item.value}</strong>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          style={{ background: "var(--bg-elevated, rgba(255,255,255,0.03))", border: "1px solid var(--border, rgba(255,255,255,0.08))", borderRadius: "16px", padding: "24px", marginBottom: "24px" }}
        >
          <h4 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700 }}>{t("auda_form_title")}</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ display: "block" }}>
              <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>{t("auda_name_label")}</span>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("auda_name_ph")}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "inherit", fontSize: "0.85rem" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>{t("auda_category_label")}</span>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--bg-elevated, #fff)", color: "inherit", fontSize: "0.85rem" }}
              >
                {AUDIT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{categoryLabels[cat] ?? cat}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginBottom: "16px" }}>
            <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>{t("auda_desc_label")}</span>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              placeholder={t("auda_desc_ph")}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "inherit", fontSize: "0.85rem", resize: "vertical" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ display: "block" }}>
              <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>{t("auda_due_label")}</span>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                style={{ width: "100%", maxWidth: "240px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "inherit", fontSize: "0.85rem" }}
              />
            </label>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              {t("auda_questions_label")} <span style={{ fontWeight: 400 }}>{t("auda_questions_hint")}</span>
            </span>
            {formQuestions.map((question, index) => (
              <div key={index} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => {
                    const next = [...formQuestions];
                    next[index] = e.target.value;
                    setFormQuestions(next);
                  }}
                  placeholder={t("auda_question_ph", { index: index + 1 })}
                  style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "inherit", fontSize: "0.85rem" }}
                />
                <button
                  type="button"
                  onClick={() => setFormQuestions((prev) => prev.filter((_, i) => i !== index))}
                  disabled={formQuestions.length === 1}
                  style={{ padding: "8px 10px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", color: "#dc2626", cursor: formQuestions.length === 1 ? "not-allowed" : "pointer" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFormQuestions((prev) => [...prev, ""])}
              style={{ padding: "8px 14px", borderRadius: "10px", border: "1px dashed var(--border)", background: "transparent", color: "inherit", fontSize: "0.8rem", cursor: "pointer" }}
            >
              {t("auda_add_question")}
            </button>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <span className="muted" style={{ fontSize: "0.75rem", fontWeight: 600, display: "block", marginBottom: "6px" }}>
              <Users className="w-3.5 h-3.5" style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
              {t("auda_assign_label")}
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={assignAll}
                onChange={(e) => setAssignAll(e.target.checked)}
              />
              {t("auda_assign_all", { count: drivers.length })}
            </label>
            {!assignAll && (
              <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
                {drivers.map((driver) => (
                  <label key={driver.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "0.82rem", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedDrivers.includes(driver.id)}
                      onChange={() => toggleDriver(driver.id)}
                    />
                    {driver.fullName} ({driver.email})
                  </label>
                ))}
              </div>
            )}
          </div>

          {formError && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", fontSize: "0.8rem", marginBottom: "16px" }}>
              {formError}
            </div>
          )}
          {formSuccess && (
            <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.3)", color: "#4ade80", fontSize: "0.8rem", marginBottom: "16px" }}>
              {formSuccess}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              style={{ padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}
            >
              {t("auda_cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: "#1e3a5f", color: "#ffffff", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? t("auda_publishing") : t("auda_publish")}
            </button>
          </div>
        </form>
      )}

      {/* Audit list */}
      {loading ? (
        <p className="muted" style={{ textAlign: "center", padding: "40px" }}>{t("auda_loading")}</p>
      ) : loadError ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#f87171", fontSize: "0.85rem" }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
          {loadError}
        </div>
      ) : audits.length === 0 ? (
        <p className="muted" style={{ textAlign: "center", padding: "40px" }}>
          {t("auda_empty")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
          {audits.map((audit) => {
            const auditAssignments = assignments.filter((a) => a.auditId === audit.id);
            const passed = auditAssignments.filter((a) => a.status === "Passed").length;
            return (
              <div
                key={audit.id}
                style={{ padding: "16px", borderRadius: "14px", border: "1px solid var(--border, rgba(255,255,255,0.08))", background: "var(--bg-elevated, rgba(255,255,255,0.03))" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "0.95rem" }}>{audit.name}</strong>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(37,99,235,0.12)", color: "#60a5fa" }}>
                        {audit.category}
                      </span>
                      {audit.isActive ? null : (
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}>
                          {t("auda_inactive")}
                        </span>
                      )}
                    </div>
                    {audit.description && (
                      <p className="muted" style={{ margin: "0 0 6px", fontSize: "0.78rem" }}>{audit.description}</p>
                    )}
                    <p className="muted" style={{ margin: 0, fontSize: "0.75rem" }}>
                      {t(audit.questions.length === 1 ? "auda_question_one" : "auda_question_other", { count: audit.questions.length })}{t("auda_assigned", { n: auditAssignments.length })}{t("auda_passed", { n: passed })}
                    </p>
                  </div>
                  <DueBadge date={audit.dueDate} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Results table */}
      {!loading && !loadError && assignments.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 700 }}>{t("auda_results_title")}</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                   <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("auda_th_driver")}</th>
                   <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("auda_th_audit")}</th>
                   <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("auda_th_due")}</th>
                   <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("auda_th_status")}</th>
                   <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("auda_th_attempts")}</th>
                   <th style={{ textAlign: "left", padding: "10px 12px" }}>{t("auda_th_last")}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600 }}>{assignment.driverName}</div>
                      <div className="muted" style={{ fontSize: "0.72rem" }}>{assignment.driverEmail}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{assignment.audit.name}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <DueBadge date={assignment.dueDate} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          background:
                            assignment.status === "Passed"
                              ? "rgba(22,163,74,0.12)"
                              : assignment.status === "Action Required"
                              ? "rgba(220,38,38,0.12)"
                              : assignment.status === "In Progress"
                              ? "rgba(217,119,6,0.12)"
                              : "rgba(148,163,184,0.12)",
                          color:
                            assignment.status === "Passed"
                              ? "#4ade80"
                              : assignment.status === "Action Required"
                              ? "#f87171"
                              : assignment.status === "In Progress"
                              ? "#fbbf24"
                              : "#94a3b8"
                        }}
                      >
                        {tStatus(assignment.status, t)}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{assignment.attemptsCount}</td>
                    <td style={{ padding: "10px 12px" }} className="muted">
                      {assignment.lastAttemptDate
                        ? new Date(assignment.lastAttemptDate).toLocaleString("en-AU")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
