// Pure deterministic metrics helpers. No React imports, no provider calls.
//
// These produce the *measured* (deterministic) metrics that DataForge can
// compute locally without contacting any external service. Provider-measured
// metrics from Adaption Labs flow through `lib/dataforge/adaption.ts` and
// are clearly labeled in the UI as manifest-level, not image-level.

import type {
  AdaptionEvaluationSnapshot,
  ClassDistribution,
  DatasetMetrics,
  DatasetSample,
  DuplicateIssue,
  LabelIssue,
} from "./types";

/**
 * Tag for where a particular rendered metric came from. The Quality Report
 * panel uses this to show a source label next to every score.
 */
export type MetricSource =
  | "adaption" // From an AdaptionEvaluationSnapshot (manifest-level only)
  | "deterministic" // Computed locally from the sample list
  | "seeded" // Pre-baked demo fixture
  | "gpt" // GPT Vision / Gemini visual audit estimate
  | "bazel"; // Counts derived from Bazel's labelIssue/duplicateIssue inputs

export type SourcedScore = {
  value: number | null;
  source: MetricSource;
};

/**
 * Build a class distribution from the *effective* label of each sample.
 * Effective label = finalLabel ?? currentLabel ?? originalLabel.
 * Samples whose duplicateStatus is "removed" are excluded so the count
 * reflects what would appear in the exported clean manifest.
 */
export function calculateDistribution(samples: DatasetSample[]): ClassDistribution {
  const distribution: ClassDistribution = {};
  for (const sample of samples) {
    if (sample.duplicateStatus === "removed") continue;
    const label = effectiveLabel(sample);
    if (!label) continue;
    distribution[label] = (distribution[label] ?? 0) + 1;
  }
  return distribution;
}

/**
 * Compute a 0-100 balance score using the coefficient-of-variation approach.
 * A perfectly balanced distribution returns 100; one heavily skewed toward a
 * single class approaches 0. This is a deterministic local metric — when
 * Adaption returns a balance score in its snapshot, prefer that instead.
 */
export function calculateBalanceScore(distribution: ClassDistribution): number {
  const counts = Object.values(distribution);
  if (counts.length < 2) return counts.length === 1 ? 100 : 0;

  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;

  const mean = total / counts.length;
  const variance =
    counts.reduce((sum, n) => sum + (n - mean) ** 2, 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean === 0 ? 0 : stdDev / mean;
  // Map cv ∈ [0, 1+] onto [100, 0]. Cap at cv=1 so extreme imbalance floors at 0.
  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.min(cv, 1)))));
}

/**
 * Compute a 0-100 completeness score from label presence. Removed duplicates
 * are excluded from both numerator and denominator since they wouldn't ship.
 */
export function calculateCompletenessScore(samples: DatasetSample[]): number {
  const eligible = samples.filter((s) => s.duplicateStatus !== "removed");
  if (eligible.length === 0) return 0;
  const labeled = eligible.filter((s) => Boolean(effectiveLabel(s))).length;
  return Math.round((labeled / eligible.length) * 100);
}

/**
 * Build a full DatasetMetrics summary from samples plus open issue lists.
 * This is the "measured" metric set rendered in the Quality Report's
 * deterministic column. When Adaption is live, prefer its snapshot for
 * quality and consistency; this helper still supplies counts (missing
 * labels, duplicates, etc.) since Adaption doesn't compute those for
 * image-level metadata.
 */
export function calculateDatasetMetrics(
  samples: DatasetSample[],
  labelIssues: LabelIssue[] = [],
  duplicateIssues: DuplicateIssue[] = [],
): DatasetMetrics {
  const distribution = calculateDistribution(samples);
  const balanceScore = calculateBalanceScore(distribution);
  const completenessScore = calculateCompletenessScore(samples);

  const missingLabelCount = samples.filter(
    (s) => s.labelStatus === "unlabeled" || !effectiveLabel(s),
  ).length;
  const newlyLabeledCount = samples.filter(
    (s) => s.labelStatus === "newly_labeled",
  ).length;
  const correctedLabelCount = samples.filter(
    (s) => s.labelStatus === "corrected",
  ).length;
  const manualReviewCount = samples.filter(
    (s) => s.labelStatus === "manual_review",
  ).length;

  const suspectedLabelIssueCount = labelIssues.filter(
    (i) => i.status === "open",
  ).length;
  const duplicateIssueCount = duplicateIssues.filter(
    (i) => i.status === "open",
  ).length;
  const removedDuplicateCount = duplicateIssues.filter(
    (i) => i.status === "removed",
  ).length;

  return {
    sampleCount: samples.filter((s) => s.duplicateStatus !== "removed").length,
    classCount: Object.keys(distribution).length,
    missingLabelCount,
    suspectedLabelIssueCount,
    duplicateIssueCount,
    removedDuplicateCount,
    newlyLabeledCount,
    correctedLabelCount,
    manualReviewCount,
    balanceScore,
    completenessScore,
    classDistribution: distribution,
  };
}

/**
 * The rendered shape of the before/after improvement strip. Each delta is
 * (after - before). Score deltas: positive = improvement. Count deltas
 * (missing/mislabel/duplicate): NEGATIVE = improvement — fewer issues.
 */
export type ImprovementDelta = {
  baseline: AdaptionEvaluationSnapshot | null;
  final: AdaptionEvaluationSnapshot | null;
  qualityScoreDelta: number | null;
  balanceScoreDelta: number | null;
  completenessScoreDelta: number | null;
  consistencyScoreDelta: number | null;
  classDistributionBefore: ClassDistribution;
  classDistributionAfter: ClassDistribution;
  missingLabelDelta: number;
  labelIssueDelta: number;
  duplicateIssueDelta: number;
  hasImprovement: boolean;
};

/**
 * Produce a structured before/after delta from two evaluation snapshots and
 * two metric summaries. Either snapshot may be null (e.g. before analysis
 * runs) — the UI uses that to render an "awaiting baseline" state.
 */
export function buildImprovementDelta(
  baseline: { evaluation?: AdaptionEvaluationSnapshot | null; metrics: DatasetMetrics } | null,
  final: { evaluation?: AdaptionEvaluationSnapshot | null; metrics: DatasetMetrics } | null,
): ImprovementDelta {
  const baselineEval = baseline?.evaluation ?? null;
  const finalEval = final?.evaluation ?? null;

  const qualityScoreDelta = scoreDelta(baselineEval?.qualityScore, finalEval?.qualityScore);
  const balanceScoreDelta = scoreDelta(
    baselineEval?.balanceScore ?? baseline?.metrics.balanceScore,
    finalEval?.balanceScore ?? final?.metrics.balanceScore,
  );
  const completenessScoreDelta = scoreDelta(
    baselineEval?.completenessScore ?? baseline?.metrics.completenessScore,
    finalEval?.completenessScore ?? final?.metrics.completenessScore,
  );
  const consistencyScoreDelta = scoreDelta(
    baselineEval?.consistencyScore,
    finalEval?.consistencyScore,
  );

  const missingLabelDelta =
    (final?.metrics.missingLabelCount ?? 0) - (baseline?.metrics.missingLabelCount ?? 0);
  const labelIssueDelta =
    (final?.metrics.suspectedLabelIssueCount ?? 0) -
    (baseline?.metrics.suspectedLabelIssueCount ?? 0);
  const duplicateIssueDelta =
    (final?.metrics.duplicateIssueCount ?? 0) - (baseline?.metrics.duplicateIssueCount ?? 0);

  const hasImprovement =
    (qualityScoreDelta !== null && qualityScoreDelta > 0) ||
    (balanceScoreDelta !== null && balanceScoreDelta > 0) ||
    (completenessScoreDelta !== null && completenessScoreDelta > 0) ||
    missingLabelDelta < 0 ||
    labelIssueDelta < 0 ||
    duplicateIssueDelta < 0;

  return {
    baseline: baselineEval,
    final: finalEval,
    qualityScoreDelta,
    balanceScoreDelta,
    completenessScoreDelta,
    consistencyScoreDelta,
    classDistributionBefore:
      baselineEval?.classDistribution ?? baseline?.metrics.classDistribution ?? {},
    classDistributionAfter:
      finalEval?.classDistribution ?? final?.metrics.classDistribution ?? {},
    missingLabelDelta,
    labelIssueDelta,
    duplicateIssueDelta,
    hasImprovement,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function effectiveLabel(sample: DatasetSample): string | undefined {
  return sample.finalLabel ?? sample.currentLabel ?? sample.originalLabel;
}

function scoreDelta(before?: number, after?: number): number | null {
  if (before === undefined || after === undefined) return null;
  return Math.round((after - before) * 10) / 10;
}
