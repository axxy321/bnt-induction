/**
 * InductionVersionBanner
 *
 * Milestone 1 — Versioned Inductions
 *
 * Shown to a driver when a newer version of the induction has been published
 * and their certificate (if any) was issued under an older version.
 *
 * The banner is purely informational at this stage — it notifies the driver
 * that their induction will need to be redone. The actual reset is triggered
 * by the admin via the existing reset-induction endpoint, or automatically by
 * the nightly expiry scheduler.
 *
 * This component is non-blocking and does NOT prevent the driver from
 * accessing any existing certificate. It surfaces only when:
 *   - The driver has a completed induction
 *   - The certificate's induction_version_id differs from the current version
 */

import { InductionVersion } from "../types";

interface InductionVersionBannerProps {
  currentVersion: InductionVersion;
  /** The version label stamped on the driver's existing certificate, if any */
  certificateVersionLabel: string | null;
}

export function InductionVersionBanner({ currentVersion, certificateVersionLabel }: InductionVersionBannerProps) {
  const isOutdated = currentVersion.hasPendingVersion;

  if (!isOutdated) return null;

  return (
    <div
      className="version-banner"
      role="alert"
      aria-live="polite"
      aria-label="Induction version update notice"
    >
      <div className="version-banner__icon" aria-hidden="true">⚠️</div>
      <div className="version-banner__body">
        <strong className="version-banner__title">
          Induction Update Required — Version {currentVersion.versionLabel}
        </strong>
        <p className="version-banner__message">
          The induction content has been updated since you last completed it (your certificate was issued under
          version {certificateVersionLabel}). You will need to re-complete the induction to maintain compliance.
          Contact your manager or wait for an email notification with further instructions.
        </p>
        {currentVersion.revisionNotes && (
          <details className="version-banner__notes">
            <summary>What changed in version {currentVersion.versionLabel}</summary>
            <p>{currentVersion.revisionNotes}</p>
          </details>
        )}
      </div>
    </div>
  );
}
