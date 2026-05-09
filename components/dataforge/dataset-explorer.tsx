"use client";

import { useMemo, useState } from "react";

import type {
  DatasetSample,
  DatasetSample as DatasetSampleType,
  LabelIssue,
  DuplicateIssue,
  SampleSource,
} from "../../lib/dataforge/types";

import styles from "./dataset-explorer.module.css";

type LabelStatusFilter =
  | "all"
  | "unlabeled"
  | "newly labeled"
  | "relabeled"
  | "duplicate"
  | "removed"
  | "accepted"
  | "manual review";

type DatasetExplorerProps = {
  samples: DatasetSample[];
  labelIssues?: LabelIssue[];
  duplicateIssues?: DuplicateIssue[];
};

type ExplorerRow = {
  sample: DatasetSampleType;
  reason: string;
  badges: string[];
  labels: {
    original: string;
    current: string;
    final: string;
  };
};

const sampleKey = (sample: DatasetSampleType): string => sample.sampleKey || sample.id;

const collectLabel = (sample: DatasetSampleType): string => {
  return sample.currentLabel || sample.finalLabel || sample.originalLabel || "Unlabeled";
};

const buildAvailableClasses = (samples: readonly DatasetSampleType[]) => {
  const classes = new Set<string>();

  for (const sample of samples) {
    const current = collectLabel(sample);
    if (current !== "Unlabeled") {
      classes.add(current);
    }
  }

  return Array.from(classes).sort((a, b) => a.localeCompare(b));
};

const toReason = (sample: DatasetSampleType): string => {
  if (sample.finalLabel && sample.originalLabel && sample.finalLabel !== sample.originalLabel) {
    return `relabeled from "${sample.originalLabel}" to "${sample.finalLabel}"`;
  }

  if (sample.finalLabel && !sample.originalLabel && sample.labelStatus === "accepted") {
    return "newly labeled by review action";
  }

  if (sample.labelReason) {
    return sample.labelReason;
  }

  if (sample.duplicateStatus === "removed") {
    return "excluded from export after duplicate review";
  }

  return "—";
};

const buildRowBadges = (sample: DatasetSampleType): string[] => {
  const badges = new Set<string>();

  if (sample.labelStatus === "unlabeled" || !sample.currentLabel) {
    badges.add("Unlabeled");
  }

  if (sample.labelStatus === "manual_review") {
    badges.add("Manual Review");
  }

  if (sample.labelStatus === "accepted") {
    badges.add("Accepted");
  }

  if (sample.duplicateStatus === "suspected_duplicate") {
    badges.add("Duplicate");
  }

  if (sample.duplicateStatus === "removed") {
    badges.add("Removed");
  }

  if (!sample.originalLabel && sample.finalLabel) {
    badges.add("Newly labeled");
  }

  if (
    sample.originalLabel &&
    sample.finalLabel &&
    sample.finalLabel !== sample.originalLabel
  ) {
    badges.add("Relabeled");
  }

  return Array.from(badges);
};

export default function DatasetExplorer({ samples, labelIssues = [], duplicateIssues = [] }: DatasetExplorerProps) {
  const [classFilter, setClassFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SampleSource | "all">("all");
  const [labelStatusFilter, setLabelStatusFilter] = useState<LabelStatusFilter>("all");

  const classes = useMemo(() => buildAvailableClasses(samples), [samples]);

  const rows: ExplorerRow[] = useMemo(() => {
    return samples.map((sample) => {
      return {
        sample,
        reason: toReason(sample),
        badges: buildRowBadges(sample),
        labels: {
          original: sample.originalLabel || "Unlabeled",
          current: sample.currentLabel || "Unlabeled",
          final: sample.finalLabel || sample.currentLabel || "Unlabeled",
        },
      };
    });
  }, [samples]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter(({ sample, badges }) => {
      if (classFilter !== "all") {
        const currentMatch = collectLabel(sample) === classFilter;
        if (!currentMatch) {
          return false;
        }
      }

      if (sourceFilter !== "all" && sample.source !== sourceFilter) {
        return false;
      }

      if (labelStatusFilter !== "all") {
        if (labelStatusFilter === "newly labeled" && !badges.includes("Newly labeled")) {
          return false;
        }

        if (labelStatusFilter === "relabeled" && !badges.includes("Relabeled")) {
          return false;
        }

        if (labelStatusFilter === "manual review" && !badges.includes("Manual Review")) {
          return false;
        }

        if (labelStatusFilter === "duplicate" && !badges.includes("Duplicate")) {
          return false;
        }

        if (labelStatusFilter === "removed" && !badges.includes("Removed")) {
          return false;
        }

        if (labelStatusFilter === "accepted" && !badges.includes("Accepted")) {
          return false;
        }

        if (labelStatusFilter === "unlabeled" && !badges.includes("Unlabeled")) {
          return false;
        }
      }

      return true;
    });

    return filtered;
  }, [rows, classFilter, sourceFilter, labelStatusFilter]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2>Dataset explorer</h2>
        <p>
          {samples.length} samples · {labelIssues.length} label issues · {duplicateIssues.length} duplicate issues
        </p>
      </header>

      <div className={styles.toolbar}>
        <label>
          <span>Class</span>
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="all">All classes</option>
            {classes.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SampleSource | "all")}
          >
            <option value="all">All sources</option>
            <option value="original">Original</option>
            <option value="synthetic">Synthetic</option>
            <option value="external">External</option>
          </select>
        </label>
        <label>
          <span>Label status</span>
          <select
            value={labelStatusFilter}
            onChange={(event) => setLabelStatusFilter(event.target.value as LabelStatusFilter)}
          >
            <option value="all">All labels</option>
            <option value="unlabeled">Unlabeled</option>
            <option value="newly labeled">Newly labeled</option>
            <option value="relabeled">Relabeled</option>
            <option value="accepted">Accepted</option>
            <option value="duplicate">Duplicate</option>
            <option value="removed">Removed</option>
            <option value="manual review">Manual Review</option>
          </select>
        </label>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sample</th>
              <th>Source</th>
              <th>Original</th>
              <th>Current</th>
              <th>Final</th>
              <th>Reason</th>
              <th>Provenance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  No samples match this filter.
                </td>
              </tr>
            ) : (
              filteredRows.map(({ sample, labels, reason, badges }) => {
                return (
                  <tr key={sampleKey(sample)}>
                    <td>
                      <strong>{sample.id}</strong>
                      <small>{sample.sampleKey}</small>
                    </td>
                    <td>{sample.source}</td>
                    <td>{labels.original}</td>
                    <td>{labels.current}</td>
                    <td>{labels.final}</td>
                    <td>{reason}</td>
                    <td>
                      {sample.duplicateOf ? (
                        <span>duplicateOf: {sample.duplicateOf}</span>
                      ) : (
                        <span>self</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.badges}>
                        {badges.length === 0 ? <span>—</span> : null}
                        {badges.map((badge) => (
                          <span key={`${sample.id}-${badge}`} className={styles.badge}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
