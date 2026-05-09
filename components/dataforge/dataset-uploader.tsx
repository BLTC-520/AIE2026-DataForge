"use client";

import { useRef, useState } from "react";
import {
  parseDatasetZip,
  type UploadedDataset,
} from "../../lib/dataforge/zip-upload";
import styles from "./dataset-uploader.module.css";

export type DatasetUploaderProps = {
  /** Called once parsing succeeds. The component does not retain the URLs;
   * the caller is responsible for revokeUploadedDataset() when swapping. */
  onLoaded: (uploaded: UploadedDataset) => void;
  /** Called when a parse attempt fails so the caller can log it. */
  onError?: (message: string) => void;
  disabled?: boolean;
};

type UploadStatus = "idle" | "parsing" | "done" | "error";

type Summary = {
  name: string;
  samples: number;
  classes: number;
  duplicates: number;
  missingLabels: number;
  warnings: number;
};

export function DatasetUploader({
  onLoaded,
  onError,
  disabled,
}: DatasetUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file || disabled) return;

    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".zip") &&
      file.type !== "application/zip" &&
      file.type !== "application/x-zip-compressed"
    ) {
      const msg = "Please drop a .zip file.";
      setStatus("error");
      setErrorMessage(msg);
      onError?.(msg);
      return;
    }

    setStatus("parsing");
    setErrorMessage(null);
    try {
      const uploaded = await parseDatasetZip(file);
      setStatus("done");
      setSummary({
        name: uploaded.datasetName,
        samples: uploaded.samples.length,
        classes: Object.keys(uploaded.classDistribution).length,
        duplicates: uploaded.duplicateIssues.length,
        missingLabels: uploaded.labelIssues.filter(
          (i) => i.issueType === "missing_label",
        ).length,
        warnings: uploaded.warnings.length,
      });
      onLoaded(uploaded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to parse ZIP.";
      setStatus("error");
      setErrorMessage(msg);
      onError?.(msg);
    } finally {
      // Reset so the same file can be re-selected if the user wants to retry.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label
      className={styles.root}
      data-status={status}
      data-drag={dragOver ? "over" : undefined}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className={styles.hiddenInput}
        disabled={disabled || status === "parsing"}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <span className={styles.icon} aria-hidden="true">
        {status === "parsing"
          ? "⏳"
          : status === "done"
            ? "✓"
            : status === "error"
              ? "!"
              : "+"}
      </span>

      <span className={styles.text}>
        <strong>
          {status === "parsing"
            ? "Parsing ZIP…"
            : status === "done" && summary
              ? summary.name
              : "Drop dataset ZIP"}
        </strong>
        {status === "done" && summary ? (
          <small>
            {summary.samples} samples · {summary.classes} classes ·{" "}
            {summary.duplicates} duplicates · {summary.missingLabels} unlabeled
            {summary.warnings > 0 ? ` · ${summary.warnings} warnings` : null}
          </small>
        ) : status === "error" && errorMessage ? (
          <small className={styles.error}>{errorMessage}</small>
        ) : (
          <small>
            Click or drag a ZIP. Per-class folders become labels (e.g.{" "}
            <code>cats/</code>, <code>dogs/</code>).
          </small>
        )}
      </span>
    </label>
  );
}
