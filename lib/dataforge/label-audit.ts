import type {
  DatasetSample,
  LabelDecisionAction,
  LabelIssue,
  LabelIssueType,
  ReviewStatus,
} from "./types";

export type LabelIssueSummary = {
  missingLabelCount: number;
  suspectedWrongLabelCount: number;
  acceptedCompletions: number;
  acceptedCorrections: number;
  rejectedSuggestions: number;
  manualReviewCount: number;
  remainingReviewCount: number;
};

const normalizeConfidence = (value?: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  if (value <= 1) {
    return value;
  }

  return value / 100;
};

const buildSampleIssueId = (issueType: LabelIssueType, sampleKey: string): string => {
  return `${issueType}-${sampleKey}`;
};

const isLabeled = (sample: DatasetSample): boolean => {
  return Boolean(sample.currentLabel && sample.currentLabel.trim().length > 0);
};

const issueTargetFromId = (issueId: string): string | null => {
  const knownPrefixes = [
    "missing_label-",
    "wrong_label-",
    "ambiguous-",
    "imbalance_related-",
  ];

  for (const prefix of knownPrefixes) {
    if (issueId.startsWith(prefix)) {
      return issueId.slice(prefix.length);
    }
  }

  return null;
};

export function getMissingLabelIssues(samples: readonly DatasetSample[]): LabelIssue[] {
  return samples
    .filter((sample) => !isLabeled(sample))
    .map((sample) => {
      const sampleKey = sample.sampleKey || sample.id;
      const suggestedLabel = sample.finalLabel ?? sample.currentLabel;

      return {
        id: buildSampleIssueId("missing_label", sampleKey),
        sampleId: sample.id,
        sampleKey,
        issueType: "missing_label",
        suggestedLabel,
        confidence: normalizeConfidence(sample.labelConfidence),
        reason: sample.labelReason || "sample is missing a visible label in metadata",
        status: "open",
        source: "deterministic",
      };
    });
}

export function getOpenLabelIssues(
  samples: readonly DatasetSample[],
  labelIssues: readonly LabelIssue[],
): LabelIssue[] {
  const existingBySampleKey = new Map<string, LabelIssue>();
  const existingById = new Map<string, LabelIssue>();

  for (const issue of labelIssues) {
    existingById.set(issue.id, issue);

    if (issue.sampleKey) {
      existingBySampleKey.set(issue.sampleKey, issue);
    }

    if (issue.sampleId) {
      existingBySampleKey.set(issue.sampleId, issue);
    }

    const inferredSampleKey = issueTargetFromId(issue.id);
    if (inferredSampleKey) {
      existingBySampleKey.set(inferredSampleKey, issue);
    }
  }

  const openIssues = labelIssues.filter((issue) => issue.status === "open");
  const generatedMissing = getMissingLabelIssues(samples).filter((generated) => {
    const isAlreadyTracked =
      existingById.has(generated.id) ||
      existingBySampleKey.has(generated.sampleKey) ||
      (typeof generated.sampleId === "string" && existingBySampleKey.has(generated.sampleId));

    return !isAlreadyTracked;
  });

  return [...openIssues, ...generatedMissing];
}

const hasOpenAction = (status: ReviewStatus): boolean => {
  return status === "open";
};

const setReviewTimestamp = (action: LabelDecisionAction, sample: DatasetSample): DatasetSample => {
  if (!action.reviewedAt && !action.reviewer) {
    return sample;
  }

  const updatedMetadata: Record<string, unknown> = {
    ...(sample.metadata ?? {}),
  };

  if (action.reviewedAt) {
    updatedMetadata.lastLabelDecisionAt = action.reviewedAt;
  }

  if (action.reviewer) {
    updatedMetadata.lastLabelDecisionReviewer = action.reviewer;
  }

  return {
    ...sample,
    metadata: updatedMetadata,
  };
};

export function applyLabelDecisions(
  samples: readonly DatasetSample[],
  actions: readonly LabelDecisionAction[],
): DatasetSample[] {
  if (actions.length === 0) {
    return samples.map((sample) => ({ ...sample }));
  }

  const actionByTarget = new Map<string, LabelDecisionAction>();

  for (const action of actions) {
    const target = action.sampleId ?? action.issueId;
    actionByTarget.set(target, action);

    const inferredSampleKey = issueTargetFromId(action.issueId);
    if (inferredSampleKey) {
      actionByTarget.set(inferredSampleKey, action);
    }
  }

  const normalizeLabel = (value?: string): string => value?.trim() || "";

  return samples.map((sample) => {
    const action = actionByTarget.get(sample.id) || actionByTarget.get(sample.sampleKey) || null;

    if (!action) {
      return { ...sample };
    }

    const next: DatasetSample = { ...sample };
    const reviewed = setReviewTimestamp(action, next);
    Object.assign(next, reviewed);

    if (action.action === "manual_review") {
      return {
        ...next,
        labelStatus: "manual_review",
      };
    }

    if (action.action === "reject") {
      return {
        ...next,
        labelStatus: "rejected",
      };
    }

    if (action.action === "accept" || action.action === "edit") {
      const finalLabel = normalizeLabel(action.finalLabel);

      if (!finalLabel) {
        return next;
      }

      const originalLabel =
        next.originalLabel ?? next.currentLabel ?? undefined;

      return {
        ...next,
        originalLabel,
        currentLabel: finalLabel,
        finalLabel,
        labelStatus: "accepted",
        labelReason: next.labelReason || "manually approved label suggestion",
        labelConfidence:
          typeof next.labelConfidence === "number"
            ? next.labelConfidence
            : normalizeConfidence(action.action === "edit" ? 0.88 : 0.76),
      };
    }

    return next;
  });
}

export function summarizeLabelIssues(labelIssues: readonly LabelIssue[]) {
  const summary: LabelIssueSummary = {
    missingLabelCount: 0,
    suspectedWrongLabelCount: 0,
    acceptedCompletions: 0,
    acceptedCorrections: 0,
    rejectedSuggestions: 0,
    manualReviewCount: 0,
    remainingReviewCount: 0,
  };

  for (const issue of labelIssues) {
    if (issue.issueType === "missing_label") {
      summary.missingLabelCount += 1;
    } else if (issue.issueType === "wrong_label") {
      summary.suspectedWrongLabelCount += 1;
    }

    if (issue.status === "accepted") {
      if (issue.issueType === "missing_label") {
        summary.acceptedCompletions += 1;
      } else if (issue.issueType === "wrong_label") {
        summary.acceptedCorrections += 1;
      }
    }

    if (issue.status === "rejected") {
      summary.rejectedSuggestions += 1;
    }

    if (issue.status === "manual_review") {
      summary.manualReviewCount += 1;
    }

    if (hasOpenAction(issue.status)) {
      summary.remainingReviewCount += 1;
    }
  }

  return summary;
}
