import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GraduationCap, Plus, X, Trash2, BookOpen } from "lucide-react";
import { SOPItem } from "../../types";
import { api } from "../../lib/api";

const SOP_CATEGORIES = ["SOP", "Policy & Procedure", "Licensing", "Product Inductions"];

interface SOPCompletionRow {
  sopId: string;
  userId: string;
  userName: string;
  completedAt: string;
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function DueBadge({ date }: { date: string | null | undefined }) {
  const { t } = useTranslation();
  const days = daysUntil(date);
  if (days === null) return <span className="text-slate-400">{t("sop_no_due")}</span>;
  const label = days < 0
    ? t(Math.abs(days) === 1 ? "sop_overdue_by_one" : "sop_overdue_by_other", { count: Math.abs(days) })
    : days === 0
    ? t("sop_due_today")
    : t(days === 1 ? "sop_days_left_one" : "sop_days_left_other", { count: days });
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

export function SOPAdmin() {
  const { t } = useTranslation();
  const [sops, setSops] = useState<SOPItem[]>([]);
  const [completions, setCompletions] = useState<SOPCompletionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState(SOP_CATEGORIES[0]);
  const [formMandatory, setFormMandatory] = useState(false);
  const [formSummary, setFormSummary] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formQuizCount, setFormQuizCount] = useState("0");

  const categoryLabels: Record<string, string> = {
    SOP: t("sop_cat_sop"),
    "Policy & Procedure": t("sop_cat_policy"),
    Licensing: t("sop_cat_licensing"),
    "Product Inductions": t("sop_cat_product")
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getAdminSOPData();
      setSops(data.sops);
      setCompletions(data.completions);
    } catch (err: any) {
      setLoadError(err?.message || t("sop_load_error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formCode.trim() || !formName.trim()) {
      setFormError(t("sop_err_code_name"));
      return;
    }
    if (!formSummary.trim()) {
      setFormError(t("sop_err_content"));
      return;
    }

    setSaving(true);
    try {
      await api.createSOP({
        code: formCode.trim(),
        name: formName.trim(),
        category: formCategory,
        isMandatory: formMandatory,
        contentSummary: formSummary.trim(),
        dueDate: formDueDate || null,
        videoUrl: formVideoUrl.trim() || null,
        quizQuestionsCount: Math.max(0, parseInt(formQuizCount || "0", 10) || 0)
      });
      setFormSuccess(t("sop_published", { name: formName.trim() }));
      setFormCode("");
      setFormName("");
      setFormSummary("");
      setFormDueDate("");
      setFormVideoUrl("");
      setFormQuizCount("0");
      setFormMandatory(false);
      await load();
    } catch (err: any) {
      setFormError(err?.message || t("sop_err_publish"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sopId: string) => {
    if (!window.confirm(t("sop_delete_confirm"))) {
      return;
    }
    setDeletingId(sopId);
    try {
      await api.deleteSOP(sopId);
      await load();
    } catch (err: any) {
      setLoadError(err?.message || t("sop_err_delete"));
    } finally {
      setDeletingId(null);
    }
  };

  const completionCountFor = (sopId: string) =>
    completions.filter((c) => c.sopId === sopId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-400" />
            {t("sop_title")}
          </h3>
          <p className="text-xs text-slate-400">
            {t("sop_subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg flex items-center gap-2"
        >
          {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreateForm ? t("sop_close_form") : t("sop_new_module")}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          style={{
            background: "var(--bg-elevated, rgba(255,255,255,0.03))",
            border: "1px solid var(--border, rgba(255,255,255,0.08))",
            borderRadius: "16px",
            padding: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}
        >
          <h4 style={{ gridColumn: "1 / -1", margin: "0", fontSize: "1rem", fontWeight: 700 }}>
            {t("sop_publish_title")}
          </h4>

          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_code")}
            <input
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder={t("sop_code_ph")}
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem" }}
            />
          </label>

          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_name")}
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t("sop_name_ph")}
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem" }}
            />
          </label>

          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_category")}
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem" }}
            >
              {SOP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabels[c] ?? c}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_due")}
            <input
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem" }}
            />
          </label>

          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_quiz_count")}
            <input
              type="number"
              min="0"
              value={formQuizCount}
              onChange={(e) => setFormQuizCount(e.target.value)}
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem" }}
            />
          </label>

          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_video_url")}
            <input
              value={formVideoUrl}
              onChange={(e) => setFormVideoUrl(e.target.value)}
              placeholder="https://…"
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem" }}
            />
          </label>

          <label
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "0.8rem",
              cursor: "pointer"
            }}
          >
            <input
              type="checkbox"
              checked={formMandatory}
              onChange={(e) => setFormMandatory(e.target.checked)}
            />
            {t("sop_mandatory")}
          </label>

          <label style={{ gridColumn: "1 / -1", display: "block", fontSize: "0.75rem", fontWeight: 600 }}>
            {t("sop_content")}
            <textarea
              value={formSummary}
              onChange={(e) => setFormSummary(e.target.value)}
              rows={5}
              placeholder={t("sop_content_ph")}
              style={{ width: "100%", marginTop: "6px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border, rgba(255,255,255,0.1))", background: "rgba(0,0,0,0.2)", color: "inherit", fontSize: "0.85rem", resize: "vertical" }}
            />
          </label>

          {formError && (
            <div style={{ gridColumn: "1 / -1" }} className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div style={{ gridColumn: "1 / -1" }} className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              {formSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              gridColumn: "1 / -1",
              justifySelf: "start",
              padding: "10px 20px",
              borderRadius: "10px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? t("sop_publishing") : t("sop_publish")}
          </button>
        </form>
      )}

      {loading ? (
        <div className="glass" style={{ padding: "28px", borderRadius: "20px", textAlign: "center", color: "var(--color-muted)", fontSize: "0.85rem" }}>
          {t("sop_loading")}
        </div>
      ) : loadError ? (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
          {loadError}
        </div>
      ) : sops.length === 0 ? (
        <div className="glass" style={{ padding: "40px", borderRadius: "20px", textAlign: "center" }}>
          <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-muted)" }} />
          <p className="text-sm font-bold">{t("sop_empty_title")}</p>
          <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
            {t("sop_empty_sub")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase" style={{ color: "var(--color-muted)" }}>
              <tr className="border-b" style={{ borderColor: "var(--border, rgba(255,255,255,0.08))" }}>
                <th className="py-3 px-4 font-semibold">{t("sop_th_code")}</th>
                <th className="py-3 px-4 font-semibold">{t("sop_th_module")}</th>
                <th className="py-3 px-4 font-semibold">{t("sop_th_category")}</th>
                <th className="py-3 px-4 font-semibold">{t("sop_th_due")}</th>
                <th className="py-3 px-4 font-semibold">{t("sop_th_completed")}</th>
                <th className="py-3 px-4 font-semibold text-right">{t("sop_th_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sops.map((sop) => (
                <tr
                  key={sop.id}
                  className="border-b"
                  style={{ borderColor: "var(--border, rgba(255,255,255,0.06))" }}
                >
                  <td className="py-3 px-4 font-mono text-xs">{sop.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold">{sop.name}</div>
                    <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                      {sop.isMandatory ? t("sop_mandatory_word") : t("sop_optional_word")}
                      {sop.quizQuestionsCount ? t("sop_quiz_suffix", { n: sop.quizQuestionsCount }) : ""}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400">
                      {categoryLabels[sop.category] ?? sop.category}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <DueBadge date={sop.dueDate} />
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {t(completionCountFor(sop.id) === 1 ? "sop_drivers_one" : "sop_drivers_other", { count: completionCountFor(sop.id) })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDelete(sop.id)}
                      disabled={deletingId === sop.id}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 disabled:opacity-50"
                      title={t("sop_delete_title")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {completions.length > 0 && (
        <div className="glass card-hover" style={{ padding: "20px", borderRadius: "16px" }}>
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--color-muted)" }}>
            {t("sop_recent_completions")}
          </h4>
          <div className="space-y-2">
            {completions.slice(0, 8).map((c) => (
              <div key={`${c.sopId}-${c.userId}`} className="flex items-center justify-between text-xs">
                <span className="font-medium">{c.userName}</span>
                <span style={{ color: "var(--color-muted)" }}>
                  {new Date(c.completedAt).toLocaleString("en-AU")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
