"use client";

import { useMemo } from "react";

import type {
  DatasetSample,
  DuplicateIssue,
} from "../../lib/dataforge/types";
import { summarizeDuplicateIssues } from "../../lib/dataforge/duplicates";

import styles from "./duplicate-review-panel.module.css";

type DuplicateReviewPanelProps = {
  samples: DatasetSample[];
  duplicateIssues: DuplicateIssue[];
  disabled?: boolean;
  onRemove: (issueId: string) => void;
  onKeep: (issueId: string) => void;
  onManualReview: (issueId: string) => void;
};

const buildSampleLookup = (samples: DatasetSample[]) => {
  const bySampleKey = new Map<string, DatasetSample>();

  for (const sample of samples) {
    bySampleKey.set(sample.id, sample);
    bySampleKey.set(sample.sampleKey, sample);
  }

  return bySampleKey;
};

const labelLines = (sample?: DatasetSample) => {
  return {
    current: sample?.currentLabel || sample?.finalLabel || sample?.originalLabel || "Unlabeled",
    final: sample?.finalLabel || sample?.currentLabel || sample?.originalLabel || "Unlabeled",
  };
};

export default function DuplicateReviewPanel({
  samples,
  duplicateIssues,
  disabled = false,
  onRemove,
  onKeep,
  onManualReview,
}: DuplicateReviewPanelProps) {
  const sampleByKey = useMemo(() => buildSampleLookup(samples), [samples]);
  const summary = useMemo(() => summarizeDuplicateIssues(duplicateIssues), [duplicateIssues]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Duplicate review</h2>
          <p>Review suspected duplicates before export. This removes duplicate export entries, not source image files.</p>
        </div>
      </header>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <p>Suspected</p>
          <strong>{summary.suspectedCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Removed</p>
          <strong>{summary.removedCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Kept</p>
          <strong>{summary.keptCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Manual review</p>
          <strong>{summary.manualReviewCount}</strong>
        </article>
      </div>

      {duplicateIssues.length === 0 ? (
        <div className={styles.empty}>
          <p>No duplicate issues detected yet.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {duplicateIssues.map((issue) => {
            const sourceSample = sampleByKey.get(issue.sampleKey);
            const duplicateSample = sampleByKey.get(issue.duplicateOfSampleKey);

            return (
              <li key={issue.id} className={styles.issueRow}>
                <div className={styles.pair}>
                  <div>
                    <p>
                      <strong>Source sample</strong>
                    </p>
                    <span>{issue.sampleKey}</span>
                    <small>
                      current: {labelLines(sourceSample).current}
                    </small>
                    <small>
                      final: {labelLines(sourceSample).final}
                    </small>
                  </div>
                  <div>
                    <p>
                      <strong>Duplicate sample</strong>
                    </p>
                    <span>{issue.duplicateOfSampleKey}</span>
                    <small>
                      current: {labelLines(duplicateSample).current}
                    </small>
                    <small>
                      final: {labelLines(duplicateSample).final}
                    </small>
                  </div>
                  <div>
                    <p>
                      <strong>Source</strong>
                    </p>
                    <span>{issue.source}</span>
                  </div>
                  <div>
                    <p>
                      <strong>Status</strong>
                    </p>
                    <span>{issue.status}</span>
                  </div>
                </div>
                <p className={styles.reason}>
                  {issue.reason}
                  {issue.similarityScore !== undefined && (
                    <span>
                      {" "}({Math.round(issue.similarityScore * 100)}% similarity)
                    </span>
                  )}
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => onRemove(issue.id)}
                    disabled={disabled || issue.status !== "open"}
                  >
                    Remove duplicate
                  </button>
                  <button
                    type="button"
                    className={styles.success}
                    onClick={() => onKeep(issue.id)}
                    disabled={disabled || issue.status !== "open"}
                  >
                    Keep both
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => onManualReview(issue.id)}
                    disabled={disabled || issue.status !== "open"}
                  >
                    Manual review
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
