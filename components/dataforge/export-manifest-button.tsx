// Triggers browser downloads for the final dataset CSV and report.
//
// Brian's stub signature:
//   { samples, labelIssues, duplicateIssues, balancingPlan,
//     baselineEvaluation, finalEvaluation, qualityReport }
// This component matches that exactly so it drops in.
//
// The actual manifest construction lives in lib/dataforge/export.ts so it
// can be reused by server actions (e.g. saving the manifest to Convex).

"use client";

import { useState } from "react";
import type {
  AdaptionEvaluationSnapshot,
  BalancingPlan,
  DatasetSample,
  DuplicateIssue,
  LabelIssue,
  QualityReport,
} from "../../lib/dataforge/types";
import {
  buildDatasetReportMarkdown,
  buildExportManifest,
  buildSamplesCsv,
} from "../../lib/dataforge/export";
import styles from "./export-manifest-button.module.css";

export type ExportManifestButtonProps = {
  samples: DatasetSample[];
  labelIssues: LabelIssue[];
  duplicateIssues: DuplicateIssue[];
  balancingPlan: BalancingPlan[];
  baselineEvaluation: AdaptionEvaluationSnapshot;
  finalEvaluation: AdaptionEvaluationSnapshot;
  qualityReport: QualityReport;
  /** Optional name to use for the download file. Defaults to dataset_name. */
  datasetName?: string;
  /** Training intent text — flows into the manifest header. */
  trainingIntent?: string;
  /** Disable the button (e.g. before analysis completes). */
  disabled?: boolean;
  /** Optional CSS class hook for placement-specific styling. */
  className?: string;
  /** Optional callback fired after a successful download. */
  onExported?: (filename: string) => void;
};

export function ExportManifestButton({
  samples,
  labelIssues,
  duplicateIssues,
  balancingPlan,
  baselineEvaluation,
  finalEvaluation,
  qualityReport,
  datasetName = "dataforge-clean-dataset",
  trainingIntent = "",
  disabled,
  className,
  onExported,
}: ExportManifestButtonProps) {
  const [status, setStatus] = useState<"idle" | "exporting" | "done" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const includedCount = samples.filter((s) => s.duplicateStatus !== "removed").length;
  const removedCount = samples.length - includedCount;

  async function handleExport() {
    if (disabled || status === "exporting") return;
    setStatus("exporting");
    setErrorMessage(null);

    try {
      const manifest = buildExportManifest({
        datasetName,
        trainingIntent,
        samples,
        labelIssues,
        duplicateIssues,
        balancingPlan,
        baselineEvaluation,
        finalEvaluation,
        qualityReport,
      });
      const baseName = `${slug(datasetName)}-${stamp()}`;
      const datasetFilename = `${baseName}-final-dataset.csv`;
      const reportFilename = `${baseName}-dataforge-report.md`;
      triggerDownload(buildSamplesCsv(manifest.samples), datasetFilename, "text/csv;charset=utf-8");
      triggerDownload(
        buildDatasetReportMarkdown(manifest),
        reportFilename,
        "text/markdown;charset=utf-8",
      );
      setStatus("done");
      onExported?.(`${datasetFilename} + ${reportFilename}`);
      // Reset back to idle so the user can re-export after further edits.
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown export error");
    }
  }

  return (
    <section className={`${styles.root} ${className ?? ""}`} aria-label="Export dataset and report">
      <header className={styles.header}>
        <span className={styles.kicker}>Export</span>
        <h2 className={styles.title}>Final dataset and report</h2>
        <p className={styles.subtitle}>
          Downloads the clean labeled dataset as CSV plus a Markdown report with
          quality deltas, provider boundaries, and synthetic-sample provenance.
        </p>
      </header>

      <dl className={styles.summary}>
        <div>
          <dt>Samples included</dt>
          <dd>{includedCount}</dd>
        </div>
        <div>
          <dt>Removed (dupes)</dt>
          <dd>{removedCount}</dd>
        </div>
        <div>
          <dt>Label issues</dt>
          <dd>{labelIssues.length}</dd>
        </div>
        <div>
          <dt>Balancing entries</dt>
          <dd>{balancingPlan.length}</dd>
        </div>
        <div>
          <dt>Quality (baseline → final)</dt>
          <dd>
            {baselineEvaluation.qualityScore ?? "—"} →{" "}
            <strong>{finalEvaluation.qualityScore ?? "—"}</strong>
          </dd>
        </div>
      </dl>

      <button
        type="button"
        className={styles.btn}
        onClick={handleExport}
        disabled={disabled || status === "exporting"}
        data-status={status}
        aria-live="polite"
      >
        {renderButtonLabel(status)}
      </button>

      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderButtonLabel(status: "idle" | "exporting" | "done" | "error"): string {
  switch (status) {
    case "exporting":
      return "Building dataset…";
    case "done":
      return "Downloaded";
    case "error":
      return "Retry export";
    default:
      return "Export dataset + report";
  }
}

function triggerDownload(contents: string, filename: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Defer revocation slightly so the download starts cleanly.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "") // strip a trailing extension if present
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stamp(): string {
  // YYYYMMDD-HHMM in local time. Short and sortable.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}
