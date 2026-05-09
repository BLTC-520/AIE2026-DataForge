export type StageStatus = "queued" | "running" | "complete" | "error" | "skipped" | "degraded";

export type PipelineStageId =
  | "normalize"
  | "evaluate"
  | "labelize"
  | "deduplicate"
  | "balance"
  | "repair"
  | "reevaluate"
  | "report"
  | "export";

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  status: StageStatus;
  progress?: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
};

export type SampleSource = "original" | "synthetic" | "external";

export type LabelStatus =
  | "unlabeled"
  | "suggested"
  | "newly_labeled"
  | "corrected"
  | "accepted"
  | "rejected"
  | "manual_review";

export type DuplicateStatus = "unique" | "suspected_duplicate" | "removed" | "kept" | "manual_review";

export type SamplingStrategy = "keep" | "downsample" | "upsample" | "collect_more" | "optional_generate";

export type ClassDistribution = Record<string, number>;

export type DatasetSample = {
  id: string;
  sampleKey: string;
  imageUrl?: string;
  source: SampleSource;
  provider?: string;
  prompt?: string;
  originalLabel?: string;
  currentLabel?: string;
  finalLabel?: string;
  labelStatus?: LabelStatus;
  labelConfidence?: number;
  labelReason?: string;
  qualityFlags?: string[];
  duplicateOf?: string;
  duplicateStatus?: DuplicateStatus;
  classWeight?: number;
  samplingStrategy?: SamplingStrategy;
  metadata?: Record<string, unknown>;
};

export type DatasetMetrics = {
  sampleCount: number;
  classCount: number;
  missingLabelCount: number;
  suspectedLabelIssueCount: number;
  duplicateIssueCount: number;
  removedDuplicateCount: number;
  newlyLabeledCount: number;
  correctedLabelCount: number;
  manualReviewCount: number;
  qualityScore?: number;
  balanceScore?: number;
  completenessScore?: number;
  consistencyScore?: number;
  classDistribution: ClassDistribution;
};

export type LabelIssueType = "missing_label" | "wrong_label" | "ambiguous" | "imbalance_related";

export type ReviewStatus = "open" | "accepted" | "rejected" | "manual_review";

export type LabelIssueSource = "adaption" | "gpt" | "deterministic" | "user";

export type LabelIssue = {
  id: string;
  sampleId?: string;
  sampleKey: string;
  issueType: LabelIssueType;
  currentLabel?: string;
  suggestedLabel?: string;
  confidence?: number;
  reason: string;
  status: ReviewStatus;
  source: LabelIssueSource;
  createdAt?: number;
  reviewedAt?: number;
};

export type DuplicateIssueSource = "adaption" | "perceptual_hash" | "file_hash" | "user";

export type DuplicateIssue = {
  id: string;
  sampleId?: string;
  sampleKey: string;
  duplicateOfSampleKey: string;
  similarityScore?: number;
  reason: string;
  status: "open" | "removed" | "kept" | "manual_review";
  source: DuplicateIssueSource;
  createdAt?: number;
  reviewedAt?: number;
};

export type LabelDecisionAction = {
  issueId: string;
  sampleId?: string;
  action: "accept" | "reject" | "manual_review" | "edit";
  finalLabel?: string;
  reviewer?: string;
  reviewedAt?: number;
};

export type BalancingPlan = {
  id: string;
  className: string;
  currentCount: number;
  targetCount?: number;
  recommendedWeight?: number;
  samplingStrategy: SamplingStrategy;
  reason: string;
  status: "proposed" | "accepted" | "rejected" | "applied";
  createdAt?: number;
  updatedAt?: number;
};

export type AdaptionEvaluationVersion = "baseline" | "labelized" | "balanced" | "augmented";

export type AdaptionEvaluationSnapshot = {
  id: string;
  version: AdaptionEvaluationVersion;
  provider: "adaption" | "demo-adaption" | string;
  qualityScore?: number;
  balanceScore?: number;
  completenessScore?: number;
  consistencyScore?: number;
  classDistribution: ClassDistribution;
  rawMetrics?: unknown;
  createdAt?: number;
};

export type PipelineEvent = {
  id: string;
  timestamp: number;
  level: "info" | "warning" | "error" | "success";
  eventName: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type QualityReportGap = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  measuredBy: "adaption" | "deterministic" | "gpt" | "demo";
  description: string;
  recommendedAction: string;
};

export type QualityReport = {
  id: string;
  summary: string;
  provider: "openai" | "demo-openai" | string;
  model: string;
  measuredMetrics: DatasetMetrics;
  baselineEvaluation?: AdaptionEvaluationSnapshot;
  finalEvaluation?: AdaptionEvaluationSnapshot;
  gaps: QualityReportGap[];
  biasFlags: string[];
  labelIssues: LabelIssue[];
  duplicateIssues: DuplicateIssue[];
  balancingPlan: BalancingPlan[];
  recommendedActions: string[];
  createdAt?: number;
};

export type ExportManifest = {
  product: "DataForge";
  datasetName: string;
  trainingIntent: string;
  generatedAt: string;
  samples: DatasetSample[];
  labelIssues: LabelIssue[];
  duplicateIssues: DuplicateIssue[];
  balancingPlan: BalancingPlan[];
  baselineEvaluation?: AdaptionEvaluationSnapshot;
  finalEvaluation?: AdaptionEvaluationSnapshot;
  qualityReport?: QualityReport;
  metadata?: Record<string, unknown>;
};
