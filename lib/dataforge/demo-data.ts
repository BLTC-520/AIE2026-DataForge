import type {
  AdaptionEvaluationSnapshot,
  BalancingPlan,
  ClassDistribution,
  DatasetMetrics,
  DatasetSample,
  DuplicateIssue,
  LabelIssue,
  PipelineStage,
  QualityReport,
} from "./types";

export const demoDatasetName = "animals10-training.zip";

export const demoTrainingIntent =
  "Train an Animals-10 image classifier across dogs, horses, elephants, butterflies, chickens, cats, cows, sheep, spiders, and squirrels.";

export const demoClassColors: Record<string, string> = {
  cane: "#54f0b4",
  cavallo: "#ffbc42",
  elefante: "#52d6ff",
  farfalla: "#ff5d7d",
  gallina: "#f2f0dc",
  gatto: "#af8cff",
  mucca: "#8fd17f",
  pecora: "#ffe2a8",
  ragno: "#f06c9b",
  scoiattolo: "#d99a52",
  Unlabeled: "#8a93a6",
};

export const demoOriginalDistribution: ClassDistribution = {
  cane: 100,
  cavallo: 90,
  elefante: 80,
  farfalla: 70,
  gallina: 60,
  gatto: 50,
  mucca: 40,
  pecora: 30,
  ragno: 25,
  scoiattolo: 20,
};

export const demoFinalDistribution: ClassDistribution = {
  cane: 100,
  cavallo: 100,
  elefante: 100,
  farfalla: 100,
  gallina: 100,
  gatto: 100,
  mucca: 100,
  pecora: 100,
  ragno: 100,
  scoiattolo: 100,
};

export const demoPipelineStages: PipelineStage[] = [
  { id: "normalize", label: "Normalize manifest", status: "queued", progress: 0 },
  { id: "evaluate", label: "Baseline evaluation", status: "queued", progress: 0 },
  { id: "labelize", label: "Vision audit / label issues", status: "queued", progress: 0 },
  { id: "deduplicate", label: "Duplicate detection", status: "queued", progress: 0 },
  { id: "balance", label: "Balancing plan", status: "queued", progress: 0 },
  { id: "repair", label: "Apply approved repairs", status: "queued", progress: 0 },
  { id: "reevaluate", label: "Re-evaluation", status: "queued", progress: 0 },
  { id: "report", label: "Report ready", status: "queued", progress: 0 },
  { id: "export", label: "Export", status: "queued", progress: 0 },
];

export const demoBaselineMetrics: DatasetMetrics = {
  sampleCount: 565,
  classCount: 10,
  missingLabelCount: 22,
  suspectedLabelIssueCount: 8,
  duplicateIssueCount: 7,
  removedDuplicateCount: 0,
  newlyLabeledCount: 0,
  correctedLabelCount: 0,
  manualReviewCount: 0,
  qualityScore: 62,
  balanceScore: 41,
  completenessScore: 74,
  consistencyScore: 82,
  classDistribution: demoOriginalDistribution,
};

export const demoFinalMetrics: DatasetMetrics = {
  sampleCount: 1000,
  classCount: 10,
  missingLabelCount: 3,
  suspectedLabelIssueCount: 1,
  duplicateIssueCount: 0,
  removedDuplicateCount: 7,
  newlyLabeledCount: 19,
  correctedLabelCount: 7,
  manualReviewCount: 4,
  qualityScore: 84,
  balanceScore: 78,
  completenessScore: 96,
  consistencyScore: 91,
  classDistribution: demoFinalDistribution,
};

export const demoBaselineEvaluation: AdaptionEvaluationSnapshot = {
  id: "eval-baseline-demo-animal-001",
  version: "baseline",
  provider: "demo-adaption",
  qualityScore: 62,
  balanceScore: 41,
  completenessScore: 74,
  consistencyScore: 82,
  classDistribution: demoOriginalDistribution,
  rawMetrics: {
    quality: {
      score_before: 62,
      grade_before: "C",
    },
    duplicate_issue_count: 7,
    missing_label_count: 22,
    suspected_label_issue_count: 8,
  },
  createdAt: 1_778_284_800_000,
};

export const demoFinalEvaluation: AdaptionEvaluationSnapshot = {
  id: "eval-balanced-demo-animal-001",
  version: "balanced",
  provider: "demo-adaption",
  qualityScore: 84,
  balanceScore: 78,
  completenessScore: 96,
  consistencyScore: 91,
  classDistribution: demoFinalDistribution,
  rawMetrics: {
    quality: {
      score_after: 84,
      grade_after: "B",
      improvement_percent: 35,
    },
    duplicate_issue_count: 0,
    missing_label_count: 3,
    suspected_label_issue_count: 1,
  },
  createdAt: 1_778_284_920_000,
};

export const demoBalancingPlan: BalancingPlan[] = Object.entries(demoOriginalDistribution).map(
  ([className, currentCount]) => {
    const targetCount = demoFinalDistribution[className] ?? currentCount;
    const generatedCount = Math.max(0, targetCount - currentCount);

    return {
      id: `balance-${className}`,
      className,
      currentCount,
      targetCount,
      recommendedWeight: Number((targetCount / Math.max(currentCount, 1)).toFixed(2)),
      samplingStrategy: generatedCount > 0 ? "optional_generate" as const : "keep" as const,
      reason: generatedCount > 0
        ? `recover ${generatedCount} cached Fal AI ${className} records so raw plus generated images total exactly ${targetCount}.`
        : `${className} already has ${currentCount} raw images, matching the 100-image cap.`,
      status: "proposed" as const,
    };
  },
);

export const demoLabelIssues: LabelIssue[] = [
  ...Array.from({ length: 22 }, (_, index) => {
    const sampleNumber = String(index + 1).padStart(3, "0");
    const suggestedLabel = index < 7 ? "ragno" : index < 14 ? "scoiattolo" : "pecora";
    return {
      id: `missing-label-${sampleNumber}`,
      sampleKey: `unlabeled-${sampleNumber}`,
      issueType: "missing_label" as const,
      suggestedLabel,
      confidence: index < 18 ? 0.86 : 0.64,
      reason: index < 18 ? `visual features match ${suggestedLabel} class.` : "low confidence because the frame is cropped or partly occluded.",
      status: index < 18 ? "open" as const : "manual_review" as const,
      source: "gpt" as const,
    };
  }),
  ...[
    ["wrong-label-001", "cane-006", "cane", "gatto", 0.94, "cat face and whiskers visible despite cane folder source."],
    ["wrong-label-002", "cane-017", "cane", "gatto", 0.91, "small indoor pet posture is more consistent with gatto imagery."],
    ["wrong-label-003", "cavallo-033", "cavallo", "mucca", 0.87, "body shape and pasture context indicate mucca rather than cavallo."],
    ["wrong-label-004", "farfalla-011", "farfalla", "gallina", 0.9, "feathered body and beak are visible, not butterfly wings."],
    ["wrong-label-005", "gallina-029", "gallina", "farfalla", 0.88, "wing pattern and flower context match farfalla class."],
    ["wrong-label-006", "gatto-044", "gatto", "cane", 0.84, "muzzle shape and outdoor leash context match cane."],
    ["wrong-label-007", "pecora-009", "pecora", "mucca", 0.72, "ambiguous livestock sample needs human confirmation."],
    ["wrong-label-008", "ragno-020", "ragno", "scoiattolo", 0.82, "fur texture and tree context match scoiattolo, not ragno."],
  ].map(([id, sampleKey, currentLabel, suggestedLabel, confidence, reason]) => ({
    id: id as string,
    sampleKey: sampleKey as string,
    issueType: "wrong_label" as const,
    currentLabel: currentLabel as string,
    suggestedLabel: suggestedLabel as string,
    confidence: confidence as number,
    reason: reason as string,
    status: "open" as const,
    source: "gpt" as const,
  })),
];

export const demoDuplicateIssues: DuplicateIssue[] = [
  ["duplicate-001", "cane-012", "cane-011", 0.99, "same resized source image detected by file hash."],
  ["duplicate-002", "cavallo-038", "cavallo-037", 0.96, "near-identical crop with matching background."],
  ["duplicate-003", "elefante-021", "elefante-020", 0.98, "same image appears in adjacent folder export."],
  ["duplicate-004", "farfalla-064", "farfalla-063", 0.95, "burst capture has no meaningful pose change."],
  ["duplicate-005", "gallina-018", "gallina-017", 0.94, "near-duplicate coop frame."],
  ["duplicate-006", "gatto-014", "gatto-013", 0.93, "near-duplicate indoor portrait."],
  ["duplicate-007", "mucca-008", "mucca-007", 0.95, "same pasture crop with minor compression difference."],
].map(([id, sampleKey, duplicateOfSampleKey, similarityScore, reason]) => ({
  id: id as string,
  sampleKey: sampleKey as string,
  duplicateOfSampleKey: duplicateOfSampleKey as string,
  similarityScore: similarityScore as number,
  reason: reason as string,
  status: "open" as const,
  source: similarityScore === 0.99 || similarityScore === 0.98 ? "file_hash" as const : "perceptual_hash" as const,
}));

export const demoSamples: DatasetSample[] = [
  ...makeSamples("cane", "cane", 100, ["dog portrait", "outdoor dog", "companion animal"]),
  ...makeSamples("cavallo", "cavallo", 90, ["horse profile", "pasture", "stable"]),
  ...makeSamples("elefante", "elefante", 80, ["elephant herd", "savanna", "close portrait"]),
  ...makeSamples("farfalla", "farfalla", 70, ["butterfly macro", "flower landing", "wing profile"]),
  ...makeSamples("gallina", "gallina", 60, ["chicken coop", "farm yard", "rooster profile"]),
  ...makeSamples("gatto", "gatto", 50, ["cat portrait", "indoor cat", "window light"]),
  ...makeSamples("mucca", "mucca", 40, ["cow pasture", "dairy barn", "field profile"]),
  ...makeSamples("pecora", "pecora", 30, ["sheep pasture", "wool closeup", "flock"]),
  ...makeSamples("ragno", "ragno", 25, ["spider macro", "web detail", "dark background"]),
  ...makeSamples("scoiattolo", "scoiattolo", 20, ["squirrel tree", "forest floor", "nut foraging"]),
  ...makeUnlabeledSamples(22),
].map(applySeededSampleIssues);

export const falSyntheticSamples: DatasetSample[] = makeFalSyntheticSamples(
  demoOriginalDistribution,
  Math.max(
    ...Object.entries(demoOriginalDistribution)
      .filter(([className]) => className !== "Unlabeled")
      .map(([, count]) => count),
  ),
);

export const demoQualityReport: QualityReport = {
  id: "quality-report-demo-animal-001",
  summary:
    "The baseline Animals-10 dataset is usable but not training-ready: missing labels, cross-class label mistakes, duplicate bursts, and severe class imbalance will bias a classifier before training starts.",
  provider: "demo-openai",
  model: "gpt-5.5-demo-fallback",
  measuredMetrics: demoBaselineMetrics,
  baselineEvaluation: demoBaselineEvaluation,
  finalEvaluation: demoFinalEvaluation,
  gaps: [
    {
      id: "gap-missing-labels",
      title: "22 samples are unlabeled",
      severity: "high",
      measuredBy: "deterministic",
      description: "unlabeled rows reduce completeness and block supervised training export.",
      recommendedAction: "approve high-confidence label completions and send low-confidence frames to manual review.",
    },
    {
      id: "gap-wrong-labels",
      title: "8 samples are likely mislabeled",
      severity: "high",
      measuredBy: "gpt",
      description: "cane, gatto, cavallo, mucca, farfalla, gallina, ragno, and scoiattolo examples are mixed across folder-derived labels.",
      recommendedAction: "preserve original labels and apply reviewer-approved final labels.",
    },
    {
      id: "gap-duplicates",
      title: "7 duplicate or near-duplicate images",
      severity: "medium",
      measuredBy: "deterministic",
      description: "duplicate bursts overrepresent common classes and can leak into evaluation splits.",
      recommendedAction: "exclude approved duplicates from the export manifest, not from source storage.",
    },
    {
      id: "gap-class-balance",
      title: "9 animal classes are below the 100-image cap",
      severity: "high",
      measuredBy: "adaption",
      description: "the unzipped source dataset has 100 cane images but only 20 scoiattolo, 25 ragno, and several other underfilled classes.",
      recommendedAction: "recover cached Fal AI additions only until each animal class totals exactly 100 images.",
    },
  ],
  biasFlags: [
    "cane dominates the raw source distribution.",
    "small-animal classes such as ragno and scoiattolo have weaker coverage.",
    "all synthetic additions must stay capped at 100 total images per animal.",
  ],
  labelIssues: demoLabelIssues,
  duplicateIssues: demoDuplicateIssues,
  balancingPlan: demoBalancingPlan,
  recommendedActions: [
    "approve high-confidence missing-label completions.",
    "correct obvious cross-class mislabels while preserving original-label provenance.",
    "remove approved duplicates from export only.",
    "recover cached Fal AI additions until every animal totals exactly 100 images.",
    "re-evaluate the labelized and deduplicated dataset before export.",
  ],
  createdAt: 1_778_284_860_000,
};

function makeSamples(prefix: string, label: string, count: number, scenarios: string[]): DatasetSample[] {
  return Array.from({ length: count }, (_, index) => {
    const sampleNumber = String(index + 1).padStart(3, "0");
    return {
      id: `${prefix}-${sampleNumber}`,
      sampleKey: `${prefix}-${sampleNumber}`,
      source: "original",
      originalLabel: label,
      currentLabel: label,
      finalLabel: label,
      labelStatus: "accepted",
      duplicateStatus: "unique",
      qualityFlags: [],
      metadata: {
        scenario: scenarios[index % scenarios.length],
      },
    };
  });
}

function makeUnlabeledSamples(count: number): DatasetSample[] {
  return Array.from({ length: count }, (_, index) => {
    const sampleNumber = String(index + 1).padStart(3, "0");
    return {
      id: `unlabeled-${sampleNumber}`,
      sampleKey: `unlabeled-${sampleNumber}`,
      source: "original",
      currentLabel: undefined,
      labelStatus: "unlabeled",
      duplicateStatus: "unique",
      qualityFlags: ["missing_label"],
      metadata: {
        scenario: index < 12 ? "missing Animals-10 folder label" : "unknown unzipped image label",
      },
    };
  });
}

function applySeededSampleIssues(sample: DatasetSample): DatasetSample {
  const labelIssue = demoLabelIssues.find((issue) => issue.sampleKey === sample.sampleKey);
  const duplicateIssue = demoDuplicateIssues.find((issue) => issue.sampleKey === sample.sampleKey);

  return {
    ...sample,
    finalLabel: labelIssue?.suggestedLabel ?? sample.finalLabel,
    labelConfidence: labelIssue?.confidence,
    labelReason: labelIssue?.reason,
    labelStatus: labelIssue
      ? labelIssue.issueType === "missing_label"
        ? "suggested"
        : "corrected"
      : sample.labelStatus,
    qualityFlags: [
      ...(sample.qualityFlags ?? []),
      ...(labelIssue ? [labelIssue.issueType] : []),
      ...(duplicateIssue ? ["duplicate"] : []),
    ],
    duplicateOf: duplicateIssue?.duplicateOfSampleKey,
    duplicateStatus: duplicateIssue ? "suspected_duplicate" : sample.duplicateStatus,
  };
}

function makeFalSyntheticSamples(distribution: ClassDistribution, targetCount: number): DatasetSample[] {
  return Object.entries(distribution)
    .filter(([className]) => className !== "Unlabeled")
    .flatMap(([className, currentCount]) => {
      const recoveredCount = Math.max(0, targetCount - currentCount);
      const prefix = `fal-${className.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

      return Array.from({ length: recoveredCount }, (_, index) => {
        const sampleNumber = String(index + 1).padStart(3, "0");
        return {
          id: `${prefix}-${sampleNumber}`,
          sampleKey: `${prefix}-${sampleNumber}`,
          source: "synthetic" as const,
          provider: "fal.ai",
          prompt: `photorealistic ${className.toLowerCase()} sample for bounded class balancing`,
          originalLabel: className,
          currentLabel: className,
          finalLabel: className,
          labelStatus: "accepted" as const,
          duplicateStatus: "unique" as const,
          samplingStrategy: "optional_generate" as const,
          qualityFlags: ["fal_synthetic", "bounded_balance_recovery"],
          metadata: {
            badge: "Fal AI",
            recoveredForBalance: true,
            maxClassCap: targetCount,
            currentClassCount: currentCount,
            recoveredIndex: index + 1,
          },
        } satisfies DatasetSample;
      });
    });
}
