/**
 * InductionVersionsPanel
 *
 * Milestone 1 — Versioned Inductions
 *
 * Admin-facing panel that allows administrators to:
 *   1. View all published induction versions (newest first)
 *   2. Publish a new version with a label and revision notes
 *
 * Publishing a new version:
 *   - Marks the new version as is_current = true
 *   - De-activates the previous current version
 *   - Drivers who log in next will receive the InductionVersionBanner
 *     indicating their certificate is outdated
 *
 * This panel is intended to be embedded in the existing AdminCMS component
 * as a new tab alongside "Learning Modules" and "Quiz Questions".
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAdminInductionVersions, publishInductionVersion } from "../lib/api";
import { InductionVersionRecord, SessionState } from "../types";

interface InductionVersionsPanelProps {
  session: SessionState;
}

export function InductionVersionsPanel({ session }: InductionVersionsPanelProps) {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<InductionVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [versionLabel, setVersionLabel] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [formErrors, setFormErrors] = useState<{ versionLabel?: string; revisionNotes?: string }>({});

  useEffect(() => {
    void loadVersions();
  }, []);

  async function loadVersions() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminInductionVersions(session);
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ivp_err_load"));
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const errors: { versionLabel?: string; revisionNotes?: string } = {};
    if (!versionLabel.trim()) errors.versionLabel = t("ivp_label_err");
    if (versionLabel.trim().length > 32) errors.versionLabel = t("ivp_label_len_err");
    if (!revisionNotes.trim()) errors.revisionNotes = t("ivp_notes_err");
    if (revisionNotes.trim().length < 10) errors.revisionNotes = t("ivp_notes_len_err");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handlePublish(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setPublishing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const newVersion = await publishInductionVersion(session, {
        versionLabel: versionLabel.trim(),
        revisionNotes: revisionNotes.trim()
      });
      setVersions((prev) => [newVersion, ...prev.map((v) => ({ ...v, isCurrent: false }))]);
      setVersionLabel("");
      setRevisionNotes("");
      setFormErrors({});
      setSuccessMessage(
        t("ivp_success", { version: newVersion.versionLabel })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ivp_err_publish"));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="induction-versions-panel" aria-label={t("ivp_aria")}>
      <h3 className="induction-versions-panel__title">{t("ivp_title")}</h3>
      <p className="induction-versions-panel__description">
        {t("ivp_desc")}
      </p>

      {/* Publish New Version Form */}
      <form
        onSubmit={(e) => void handlePublish(e)}
        className="induction-versions-panel__form"
        aria-label={t("ivp_form_aria")}
        noValidate
      >
        <h4 className="induction-versions-panel__form-title">{t("ivp_form_title")}</h4>

        <div className="form-group">
          <label htmlFor="version-label" className="form-label">
            {t("ivp_label")}<span aria-hidden="true">*</span>
          </label>
          <input
            id="version-label"
            type="text"
            className={`form-input${formErrors.versionLabel ? " form-input--error" : ""}`}
            placeholder={t("ivp_label_ph")}
            value={versionLabel}
            maxLength={32}
            onChange={(e) => setVersionLabel(e.target.value)}
            aria-describedby={formErrors.versionLabel ? "version-label-error" : undefined}
            aria-required="true"
            disabled={publishing}
          />
          {formErrors.versionLabel && (
            <span id="version-label-error" className="form-error" role="alert">
              {formErrors.versionLabel}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="revision-notes" className="form-label">
            {t("ivp_notes")}<span aria-hidden="true">*</span>
          </label>
          <textarea
            id="revision-notes"
            className={`form-input form-textarea${formErrors.revisionNotes ? " form-input--error" : ""}`}
            placeholder={t("ivp_notes_ph")}
            value={revisionNotes}
            maxLength={2000}
            rows={4}
            onChange={(e) => setRevisionNotes(e.target.value)}
            aria-describedby={formErrors.revisionNotes ? "revision-notes-error" : undefined}
            aria-required="true"
            disabled={publishing}
          />
          {formErrors.revisionNotes && (
            <span id="revision-notes-error" className="form-error" role="alert">
              {formErrors.revisionNotes}
            </span>
          )}
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="alert alert--success" role="status" aria-live="polite">
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={publishing}
          aria-busy={publishing}
        >
          {publishing ? t("ivp_publishing") : t("ivp_publish")}
        </button>
      </form>

      {/* Version History Table */}
      <div className="induction-versions-panel__history" aria-label={t("ivp_history_aria")}>
        <h4 className="induction-versions-panel__history-title">{t("ivp_history_title")}</h4>

        {loading ? (
          <p className="induction-versions-panel__loading" aria-live="polite" aria-busy="true">
            {t("ivp_loading")}
          </p>
        ) : versions.length === 0 ? (
          <p className="induction-versions-panel__empty">{t("ivp_empty")}</p>
        ) : (
          <table className="versions-table" aria-label={t("ivp_table_aria")}>
            <thead>
              <tr>
                <th scope="col">{t("ivp_th_version")}</th>
                <th scope="col">{t("ivp_th_status")}</th>
                <th scope="col">{t("ivp_th_published")}</th>
                <th scope="col">{t("ivp_th_notes")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className={v.isCurrent ? "versions-table__row--current" : ""}>
                  <td className="versions-table__version">
                    <strong>{v.versionLabel}</strong>
                  </td>
                  <td>
                    {v.isCurrent ? (
                      <span className="badge badge--active" aria-label={t("ivp_current_aria")}>
                        {t("ivp_current")}
                      </span>
                    ) : (
                      <span className="badge badge--archived" aria-label={t("ivp_archived_aria")}>
                        {t("ivp_archived")}
                      </span>
                    )}
                  </td>
                  <td className="versions-table__date">
                    {new Date(v.publishedAt).toLocaleString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td className="versions-table__notes">{v.revisionNotes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
