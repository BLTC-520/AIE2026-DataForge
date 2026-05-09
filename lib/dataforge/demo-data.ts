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

export const demoDatasetName = "demo-animal-camera-traps.zip";

export const demoTrainingIntent =
  "Train an animal image classifier that works across common pets and wildlife, including low-light camera-trap photos.";

export const demoClassColors: Record<string, string> = {
  Cats: "#ffbc42",
  Dogs: "#54f0b4",
  Birds: "#52d6ff",
  Foxes: "#ff5d7d",
  Owls: "#af8cff",
  "Low-light Wildlife": "#f2f0dc",
  Unlabeled: "#8a93a6",
};

export const demoOriginalDistribution: ClassDistribution = {
  Cats: 90,
  Dogs: 80,
  Birds: 45,
  Foxes: 24,
  Owls: 18,
  "Low-light Wildlife": 6,
  Unlabeled: 22,
};

export const demoFinalDistribution: ClassDistribution = {
  Cats: 92,
  Dogs: 75,
  Birds: 48,
  Foxes: 28,
  Owls: 22,
  "Low-light Wildlife": 15,
};

export const demoPipelineStages: PipelineStage[] = [
  { id: "upload", label: "Upload", status: "queued", progress: 0 },
  { id: "evaluate", label: "Evaluate", status: "queued", progress: 0 },
  { id: "labelize", label: "Labelize", status: "queued", progress: 0 },
  { id: "deduplicate", label: "Deduplicate", status: "queued", progress: 0 },
  { id: "balance", label: "Balance", status: "queued", progress: 0 },
  { id: "reevaluate", label: "Re-evaluate", status: "queued", progress: 0 },
  { id: "export", label: "Export", status: "queued", progress: 0 },
];

export const demoBaselineMetrics: DatasetMetrics = {
  sampleCount: 285,
  classCount: 6,
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
  sampleCount: 278,
  classCount: 6,
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

export const demoBalancingPlan: BalancingPlan[] = [
  {
    id: "balance-cats",
    className: "Cats",
    currentCount: 92,
    targetCount: 90,
    recommendedWeight: 0.65,
    samplingStrategy: "keep",
    reason: "majority class is healthy; keep samples and lower weight during training.",
    status: "proposed",
  },
  {
    id: "balance-dogs",
    className: "Dogs",
    currentCount: 75,
    targetCount: 80,
    recommendedWeight: 0.8,
    samplingStrategy: "keep",
    reason: "dog count remains close to the target after relabeling cat mistakes out of the class.",
    status: "proposed",
  },
  {
    id: "balance-foxes",
    className: "Foxes",
    currentCount: 28,
    targetCount: 60,
    recommendedWeight: 1.85,
    samplingStrategy: "collect_more",
    reason: "foxes remain underrepresented after label repair and need more real collection.",
    status: "proposed",
  },
  {
    id: "balance-owls",
    className: "Owls",
    currentCount: 22,
    targetCount: 50,
    recommendedWeight: 2.1,
    samplingStrategy: "optional_generate",
    reason: "owl coverage is sparse; optional generated previews can demonstrate the gap without pretending they are real samples.",
    status: "proposed",
  },
  {
    id: "balance-low-light-wildlife",
    className: "Low-light Wildlife",
    currentCount: 15,
    targetCount: 35,
    recommendedWeight: 2.4,
    samplingStrategy: "collect_more",
    reason: "low-light camera-trap scenarios are the main training-intent coverage gap.",
    status: "proposed",
  },
];

export const demoLabelIssues: LabelIssue[] = [
  ...Array.from({ length: 22 }, (_, index) => {
    const sampleNumber = String(index + 1).padStart(3, "0");
    const suggestedLabel = index < 7 ? "Owls" : index < 14 ? "Foxes" : "Low-light Wildlife";
    return {
      id: `missing-label-${sampleNumber}`,
      sampleKey: `unlabeled-${sampleNumber}`,
      issueType: "missing_label" as const,
      suggestedLabel,
      confidence: index < 18 ? 0.86 : 0.64,
      reason: index < 18 ? `visual features match ${suggestedLabel.toLowerCase()} class.` : "low confidence because the frame is dark or partly occluded.",
      status: index < 18 ? "open" as const : "manual_review" as const,
      source: "gpt" as const,
    };
  }),
  ...[
    ["wrong-label-001", "dog-006", "Dogs", "Cats", 0.94, "cat face and whiskers visible despite dog-folder source."],
    ["wrong-label-002", "dog-017", "Dogs", "Cats", 0.91, "small indoor pet posture is more consistent with cat imagery."],
    ["wrong-label-003", "dog-033", "Dogs", "Foxes", 0.87, "pointed ears and woodland background indicate fox."],
    ["wrong-label-004", "bird-011", "Birds", "Owls", 0.9, "round facial disk suggests owl rather than generic bird."],
    ["wrong-label-005", "bird-029", "Birds", "Owls", 0.88, "perched nocturnal raptor features match owl class."],
    ["wrong-label-006", "cat-044", "Cats", "Dogs", 0.84, "muzzle shape and outdoor leash context match dog."],
    ["wrong-label-007", "fox-009", "Foxes", "Dogs", 0.72, "ambiguous canid sample needs human confirmation."],
    ["wrong-label-008", "dog-052", "Dogs", "Foxes", 0.82, "orange coat and forest edge match fox class."],
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
  ["duplicate-001", "cat-012", "cat-011", 0.99, "same resized source image detected by file hash."],
  ["duplicate-002", "cat-038", "cat-037", 0.96, "near-identical crop with matching background."],
  ["duplicate-003", "dog-021", "dog-020", 0.98, "same image appears in adjacent folder export."],
  ["duplicate-004", "dog-064", "dog-063", 0.95, "burst capture has no meaningful pose change."],
  ["duplicate-005", "bird-018", "bird-017", 0.94, "near-duplicate feeder frame."],
  ["duplicate-006", "fox-014", "fox-013", 0.93, "near-duplicate woodland edge frame."],
  ["duplicate-007", "owl-008", "owl-007", 0.95, "same perch and crop with minor compression difference."],
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
  ...makeSamples("cat", "Cats", 90, ["indoor daylight", "window light", "sofa portrait"]),
  ...makeSamples("dog", "Dogs", 80, ["park daylight", "street walk", "yard profile"]),
  ...makeSamples("bird", "Birds", 45, ["branch daylight", "sky profile", "feeder closeup"]),
  ...makeSamples("fox", "Foxes", 24, ["woodland edge", "field daylight"]),
  ...makeSamples("owl", "Owls", 18, ["perched daylight", "tree hollow"]),
  ...makeSamples("low-light", "Low-light Wildlife", 6, ["dim trail camera"]),
  ...makeUnlabeledSamples(22),
].map(applySeededSampleIssues);

export const demoQualityReport: QualityReport = {
  id: "quality-report-demo-animal-001",
  summary:
    "The baseline dataset is usable but not training-ready: missing labels, cat/dog/fox/owl label mistakes, duplicate bursts, and low-light wildlife gaps will bias a classifier before training starts.",
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
      description: "cat, dog, fox, and owl examples are mixed across folder-derived labels.",
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
      id: "gap-low-light",
      title: "low-light wildlife is underrepresented",
      severity: "high",
      measuredBy: "adaption",
      description: "the training intent mentions camera-trap photos, but baseline coverage has only 6 low-light records.",
      recommendedAction: "use class weights now and collect or optionally generate reviewed low-light additions later.",
    },
  ],
  biasFlags: [
    "majority pet classes dominate the source distribution.",
    "wildlife classes have weaker scenario coverage than cats and dogs.",
    "low-light records are too rare for the stated training intent.",
  ],
  labelIssues: demoLabelIssues,
  duplicateIssues: demoDuplicateIssues,
  balancingPlan: demoBalancingPlan,
  recommendedActions: [
    "approve high-confidence missing-label completions.",
    "correct obvious cat/dog/fox/owl mislabels while preserving original-label provenance.",
    "remove approved duplicates from export only.",
    "apply class weights for foxes, owls, and low-light wildlife.",
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
        scenario: index < 12 ? "unlabeled wildlife folder" : "unknown camera-trap frame",
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
