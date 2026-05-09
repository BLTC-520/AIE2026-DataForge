import type { DatasetSample, DuplicateIssue, DuplicateIssueSource } from "./types";

export type DuplicateDecisionAction = {
  issueId: string;
  sampleId?: string;
  action: "remove" | "keep" | "manual_review";
  reviewedAt?: number;
  reviewer?: string;
};

export type DuplicateIssueSummary = {
  suspectedCount: number;
  removedCount: number;
  keptCount: number;
  manualReviewCount: number;
};

const deterministicSource: DuplicateIssueSource = "adaption";

const uniqueByIssueId = (issues: readonly DuplicateIssue[]): DuplicateIssue[] => {
  const byId = new Map<string, DuplicateIssue>();

  for (const issue of issues) {
    byId.set(issue.id, issue);
  }

  return Array.from(byId.values());
};

const sampleKey = (sample: DatasetSample): string => sample.sampleKey || sample.id;

const isCandidateDuplicate = (sample: DatasetSample): boolean => {
  return sample.duplicateStatus === "suspected_duplicate";
};

const issueTargetFromId = (issueId: string): string | null => {
  const prefix = "duplicate-";

  if (!issueId.startsWith(prefix)) {
    return null;
  }

  return issueId.slice(prefix.length);
};

const chooseFallbackDuplicateOf = (
  sample: DatasetSample,
  samples: readonly DatasetSample[],
): string | null => {
  if (sample.duplicateOf) {
    return sample.duplicateOf;
  }

  const currentClass = sample.currentLabel || sample.finalLabel || sample.originalLabel;
  if (!currentClass) {
    return null;
  }

  const duplicateOfSample = samples.find(
    (candidate) =>
      candidate.id !== sample.id &&
      (candidate.currentLabel || candidate.finalLabel || candidate.originalLabel) === currentClass,
  );

  return duplicateOfSample ? sampleKey(duplicateOfSample) : null;
};

export function getOpenDuplicateIssues(
  samples: readonly DatasetSample[],
  duplicateIssues: readonly DuplicateIssue[],
): DuplicateIssue[] {
  const bySample = new Map<string, DuplicateIssue>();

  for (const issue of uniqueByIssueId(duplicateIssues)) {
    if (issue.status === "open") {
      bySample.set(issue.sampleKey, issue);
    }
  }

  const inferred = samples
    .filter((sample) => isCandidateDuplicate(sample) && !bySample.has(sampleKey(sample)))
    .map((sample) => {
      const fallbackDuplicateOf = chooseFallbackDuplicateOf(sample, samples);
      if (!fallbackDuplicateOf) {
        return null;
      }

      const key = sampleKey(sample);

      return {
        id: `duplicate-${key}`,
        sampleId: sample.id,
        sampleKey: key,
        duplicateOfSampleKey: fallbackDuplicateOf,
        reason: "deterministic duplicate marker from local demo data",
        status: "open",
        source: deterministicSource,
        similarityScore: 0.86,
      } as DuplicateIssue;
    })
    .filter((issue): issue is DuplicateIssue => Boolean(issue));

  return [...bySample.values(), ...inferred];
}

export function applyDuplicateDecisions(
  samples: readonly DatasetSample[],
  actions: readonly DuplicateDecisionAction[],
): DatasetSample[] {
  if (actions.length === 0) {
    return samples.map((sample) => ({ ...sample }));
  }

  const actionsBySample = new Map<string, DuplicateDecisionAction>();
  for (const action of actions) {
    const target = action.sampleId ?? action.issueId;
    actionsBySample.set(target, action);

    const inferredSampleKey = issueTargetFromId(action.issueId);
    if (inferredSampleKey) {
      actionsBySample.set(inferredSampleKey, action);
    }
  }

  const makeMetadata = (sample: DatasetSample, action: DuplicateDecisionAction): Record<string, unknown> => {
    const metadata: Record<string, unknown> = {
      ...(sample.metadata ?? {}),
      lastDuplicateReviewAction: action.action,
    };

    if (action.reviewedAt) {
      metadata.lastDuplicateReviewAt = action.reviewedAt;
    }

    if (action.reviewer) {
      metadata.lastDuplicateReviewReviewer = action.reviewer;
    }

    return metadata;
  };

  return samples.map((sample) => {
    const action = actionsBySample.get(sample.id) || actionsBySample.get(sampleKey(sample));

    if (!action) {
      return { ...sample };
    }

    if (action.action === "remove") {
      return {
        ...sample,
        duplicateStatus: "removed",
        metadata: makeMetadata(sample, action),
      };
    }

    if (action.action === "manual_review") {
      return {
        ...sample,
        duplicateStatus: "manual_review",
        metadata: makeMetadata(sample, action),
      };
    }

    return {
      ...sample,
      duplicateStatus: "kept",
      metadata: makeMetadata(sample, action),
    };
  });
}

export function summarizeDuplicateIssues(duplicateIssues: readonly DuplicateIssue[]) {
  const summary: DuplicateIssueSummary = {
    suspectedCount: 0,
    removedCount: 0,
    keptCount: 0,
    manualReviewCount: 0,
  };

  for (const issue of duplicateIssues) {
    if (issue.status === "open") {
      summary.suspectedCount += 1;
    }

    if (issue.status === "removed") {
      summary.removedCount += 1;
    }

    if (issue.status === "kept") {
      summary.keptCount += 1;
    }

    if (issue.status === "manual_review") {
      summary.manualReviewCount += 1;
    }
  }

  return summary;
}
