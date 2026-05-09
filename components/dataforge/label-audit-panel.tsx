"use client";

import { ChangeEvent, useMemo, useState, type FormEvent } from "react";

import type {
  DatasetSample,
  LabelIssue,
} from "../../lib/dataforge/types";
import {
  getOpenLabelIssues,
  summarizeLabelIssues,
} from "../../lib/dataforge/label-audit";

import styles from "./label-audit-panel.module.css";

type LabelAuditPanelProps = {
  samples: DatasetSample[];
  labelIssues: LabelIssue[];
  disabled?: boolean;
  onApprove: (issueId: string) => void;
  onReject: (issueId: string) => void;
  onManualReview: (issueId: string) => void;
  onEditLabel: (issueId: string, finalLabel: string) => void;
};

const makeSampleLookup = (samples: DatasetSample[]) => {
  const byId = new Map<string, DatasetSample>();

  for (const sample of samples) {
    byId.set(sample.id, sample);
    byId.set(sample.sampleKey, sample);
  }

  return byId;
};

const issueLabelType = (issueType: LabelIssue["issueType"]): string => {
  if (issueType === "wrong_label") {
    return "Likely wrong label";
  }

  if (issueType === "ambiguous") {
    return "Ambiguous sample";
  }

  if (issueType === "imbalance_related") {
    return "Imbalance signal";
  }

  return "Missing label";
};

const formatConfidence = (value?: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  if (value > 1) {
    return Math.max(0, Math.min(1, value / 100));
  }

  return Math.max(0, Math.min(1, value));
};

export default function LabelAuditPanel({
  samples,
  labelIssues,
  disabled = false,
  onApprove,
  onReject,
  onManualReview,
  onEditLabel,
}: LabelAuditPanelProps) {
  const [editValueByIssue, setEditValueByIssue] = useState<Record<string, string>>({});

  const sampleByKey = useMemo(() => makeSampleLookup(samples), [samples]);
  const openIssues = useMemo(() => getOpenLabelIssues(samples, labelIssues), [samples, labelIssues]);
  const summary = useMemo(() => summarizeLabelIssues(labelIssues), [labelIssues]);

  const classOptions = useMemo(() => {
    const options = new Set<string>();

    for (const sample of samples) {
      if (sample.currentLabel) {
        options.add(sample.currentLabel);
      }

      if (sample.finalLabel) {
        options.add(sample.finalLabel);
      }
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [samples]);

  const onSubmitEdit = (event: FormEvent, issue: LabelIssue) => {
    event.preventDefault();
    const finalLabel = editValueByIssue[issue.id]?.trim();

    if (!finalLabel) {
      return;
    }

    onEditLabel(issue.id, finalLabel);
  };

  const onEditChange = (issueId: string, event: ChangeEvent<HTMLInputElement>) => {
    setEditValueByIssue((state) => ({
      ...state,
      [issueId]: event.target.value,
    }));
  };

  const quickChooseLabel = (issue: LabelIssue) => {
    const sample = sampleByKey.get(issue.sampleKey) || sampleByKey.get(issue.sampleId || "");
    const current = sample?.currentLabel?.trim();

    if (!current) {
      return;
    }

    setEditValueByIssue((state) => ({
      ...state,
      [issue.id]: current,
    }));
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Label audit</h2>
          <p>Approve missing labels and relabel likely mistakes before moving to dedupe.</p>
        </div>
      </header>

      <div className={styles.metrics}>
        <article className={styles.metricCard}>
          <p>Missing labels</p>
          <strong>{summary.missingLabelCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Suspected wrong labels</p>
          <strong>{summary.suspectedWrongLabelCount}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Accepted completions</p>
          <strong>{summary.acceptedCompletions}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Accepted corrections</p>
          <strong>{summary.acceptedCorrections}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Rejected suggestions</p>
          <strong>{summary.rejectedSuggestions}</strong>
        </article>
        <article className={styles.metricCard}>
          <p>Remaining review</p>
          <strong>{summary.remainingReviewCount}</strong>
        </article>
      </div>

      <div className={styles.listHeader}>
        <span>{openIssues.length} issue{openIssues.length === 1 ? "" : "s"} waiting</span>
        <span>Confidence is an internal heuristic for demo review.</span>
      </div>

      {openIssues.length === 0 ? (
        <div className={styles.empty}>
          <p>No open label issues at this stage.</p>
        </div>
      ) : (
        <ul className={styles.issueList}>
          {openIssues.map((issue) => {
            const sample = sampleByKey.get(issue.sampleKey) || sampleByKey.get(issue.sampleId || "");
            const currentLabel = sample?.currentLabel || "Unlabeled";
            const suggestedLabel = issue.suggestedLabel || sample?.finalLabel || "Pending";
            const scenario = sample?.prompt || "No scenario metadata";
            const confidence = formatConfidence(issue.confidence ?? sample?.labelConfidence);
            const editValue = editValueByIssue[issue.id] ?? suggestedLabel;
            const datalistId = `label-options-${issue.id}`;

            return (
              <li key={issue.id} className={styles.issueRow}>
                <header className={styles.issueHeader}>
                  <p>
                    <strong>Issue:</strong> {issueLabelType(issue.issueType)}
                  </p>
                  <span>{issue.id}</span>
                </header>

                <div className={styles.issueMeta}>
                  <div>
                    <span>Sample</span>
                    <strong>{sample?.id || issue.sampleId || "unknown"}</strong>
                  </div>
                  <div>
                    <span>Current label</span>
                    <strong>{currentLabel}</strong>
                  </div>
                  <div>
                    <span>Suggested</span>
                    <strong>{suggestedLabel}</strong>
                  </div>
                  <div>
                    <span>Confidence (demo)</span>
                    <div className={styles.confidenceTrack}>
                      <span style={{ width: `${Math.round(confidence * 100)}%` }} />
                    </div>
                    <small>{Math.round(confidence * 100)}%</small>
                  </div>
                  <div>
                    <span>Scenario</span>
                    <small>{scenario}</small>
                  </div>
                </div>

                <p className={styles.reason}>{issue.reason}</p>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => onApprove(issue.id)}
                    disabled={disabled}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => onReject(issue.id)}
                    disabled={disabled}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => onManualReview(issue.id)}
                    disabled={disabled}
                  >
                    Manual review
                  </button>
                </div>

                <form className={styles.editRow} onSubmit={(event) => onSubmitEdit(event, issue)}>
                  <label htmlFor={`issue-edit-${issue.id}`}>
                    Edit label
                  </label>
                  <div className={styles.editInputs}>
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => quickChooseLabel(issue)}
                      disabled={disabled}
                    >
                      use current
                    </button>
                    <input
                      id={`issue-edit-${issue.id}`}
                      list={datalistId}
                      value={editValue}
                      onChange={(event) => onEditChange(issue.id, event)}
                      disabled={disabled}
                      autoComplete="off"
                    />
                    <datalist id={datalistId}>
                      {classOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                    <button type="submit" className={styles.primary} disabled={disabled || !editValue.trim()}>
                      Save
                    </button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
