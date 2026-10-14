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

import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { InductionVersion, DriverProfile } from "../types";

interface InductionVersionBannerProps {
  currentVersion: InductionVersion;
  /** The version label stamped on the driver's existing certificate, if any */
  certificateVersionLabel: string | null;
}

export function InductionVersionBanner({ currentVersion, certificateVersionLabel }: InductionVersionBannerProps) {
  const { t } = useTranslation();
  // H-4 FIX: isOutdated must compare the driver's certificate version label against the
  // current published version — NOT hasPendingVersion (which is true whenever an admin drafts
  // any new version, causing the banner to show to fully-compliant drivers incorrectly).
  const isOutdated =
    certificateVersionLabel !== null &&
    certificateVersionLabel !== undefined &&
    certificateVersionLabel !== currentVersion.versionLabel;

  if (!isOutdated) return null;


  return (
    <div
      className="version-banner"
      role="alert"
      aria-live="polite"
      aria-label={t("ivb_aria")}
    >
      <div className="version-banner__icon" aria-hidden="true">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
      </div>
      <div className="version-banner__body">
        <strong className="version-banner__title">
          {t("ivb_title", { version: currentVersion.versionLabel })}
        </strong>
        <p className="version-banner__message">
          {t("ivb_message", { oldVersion: certificateVersionLabel })}
        </p>
        {currentVersion.revisionNotes && (
          <details className="version-banner__notes">
            <summary>{t("ivb_summary", { version: currentVersion.versionLabel })}</summary>
            <p>{currentVersion.revisionNotes}</p>
          </details>
        )}
      </div>
    </div>
  );
}
