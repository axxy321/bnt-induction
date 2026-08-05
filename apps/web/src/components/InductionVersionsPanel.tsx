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
import { getAdminInductionVersions, publishInductionVersion } from "../lib/api";
import { InductionVersionRecord, SessionState } from "../types";

interface InductionVersionsPanelProps {
  session: SessionState;
}

export function InductionVersionsPanel({ session }: InductionVersionsPanelProps) {
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
      setError(err instanceof Error ? err.message : "Failed to load versions.");
    } finally {
      setLoading(false);
    }
  }

  function validate(): boolean {
    const errors: { versionLabel?: string; revisionNotes?: string } = {};
    if (!versionLabel.trim()) errors.versionLabel = "Version label is required.";
    if (versionLabel.trim().length > 32) errors.versionLabel = "Version label must be 32 characters or fewer.";
    if (!revisionNotes.trim()) errors.revisionNotes = "Revision notes are required.";
    if (revisionNotes.trim().length < 10) errors.revisionNotes = "Revision notes must be at least 10 characters.";
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
        `Version ${newVersion.versionLabel} published successfully. Drivers will be notified on their next login.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish version.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="induction-versions-panel" aria-label="Induction Versions Management">
      <h3 className="induction-versions-panel__title">Induction Versions</h3>
      <p className="induction-versions-panel__description">
        Publishing a new version will notify all drivers (on next login) that they must re-complete the
        induction. Their existing certificates are archived and remain verifiable — only a re-induction
        will issue a new certificate.
      </p>

      {/* Publish New Version Form */}
      <form
        onSubmit={(e) => void handlePublish(e)}
        className="induction-versions-panel__form"
        aria-label="Publish new induction version"
        noValidate
      >
        <h4 className="induction-versions-panel__form-title">Publish New Version</h4>

        <div className="form-group">
          <label htmlFor="version-label" className="form-label">
            Version Label <span aria-hidden="true">*</span>
          </label>
          <input
            id="version-label"
            type="text"
            className={`form-input${formErrors.versionLabel ? " form-input--error" : ""}`}
            placeholder="e.g. 2.0, 2024-Q3, July 2024"
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
            Revision Notes <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="revision-notes"
            className={`form-input form-textarea${formErrors.revisionNotes ? " form-input--error" : ""}`}
            placeholder="Describe what changed in this version — e.g. updated WHS policy, new fatigue management rules..."
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
          {publishing ? "Publishing…" : "Publish New Version"}
        </button>
      </form>

      {/* Version History Table */}
      <div className="induction-versions-panel__history" aria-label="Version history">
        <h4 className="induction-versions-panel__history-title">Version History</h4>

        {loading ? (
          <p className="induction-versions-panel__loading" aria-live="polite" aria-busy="true">
            Loading versions…
          </p>
        ) : versions.length === 0 ? (
          <p className="induction-versions-panel__empty">No versions published yet.</p>
        ) : (
          <table className="versions-table" aria-label="Induction version history">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Published</th>
                <th scope="col">Revision Notes</th>
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
                      <span className="badge badge--active" aria-label="Current active version">
                        Current
                      </span>
                    ) : (
                      <span className="badge badge--archived" aria-label="Archived version">
                        Archived
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
