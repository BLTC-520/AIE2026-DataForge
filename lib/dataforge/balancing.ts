// Class-balancing helpers. Pure functions, no React, no provider calls.
//
// Balancing is *advice*, not new images. A BalancingPlan describes what
// should happen to each class — keep, downsample, upsample (with weights),
// collect more real data, or optionally generate. The exporter preserves
// these recommendations as metadata; class weights are NEVER expanded into
// duplicated synthetic-looking sample rows.

import type {
  BalancingPlan,
  ClassDistribution,
  DatasetSample,
  SamplingStrategy,
} from "./types";
import { calculateDistribution } from "./metrics";

export type BalancingPlanOptions = {
  /**
   * Below this fraction of the largest class, a class is considered
   * underrepresented. Default 0.4 — so if cats=90 and foxes=24, foxes
   * (~0.27) is below 0.4 and gets flagged for upsample.
   */
  underrepresentedRatio?: number;
  /**
   * Above this fraction of the dataset, a class is considered dominant
   * and is recommended for downsampling. Default 0.55.
   */
  dominantRatio?: number;
  /**
   * Floor for how few real images a class can have before we recommend
   * `collect_more` rather than `upsample` (because upsampling 5 images
   * to match 100 produces a degenerate effective sample size).
   */
  minRealSamplesForUpsample?: number;
  /**
   * If true, the plan offers `optional_generate` as a strategy alongside
   * `collect_more` for severely underrepresented classes. Off by default
   * to keep the plan honest about real vs synthetic data.
   */
  allowGenerate?: boolean;
};

const DEFAULTS: Required<BalancingPlanOptions> = {
  underrepresentedRatio: 0.4,
  dominantRatio: 0.55,
  minRealSamplesForUpsample: 20,
  allowGenerate: false,
};

/**
 * Build a BalancingPlan entry per class from the current sample state.
 * Uses inverse-frequency weighting so smaller classes get larger weights,
 * which is what most training-time loss-weighting schemes consume.
 */
export function createBalancingPlan(
  samples: DatasetSample[],
  options: BalancingPlanOptions = {},
): BalancingPlan[] {
  const opts = { ...DEFAULTS, ...options };
  const distribution = calculateDistribution(samples);
  return createBalancingPlanFromDistribution(distribution, opts);
}

/**
 * Same as createBalancingPlan but starts from a precomputed distribution.
 * Useful when the demo seeds a distribution directly without building
 * a full sample list.
 */
export function createBalancingPlanFromDistribution(
  distribution: ClassDistribution,
  options: BalancingPlanOptions = {},
): BalancingPlan[] {
  const opts = { ...DEFAULTS, ...options };
  const entries = Object.entries(distribution).filter(([name]) => name !== "Unlabeled");
  if (entries.length === 0) return [];

  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const max = Math.max(...entries.map(([, n]) => n));
  const targetCount = chooseTargetCount(entries.map(([, n]) => n));
  const now = Date.now();

  const weights = calculateClassWeights(Object.fromEntries(entries));

  return entries.map(([className, currentCount]) => {
    const ratioOfMax = max === 0 ? 0 : currentCount / max;
    const ratioOfTotal = total === 0 ? 0 : currentCount / total;

    const strategy = chooseStrategy(currentCount, ratioOfMax, ratioOfTotal, opts);
    const reason = explainStrategy(strategy, className, currentCount, targetCount, opts);

    return {
      id: `balance-${slug(className)}`,
      className,
      currentCount,
      targetCount: strategy === "keep" ? undefined : targetCount,
      recommendedWeight: weights[className],
      samplingStrategy: strategy,
      reason,
      status: "proposed",
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Inverse-frequency class weights. The largest class gets weight 1.0;
 * smaller classes get weights >1, in line with how most ML libs expect
 * `class_weight` to be passed in. These weights are *training-time*
 * recommendations — they do not change the dataset itself.
 */
export function calculateClassWeights(distribution: ClassDistribution): Record<string, number> {
  const entries = Object.entries(distribution).filter(([name, n]) => name !== "Unlabeled" && n > 0);
  if (entries.length === 0) return {};

  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const numClasses = entries.length;

  const raw: Record<string, number> = {};
  for (const [name, count] of entries) {
    // Standard balanced-class formula: total / (numClasses * count)
    raw[name] = total / (numClasses * count);
  }

  const minRaw = Math.min(...Object.values(raw));
  const out: Record<string, number> = {};
  for (const [name, w] of Object.entries(raw)) {
    // Normalize so the largest class (smallest raw weight) lands at 1.0,
    // and rare classes get >1. Round to 2dp for stable display.
    out[name] = Math.round((w / minRaw) * 100) / 100;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Strategy selection
// ---------------------------------------------------------------------------

function chooseStrategy(
  currentCount: number,
  ratioOfMax: number,
  ratioOfTotal: number,
  opts: Required<BalancingPlanOptions>,
): SamplingStrategy {
  if (ratioOfTotal >= opts.dominantRatio) return "downsample";
  if (ratioOfMax >= opts.underrepresentedRatio) return "keep";
  if (currentCount < opts.minRealSamplesForUpsample) {
    return opts.allowGenerate ? "optional_generate" : "collect_more";
  }
  return "upsample";
}

function explainStrategy(
  strategy: SamplingStrategy,
  className: string,
  currentCount: number,
  targetCount: number,
  opts: Required<BalancingPlanOptions>,
): string {
  switch (strategy) {
    case "keep":
      return `${className} is within balance band (${currentCount} samples). No change recommended.`;
    case "downsample":
      return `${className} dominates the dataset (${currentCount} samples). Downsample toward ${targetCount} or apply a lower class weight at training time.`;
    case "upsample":
      return `${className} is underrepresented (${currentCount} samples). Apply an inverse-frequency class weight to lift its training signal toward parity with majority classes.`;
    case "collect_more":
      return `${className} has only ${currentCount} samples — below the ${opts.minRealSamplesForUpsample}-sample floor. Class weighting alone will overfit; collect more real images before training.`;
    case "optional_generate":
      return `${className} is severely underrepresented (${currentCount} samples). Optionally generate targeted synthetic samples — but flag them as synthetic in the manifest and prefer real collection when possible.`;
  }
}

/**
 * Choose a target count: the median of class counts, rounded up to the
 * nearest 10. Median (rather than max) avoids inflating the dataset toward
 * a single dominant class. Floor of 30 so target is never trivially small.
 */
function chooseTargetCount(counts: number[]): number {
  if (counts.length === 0) return 0;
  const sorted = [...counts].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  return Math.max(30, Math.ceil(median / 10) * 10);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
