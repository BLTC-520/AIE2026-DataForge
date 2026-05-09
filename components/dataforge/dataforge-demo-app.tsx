"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
// Convex Document IDs: https://docs.convex.dev/using/document-ids
import type { Id } from "../../convex/_generated/dataModel";
import {
  demoBalancingPlan,
  demoBaselineEvaluation,
  demoDuplicateIssues,
  demoFinalEvaluation,
  demoLabelIssues,
  demoQualityReport,
  demoSamples,
} from "../../lib/dataforge/demo-data";
import type {
  AdaptionEvaluationSnapshot as DataForgeEvaluationSnapshot,
  BalancingPlan as DataForgeBalancingPlan,
  ClassDistribution,
  DatasetMetrics as DataForgeDatasetMetrics,
  DatasetSample as DataForgeDatasetSample,
  DuplicateIssue as DataForgeDuplicateIssue,
  LabelDecisionAction,
  LabelIssue as DataForgeLabelIssue,
  QualityReport as DataForgeQualityReport,
} from "../../lib/dataforge/types";
// Brian Phase 2 — real components (B2.1). Bazel's components are default-exports;
// Joseph's are named exports. Helpers are pure and live-derive from local state.
import LabelAuditPanel from "./label-audit-panel";
import DuplicateReviewPanel from "./duplicate-review-panel";
import DatasetExplorer from "./dataset-explorer";
import { QualityReportPanel } from "./quality-report-panel";
import { DistributionChart } from "./distribution-chart";
import { BalancingPanel } from "./balancing-panel";
import { ExportManifestButton } from "./export-manifest-button";
import { applyLabelDecisions } from "../../lib/dataforge/label-audit";
import { applyDuplicateDecisions, type DuplicateDecisionAction } from "../../lib/dataforge/duplicates";
import { calculateDatasetMetrics } from "../../lib/dataforge/metrics";
import { createBalancingPlan } from "../../lib/dataforge/balancing";
import { DatasetUploader } from "./dataset-uploader";
import {
  revokeUploadedDataset,
  type UploadedDataset,
} from "../../lib/dataforge/zip-upload";

type StageStatus = "queued" | "running" | "complete" | "error";
type SourceType = "original" | "synthetic";
type ReportSource = "convex" | "local-fallback";

type Sample = {
  id: string;
  className: string;
  source: SourceType;
  scenario: string;
  status: string;
  imageUrl?: string;
};

type FalGeneratedJob = {
  className: string;
  prompt: string;
  requestedCount: number;
  generatedCount: number;
  images: Array<{ url: string; width?: number; height?: number; contentType?: string }>;
};

type FalGenerationResponse = {
  provider: "fal";
  model: string;
  datasetName: string;
  perJobCap: number;
  totalImages: number;
  jobs: FalGeneratedJob[];
};

type Metrics = {
  quality: number;
  balance: number;
  coverage: number;
  consistency: number;
  synthetic?: number;
};

type EventRecord = {
  id: number;
  name: string;
  message: string;
  time: string;
};

type MappedDashboardEvent = EventRecord & {
  _sortTime: number;
};

type PersistedGapJobType = "generate" | "relabel";

type PersistedGapJob = {
  type?: PersistedGapJobType;
  className?: string;
  scenario?: string;
  currentCount?: number;
  targetCount?: number;
  syntheticCount?: number;
  severity?: "low" | "medium" | "high";
  accent?: string;
  prompt?: string;
  status?: "proposed" | "approved" | "running" | "complete" | "error" | "rejected";
  falJobId?: string;
  imagesGenerated?: number;
  sampleId?: string;
  fromClassName?: string;
  toClassName?: string;
  confidence?: number;
  reasoning?: string;
  decision?: "pending" | "accepted" | "rejected" | "applied" | "requires_review";
};

type PersistedRelabelJob = PersistedGapJob & {
  type: "relabel";
  sampleId: string;
  fromClassName: string;
  toClassName: string;
  reviewedAt?: number;
  reviewer?: string;
};

type RelabelJob = {
  id: string;
  sampleId: string;
  fromClassName: string;
  toClassName: string;
  status: "proposed" | "approved" | "running" | "complete" | "error" | "rejected";
  confidence?: number;
  reasoning?: string;
  decision?: "pending" | "accepted" | "rejected" | "applied" | "requires_review";
  reviewedAt?: number;
  reviewer?: string;
};

type FalJobRun = {
  runId: string;
  jobId?: string;
  provider: string;
  providerRunId?: string;
  status: "queued" | "running" | "complete" | "error";
  requestedPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string;
  imageCount?: number;
  updatedRecords?: number;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
};

type FalJobSummary = {
  totalRuns: number;
  queued: number;
  running: number;
  complete: number;
  error: number;
  generatedSamples: number;
  failedJobs: number;
  latestError?: string;
};

type GapJob = {
  className: string;
  currentCount: number;
  targetCount: number;
  syntheticCount: number;
  severity: "low" | "medium" | "high";
  accent: string;
  prompt: string;
};

type ReportMode = "baseline" | "measured" | "inferred" | "complete";

type MiniSampleStyle = CSSProperties & {
  "--accent": string;
};

type QualityReport = {
  provider: "openai" | "demo-openai";
  model: string;
  responseId?: string;
  fallbackReason?: string;
  measuredFindings: string[];
  repairPlan: string[];
  completionSummary: string[];
  nextSteps: string[];
  gapJobs: GapJob[];
};

type DatasetStatus =
  | "uploaded"
  | "analyzing"
  | "evaluated"
  | "label_review"
  | "analysis_ready"
  | "balancing"
  | "reevaluating"
  | "complete"
  | "error";

const stages = [
  { id: "upload", label: "Upload", icon: "01" },
  { id: "evaluate", label: "Evaluate", icon: "02" },
  { id: "analyze", label: "Analyze Gaps", icon: "03" },
  { id: "generate", label: "Generate Synthetic Data", icon: "04" },
  { id: "reevaluate", label: "Re-evaluate", icon: "05" },
  { id: "export", label: "Export", icon: "06" },
] as const;

type StageId = (typeof stages)[number]["id"];

const classColors: Record<string, string> = {
  Cats: "#ffbc42",
  Dogs: "#54f0b4",
  Birds: "#52d6ff",
  Foxes: "#ff5d7d",
  Owls: "#af8cff",
  "Low-light Wildlife": "#f2f0dc",
};

// Fallback palette for uploaded datasets whose class names aren't in the
// demo's color map. Picked to be visually distinct on the dark theme.
const UPLOAD_PALETTE: readonly string[] = [
  "#52d6ff",
  "#ffbc42",
  "#54f0b4",
  "#ff5d7d",
  "#af8cff",
  "#f2f0dc",
  "#9adcff",
  "#ffb3ff",
  "#ffd966",
  "#a0d8b3",
];

const originalDistribution: Record<string, number> = {
  Cats: 120,
  Dogs: 100,
  Birds: 70,
  Foxes: 15,
  Owls: 10,
  "Low-light Wildlife": 3,
};

const baselineMetrics: Metrics = {
  quality: 62,
  balance: 41,
  coverage: 35,
  consistency: 88,
};

const augmentedMetrics: Metrics = {
  quality: 84,
  balance: 78,
  coverage: 81,
  consistency: 90,
};

const fallbackGapJobs: GapJob[] = [
  {
    className: "Foxes",
    currentCount: 15,
    targetCount: 60,
    syntheticCount: 45,
    severity: "high",
    accent: "#ff5d7d",
    prompt:
      "Photorealistic foxes in mixed woodland and suburban edges, varied poses, clean labels, no text, no watermark.",
  },
  {
    className: "Owls",
    currentCount: 10,
    targetCount: 50,
    syntheticCount: 40,
    severity: "high",
    accent: "#af8cff",
    prompt:
      "Owls perched and in flight across natural backgrounds, side and frontal angles, realistic feather detail, no overlays.",
  },
  {
    className: "Low-light Wildlife",
    currentCount: 3,
    targetCount: 33,
    syntheticCount: 30,
    severity: "high",
    accent: "#f2f0dc",
    prompt:
      "Low-light camera-trap wildlife photos with infrared glare, motion blur, night foliage, plausible animal framing.",
  },
];

const fallbackMeasuredCopy: Record<ReportMode, string[]> = {
  baseline: ["Load the demo dataset to create a baseline snapshot."],
  measured: [
    "Class distribution is skewed: cats 120, dogs 100, foxes 15, owls 10.",
    "Coverage score is 35 because low-light wildlife records are almost absent.",
    "Consistency remains strong at 88, so repair should focus on coverage rather than relabeling.",
  ],
  inferred: [
    "Class distribution is skewed: cats 120, dogs 100, foxes 15, owls 10.",
    "Coverage score is 35 because low-light wildlife records are almost absent.",
    "Consistency remains strong at 88, so repair should focus on coverage rather than relabeling.",
  ],
  complete: [
    "Post-repair quality increased to 84 after targeted synthetic records were added.",
    "Balance improved to 78 with foxes and owls lifted near the minimum target count.",
    "Coverage improved to 81 after adding low-light camera-trap scenarios.",
  ],
};

const fallbackInferredCopy: Record<ReportMode, string[]> = {
  baseline: ["The repair plan will target underrepresented wildlife and missing night scenes."],
  measured: [
    "Foxes and owls should be prioritized before generating more common pet images.",
    "Synthetic data should be tied to measured class gaps, not broad aesthetic variation.",
    "Night scenes need camera-trap artifacts so the dataset matches the training intent.",
  ],
  inferred: [
    "Generate 45 fox records across woodland and suburban edge conditions.",
    "Generate 40 owl records with perched, flight, frontal, and side-angle compositions.",
    "Generate 30 low-light wildlife records with infrared glare and plausible motion blur.",
  ],
  complete: [
    "Keep synthetic records flagged in the manifest for downstream filtering.",
    "Review remaining pet-to-wildlife imbalance before a larger training run.",
    "Export the augmented dataset with both evaluation snapshots as proof of improvement.",
  ],
};

const noPersistedQualityCopy: Record<ReportMode, string[]> = {
  baseline: ["Load the demo dataset and run analysis to generate a measured baseline report."],
  measured: ["No measured findings have been persisted yet for the active dataset."],
  inferred: ["No quality report has been generated for this dataset yet."],
  complete: ["No completion summary is available yet. Run analysis to end-to-end evaluate repair effects."],
};

// Idle-state copy: used when the integration band's QualityReportPanel is
// rendered before any dataset has been loaded. No demo data leaks through.
const idleQualityCopy: Record<ReportMode, string[]> = {
  baseline: ["Drop a ZIP to begin."],
  measured: ["Awaiting a dataset. The GPT evaluator has not been called."],
  inferred: ["The repair plan will be generated by GPT once the dataset is analyzed."],
  complete: ["Run analysis to compare baseline vs cleaned manifest."],
};

// Empty canonical-shape quality report rendered when no dataset has been
// loaded. The panel renders gracefully on this — every score row shows "—",
// gap/biasFlag/recommendedAction lists collapse to empty.
const EMPTY_QUALITY_REPORT: DataForgeQualityReport = {
  id: "empty-quality-report",
  summary: "No dataset loaded. Drop a ZIP to begin.",
  provider: "demo-openai",
  model: "idle",
  measuredMetrics: {
    sampleCount: 0,
    classCount: 0,
    missingLabelCount: 0,
    suspectedLabelIssueCount: 0,
    duplicateIssueCount: 0,
    removedDuplicateCount: 0,
    newlyLabeledCount: 0,
    correctedLabelCount: 0,
    manualReviewCount: 0,
    classDistribution: {},
  },
  gaps: [],
  biasFlags: [],
  labelIssues: [],
  duplicateIssues: [],
  balancingPlan: [],
  recommendedActions: [],
};

const originalSamples = buildOriginalSamples();

export function DataForgeDemoApp() {
  const [trainingIntent, setTrainingIntent] = useState(
    "Train an animal image classifier that works across common pets and wildlife, including low-light camera-trap photos.",
  );
  const [activeDatasetId, setActiveDatasetId] = useState<Id<"datasets"> | null>(null);
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(
    makeQueuedStages(),
  );
  const [samples, setSamples] = useState<Sample[]>([]);
  const [visibleSynthetic, setVisibleSynthetic] = useState<Sample[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("baseline");
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [qualityReportSource, setQualityReportSource] = useState<ReportSource>("local-fallback");
  const [qualityReportHasData, setQualityReportHasData] = useState(false);
  const [relabelJobs, setRelabelJobs] = useState<RelabelJob[]>([]);
  const [falJobRuns, setFalJobRuns] = useState<FalJobRun[]>([]);
  const [convexUnavailable, setConvexUnavailable] = useState(false);
  const [classFilter, setClassFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceType>("all");

  // ── Brian Phase 2 (B2.3 / B2.4) ────────────────────────────────────────────
  // Local approval state for the canonical label/duplicate review flow. The
  // canonical pipeline (Upload → Evaluate → Labelize → Deduplicate → Balance →
  // Re-evaluate → Export) is driven by these decisions; downstream metrics,
  // balancing, and Adaption's "final" evaluation read from the result of
  // applyLabelDecisions(...) → applyDuplicateDecisions(...). Decisions are
  // intentionally NOT auto-applied on page load.
  const [labelDecisions, setLabelDecisions] = useState<LabelDecisionAction[]>([]);
  const [duplicateDecisions, setDuplicateDecisions] = useState<DuplicateDecisionAction[]>([]);
  const [labelizationApproved, setLabelizationApproved] = useState(false);

  // Real-ZIP upload (replaces the seeded dataset when set). The lib parses
  // the ZIP, infers labels from per-class folder names, and runs SHA-1
  // duplicate detection. The live derivation chain below reads from
  // uploadedDataset when present, otherwise it falls back to the demo seed.
  const [uploadedDataset, setUploadedDataset] = useState<UploadedDataset | null>(null);

  // Monotonic counter for synthetic sample IDs. State updates are async,
  // so reading uploadedDataset.samples.length between consecutive ingest
  // calls in the balancing loop returned stale values and produced
  // duplicate syn-NNNN keys (React warning). A ref bumps reliably across
  // the full pipeline run.
  const syntheticCounterRef = useRef(0);

  // Pipeline error surface. When any stage's real work fails (missing API
  // key, provider 5xx, schema mismatch, etc.) the cockpit freezes at the
  // erroring stage and the banner displays this message. There is no
  // silent fallback to demo data on the analyze path.
  const [pipelineError, setPipelineError] = useState<{
    stage: StageId;
    message: string;
    hint?: string;
  } | null>(null);

  // Snapshots returned by /api/adaption-evaluate. These drive the metric
  // tiles and the QualityReportPanel — Local fallback is removed; if these
  // are null when the pipeline says "complete", that's a bug surfaced
  // explicitly via pipelineError above.
  const [adaptionBaseline, setAdaptionBaseline] = useState<DataForgeEvaluationSnapshot | null>(null);
  const [adaptionFinal, setAdaptionFinal] = useState<DataForgeEvaluationSnapshot | null>(null);

  const createDemoDataset = useMutation(api.datasets.createDemoDataset);
  const setDatasetStatus = useMutation(api.datasets.setDatasetStatus);
  const setStageStatus = useMutation(api.datasets.setStageStatus);
  const appendEvent = useMutation(api.datasets.appendEvent);
  const saveBaselineSnapshot = useMutation(api.datasets.saveBaselineSnapshot);
  const saveAugmentedSnapshot = useMutation(api.datasets.saveAugmentedSnapshot);
  const saveQualityReport = useMutation(api.datasets.saveQualityReport);
  const saveGapJobs = useMutation(api.datasets.saveGapJobs);
  const addSamples = useMutation(api.datasets.addSamples);

  const dashboardState = useQuery(
    api.datasets.getDashboardState,
    activeDatasetId ? { datasetId: activeDatasetId } : "skip",
  );

  const convexDistribution = useMemo(
    () => dashboardState?.dataset?.classDistribution ?? originalDistribution,
    [dashboardState],
  );
  const isConvexMode = Boolean(activeDatasetId && dashboardState?.dataset);
  const activeDistribution = useMemo(() => {
    if (uploadedDataset) return uploadedDataset.classDistribution;
    if (isConvexMode) return convexDistribution;
    if (datasetLoaded) return originalDistribution;
    // Idle: empty so the distribution chart renders its own empty state
    // ("Load a dataset to populate distribution.") instead of seeded demo
    // numbers (Cats 120, Dogs 100, Birds 70, …) that aren't yours.
    return {};
  }, [uploadedDataset, convexDistribution, isConvexMode, datasetLoaded]);

  useEffect(() => {
    if (!activeDatasetId) {
      setConvexUnavailable(false);
      return;
    }

    if (!dashboardState) {
      const timer = window.setTimeout(() => setConvexUnavailable(true), 1200);
      return () => {
        window.clearTimeout(timer);
      };
    }

    if (!dashboardState.dataset) {
      return;
    }

    const hydratedSamples = dashboardState.samples.map(mapDashboardSample);
    const hydratedSyntheticSamples = hydratedSamples.filter((sample) => sample.source === "synthetic");

    setDatasetLoaded(true);
    setSamples(hydratedSamples);
    setVisibleSynthetic(hydratedSyntheticSamples);
    setStageStatuses(dashboardState.stageStatuses);
    setMetrics(resolveDashboardMetrics(dashboardState.dataset.status, dashboardState.baselineSnapshot, dashboardState.augmentedSnapshot));
    const mappedQuality = mapDashboardQualityReport(dashboardState.qualityReport, dashboardState.gapJobs);
    setQualityReport(mappedQuality.report);
    setQualityReportSource("convex");
    setQualityReportHasData(mappedQuality.hasData);
    setRelabelJobs(normalizeRelabelJobs(dashboardState.gapJobs));
    setFalJobRuns(normalizeFalJobRuns(dashboardState.falJobRuns));
    setEvents(mapDashboardEvents(dashboardState.events));
    setReportMode(deriveReportModeFromStatus(dashboardState.dataset.status, mappedQuality.report));
    setAnalysisRunning(dashboardState.isPipelineActive);
    setAnalysisComplete(dashboardState.dataset.status === "complete");
    setConvexUnavailable(false);
  }, [activeDatasetId, dashboardState]);

  const systemTone = analysisRunning ? "running" : analysisComplete ? "complete" : datasetLoaded ? "idle" : "idle";
  const systemLabel = analysisRunning ? "Running" : analysisComplete ? "Complete" : datasetLoaded ? "Dataset loaded" : "Idle";

  const isConvexReport = qualityReportSource === "convex";
  // For uploaded data we never synthesize fox/owl/low-light gap jobs from
  // the demo fixtures — the upload path has no synthetic generation lane.
  const currentGapJobs = uploadedDataset
    ? []
    : qualityReport
      ? isConvexReport
        ? qualityReport.gapJobs
        : qualityReport.gapJobs.length
          ? qualityReport.gapJobs
          : fallbackGapJobs
      : [];
  const missingPersistedReport = isConvexReport && !qualityReportHasData;
  const uploadActive = Boolean(uploadedDataset);
  const measuredReportItems = makeMeasuredReportItems(qualityReport, missingPersistedReport, uploadActive, datasetLoaded);
  const inferredReportItems = makeInferredReportItems(qualityReport, missingPersistedReport, uploadActive, datasetLoaded);
  // currentAugmentedDistribution is declared LATER, after liveFinalMetrics
  // is in scope. Placeholder reference removed to avoid use-before-declaration.

  const activeJobs = useMemo(
    () =>
      currentGapJobs.filter((job) =>
        visibleSynthetic.some((sample) => sample.className === job.className),
      ),
    [currentGapJobs, visibleSynthetic],
  );

  const filteredSamples = useMemo(() => {
    return samples
      .filter((sample) => classFilter === "all" || sample.className === classFilter)
      .filter((sample) => sourceFilter === "all" || sample.source === sourceFilter)
      .slice(0, 32);
  }, [classFilter, samples, sourceFilter]);

  const falSummary = useMemo(() => summarizeFalRuns(falJobRuns), [falJobRuns]);

  // ── Brian Phase 2 (B2.3 / B2.4) ────────────────────────────────────────────
  // Live derivation: labelize first, then deduplicate, then compute Joseph's
  // metrics + balancing plan + final evaluation snapshot from the cleaned data.
  // The Adaption "final" evaluation receives the labelized AND deduplicated
  // manifest, never the stale originals.

  // Source of truth for the live pipeline. Three states:
  //   - Upload active           → real uploaded data
  //   - Demo button clicked     → seeded demo fixtures
  //   - Idle (page just loaded) → EMPTY arrays so the integration-band
  //                                panels render their empty states instead
  //                                of demo placeholders.
  const activeSamples = useMemo<DataForgeDatasetSample[]>(() => {
    if (uploadedDataset) return uploadedDataset.samples;
    if (datasetLoaded) return demoSamples;
    return [];
  }, [uploadedDataset, datasetLoaded]);

  const activeLabelIssues = useMemo<DataForgeLabelIssue[]>(() => {
    if (uploadedDataset) return uploadedDataset.labelIssues;
    if (datasetLoaded) return demoLabelIssues;
    return [];
  }, [uploadedDataset, datasetLoaded]);

  const activeDuplicateIssues = useMemo<DataForgeDuplicateIssue[]>(() => {
    if (uploadedDataset) return uploadedDataset.duplicateIssues;
    if (datasetLoaded) return demoDuplicateIssues;
    return [];
  }, [uploadedDataset, datasetLoaded]);

  const labelizedSamples = useMemo(
    () => applyLabelDecisions(activeSamples, labelDecisions),
    [activeSamples, labelDecisions],
  );

  const cleanSamples = useMemo(
    () => applyDuplicateDecisions(labelizedSamples, duplicateDecisions),
    [labelizedSamples, duplicateDecisions],
  );

  const effectiveLabelIssues = useMemo<DataForgeLabelIssue[]>(() => {
    if (labelDecisions.length === 0) return activeLabelIssues;
    const decisionByIssue = new Map(labelDecisions.map((d) => [d.issueId, d] as const));
    return activeLabelIssues.map((issue) => {
      const decision = decisionByIssue.get(issue.id);
      if (!decision) return issue;
      const status: DataForgeLabelIssue["status"] =
        decision.action === "manual_review"
          ? "manual_review"
          : decision.action === "reject"
            ? "rejected"
            : "accepted";
      return { ...issue, status, reviewedAt: decision.reviewedAt };
    });
  }, [activeLabelIssues, labelDecisions]);

  const effectiveDuplicateIssues = useMemo<DataForgeDuplicateIssue[]>(() => {
    if (duplicateDecisions.length === 0) return activeDuplicateIssues;
    const decisionByIssue = new Map(duplicateDecisions.map((d) => [d.issueId, d] as const));
    return activeDuplicateIssues.map((issue) => {
      const decision = decisionByIssue.get(issue.id);
      if (!decision) return issue;
      const status: DataForgeDuplicateIssue["status"] =
        decision.action === "manual_review"
          ? "manual_review"
          : decision.action === "remove"
            ? "removed"
            : "kept";
      return { ...issue, status, reviewedAt: decision.reviewedAt };
    });
  }, [activeDuplicateIssues, duplicateDecisions]);

  const liveBaselineMetrics = useMemo(
    () => calculateDatasetMetrics(activeSamples, activeLabelIssues, activeDuplicateIssues),
    [activeSamples, activeLabelIssues, activeDuplicateIssues],
  );

  const liveFinalMetrics = useMemo(
    () => calculateDatasetMetrics(cleanSamples, effectiveLabelIssues, effectiveDuplicateIssues),
    [cleanSamples, effectiveLabelIssues, effectiveDuplicateIssues],
  );

  // After-state distribution for the chart and exports. Uploads: the
  // labelized + deduped distribution. Demo: the seeded gap-jobs synthesis.
  const currentAugmentedDistribution = useMemo(() => {
    if (uploadedDataset) return liveFinalMetrics.classDistribution;
    if (datasetLoaded) return buildAugmentedDistribution(convexDistribution, currentGapJobs);
    return {};
  }, [uploadedDataset, liveFinalMetrics, convexDistribution, currentGapJobs, datasetLoaded]);

  // Balancing plan is generated AFTER labelization is approved. Until then
  // it's empty — no seeded class-weight / sampling-recommendation placeholders.
  const liveBalancingPlan = useMemo<DataForgeBalancingPlan[]>(
    () => (labelizationApproved ? createBalancingPlan(cleanSamples) : []),
    [labelizationApproved, cleanSamples],
  );

  // Adaption "final" snapshot for the demo path — same shape as the seeded
  // snapshot, but with the recomputed class distribution from cleaned
  // samples. Only used when no upload is active; uploads bypass this and
  // build a pure-Local snapshot via activeFinalEvaluation below.
  const liveFinalEvaluation = useMemo<DataForgeEvaluationSnapshot>(
    () => ({
      ...demoFinalEvaluation,
      classDistribution: liveFinalMetrics.classDistribution,
      balanceScore: liveFinalMetrics.balanceScore ?? demoFinalEvaluation.balanceScore,
      completenessScore: liveFinalMetrics.completenessScore ?? demoFinalEvaluation.completenessScore,
    }),
    [liveFinalMetrics],
  );

  // ── Demo-leak protection ────────────────────────────────────────────────
  // When an upload is active, every "active*" view of evaluations, quality
  // report, colors, and distribution is computed from real data. Demo
  // fixtures are only used when uploadedDataset is null.

  // For uploads, the active snapshot comes from a real Adaption call. If
  // that call hasn't run yet (or failed), the snapshot is null and the UI
  // shows "—" with an error badge — no local fallback. The empty fallback
  // shape below is only used to keep render types non-null when the panel
  // is mounted before analyze runs; the actual scores are undefined.
  const emptyAdaptionShape = useMemo<DataForgeEvaluationSnapshot>(
    () => ({
      id: "eval-pending",
      version: "baseline",
      provider: "adaption",
      qualityScore: undefined,
      balanceScore: undefined,
      completenessScore: undefined,
      consistencyScore: undefined,
      classDistribution: uploadedDataset?.classDistribution ?? {},
      rawMetrics: { pending: true },
    }),
    [uploadedDataset],
  );

  const activeBaselineEvaluation = useMemo<DataForgeEvaluationSnapshot>(() => {
    if (!datasetLoaded) return emptyAdaptionShape;
    if (!uploadedDataset) return demoBaselineEvaluation;
    return adaptionBaseline ?? emptyAdaptionShape;
  }, [datasetLoaded, uploadedDataset, adaptionBaseline, emptyAdaptionShape]);

  const activeFinalEvaluation = useMemo<DataForgeEvaluationSnapshot>(() => {
    if (!datasetLoaded) return { ...emptyAdaptionShape, version: "balanced" };
    if (!uploadedDataset) return liveFinalEvaluation;
    return adaptionFinal ?? { ...emptyAdaptionShape, version: "balanced" };
  }, [datasetLoaded, uploadedDataset, liveFinalEvaluation, adaptionFinal, emptyAdaptionShape]);

  const activeClassColors = useMemo<Record<string, string>>(() => {
    if (!uploadedDataset) return classColors;
    const map: Record<string, string> = {};
    let i = 0;
    for (const className of Object.keys(uploadedDataset.classDistribution)) {
      map[className] = classColors[className] ?? UPLOAD_PALETTE[i % UPLOAD_PALETTE.length];
      i++;
    }
    return map;
  }, [uploadedDataset]);

  const activeQualityReport = useMemo<DataForgeQualityReport>(() => {
    if (!datasetLoaded) return EMPTY_QUALITY_REPORT;
    if (!uploadedDataset) return demoQualityReport;
    return buildLocalQualityReport({
      datasetName: uploadedDataset.datasetName,
      baselineMetrics: liveBaselineMetrics,
      baselineEvaluation: activeBaselineEvaluation,
      finalEvaluation: activeFinalEvaluation,
      labelIssues: effectiveLabelIssues,
      duplicateIssues: effectiveDuplicateIssues,
      balancingPlan: liveBalancingPlan,
    });
  }, [
    datasetLoaded,
    uploadedDataset,
    liveBaselineMetrics,
    activeBaselineEvaluation,
    activeFinalEvaluation,
    effectiveLabelIssues,
    effectiveDuplicateIssues,
    liveBalancingPlan,
  ]);

  // One sample image per class for the source-dataset rig preview. Counts
  // ONLY original samples so the rig (labeled "SOURCE DATASET") reflects
  // the raw upload, not the post-balancing state. Synthetic samples have
  // their own dedicated gallery further down.
  const classPreviews = useMemo<
    Array<{ className: string; imageUrl: string; count: number; color: string }>
  >(() => {
    if (!uploadedDataset) return [];
    const seen = new Map<string, { imageUrl: string; count: number }>();
    for (const sample of uploadedDataset.samples) {
      if (sample.source !== "original") continue;
      if (!sample.imageUrl) continue;
      const label =
        sample.finalLabel ?? sample.currentLabel ?? sample.originalLabel ?? "_unlabeled";
      const existing = seen.get(label);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(label, { imageUrl: sample.imageUrl, count: 1 });
      }
    }
    return Array.from(seen.entries()).map(([className, info]) => ({
      className,
      imageUrl: info.imageUrl,
      count: info.count,
      color: activeClassColors[className] ?? "#888",
    }));
  }, [uploadedDataset, activeClassColors]);

  const decisionStats = useMemo(
    () => ({
      acceptedLabels: labelDecisions.filter((d) => d.action === "accept" || d.action === "edit").length,
      rejectedLabels: labelDecisions.filter((d) => d.action === "reject").length,
      manualReview: labelDecisions.filter((d) => d.action === "manual_review").length,
      duplicatesRemoved: duplicateDecisions.filter((d) => d.action === "remove").length,
    }),
    [labelDecisions, duplicateDecisions],
  );

  const fallbackBanner = useMemo(() => {
    if (activeDatasetId && convexUnavailable) {
      return "Convex backend not reachable. Showing local state from in-memory workflow.";
    }

    if (isConvexMode) {
      if (qualityReportSource === "local-fallback" && qualityReport?.fallbackReason) {
        return `Local fallback active: ${qualityReport.fallbackReason}`;
      }

      if (missingPersistedReport) {
        return "Convex report missing for this dataset. Generate quality analysis to persist report data.";
      }

      return null;
    }

    if (!datasetLoaded) {
      return null;
    }

    if (qualityReportSource === "local-fallback" && qualityReport?.fallbackReason) {
      return `Local fallback active: ${qualityReport.fallbackReason}`;
    }

    if (!activeDatasetId && qualityReport === null) {
      return "Local demo mode. Analysis results are not persisted in Convex.";
    }

    return null;
  }, [
    activeDatasetId,
    datasetLoaded,
    isConvexMode,
    qualityReport,
    qualityReportSource,
    qualityReport?.fallbackReason,
    convexUnavailable,
    missingPersistedReport,
  ]);

  const isFallbackVisible = Boolean(fallbackBanner);
  const relabelQueue = relabelJobs.filter((job) => job.status !== "complete" && job.status !== "rejected");
  const completedRelabelJobs = relabelJobs.filter((job) => job.status === "complete" || job.status === "rejected");
  const qualitySourceLabel = qualityReportSource === "convex" ? "Convex persisted report" : "Local fallback report";
  const activeDatasetClassEntries = Object.entries(activeDistribution);
  const activeDatasetSampleCount = totalCount(activeDistribution);

  function logEvent(name: string, message: string) {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setEvents((current) => [{ id: Date.now() + Math.random(), name, message, time }, ...current]);
  }

  // ── Brian Phase 2 (B2.2 / B2.3) ────────────────────────────────────────────
  // Label-decision callbacks. Each emits a named event from the canonical set
  // (`label_decision.approved`, `label_issue.detected`, etc.) and updates
  // local state, which re-derives metrics and the balancing plan.

  function recordLabelDecision(action: LabelDecisionAction, eventName: string, message: string) {
    setLabelDecisions((current) => {
      const filtered = current.filter((d) => d.issueId !== action.issueId);
      return [...filtered, action];
    });
    logEvent(eventName, message);
  }

  function handleApproveLabel(issueId: string) {
    const issue = effectiveLabelIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordLabelDecision(
      {
        issueId,
        action: "accept",
        finalLabel: issue.suggestedLabel ?? issue.currentLabel,
        reviewer: "presenter",
        reviewedAt: Date.now(),
      },
      "label_decision.approved",
      `Approved ${issue.issueType.replace("_", " ")} for ${issue.sampleKey} → ${issue.suggestedLabel ?? "(no change)"}.`,
    );
    if (!labelizationApproved) {
      setLabelizationApproved(true);
      logEvent("labelize.complete", "Labelization stage complete; balancing plan regenerated from cleaned samples.");
      logEvent("balance_plan.created", "Balancing plan derived from labelized + deduplicated samples.");
    }
  }

  function handleRejectLabel(issueId: string) {
    const issue = effectiveLabelIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordLabelDecision(
      { issueId, action: "reject", reviewer: "presenter", reviewedAt: Date.now() },
      "label_decision.approved",
      `Rejected suggestion for ${issue.sampleKey}; original label preserved.`,
    );
  }

  function handleManualReviewLabel(issueId: string) {
    const issue = effectiveLabelIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordLabelDecision(
      { issueId, action: "manual_review", reviewer: "presenter", reviewedAt: Date.now() },
      "label_decision.approved",
      `Routed ${issue.sampleKey} to manual review queue.`,
    );
  }

  function handleEditLabel(issueId: string, finalLabel: string) {
    const issue = effectiveLabelIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordLabelDecision(
      { issueId, action: "edit", finalLabel, reviewer: "presenter", reviewedAt: Date.now() },
      "label_decision.approved",
      `Edited final label for ${issue.sampleKey} → ${finalLabel}.`,
    );
  }

  function recordDuplicateDecision(action: DuplicateDecisionAction, eventName: string, message: string) {
    setDuplicateDecisions((current) => {
      const filtered = current.filter((d) => d.issueId !== action.issueId);
      return [...filtered, action];
    });
    logEvent(eventName, message);
  }

  function handleRemoveDuplicate(issueId: string) {
    const issue = effectiveDuplicateIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordDuplicateDecision(
      { issueId, action: "remove", reviewer: "presenter", reviewedAt: Date.now() },
      "duplicate.removed",
      `Removed ${issue.sampleKey} (matches ${issue.duplicateOfSampleKey}).`,
    );
  }

  function handleKeepDuplicate(issueId: string) {
    const issue = effectiveDuplicateIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordDuplicateDecision(
      { issueId, action: "keep", reviewer: "presenter", reviewedAt: Date.now() },
      "duplicate.detected",
      `Kept ${issue.sampleKey} despite ${(issue.similarityScore ?? 0).toFixed(2)} similarity to ${issue.duplicateOfSampleKey}.`,
    );
  }

  function handleManualReviewDuplicate(issueId: string) {
    const issue = effectiveDuplicateIssues.find((i) => i.id === issueId);
    if (!issue) return;
    recordDuplicateDecision(
      { issueId, action: "manual_review", reviewer: "presenter", reviewedAt: Date.now() },
      "duplicate.detected",
      `Routed duplicate ${issue.sampleKey} to manual review.`,
    );
  }

  async function logAndPersistEvent(
    level: "info" | "warning" | "error" | "success",
    eventName: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    logEvent(eventName, message);

    if (!activeDatasetId) {
      return;
    }

    try {
      await appendEvent({
        datasetId: activeDatasetId,
        level,
        eventName,
        message,
        metadata,
      });
    } catch (error) {
      console.error("Failed to persist event", error);
    }
  }

  function resetDecisionsAndDerived() {
    setLabelDecisions([]);
    setDuplicateDecisions([]);
    setLabelizationApproved(false);
    // Reset the synthetic ID counter so a fresh dataset starts at syn-0001.
    syntheticCounterRef.current = 0;
  }

  function handleUploadLoaded(uploaded: UploadedDataset) {
    if (analysisRunning) return;
    // Release URLs from any previous upload before swapping in the new one.
    if (uploadedDataset) revokeUploadedDataset(uploadedDataset);

    setActiveDatasetId(null);
    setUploadedDataset(uploaded);
    setDatasetLoaded(true);
    setAnalysisComplete(false);
    setVisibleSynthetic([]);
    setStageStatuses({ ...makeQueuedStages(), upload: "complete" });
    setMetrics(null);
    setReportMode("baseline");
    setQualityReport(null);
    setQualityReportSource("local-fallback");
    setQualityReportHasData(false);
    setEvents([]);
    setRelabelJobs([]);
    setFalJobRuns([]);
    setConvexUnavailable(false);
    setClassFilter("all");
    setSourceFilter("all");
    resetDecisionsAndDerived();

    logEvent(
      "dataset.uploaded",
      `Parsed ${uploaded.datasetName}: ${uploaded.samples.length} samples, ${
        Object.keys(uploaded.classDistribution).length
      } classes, ${uploaded.duplicateIssues.length} duplicate(s) detected by file-hash, ${
        uploaded.labelIssues.length
      } missing label(s).`,
    );
    if (uploaded.warnings.length > 0) {
      logEvent("dataset.warnings", `Parser warnings: ${uploaded.warnings.length}. First: ${uploaded.warnings[0]}`);
    }
  }

  function handleUploadError(message: string) {
    logEvent("dataset.upload_error", message);
  }

  // Release object URLs created by JSZip when the page unmounts or the
  // active upload is swapped out via a fresh upload (handled above).
  useEffect(() => {
    return () => {
      if (uploadedDataset) revokeUploadedDataset(uploadedDataset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDemoDataset() {
    if (analysisRunning) return;

    // Drop any uploaded dataset and revert to seeded demo.
    if (uploadedDataset) {
      revokeUploadedDataset(uploadedDataset);
      setUploadedDataset(null);
    }
    resetDecisionsAndDerived();

    setActiveDatasetId(null);
    setDatasetLoaded(true);
    setAnalysisComplete(false);
    setSamples(originalSamples);
    setVisibleSynthetic([]);
    setStageStatuses({ ...makeQueuedStages(), upload: "complete" });
    setMetrics(null);
    setReportMode("baseline");
    setQualityReport(null);
    setQualityReportSource("local-fallback");
    setQualityReportHasData(false);
    setEvents([]);
    setRelabelJobs([]);
    setFalJobRuns([]);
    setConvexUnavailable(false);
    setClassFilter("all");
    setSourceFilter("all");

    const datasetPayload = {
      datasetName: "demo-animal-camera-traps.zip",
      trainingIntent,
      classDistribution: originalDistribution,
      sampleCount: originalSamples.length,
      classCount: Object.keys(originalDistribution).length,
      baselineMetrics,
      originalSamples: originalSamples.map((sample) => ({
        sampleId: sample.id,
        className: sample.className,
        source: sample.source,
        scenario: sample.scenario,
        status: sample.status,
        provider: "mock",
      })),
    };

    let createdDatasetId: Id<"datasets"> | null = null;

    try {
      const result = await createDemoDataset(datasetPayload);
      createdDatasetId = result?.datasetId ?? null;

      if (createdDatasetId) {
        setActiveDatasetId(createdDatasetId);
        setStageStatuses((current) => ({ ...current, upload: "complete" }));
      }
    } catch (error) {
      console.error("Failed to initialize Convex dataset", error);
    }

    if (!createdDatasetId) {
      window.setTimeout(() => {
        logEvent(
          "dataset.loaded",
          "Seeded animal dataset detected: cats, dogs, birds, foxes, owls, and sparse low-light wildlife.",
        );
      }, 0);
      return;
    }

    await logAndPersistEvent(
      "info",
      "dataset.loaded",
      "Seeded animal dataset detected: cats, dogs, birds, foxes, owls, and sparse low-light wildlife.",
    );
  }

  async function runAnalysis() {
    if (!datasetLoaded || analysisRunning) return;

    // Real-upload path: skip the seeded demo orchestration entirely.
    // No hardcoded 62→84 numbers, no Convex mutations, no Fal calls.
    if (uploadedDataset) {
      await runAnalysisForUpload();
      return;
    }

    setAnalysisRunning(true);
    setAnalysisComplete(false);
    setEvents([]);
    setQualityReport(null);
    setQualityReportSource("local-fallback");
    setQualityReportHasData(false);
    setRelabelJobs([]);
    setFalJobRuns([]);
    await logAndPersistEvent(
      "info",
      "pipeline.started",
      "Dataset repair loop started with demo-adaption, GPT analysis, and demo-fal adapters.",
    );

    if (activeDatasetId) {
      await Promise.all([
        setDatasetStatus({ datasetId: activeDatasetId, status: "analyzing" }),
        logAndPersistEvent(
          "info",
          "dataset.status",
          "Pipeline status updated to analyzing.",
        ),
      ]);
    }

    await step("upload", "complete", "upload.complete", "Source dataset registered with 318 records and 6 detected labels.", 420);
    await step("evaluate", "running", "baseline_evaluation.started", "Adaption baseline evaluation queued for imbalance and coverage checks.", 720);
    setMetrics(baselineMetrics);
    setReportMode("measured");
    await step("evaluate", "complete", "baseline_evaluation.complete", "Quality 62, balance 41, coverage 35, consistency 88.", 520);

    if (activeDatasetId) {
      await saveBaselineSnapshot({
        datasetId: activeDatasetId,
        provider: "demo-adaption",
        quality: baselineMetrics.quality,
        balance: baselineMetrics.balance,
        coverage: baselineMetrics.coverage,
        consistency: baselineMetrics.consistency,
        syntheticCount: 0,
        classDistribution: convexDistribution,
        rawMetrics: {
          syntheticCount: 0,
          baseline: true,
        },
      });

      await setDatasetStatus({ datasetId: activeDatasetId, status: "evaluated" });
    }

    await step("analyze", "running", "gap_analysis.started", "GPT is translating measured gaps into a structured repair plan.", 220);
    let report: QualityReport;
    try {
      report = await fetchQualityReport({
        intent: trainingIntent,
        classDistribution: originalDistribution,
        baselineMetrics,
        scenarioGaps: ["low-light wildlife coverage", "camera-trap night scenes"],
      });
    } catch (err) {
      const e = err as ApiError;
      failStage("analyze", "gap_analysis.failed", e.message, e.hint);
      return;
    }
    const plannedGapJobs = report.gapJobs;
    setQualityReport(report);

    if (activeDatasetId) {
      await Promise.all([
        saveQualityReport({
          datasetId: activeDatasetId,
          provider: report.provider,
          model: report.model,
          responseId: report.responseId,
          fallbackReason: report.fallbackReason,
          measuredFindings: report.measuredFindings,
          repairPlan: report.repairPlan,
          completionSummary: report.completionSummary,
          nextSteps: report.nextSteps,
        }),
        saveGapJobs({
          datasetId: activeDatasetId,
          gapJobs: plannedGapJobs.map((job) => ({
            className: job.className,
            scenario: `${job.className} coverage`,
            currentCount: job.currentCount,
            targetCount: job.targetCount,
            syntheticCount: job.syntheticCount,
            severity: job.severity,
            accent: job.accent,
            prompt: job.prompt,
            status: "proposed",
            imagesGenerated: 0,
          })),
        }),
      ]);

       await setDatasetStatus({ datasetId: activeDatasetId, status: "analysis_ready" });
       await setDatasetStatus({ datasetId: activeDatasetId, status: "label_review" });
     }

    logEvent(
      report.provider === "openai" ? "gpt55_report.complete" : "gpt55_report.fallback",
      report.provider === "openai"
        ? `OpenAI ${report.model} returned ${plannedGapJobs.length} targeted repair jobs.`
        : report.fallbackReason || "Using deterministic GPT-style repair plan.",
    );
    setReportMode("inferred");
    await step(
      "analyze",
      "complete",
      "gap_analysis.complete",
      `Repair plan created for ${plannedGapJobs.map((job) => job.className).join(", ")}.`,
      560,
    );
    await step("generate", "running", "fal_jobs.queued", `${plannedGapJobs.length} synthetic generation jobs queued with targeted prompts.`, 720);

    // Real Fal call. Throws on missing FAL_KEY or upstream failure — no
    // demo fallback. The returned `jobs[]` carries the generated image URLs
    // we stamp onto each persisted synthetic sample below.
    let falResponse: FalGenerationResponse;
    try {
      falResponse = await generateWithFal({
        datasetName: "demo-animal-camera-traps",
        gapJobs: plannedGapJobs,
      });
    } catch (err) {
      const e = err as ApiError;
      failStage("generate", "fal_jobs.failed", e.message, e.hint);
      return;
    }

    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "balancing" });
    }

    // Index Fal-returned image URLs by class so the loop can stamp them onto
    // each synthetic Sample. Falls back to no imageUrl if Fal returned fewer
    // images than the gap-job's requestedCount (per-job cap, partial result).
    const imageUrlsByClass = new Map<string, string[]>();
    for (const job of falResponse.jobs) {
      imageUrlsByClass.set(
        job.className,
        job.images.map((img) => img.url),
      );
    }

    const generatedSamples: Sample[] = [];
    for (const job of plannedGapJobs) {
      const urls = imageUrlsByClass.get(job.className) ?? [];
      const sampleCount = Math.max(urls.length, 1);
      const newSamples: Sample[] = Array.from({ length: sampleCount }).map((_, index) => ({
        id: `syn-${slug(job.className)}-${String(index + 1).padStart(3, "0")}`,
        className: job.className,
        source: "synthetic",
        scenario:
          job.className === "Low-light Wildlife" ? "night camera trap" : "targeted class repair",
        status: "pending review",
        imageUrl: urls[index],
      }));
      generatedSamples.push(...newSamples);
      setVisibleSynthetic([...generatedSamples]);
      setSamples([...originalSamples, ...generatedSamples]);
      setMetrics({ ...baselineMetrics, synthetic: generatedSamples.length });

      if (activeDatasetId) {
        await addSamples({
          datasetId: activeDatasetId,
          samples: newSamples.map((sample) => ({
            sampleId: sample.id,
            className: sample.className,
            source: sample.source,
            scenario: sample.scenario,
            status: sample.status,
            prompt: job.prompt,
            provider: falResponse.provider,
            imageUrl: sample.imageUrl,
          })),
        });
      }

      await logAndPersistEvent(
        "success",
        "synthetic_samples.generated",
        `${newSamples.length} ${falResponse.provider} images generated for ${job.className} (model ${falResponse.model}).`,
      );
      await wait(520);
    }

    await step("generate", "complete", "fal_jobs.complete", `${generatedSamples.length} synthetic records added with provider prompts and source metadata.`, 560);

    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "reevaluating" });
    }

    await step("reevaluate", "running", "augmented_evaluation.started", "Augmented dataset re-ingested for second quality snapshot.", 720);
    const augmentedDistribution = buildAugmentedDistribution(convexDistribution, plannedGapJobs);
    setMetrics({ ...augmentedMetrics, synthetic: generatedSamples.length });
    setReportMode("complete");

    if (activeDatasetId) {
      await saveAugmentedSnapshot({
        datasetId: activeDatasetId,
        provider: "demo-adaption",
        quality: augmentedMetrics.quality,
        balance: augmentedMetrics.balance,
        coverage: augmentedMetrics.coverage,
        consistency: augmentedMetrics.consistency,
        syntheticCount: generatedSamples.length,
        classDistribution: augmentedDistribution,
        rawMetrics: {
          syntheticCount: generatedSamples.length,
          gapJobs: plannedGapJobs.length,
        },
      });
    }

    await step("reevaluate", "complete", "augmented_evaluation.complete", "Quality improved from 62 to 84. Balance improved from 41 to 78.", 620);
    await step("export", "complete", "export.ready", "Export manifest is ready with provenance fields for each synthetic sample.", 380);

    if (activeDatasetId) {
      await Promise.all([
        setDatasetStatus({ datasetId: activeDatasetId, status: "complete" }),
        logAndPersistEvent(
          "success",
          "pipeline.complete",
          "Dataset repair loop complete and ready for export manifest.",
        ),
      ]);
    }

    setAnalysisRunning(false);
    setAnalysisComplete(true);
  }

  async function runAnalysisForUpload() {
    if (!uploadedDataset) return;

    setAnalysisRunning(true);
    setAnalysisComplete(false);
    setPipelineError(null);
    setEvents([]);
    setQualityReport(null);
    setQualityReportSource("local-fallback");
    setQualityReportHasData(false);
    setRelabelJobs([]);
    setFalJobRuns([]);
    setVisibleSynthetic([]);
    setMetrics(null);
    setReportMode("baseline");
    setAdaptionBaseline(null);
    setAdaptionFinal(null);
    setStageStatuses({ ...makeQueuedStages(), upload: "complete" });

    const datasetLabel = uploadedDataset.datasetName;
    const classCount = Object.keys(uploadedDataset.classDistribution).length;
    logEvent(
      "pipeline.started",
      `Realtime analysis started for ${datasetLabel} (${uploadedDataset.samples.length} samples, ${classCount} classes). Each stage advances on real provider response.`,
    );

    // ── upload (already parsed at upload time) ─────────────────────────────
    await step(
      "upload",
      "complete",
      "upload.complete",
      `Parsed ${uploadedDataset.samples.length} samples across ${classCount} class folder(s).`,
    );

    // ── evaluate: real Adaption manifest evaluation ────────────────────────
    await step(
      "evaluate",
      "running",
      "evaluator.started",
      "Calling GPT to evaluate baseline manifest (class balance + completeness)…",
    );
    let baselineSnapshot: DataForgeEvaluationSnapshot;
    try {
      baselineSnapshot = await evaluateDataset({
        datasetName: datasetLabel,
        version: "baseline",
        samples: uploadedDataset.samples,
        classDistribution: uploadedDataset.classDistribution,
      });
      setAdaptionBaseline(baselineSnapshot);
      setMetrics(snapshotMetricsForTiles(baselineSnapshot));
    } catch (err) {
      const e = err as ApiError;
      failStage(
        "evaluate",
        "baseline_evaluation.failed",
        e.message,
        e.hint,
      );
      return;
    }
    setReportMode("measured");
    await step(
      "evaluate",
      "complete",
      "baseline_evaluation.complete",
      `GPT baseline: quality ${baselineSnapshot.qualityScore ?? "—"}, balance ${baselineSnapshot.balanceScore ?? "—"}, completeness ${baselineSnapshot.completenessScore ?? "—"}.`,
    );

    // ── analyze: real GPT quality report ───────────────────────────────────
    await step(
      "analyze",
      "running",
      "labelize.started",
      "Calling GPT for structured repair plan…",
    );
    if (liveBaselineMetrics.missingLabelCount > 0) {
      logEvent(
        "missing_label.detected",
        `${liveBaselineMetrics.missingLabelCount} sample(s) flagged as unlabeled. Approve in the Label Audit panel.`,
      );
    }
    if (liveBaselineMetrics.duplicateIssueCount > 0) {
      logEvent(
        "duplicate.detected",
        `${liveBaselineMetrics.duplicateIssueCount} duplicate candidate(s) detected by SHA-1 file hash.`,
      );
    }
    // Hoisted so the generate stage below can read the gap jobs without
    // depending on React state (which is async-set and stale in this closure).
    let qualityReportResult: QualityReport;
    try {
      qualityReportResult = await fetchQualityReport({
        intent: trainingIntent,
        classDistribution: uploadedDataset.classDistribution,
        baselineMetrics: {
          quality: baselineSnapshot.qualityScore ?? 0,
          balance: baselineSnapshot.balanceScore ?? 0,
          coverage: baselineSnapshot.completenessScore ?? 0,
          consistency: baselineSnapshot.consistencyScore ?? 0,
        },
        scenarioGaps: [],
      });
      setQualityReport(qualityReportResult);
    } catch (err) {
      const e = err as ApiError;
      failStage("analyze", "gap_analysis.failed", e.message, e.hint);
      return;
    }
    setReportMode("inferred");
    await step(
      "analyze",
      "complete",
      "labelize.complete",
      `GPT repair plan received with ${qualityReportResult.gapJobs.length} gap job(s). Approve label and duplicate decisions in the integration band.`,
    );

    // ── generate: deterministic balancing — bring every class up to the
    // max class count via Fal. GPT's syntheticCount recommendation is
    // ignored in favor of the actual deficit, so the user gets a fully
    // balanced dataset rather than GPT's conservative guess.
    await step(
      "generate",
      "running",
      "fal_jobs.queued",
      "Computing balancing targets and queuing synthetic generation jobs…",
    );
    const balancingJobs = computeBalancingJobs(
      uploadedDataset.classDistribution,
      qualityReportResult,
    );
    let totalGenerated = 0;
    if (balancingJobs.length === 0) {
      await step(
        "generate",
        "complete",
        "fal_jobs.skipped",
        "Dataset is already balanced — no synthetic generation needed.",
      );
    } else {
      const totalNeeded = balancingJobs.reduce(
        (sum, job) => sum + job.syntheticCount,
        0,
      );
      const target = balancingJobs[0].targetCount;
      logEvent(
        "balance_target.computed",
        `Balancing target: ${target} samples per class. Generating ${totalNeeded} synthetic image(s) across ${balancingJobs.length} class(es) with Fal.`,
      );

      try {
        // One Fal call per class so the user sees per-class progress in
        // the event log instead of waiting on one monolithic request.
        for (const job of balancingJobs) {
          logEvent(
            "fal_jobs.started",
            `Generating ${job.syntheticCount} synthetic ${job.className} sample(s) (current: ${job.currentCount}, target: ${job.targetCount})…`,
          );
          const falResponse = await generateWithFal({
            datasetName: datasetLabel,
            gapJobs: [job],
          });
          const ingested = await ingestFalGenerationResponse(falResponse);
          totalGenerated += ingested;
          logEvent(
            "fal_jobs.progress",
            `Generated ${ingested}/${job.syntheticCount} synthetic ${job.className} samples (${totalGenerated}/${totalNeeded} total).`,
          );
        }
        await step(
          "generate",
          "complete",
          "fal_jobs.complete",
          `Fal generated ${totalGenerated}/${totalNeeded} synthetic samples — every class now ≥ ${target}.`,
        );
      } catch (err) {
        const e = err as ApiError;
        failStage(
          "generate",
          "fal_jobs.failed",
          `Failed during balancing run: ${e.message}`,
          e.hint,
        );
        return;
      }
    }

    // ── reevaluate: real Adaption call on cleaned manifest ─────────────────
    await step(
      "reevaluate",
      "running",
      "augmented_evaluation.started",
      "Calling GPT to re-evaluate the cleaned (labelized + deduplicated) manifest…",
    );
    let finalSnapshot: DataForgeEvaluationSnapshot;
    try {
      finalSnapshot = await evaluateDataset({
        datasetName: datasetLabel,
        version: "balanced",
        samples: cleanSamples,
        classDistribution: liveFinalMetrics.classDistribution,
      });
      setAdaptionFinal(finalSnapshot);
      setMetrics(snapshotMetricsForTiles(finalSnapshot));
    } catch (err) {
      const e = err as ApiError;
      failStage(
        "reevaluate",
        "augmented_evaluation.failed",
        e.message,
        e.hint,
      );
      return;
    }
    setReportMode("complete");
    await step(
      "reevaluate",
      "complete",
      "reevaluate.complete",
      `GPT final: quality ${finalSnapshot.qualityScore ?? "—"} (was ${baselineSnapshot.qualityScore ?? "—"}), balance ${finalSnapshot.balanceScore ?? "—"}, completeness ${finalSnapshot.completenessScore ?? "—"}.`,
    );

    // ── export ─────────────────────────────────────────────────────────────
    await step(
      "export",
      "complete",
      "export.ready",
      "Real-data export is ready. Use the Export Manifest button to download.",
    );

    setAnalysisRunning(false);
    setAnalysisComplete(true);
  }

  // Stage helper. Realtime: NO setTimeout-based delay anymore. Each call site
  // either does real work between status transitions (so the cockpit reflects
  // genuine elapsed time) or flips status instantly. The trailing number
  // argument from the legacy demo path is accepted but ignored.
  async function step(
    stageId: StageId,
    status: StageStatus,
    eventName: string,
    message: string,
    _ignoredLegacyDelay?: number,
  ) {
    setStageStatuses((current) => ({ ...current, [stageId]: status }));
    if (activeDatasetId) {
      void setStageStatus({
        datasetId: activeDatasetId,
        stage: stageId,
        status,
        message,
        progress: status === "complete" ? 100 : status === "running" ? 20 : 0,
      });
      await logAndPersistEvent("info", eventName, message);
    } else {
      logEvent(eventName, message);
    }
  }

  /**
   * Mark a stage as `error` and freeze the pipeline. The error banner
   * picks up `pipelineError` and the user can fix the underlying cause
   * (usually a missing API key) before retrying.
   */
  function failStage(stageId: StageId, eventName: string, message: string, hint?: string) {
    setStageStatuses((current) => ({ ...current, [stageId]: "error" }));
    setPipelineError({ stage: stageId, message, hint });
    logEvent(eventName, hint ? `${message} — ${hint}` : message);
    setAnalysisRunning(false);
    setAnalysisComplete(false);
  }

  /**
   * Real GPT quality-report call. Throws on non-2xx — there is no
   * client-side fallback. The cockpit calls failStage(...) when this throws.
   */
  async function fetchQualityReport(args: {
    intent: string;
    classDistribution: Record<string, number>;
    baselineMetrics: { quality: number; balance: number; coverage: number; consistency: number };
    scenarioGaps: string[];
  }): Promise<QualityReport> {
    const response = await fetch("/api/quality-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainingIntent: args.intent,
        classDistribution: args.classDistribution,
        baselineMetrics: args.baselineMetrics,
        scenarioGaps: args.scenarioGaps,
      }),
    });

    if (!response.ok) {
      const err = await readErrorBody(response);
      throw new ApiError(err.message, err.hint, err.status);
    }

    return normalizeQualityReport(await response.json());
  }

  /**
   * GPT-driven manifest evaluation. Server route uses OpenAI's Responses
   * API to score class balance / completeness / quality from the manifest.
   * Adaption Labs has been removed — same OPENAI_API_KEY drives both
   * analyze and evaluate stages. Throws on non-2xx, no demo fallback.
   */
  async function evaluateDataset(args: {
    datasetName: string;
    version: "baseline" | "labelized" | "balanced" | "augmented";
    samples: DataForgeDatasetSample[];
    classDistribution: Record<string, number>;
  }): Promise<DataForgeEvaluationSnapshot> {
    const response = await fetch("/api/evaluate-dataset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetName: args.datasetName,
        version: args.version,
        samples: args.samples,
        classDistribution: args.classDistribution,
      }),
    });

    if (!response.ok) {
      const err = await readErrorBody(response);
      throw new ApiError(err.message, err.hint, err.status);
    }

    return (await response.json()) as DataForgeEvaluationSnapshot;
  }

  /**
   * Real Fal generation. Server-side route is wired to throw 500 if FAL_KEY
   * is missing and 502 if the upstream Fal call fails. Throws on non-2xx —
   * no client fallback. On success, returns the per-job image URLs so the
   * caller can stamp `imageUrl` onto each persisted synthetic sample.
   */
  async function generateWithFal(args: {
    datasetName: string;
    gapJobs: GapJob[];
  }): Promise<FalGenerationResponse> {
    const response = await fetch("/api/fal-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetName: args.datasetName,
        gapJobs: args.gapJobs,
      }),
    });
    if (!response.ok) {
      const err = await readErrorBody(response);
      throw new ApiError(err.message, err.hint, err.status);
    }
    return (await response.json()) as FalGenerationResponse;
  }

  /**
   * Convert each Fal-generated image into a DatasetSample with
   * source="synthetic" and merge into uploadedDataset. Bytes are fetched
   * from Fal's CDN in parallel so the cleaned-dataset export can include
   * the images. Returns the number of samples actually ingested.
   */
  async function ingestFalGenerationResponse(
    falResponse: FalGenerationResponse,
  ): Promise<number> {
    if (!uploadedDataset) return 0;

    // Use the monotonic ref (not uploadedDataset.samples.length) — React
    // state hasn't flushed between consecutive ingest calls in the
    // balancing loop, so reading from state would produce duplicate IDs.
    type Pending = {
      sample: DataForgeDatasetSample;
      blobPromise: Promise<Blob | null>;
      sampleKey: string;
    };
    const pending: Pending[] = [];
    let counter = syntheticCounterRef.current;

    for (const job of falResponse.jobs) {
      for (const image of job.images) {
        counter++;
        const slug = job.className
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          || "synthetic";
        const ext =
          (image.contentType?.split("/")[1] ?? "jpg")
            .replace("jpeg", "jpg")
            .replace(/[^a-z0-9]/g, "") || "jpg";
        const sampleKey = `_synthetic/${slug}/${counter
          .toString()
          .padStart(3, "0")}.${ext}`;
        const id = `syn-${counter.toString().padStart(4, "0")}`;

        const sample: DataForgeDatasetSample = {
          id,
          sampleKey,
          imageUrl: image.url,
          source: "synthetic",
          provider: "fal",
          prompt: job.prompt,
          originalLabel: job.className,
          currentLabel: job.className,
          finalLabel: job.className,
          labelStatus: "accepted",
          labelConfidence: 0.9,
          labelReason: "Generated by Fal for the targeted gap job.",
          duplicateStatus: "unique",
          qualityFlags: ["synthetic"],
          metadata: {
            fromFal: true,
            falImageUrl: image.url,
            contentType: image.contentType,
            width: image.width,
            height: image.height,
            jobClassName: job.className,
            jobPrompt: job.prompt,
          },
        };

        // Try to fetch the bytes for inclusion in the export ZIP. Fal's CDN
        // typically serves CORS-friendly responses; a failure here is
        // non-fatal — the sample is still added with imageUrl, the export
        // will note missing-bytes for it.
        const blobPromise = fetch(image.url, { mode: "cors" })
          .then((r) => (r.ok ? r.blob() : null))
          .catch(() => null);
        pending.push({ sample, blobPromise, sampleKey });
      }
    }

    // Persist the bumped counter so the next ingest call picks up here.
    syntheticCounterRef.current = counter;

    const blobs = await Promise.all(pending.map((p) => p.blobPromise));
    const newSamples: DataForgeDatasetSample[] = [];
    const newBlobs = new Map<string, Blob>();
    for (let i = 0; i < pending.length; i++) {
      newSamples.push(pending[i].sample);
      const blob = blobs[i];
      if (blob) newBlobs.set(pending[i].sampleKey, blob);
    }

    setUploadedDataset((current) => {
      if (!current) return current;
      const mergedBlobs = new Map(current.imageBlobs);
      for (const [k, v] of newBlobs) mergedBlobs.set(k, v);

      // IMPORTANT: do NOT mutate classDistribution here. It's the
      // pre-balancing snapshot used by the "Source" bars in the
      // distribution chart. The post-balancing distribution is computed
      // dynamically from the samples list via liveFinalMetrics — that's
      // what feeds the "Final" bars. Mutating this would make Source and
      // Final identical (the bug).
      return {
        ...current,
        samples: [...current.samples, ...newSamples],
        imageBlobs: mergedBlobs,
      };
    });

    return newSamples.length;
  }

  function downloadManifest() {
    if (!datasetLoaded) return;

    const manifest = {
      product: "DataForge",
      dataset: "demo-animal-camera-traps.zip",
      trainingIntent,
      generatedAt: new Date().toISOString(),
      adapters: {
        evaluation: "demo-adaption",
        analysis: qualityReport
          ? `${qualityReport.provider}:${qualityReport.model}`
          : "gpt-fallback",
        generation: "demo-fal",
      },
      metrics: {
        baseline: baselineMetrics,
        augmented: analysisComplete ? augmentedMetrics : null,
      },
      classDistribution: {
        source: originalDistribution,
        augmented: analysisComplete ? currentAugmentedDistribution : originalDistribution,
      },
      qualityReport,
      gapJobs: currentGapJobs,
      samples,
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataforge-demo-manifest.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logEvent(
      "export_manifest.downloaded",
      "Manifest includes original samples, synthetic flags, prompts, and evaluation snapshots.",
    );
  }

  return (
    <>
      <div className="scanline" aria-hidden="true" />
      <div className="page-shell">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="DataForge home">
            <span className="brand-mark" aria-hidden="true">
              DF
            </span>
            <span>
              <strong>DataForge</strong>
              <small>Adaptive dataset repair loop</small>
            </span>
          </a>

          <nav className="nav-links" aria-label="Page navigation">
            <a href="#pipeline">Pipeline</a>
            <a href="#quality">Quality</a>
            <a href="#synthetics">Synthetics</a>
            <a href="#explorer">Explorer</a>
          </nav>

          <div className="status-pill" data-tone={systemTone}>
            <span className="status-led" aria-hidden="true" />
            <span>{systemLabel}</span>
          </div>
        </header>

        <main id="top">
          <section className="hero-grid" aria-labelledby="heroTitle">
            <div className="hero-copy">
              <div className="eyebrow">
                <span>// DataForge</span>
                <span>Live repair loop</span>
              </div>

              <h1 id="heroTitle">Stop training on broken data.</h1>
              <p className="hero-lede">
                DataForge evaluates an image dataset, explains coverage gaps, generates targeted
                synthetic samples, and proves the improvement with a second quality pass.
              </p>

              <div className="intent-console" aria-label="Dataset analysis controls">
                {/* Training-intent textarea removed per design pass; the
                    underlying state still ships a sane default to the
                    analysis pipeline so downstream calls keep working. */}

                <DatasetUploader
                  onLoaded={handleUploadLoaded}
                  onError={handleUploadError}
                  disabled={analysisRunning}
                />

                <div className="action-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={runAnalysis}
                    disabled={!datasetLoaded || analysisRunning}
                  >
                    <span aria-hidden="true">▶</span>
                    Analyze dataset
                  </button>
                </div>
              </div>
            </div>

            <aside
              className="dataset-rig"
              aria-label={uploadedDataset ? "Uploaded dataset preview" : "Demo dataset preview"}
            >
              <div className="rig-header">
                <span>Source Dataset</span>
                <strong>
                  {uploadedDataset
                    ? `${uploadedDataset.datasetName}.zip`
                    : datasetLoaded
                      ? "demo-animal-camera-traps.zip"
                      : "No dataset loaded"}
                </strong>
              </div>

              {uploadedDataset ? (
                // Real-upload preview: one image per class. Card is square
                // image on top, label band beneath — labels never overlap
                // images and never bleed onto neighboring cards.
                <div
                  className="pixel-field"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    // Override .pixel-field's `grid-auto-rows: minmax(112px, 1fr)`,
                    // which stretches single-row cards to fill the field's
                    // 360px min-height and produces tall rectangles.
                    gridAutoRows: "max-content",
                    alignItems: "start",
                    gap: "0.65rem",
                  }}
                >
                  {classPreviews.length === 0 ? (
                    <div
                      className="pixel-card"
                      style={{ gridColumn: "1 / -1", textAlign: "center", padding: "1rem" }}
                    >
                      <span>No image previews available</span>
                    </div>
                  ) : (
                    classPreviews.map((preview) => (
                      <div
                        className="pixel-card"
                        key={preview.className}
                        style={{
                          padding: 0,
                          overflow: "hidden",
                          borderRadius: 10,
                          border: `1.5px solid ${preview.color}`,
                          background: "rgba(0,0,0,0.35)",
                          display: "flex",
                          flexDirection: "column",
                          minWidth: 0,
                        }}
                        title={`${preview.className}: ${preview.count} sample(s)`}
                      >
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            aspectRatio: "1 / 1",
                            overflow: "hidden",
                            background: "#1a1a1a",
                          }}
                        >
                          <img
                            src={preview.imageUrl}
                            alt={`${preview.className} preview`}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.45rem 0.55rem",
                            background: "rgba(0,0,0,0.5)",
                            borderTop: `1px solid ${preview.color}`,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              // Override .pixel-card span global rule
                              // (position:absolute; left:8px; bottom:7px;
                              // border) intended for the seeded demo grid's
                              // single label chip; without these resets both
                              // spans stack at the same absolute coords.
                              position: "static",
                              left: "auto",
                              bottom: "auto",
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "white",
                              flex: 1,
                              minWidth: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              letterSpacing: "0.01em",
                            }}
                          >
                            {preview.className}
                          </span>
                          <span
                            style={{
                              position: "static",
                              left: "auto",
                              bottom: "auto",
                              border: "none",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              color: preview.color,
                              padding: "0.1rem 0.4rem",
                              borderRadius: 6,
                              background: "rgba(255, 255, 255, 0.06)",
                              flexShrink: 0,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {preview.count}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : datasetLoaded ? (
                // Demo-dataset placeholder grid — only when the demo button
                // has been clicked. On idle (page just loaded) we render
                // nothing so the rig doesn't show fake CAT/DOG/BIRD cards.
                <div className="pixel-field" aria-hidden="true">
                  <div className="pixel-card cat-card">
                    <span>CAT</span>
                  </div>
                  <div className="pixel-card dog-card">
                    <span>DOG</span>
                  </div>
                  <div className="pixel-card bird-card">
                    <span>BIRD</span>
                  </div>
                  <div className="pixel-card fox-card">
                    <span>FOX</span>
                  </div>
                  <div className="pixel-card owl-card">
                    <span>OWL</span>
                  </div>
                  <div className="pixel-card night-card">
                    <span>NIGHT</span>
                  </div>
                </div>
              ) : (
                // Idle: nothing loaded yet. Note we deliberately skip the
                // .pixel-field class here — its CSS grid template would
                // split this single-line message into 3 columns.
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 120,
                    border: "1px dashed rgba(255, 255, 255, 0.18)",
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.03)",
                    color: "rgba(255, 255, 255, 0.55)",
                    fontSize: "0.85rem",
                    padding: "1rem",
                    textAlign: "center",
                  }}
                  aria-hidden="true"
                >
                  Drop a ZIP to populate.
                </div>
              )}

              <dl className="dataset-stats">
                <div>
                  <dt>Samples</dt>
                  <dd>{datasetLoaded ? activeDatasetSampleCount : 0}</dd>
                </div>
                <div>
                  <dt>Classes</dt>
                  <dd>{datasetLoaded ? activeDatasetClassEntries.length : 0}</dd>
                </div>
                <div>
                  <dt>{uploadedDataset ? "Duplicates" : "Low-light"}</dt>
                  <dd>
                    {datasetLoaded
                      ? uploadedDataset
                        ? uploadedDataset.duplicateIssues.length
                        : activeDistribution["Low-light Wildlife"] ?? 0
                      : 0}
                  </dd>
                </div>
              </dl>

              <div className="class-chip-grid" aria-label="Detected classes">
                {datasetLoaded &&
                  activeDatasetClassEntries.map(([className, count]) => (
                    <span className="class-chip" key={className}>
                      <i style={{ background: activeClassColors[className] ?? "#888" }} />
                      {className}: {count}
                    </span>
                  ))}
              </div>
            </aside>
          </section>

          <section className="dashboard-band" id="pipeline">
            <div className="section-heading">
              <span>Realtime cockpit</span>
              <h2>Closed-loop repair pipeline</h2>
            </div>

            {pipelineError && (
              <div
                role="alert"
                style={{
                  margin: "0 0 1rem",
                  padding: "0.85rem 1rem",
                  borderRadius: 12,
                  border: "1.5px solid rgba(255, 93, 125, 0.55)",
                  background: "rgba(255, 93, 125, 0.08)",
                  color: "rgba(255, 220, 225, 0.95)",
                  fontSize: "0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                <strong>
                  Pipeline error in stage <code>{pipelineError.stage}</code>
                </strong>
                <span>{pipelineError.message}</span>
                {pipelineError.hint ? (
                  <small style={{ opacity: 0.85, fontStyle: "italic" }}>
                    {pipelineError.hint}
                  </small>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPipelineError(null)}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: "0.25rem",
                    background: "transparent",
                    border: "1px solid rgba(255, 220, 225, 0.4)",
                    color: "inherit",
                    padding: "0.2rem 0.6rem",
                    borderRadius: 8,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="pipeline-layout">
              <div className="pipeline-card">
                <div className="pipeline-flow" aria-label="DataForge pipeline stages">
                  {stages.map((stage) => {
                    const status = stageStatuses[stage.id] || "queued";
                    return (
                      <button
                        className="flow-node"
                        type="button"
                        data-status={status}
                        aria-label={`${stage.label}: ${status}`}
                        key={stage.id}
                      >
                        <span className="flow-icon" aria-hidden="true">
                          {stage.icon}
                        </span>
                        <strong>{stage.label}</strong>
                        <small>{status}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <aside className="event-panel" aria-label="Live event log">
                <div className="panel-title">
                  <span>Convex stream</span>
                  <strong>Live events</strong>
                </div>
                <ol className="event-log">
                  {events.length ? (
                    events.map((event) => (
                      <li key={event.id}>
                        <time>{event.time}</time>
                        <span>
                          <strong>{event.name}</strong>
                          <small>{event.message}</small>
                        </span>
                      </li>
                    ))
                  ) : (
                    <li>
                      <time>--:--</time>
                      <span>
                        <strong>waiting</strong>
                        <small>Load the demo dataset to start the stream.</small>
                      </span>
                    </li>
                  )}
                </ol>
              </aside>
            </div>
          </section>

          <section className="metric-strip" aria-label="Dataset quality metrics">
            <MetricTile
              label="Quality score"
              value={uploadedDataset ? (adaptionBaseline?.qualityScore ?? "—") : (metrics ? metrics.quality : "--")}
              note={
                uploadedDataset
                  ? adaptionBaseline
                    ? "GPT evaluator"
                    : pipelineError?.stage === "evaluate"
                      ? "GPT evaluation failed"
                      : "Awaiting GPT evaluation"
                  : metrics && metrics.quality > baselineMetrics.quality
                    ? `+${metrics.quality - baselineMetrics.quality} after repair`
                    : "Waiting for baseline"
              }
            />
            <MetricTile
              label="Balance score"
              value={uploadedDataset ? (adaptionBaseline?.balanceScore ?? "—") : (metrics ? metrics.balance : "--")}
              note={
                uploadedDataset
                  ? adaptionBaseline
                    ? "GPT evaluator"
                    : "Awaiting GPT evaluation"
                  : "Measured by demo-adaption"
              }
            />
            <MetricTile
              label={uploadedDataset ? "Completeness" : "Coverage score"}
              value={uploadedDataset ? (adaptionBaseline?.completenessScore ?? "—") : (metrics ? metrics.coverage : "--")}
              note={
                uploadedDataset
                  ? adaptionBaseline
                    ? "GPT evaluator"
                    : "Awaiting GPT evaluation"
                  : "Low-light and wildlife gaps"
              }
            />
            {uploadedDataset ? (
              <MetricTile
                label="Duplicates removed"
                value={decisionStats.duplicatesRemoved}
                note={`${effectiveDuplicateIssues.filter((d) => d.status === "open").length} still pending`}
              />
            ) : (
              <MetricTile
                label="Synthetic samples"
                value={metrics?.synthetic ?? visibleSynthetic.length}
                note="Fal fallback records"
              />
            )}
          </section>

          {/* Brian Phase 2 (B2.1) — canonical 7-stage integration band.
              Label review → duplicate review → balancing → quality report → export.
              Adaption is manifest-level only; visual findings come from seeded
              demo truth or a vision model elsewhere in the pipeline. */}
          <section
            className="dashboard-band"
            id="integration"
            aria-label="Canonical pipeline integration band"
          >
            <div className="section-heading">
              <span>Canonical pipeline</span>
              <h2>Label · Deduplicate · Balance · Re-evaluate · Export</h2>
            </div>

            <div className="integration-grid" style={{ display: "grid", gap: "1.25rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
              <LabelAuditPanel
                samples={activeSamples}
                labelIssues={effectiveLabelIssues}
                onApprove={handleApproveLabel}
                onReject={handleRejectLabel}
                onManualReview={handleManualReviewLabel}
                onEditLabel={handleEditLabel}
              />

              <DuplicateReviewPanel
                samples={labelizedSamples}
                duplicateIssues={effectiveDuplicateIssues}
                onRemove={handleRemoveDuplicate}
                onKeep={handleKeepDuplicate}
                onManualReview={handleManualReviewDuplicate}
              />

              <BalancingPanel
                balancingPlan={liveBalancingPlan}
                classColors={activeClassColors}
              />

              <QualityReportPanel
                baselineEvaluation={activeBaselineEvaluation}
                finalEvaluation={activeFinalEvaluation}
                qualityReport={activeQualityReport}
                baselineMetrics={liveBaselineMetrics}
                finalMetrics={liveFinalMetrics}
              />

              {uploadedDataset && (() => {
                // Synthetic samples gallery — only shown for uploads after
                // Fal has generated. Renders the full set in a horizontal
                // scroll strip so the whole batch is visible without
                // dominating vertical space; the dataset explorer below
                // still hosts the searchable/filterable view.
                const synthetic = cleanSamples.filter((s) => s.source === "synthetic");
                if (synthetic.length === 0) return null;
                return (
                  <section
                    aria-label="Fal-generated synthetic samples"
                    style={{
                      borderRadius: 14,
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      background: "rgba(255, 255, 255, 0.02)",
                      padding: "1.1rem",
                    }}
                  >
                    <header style={{ marginBottom: "0.85rem" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "rgba(255, 255, 255, 0.55)",
                        }}
                      >
                        Synthetic samples
                      </span>
                      <h2
                        style={{
                          margin: "0.2rem 0 0.3rem",
                          fontSize: "1.05rem",
                          fontWeight: 600,
                        }}
                      >
                        Fal-generated previews
                      </h2>
                      <small
                        style={{
                          color: "rgba(255, 255, 255, 0.6)",
                          fontSize: "0.78rem",
                        }}
                      >
                        All {synthetic.length} synthetic
                        sample{synthetic.length === 1 ? "" : "s"} generated by{" "}
                        <code style={{ fontSize: "0.74rem" }}>fal-ai/flux/schnell</code>{" "}
                        from GPT-authored gap-job prompts. Scroll the strip to
                        browse; the dataset explorer below offers the
                        searchable view, and the export ZIP groups them under{" "}
                        <code style={{ fontSize: "0.74rem" }}>{"<class>/"}</code>.
                      </small>
                    </header>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.7rem",
                        overflowX: "auto",
                        overflowY: "hidden",
                        // Negative margin + matching padding lets the scroll
                        // strip bleed to the section edges so cards don't
                        // get clipped by the parent's padding when scrolling.
                        margin: "0 -1.1rem",
                        padding: "0.25rem 1.1rem 0.6rem",
                        scrollbarGutter: "stable",
                      }}
                    >
                      {synthetic.map((sample) => {
                        const label =
                          sample.finalLabel ?? sample.currentLabel ?? sample.originalLabel ?? "_unknown";
                        const accent = activeClassColors[label] ?? "#52d6ff";
                        const promptText =
                          (typeof sample.metadata?.jobPrompt === "string"
                            ? (sample.metadata.jobPrompt as string)
                            : sample.prompt) ?? "";
                        return (
                          <article
                            key={sample.id}
                            title={promptText || undefined}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              // Fixed width keeps each card uniform inside the
                              // horizontal scroller; flex-shrink: 0 prevents
                              // them from squashing as count grows.
                              flex: "0 0 168px",
                              width: 168,
                              borderRadius: 10,
                              overflow: "hidden",
                              border: `1.5px solid ${accent}`,
                              background: "rgba(0, 0, 0, 0.35)",
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                position: "relative",
                                aspectRatio: "1 / 1",
                                background: "#1a1a1a",
                                overflow: "hidden",
                              }}
                            >
                              {sample.imageUrl ? (
                                <img
                                  src={sample.imageUrl}
                                  alt={`${label} synthetic sample (${sample.sampleKey})`}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                  loading="lazy"
                                />
                              ) : (
                                <div
                                  style={{
                                    display: "grid",
                                    placeItems: "center",
                                    height: "100%",
                                    color: "rgba(255, 255, 255, 0.5)",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  no preview
                                </div>
                              )}
                              <span
                                style={{
                                  position: "absolute",
                                  top: "0.35rem",
                                  right: "0.35rem",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: 6,
                                  background: "rgba(0, 0, 0, 0.7)",
                                  color: accent,
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                }}
                              >
                                Synthetic
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "0.4rem",
                                padding: "0.45rem 0.55rem",
                                background: "rgba(0, 0, 0, 0.45)",
                                borderTop: `1px solid ${accent}`,
                                minWidth: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  color: "white",
                                  flex: 1,
                                  minWidth: 0,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {label}
                              </span>
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  color: "rgba(255, 255, 255, 0.55)",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                  flexShrink: 0,
                                }}
                              >
                                {sample.id}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

              <DatasetExplorer
                samples={cleanSamples}
                labelIssues={effectiveLabelIssues}
                duplicateIssues={effectiveDuplicateIssues}
              />

              <ExportManifestButton
                samples={cleanSamples}
                labelIssues={effectiveLabelIssues}
                duplicateIssues={effectiveDuplicateIssues}
                balancingPlan={liveBalancingPlan}
                baselineEvaluation={activeBaselineEvaluation}
                finalEvaluation={activeFinalEvaluation}
                qualityReport={activeQualityReport}
                datasetName={uploadedDataset?.datasetName ?? "dataforge-clean-dataset"}
                trainingIntent={trainingIntent}
                imageBlobs={uploadedDataset?.imageBlobs}
                disabled={
                  decisionStats.acceptedLabels === 0 &&
                  decisionStats.duplicatesRemoved === 0 &&
                  !analysisComplete
                }
                onExported={(filename) =>
                  logEvent(
                    "reevaluate.complete",
                    `Exported ${filename}: provenance + Adaption snapshots embedded.`,
                  )
                }
              />
            </div>
          </section>

          <section className="split-section" id="quality">
            <div className="quality-panel">
              <div className="section-heading">
                <span>
                  {qualityReport?.model
                    ? `Quality report · ${prettifyModel(qualityReport.model)}`
                    : "Quality report"}
                </span>
                <h2>Measured gaps, inferred fixes</h2>
              </div>

              {/* Local-fallback / persistence pills removed — the realtime
                  pipeline either succeeds with a real GPT report or fails
                  loudly via the pipelineError banner. The "Local fallback
                  report" label was misleading now that there is no
                  client-side fallback path. */}

              <div className="report-grid">
                <ReportCard
                  tone="measured-card"
                  kicker="Measured"
                  title="Adaption evaluation snapshot"
                  items={measuredReportItems[reportMode]}
                />
                <ReportCard
                  tone="inferred-card"
                  kicker="Inferred"
                  title={`${qualityReport?.model ? prettifyModel(qualityReport.model) : "GPT"} repair plan`}
                  items={inferredReportItems[reportMode]}
                />
              </div>
            </div>

            <div className="chart-panel" aria-label="Before and after class distribution">
              <div className="panel-title">
                <span>Before / after</span>
                <strong>Class distribution</strong>
              </div>
              <div className="legend">
                <span>
                  <i className="legend-before" /> Source
                </span>
                <span>
                  <i className="legend-after" /> Augmented
                </span>
              </div>
              <DistributionChart
                before={activeDistribution}
                after={analysisComplete ? currentAugmentedDistribution : activeDistribution}
              />
            </div>
          </section>

          {/* Synthetic generation lane is demo-only. Hidden for uploads
              (no Fal stage) AND on idle (no demo loaded yet) so the dash
              never shows fox/owl/low-light placeholder copy until the demo
              dataset is actually loaded. */}
          {!uploadedDataset && datasetLoaded && (
            <section className="synthetic-section" id="synthetics">
              <div className="section-heading">
                <span>Fal generation jobs</span>
                <h2>Targeted synthetic image gallery</h2>
              </div>

              <div className="aux-panels">
                <RelabelPanel jobs={relabelQueue} completedCount={completedRelabelJobs.length} />
                <FalSummaryCard summary={falSummary} />
              </div>

              <div className="job-grid">
                {activeJobs.length ? (
                  activeJobs.map((job) => (
                    <JobCard
                      key={job.className}
                      job={job}
                      count={visibleSynthetic.filter((sample) => sample.className === job.className).length}
                    />
                  ))
                ) : (
                  <article className="empty-state">
                    <span>
                      <strong>No generation jobs yet</strong>
                      Run analysis to populate fox, owl, and low-light camera-trap samples.
                    </span>
                  </article>
                )}
              </div>
            </section>
          )}

          <section className="explorer-section" id="explorer">
            <div className="section-heading">
              <span>Dataset explorer</span>
              <h2>Inspect sample provenance</h2>
            </div>

            <div className="explorer-toolbar" aria-label="Dataset filters">
                <label>
                  Class
                  <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                    <option value="all">All classes</option>
                    {activeDatasetClassEntries.map(([className]) => (
                      <option value={className} key={className}>
                        {className}
                      </option>
                    ))}
                  </select>
                </label>
              <label>
                Source
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value as "all" | SourceType)}
                >
                  <option value="all">All sources</option>
                  <option value="original">Original</option>
                  <option value="synthetic">Synthetic</option>
                </select>
              </label>
              {/* Hidden for uploads — the canonical ZIP export lives in the
                  integration band's ExportManifestButton. Showing the demo
                  ghost button here would write hardcoded baselineMetrics. */}
              {!uploadedDataset && (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={downloadManifest}
                  disabled={!analysisComplete}
                >
                  <span aria-hidden="true">↓</span>
                  Export manifest
                </button>
              )}
            </div>

            <div className="sample-table-wrap">
              <table className="sample-table">
                <thead>
                  <tr>
                    <th>Sample</th>
                    <th>Class</th>
                    <th>Source</th>
                    <th>Scenario</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSamples.length ? (
                    filteredSamples.map((sample) => (
                      <tr key={sample.id}>
                        <td>{sample.id}</td>
                        <td>{sample.className}</td>
                        <td>
                          <span className={`source-pill ${sample.source}`}>{sample.source}</span>
                        </td>
                        <td>{sample.scenario}</td>
                        <td>
                          <span className="status-tag">{sample.status}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        {datasetLoaded ? "No records match the current filters." : "Load the demo dataset to inspect records."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

// Brian Phase 2 (B2.1) — the inline FeatureIntegrationSlots placeholder and
// the per-component stubs (LabelAuditPanel, DuplicateReviewPanel, ...,
// IntegrationSlot) were removed. Real components from
// `components/dataforge/{label-audit,duplicate-review,dataset-explorer,
// quality-report,distribution-chart,balancing,export-manifest}-{panel,button}.tsx`
// are now imported at the top of this file and wired into the canonical
// pipeline integration band rendered inside DataForgeDemoApp().

/**
 * Build deterministic balancing gap jobs that bring every minority class
 * up to the dataset's max class count via Fal generation.
 *
 *   - target = min(maxClassCount, BALANCE_TARGET_CAP) — sanity-capped so
 *     pathological imbalances (1000 vs 5) don't trigger thousand-image
 *     Fal runs.
 *   - For each class with count < target, syntheticCount = target − count.
 *   - Re-uses GPT's authored prompt and accent for each class when present;
 *     falls back to a single-subject default that's compatible with the
 *     Fal route's defensive suffix.
 */
function computeBalancingJobs(
  distribution: ClassDistribution,
  // Quality report is accepted for API symmetry but not actually used —
  // balancing is a deterministic function of class counts. Prompts and
  // accents are computed from the class name so the result is stable
  // even if GPT didn't surface a gap job for some class.
  _qualityReport: unknown,
  options: { targetCap?: number } = {},
): GapJob[] {
  const counts = Object.values(distribution);
  if (counts.length === 0) return [];
  const max = Math.max(...counts);
  const target = Math.min(max, options.targetCap ?? 200);

  return Object.entries(distribution)
    .filter(([, count]) => count < target)
    .map(([className, currentCount]) => {
      const deficit = target - currentCount;
      return {
        className,
        currentCount,
        targetCount: target,
        syntheticCount: deficit,
        severity:
          deficit > target * 0.5
            ? "high"
            : deficit > target * 0.2
              ? "medium"
              : "low",
        accent: pickAccent(className),
        prompt: buildBalancingPrompt(className),
      } satisfies GapJob;
    });
}

function buildBalancingPrompt(className: string): string {
  const subject = className
    .replace(/[-_]+/g, " ")
    .replace(/\bdemo\b/i, "")
    .trim()
    .toLowerCase() || "subject";
  // Padded so it clears the route's min(30) constraint and explicitly
  // single-subject so FLUX/schnell doesn't render a grid.
  return `a single photorealistic photo of one ${subject}, natural daylight, side profile, sharp focus, single photo, no text, no watermark`;
}

function pickAccent(className: string): string {
  // Stable pseudo-random hex picked from the upload palette via a simple
  // string hash. Accent is purely cosmetic on the synthetic gallery cards.
  const palette = [
    "#52d6ff",
    "#ffbc42",
    "#54f0b4",
    "#ff5d7d",
    "#af8cff",
    "#9adcff",
    "#ffb3ff",
    "#ffd966",
    "#a0d8b3",
  ];
  let hash = 0;
  for (const ch of className) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

/** Pretty-print an OpenAI model id for UI labels.
 *   gpt-4o → GPT-4o · gpt-4o-mini → GPT-4o-mini · gpt-5.5 → GPT-5.5
 *   deterministic-local / client-fallback → Local · idle → "" */
function prettifyModel(model: string | undefined | null): string {
  if (!model) return "GPT";
  const lower = model.toLowerCase();
  if (lower === "deterministic-local" || lower === "client-fallback") return "Local";
  if (lower === "idle") return "";
  if (lower.startsWith("gpt-")) return "GPT-" + model.slice(4);
  return model.toUpperCase();
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note: string;
}) {
  return (
    <article className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function ReportCard({
  tone,
  kicker,
  title,
  items,
}: {
  tone: string;
  kicker: string;
  title: string;
  items: string[];
}) {
  return (
    <article className={`report-card ${tone}`}>
      <div className="card-kicker">{kicker}</div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function RelabelPanel({
  jobs,
  completedCount,
}: {
  jobs: RelabelJob[];
  completedCount: number;
}) {
  return (
    <article className="relabel-panel panel-like">
      <div className="panel-title">
        <span>Relabel review queue</span>
        <strong>Candidate edits ({jobs.length + completedCount})</strong>
      </div>

      {jobs.length ? (
        <div className="relabel-list">
          {jobs.map((job) => (
            <div className="relabel-item" key={job.id}>
              <div className="relabel-item-header">
                <strong>
                  {job.sampleId} · {job.fromClassName} → {job.toClassName}
                </strong>
                <span className={`relabel-status ${job.status}`}>
                  {job.status}
                </span>
              </div>

              {typeof job.confidence === "number" ? (
                <span className="relabel-meta">Confidence {Math.round(job.confidence * 100)}%</span>
              ) : null}

              <div className="relabel-meta">
                <span>Decision: {job.decision ? job.decision : "pending"}</span>
                <span>Reviewer: {job.reviewer ?? "unassigned"}</span>
              </div>

              {job.reasoning ? <small className="relabel-reason">{job.reasoning}</small> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state-relabeled">
          <strong>No pending relabel jobs.</strong>
          <small>Relabel jobs will appear here when generated by the detection pipeline.</small>
        </div>
      )}
    </article>
  );
}

function FalSummaryCard({
  summary,
}: {
  summary: FalJobSummary;
}) {
  return (
    <article className="fal-panel panel-like">
      <div className="panel-title">
        <span>FAL job telemetry</span>
        <strong>Synthetic generation runs</strong>
      </div>
      <div className="fal-summary-grid">
        <div>
          <span>Total runs</span>
          <strong>{summary.totalRuns}</strong>
        </div>
        <div>
          <span>Queued / running</span>
          <strong>
            {summary.queued}/{summary.running}
          </strong>
        </div>
        <div>
          <span>Complete / error</span>
          <strong>
            {summary.complete}/{summary.error}
          </strong>
        </div>
        <div>
          <span>Generated samples</span>
          <strong>{summary.generatedSamples}</strong>
        </div>
      </div>

      {summary.latestError ? (
        <p className="fal-error" aria-live="polite">
          Latest run error: {summary.latestError}
        </p>
      ) : null}
    </article>
  );
}

// Brian Phase 2 (B2.1) — the inline DistributionChart was removed; the real
// dependency-free component lives at ./distribution-chart.tsx and is imported
// at the top of this file. The site that previously rendered this stub
// (the chart-panel inside the quality split-section) now uses the real one.

function JobCard({
  job,
  count,
}: {
  job: GapJob;
  count: number;
}) {
  return (
    <article className="job-card">
      <h3>
        {job.className}
        <span className="synthetic-badge">Synthetic</span>
      </h3>
      <div className="synthetic-mosaic" aria-label={`${job.className} synthetic thumbnails`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            className="mini-sample"
            key={index}
            style={{
              "--accent": job.accent,
              filter: `hue-rotate(${index * 8}deg)`,
            } as MiniSampleStyle}
          />
        ))}
      </div>
      <p>{job.prompt}</p>
      <div className="job-meta">
        <div>
          <small>Current</small>
          <strong>{job.currentCount}</strong>
        </div>
        <div>
          <small>Target</small>
          <strong>{job.targetCount}</strong>
        </div>
        <div>
          <small>Added</small>
          <strong>{count}</strong>
        </div>
      </div>
    </article>
  );
}

/**
 * Detect a report produced by runAnalysisForUpload (real uploaded data).
 * Used to swap demo cats/dogs/foxes/owls copy for honest pre-analyze
 * placeholders in the legacy ReportCards.
 */
function isUploadReport(report: QualityReport | null): boolean {
  return report?.model === "deterministic-local";
}

const uploadPrePersistedCopy: Record<ReportMode, string[]> = {
  baseline: ["Click Analyze to compute deterministic baseline metrics over the uploaded dataset."],
  measured: ["Computing baseline metrics from uploaded samples…"],
  inferred: ["Generating repair plan from real findings…"],
  complete: ["Analysis complete — review the integration band for full provenance."],
};

const uploadPreAnalyzeCopy: Record<ReportMode, string[]> = {
  baseline: ["Uploaded dataset detected. Click Analyze to compute baseline metrics from real samples."],
  measured: ["Awaiting analysis — counts and class distribution come from your uploaded data."],
  inferred: ["The repair plan will be derived from real label-issue and duplicate counts in your data."],
  complete: ["Run analysis to compare baseline vs cleaned manifest."],
};

function makeMeasuredReportItems(
  report: QualityReport | null,
  missingPersistedReport: boolean,
  uploadActive: boolean,
  datasetLoaded: boolean,
): Record<ReportMode, string[]> {
  // Idle: nothing has been loaded yet → no demo copy bleed-through.
  if (!datasetLoaded) {
    return {
      baseline: idleQualityCopy.baseline,
      measured: idleQualityCopy.measured,
      inferred: idleQualityCopy.inferred,
      complete: idleQualityCopy.complete,
    };
  }
  if (missingPersistedReport) {
    return {
      baseline: noPersistedQualityCopy.baseline,
      measured: noPersistedQualityCopy.measured,
      inferred: noPersistedQualityCopy.inferred,
      complete: noPersistedQualityCopy.complete,
    };
  }

  // Real uploaded data: don't leak demo cats/dogs/foxes copy into the
  // legacy ReportCards. Use upload-specific placeholders for the
  // pre-analyze slots and real findings for inferred/complete.
  if (uploadActive) {
    if (!report) return uploadPreAnalyzeCopy;
    return {
      baseline: uploadPrePersistedCopy.baseline,
      measured: report.measuredFindings.length ? report.measuredFindings : uploadPrePersistedCopy.measured,
      inferred: report.measuredFindings.length ? report.measuredFindings : uploadPrePersistedCopy.inferred,
      complete: report.completionSummary.length ? report.completionSummary : uploadPrePersistedCopy.complete,
    };
  }

  return {
    baseline: fallbackMeasuredCopy.baseline,
    measured: fallbackMeasuredCopy.measured,
    inferred: report?.measuredFindings ?? fallbackMeasuredCopy.inferred,
    complete: report?.completionSummary ?? fallbackMeasuredCopy.complete,
  };
}

function makeInferredReportItems(
  report: QualityReport | null,
  missingPersistedReport: boolean,
  uploadActive: boolean,
  datasetLoaded: boolean,
): Record<ReportMode, string[]> {
  if (!datasetLoaded) {
    return {
      baseline: idleQualityCopy.baseline,
      measured: idleQualityCopy.measured,
      inferred: idleQualityCopy.inferred,
      complete: idleQualityCopy.complete,
    };
  }
  if (missingPersistedReport) {
    return {
      baseline: noPersistedQualityCopy.baseline,
      measured: noPersistedQualityCopy.measured,
      inferred: noPersistedQualityCopy.inferred,
      complete: noPersistedQualityCopy.complete,
    };
  }

  if (uploadActive) {
    if (!report) return uploadPreAnalyzeCopy;
    return {
      baseline: uploadPrePersistedCopy.baseline,
      measured: report.repairPlan.length ? report.repairPlan : uploadPrePersistedCopy.measured,
      inferred: report.repairPlan.length ? report.repairPlan : uploadPrePersistedCopy.inferred,
      complete: report.nextSteps.length ? report.nextSteps : uploadPrePersistedCopy.complete,
    };
  }

  return {
    baseline: fallbackInferredCopy.baseline,
    measured: fallbackInferredCopy.measured,
    inferred: report?.repairPlan ?? fallbackInferredCopy.inferred,
    complete: report?.nextSteps ?? fallbackInferredCopy.complete,
  };
}

function buildClientFallbackReport(): QualityReport {
  return {
    provider: "demo-openai",
    model: "client-fallback",
    measuredFindings: fallbackMeasuredCopy.inferred,
    repairPlan: fallbackInferredCopy.inferred,
    completionSummary: fallbackMeasuredCopy.complete,
    nextSteps: fallbackInferredCopy.complete,
    gapJobs: fallbackGapJobs,
  };
}

/**
 * Map a real Adaption evaluation snapshot into the 4-tile metric shape.
 * No fallback or proxy math — values reflect what Adaption returned.
 * Undefined provider scores stay 0 here, but the MetricTile note copy
 * surfaces "Adaption: not run" if the snapshot is null at render time.
 */
function snapshotMetricsForTiles(snap: DataForgeEvaluationSnapshot): Metrics {
  return {
    quality: snap.qualityScore ?? 0,
    balance: snap.balanceScore ?? 0,
    coverage: snap.completenessScore ?? 0,
    consistency: snap.consistencyScore ?? 0,
  };
}

/**
 * @deprecated Local proxy retained only for the seeded demo path. The
 * upload flow should never call this — Adaption is the source of truth.
 */
function uploadedMetricsForTiles(metrics: DataForgeDatasetMetrics): Metrics {
  const balance = metrics.balanceScore ?? 0;
  const completeness = metrics.completenessScore ?? 0;
  const total = Math.max(1, metrics.sampleCount);
  const missing = metrics.missingLabelCount ?? 0;
  const dupes = metrics.duplicateIssueCount ?? 0;
  // Both penalties are 0..1; multiplied yields cleanliness 0..1, scaled.
  const cleanliness =
    100 * (1 - missing / (total + missing)) * (1 - dupes / (total + dupes));
  const quality = Math.round((balance + completeness + cleanliness) / 3);
  return {
    quality,
    balance: Math.round(balance),
    coverage: Math.round(completeness),
    consistency: 90, // placeholder; no Adaption snapshot for raw uploads
  };
}

/**
 * Build a CANONICAL DataForgeQualityReport (the type from
 * lib/dataforge/types) for the integration band when an upload is active.
 * Pure function — derives gaps and biasFlags from real metric counts so
 * the QualityReportPanel never has to render demo copy against real data.
 */
function buildLocalQualityReport(args: {
  datasetName: string;
  baselineMetrics: DataForgeDatasetMetrics;
  baselineEvaluation: DataForgeEvaluationSnapshot;
  finalEvaluation: DataForgeEvaluationSnapshot;
  labelIssues: DataForgeLabelIssue[];
  duplicateIssues: DataForgeDuplicateIssue[];
  balancingPlan: DataForgeBalancingPlan[];
}): DataForgeQualityReport {
  type Severity = "low" | "medium" | "high";
  type Source = "deterministic" | "adaption" | "gpt" | "demo";
  const gaps: { id: string; title: string; severity: Severity; measuredBy: Source; description: string; recommendedAction: string }[] = [];

  const missing = args.baselineMetrics.missingLabelCount ?? 0;
  if (missing > 0) {
    gaps.push({
      id: "gap-missing-labels",
      title: `${missing} sample(s) missing labels`,
      severity: missing > 5 ? "high" : "medium",
      measuredBy: "deterministic",
      description: "Files were not under a per-class folder; no label could be inferred from path.",
      recommendedAction: "Approve high-confidence label suggestions in the Label Audit panel.",
    });
  }

  const dupes = args.baselineMetrics.duplicateIssueCount ?? 0;
  if (dupes > 0) {
    gaps.push({
      id: "gap-duplicates",
      title: `${dupes} duplicate(s) detected`,
      severity: "medium",
      measuredBy: "deterministic",
      description: "Byte-identical files detected by SHA-1 file hash.",
      recommendedAction: "Remove duplicates from the cleaned export so they don't leak into evaluation splits.",
    });
  }

  const balance = args.baselineMetrics.balanceScore ?? 100;
  if (balance < 60) {
    gaps.push({
      id: "gap-balance",
      title: `Class balance ${balance}/100`,
      severity: balance < 40 ? "high" : "medium",
      measuredBy: "deterministic",
      description: "Coefficient of variation across class counts indicates imbalance.",
      recommendedAction: "Apply class weights from the Balancing Plan; collect more samples for rare classes.",
    });
  }

  const summary =
    `Deterministic local quality assessment of ${args.datasetName}: ` +
    `${args.baselineMetrics.sampleCount} sample(s) across ${args.baselineMetrics.classCount} class(es). ` +
    `${gaps.length === 0 ? "Structure looks healthy" : `${gaps.length} structural gap(s) found`}. ` +
    `Vision-audit lane was not contacted; scoring is GPT-driven only.`;

  return {
    id: `quality-report-${args.datasetName}`,
    summary,
    provider: "demo-openai",
    model: "deterministic-local",
    measuredMetrics: args.baselineMetrics,
    baselineEvaluation: args.baselineEvaluation,
    finalEvaluation: args.finalEvaluation,
    gaps,
    biasFlags:
      gaps.length === 0
        ? ["No structural bias flags from deterministic checks. Vision-audit lane not contacted."]
        : ["Bias flags from deterministic checks only. Vision-audit lane not contacted; image-content patterns may exist."],
    labelIssues: args.labelIssues,
    duplicateIssues: args.duplicateIssues,
    balancingPlan: args.balancingPlan,
    recommendedActions: [
      "Approve missing-label suggestions and label edits in the Label Audit panel.",
      "Remove duplicates flagged by file hash.",
      "Apply class weights from the Balancing Plan to address imbalance.",
      "Re-evaluate the cleaned manifest and export with full provenance.",
    ],
    createdAt: Date.now(),
  };
}

/**
 * Build a deterministic QualityReport (legacy shape used by the dashboard's
 * Measured/Inferred ReportCards) from real uploaded-dataset metrics. No
 * provider call, no LLM. The integration band already shows live source
 * badges; this just gives the dashboard's legacy text rows real content.
 */
function buildUploadedQualityReport(
  datasetName: string,
  metrics: DataForgeDatasetMetrics,
): QualityReport {
  const findings: string[] = [
    `Detected ${metrics.classCount} class(es) across ${metrics.sampleCount} sample(s) in ${datasetName}.`,
    `Balance ${metrics.balanceScore ?? 0} (coefficient of variation across class counts).`,
    `Completeness ${metrics.completenessScore ?? 0} from per-sample label presence.`,
  ];
  if ((metrics.missingLabelCount ?? 0) > 0) {
    findings.push(`${metrics.missingLabelCount} sample(s) without inferred labels.`);
  }
  if ((metrics.duplicateIssueCount ?? 0) > 0) {
    findings.push(`${metrics.duplicateIssueCount} duplicate candidate(s) by SHA-1 file hash.`);
  }

  const plan: string[] = [];
  if ((metrics.missingLabelCount ?? 0) > 0) {
    plan.push("Approve missing-label suggestions in the Label Audit panel.");
  }
  if ((metrics.duplicateIssueCount ?? 0) > 0) {
    plan.push("Remove byte-identical duplicates flagged by file hash.");
  }
  plan.push("Apply class weights from the Balancing Plan to address imbalance.");
  if (plan.length === 1) {
    plan.unshift("Dataset structure is healthy; review balancing plan before training.");
  }

  return {
    provider: "demo-openai",
    model: "deterministic-local",
    fallbackReason:
      "Uploaded dataset analyzed deterministically without provider calls.",
    measuredFindings: findings,
    repairPlan: plan,
    completionSummary: [],
    nextSteps: [
      "Re-evaluate the cleaned manifest after approvals to compare before/after.",
      "Export the manifest with full provenance (originalLabel + finalLabel + sha1) for downstream training.",
    ],
    gapJobs: [], // no synthetic generation on the real-data path
  };
}

function normalizeQualityReport(value: unknown): QualityReport {
  if (!isRecord(value)) {
    return {
      ...buildClientFallbackReport(),
      fallbackReason: "Quality report response was not an object.",
    };
  }

  return {
    provider: value.provider === "openai" ? "openai" : "demo-openai",
    model: typeof value.model === "string" ? value.model : "fallback",
    responseId: typeof value.responseId === "string" ? value.responseId : undefined,
    fallbackReason:
      typeof value.fallbackReason === "string" ? value.fallbackReason : undefined,
    measuredFindings: normalizeStringList(
      value.measuredFindings,
      fallbackMeasuredCopy.inferred,
    ),
    repairPlan: normalizeStringList(value.repairPlan, fallbackInferredCopy.inferred),
    completionSummary: normalizeStringList(
      value.completionSummary,
      fallbackMeasuredCopy.complete,
    ),
    nextSteps: normalizeStringList(value.nextSteps, fallbackInferredCopy.complete),
    gapJobs: normalizeGapJobs(value.gapJobs),
  };
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length ? items.slice(0, 5) : fallback;
}

function normalizeGapJobs(value: unknown): GapJob[] {
  if (!Array.isArray(value)) return fallbackGapJobs;

  const jobs = value
    .filter((job): job is PersistedGapJob => {
      if (!isRecord(job)) return false;
      if (job.type === "relabel") return false;

      if (typeof job.type === "string" && job.type !== "generate") return false;

      const hasRelabelShape =
        typeof job.sampleId === "string" &&
        typeof job.fromClassName === "string" &&
        typeof job.toClassName === "string";

      if (hasRelabelShape) return false;

      return true;
    })
    .map((job, index) => {
      const fallback = fallbackGapJobs[index] ?? fallbackGapJobs[0];
      const className = typeof job.className === "string" ? job.className : fallback.className;
      const currentCount = toInt(job.currentCount, originalDistribution[className] ?? fallback.currentCount);
      const targetCount = toInt(job.targetCount, Math.max(currentCount, fallback.targetCount));
      const syntheticCount = toInt(job.syntheticCount, Math.max(0, targetCount - currentCount));
      const severity = job.severity === "low" || job.severity === "medium" || job.severity === "high"
        ? job.severity
        : fallback.severity;
      const accent = typeof job.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(job.accent)
        ? job.accent
        : fallback.accent;
      const prompt = typeof job.prompt === "string" && job.prompt.trim().length > 0
        ? job.prompt
        : fallback.prompt;

      return {
        className,
        currentCount,
        targetCount,
        syntheticCount,
        severity,
        accent,
        prompt,
      };
    })
    .filter((job): job is GapJob => Boolean(job));

  return jobs.length ? jobs : fallbackGapJobs;
}

function mapDashboardSample(value: unknown): Sample {
  if (!isRecord(value)) {
    return {
      id: `sample-${Math.random().toString(16).slice(2)}`,
      className: "Unknown",
      source: "original",
      scenario: "Unknown",
      status: "received",
    };
  }

  return {
    id: typeof value.sampleId === "string" ? value.sampleId : `sample-${Math.random().toString(16).slice(2)}`,
    className: typeof value.className === "string" ? value.className : "Unknown",
    source: value.source === "original" || value.source === "synthetic" ? value.source : "original",
    scenario: typeof value.scenario === "string" ? value.scenario : "",
    status: typeof value.status === "string" ? value.status : "accepted",
  };
}

function mapDashboardEvents(value: unknown): EventRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const mappedEvents: MappedDashboardEvent[] = value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry, index) => {
      const timestamp =
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : Date.now() + index;

      const event: MappedDashboardEvent = {
        id: timestamp + index,
        name: typeof entry.eventName === "string" ? entry.eventName : "event",
        message: typeof entry.message === "string" ? entry.message : "",
        time: new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        _sortTime: timestamp,
      };

      return event;
    });

  return mappedEvents
    .sort((a, b) => b._sortTime - a._sortTime)
    .map((event) => {
      const { _sortTime, ...rest } = event;
      return rest;
    });
}

function mapDashboardQualityReport(
  value: unknown,
  gapJobs: unknown,
): { report: QualityReport; hasData: boolean } {
  const persistedGapJobs = normalizeGapJobs(gapJobs);
  const fallbackCopy = buildClientFallbackReport();
  const valueAsRecord: Record<string, unknown> = isRecord(value) ? value : {};

  const parseMeasuredFindings = normalizeStringList(valueAsRecord?.measuredFindings, []);
  const parseRepairPlan = normalizeStringList(valueAsRecord?.repairPlan, []);
  const parseCompletionSummary = normalizeStringList(valueAsRecord?.completionSummary, []);
  const parseNextSteps = normalizeStringList(valueAsRecord?.nextSteps, []);
  const hasPersistedData =
    parseMeasuredFindings.length > 0 ||
    parseRepairPlan.length > 0 ||
    parseCompletionSummary.length > 0 ||
    parseNextSteps.length > 0;

  if (!isRecord(value)) {
    return {
      report: {
        ...fallbackCopy,
        gapJobs: persistedGapJobs,
      },
      hasData: false,
    };
  }

  const measuredFindings = parseMeasuredFindings.length
    ? parseMeasuredFindings
    : fallbackCopy.measuredFindings;
  const repairPlan = parseRepairPlan.length ? parseRepairPlan : fallbackCopy.repairPlan;
  const completionSummary = parseCompletionSummary.length
    ? parseCompletionSummary
    : fallbackCopy.completionSummary;
  const nextSteps = parseNextSteps.length ? parseNextSteps : fallbackCopy.nextSteps;

  return {
    report: {
      provider: valueAsRecord.provider === "openai" ? "openai" : "demo-openai",
      model: typeof valueAsRecord.model === "string" ? valueAsRecord.model : "fallback",
      responseId: typeof valueAsRecord.responseId === "string" ? valueAsRecord.responseId : undefined,
      fallbackReason:
        typeof valueAsRecord.fallbackReason === "string"
          ? valueAsRecord.fallbackReason
          : undefined,
      measuredFindings,
      repairPlan,
      completionSummary,
      nextSteps,
      gapJobs: persistedGapJobs,
    },
    hasData: hasPersistedData,
  };
}

function parseRelabelDecision(value: unknown): RelabelJob["decision"] | undefined {
  return value === "accepted" ||
    value === "applied" ||
    value === "rejected" ||
    value === "requires_review" ||
    value === "pending"
    ? value
    : undefined;
}

function normalizeRelabelJobs(value: unknown): RelabelJob[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((job): job is PersistedRelabelJob => {
      if (!isRecord(job)) return false;

      if (job.type !== "relabel") return false;
      if (typeof job.sampleId !== "string") return false;
      if (typeof job.fromClassName !== "string") return false;
      if (typeof job.toClassName !== "string") return false;

      return true;
    })
    .map((job) => {
      return {
        id: job.sampleId,
        sampleId: job.sampleId,
        fromClassName: job.fromClassName,
        toClassName: job.toClassName,
        status: job.status === "approved" ||
          job.status === "running" ||
          job.status === "complete" ||
          job.status === "error" ||
          job.status === "rejected" ||
          job.status === "proposed"
          ? job.status
          : "proposed",
        confidence: toFraction(job.confidence),
        reasoning: typeof job.reasoning === "string" ? job.reasoning : undefined,
        decision: parseRelabelDecision(job.decision),
        reviewedAt: typeof job.reviewedAt === "number" && Number.isFinite(job.reviewedAt)
          ? job.reviewedAt
          : undefined,
        reviewer: typeof job.reviewer === "string" ? job.reviewer : undefined,
      };
    })
    .sort((a, b) => a.sampleId.localeCompare(b.sampleId));
}

function parseFalRunStatus(value: unknown): FalJobRun["status"] {
  return value === "running" || value === "complete" || value === "error"
    ? value
    : value === "queued"
      ? "queued"
      : "queued";
}

function normalizeFalJobRuns(value: unknown): FalJobRun[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((run): run is Record<string, unknown> => isRecord(run))
    .map((run, index) => {
      return {
        runId: typeof run._id === "string"
          ? run._id
          : typeof (run as { runId?: unknown }).runId === "string"
            ? (run as { runId: string }).runId
            : `fal-run-${index}`,
        jobId: typeof run.jobId === "string" ? run.jobId : undefined,
        provider: typeof run.provider === "string" ? run.provider : "demo-fal",
        providerRunId: typeof run.providerRunId === "string" ? run.providerRunId : undefined,
        status: parseFalRunStatus(run.status),
        requestedPayload: run.requestedPayload,
        responsePayload: run.responsePayload,
        errorMessage: typeof run.errorMessage === "string" ? run.errorMessage : undefined,
        imageCount:
          typeof run.imageCount === "number" && Number.isFinite(run.imageCount)
            ? Math.max(0, Math.round(run.imageCount))
            : undefined,
        updatedRecords:
          typeof run.updatedRecords === "number" && Number.isFinite(run.updatedRecords)
            ? Math.max(0, Math.round(run.updatedRecords))
            : undefined,
        startedAt: typeof run.startedAt === "number" && Number.isFinite(run.startedAt)
          ? run.startedAt
          : undefined,
        completedAt: typeof run.completedAt === "number" && Number.isFinite(run.completedAt)
          ? run.completedAt
          : undefined,
        createdAt: typeof run.createdAt === "number" && Number.isFinite(run.createdAt)
          ? run.createdAt
          : undefined,
      };
    });
}

function summarizeFalRuns(runs: FalJobRun[]): FalJobSummary {
  const summary: FalJobSummary = {
    totalRuns: runs.length,
    queued: 0,
    running: 0,
    complete: 0,
    error: 0,
    generatedSamples: 0,
    failedJobs: 0,
  };

  let latestErrorAt = -1;

  for (const run of runs) {
    if (run.status === "queued") summary.queued += 1;
    if (run.status === "running") summary.running += 1;
    if (run.status === "complete") summary.complete += 1;
    if (run.status === "error") {
      summary.error += 1;
      summary.failedJobs += 1;

      const runErrorTime =
        typeof run.completedAt === "number" && Number.isFinite(run.completedAt)
          ? run.completedAt
          : typeof run.createdAt === "number" && Number.isFinite(run.createdAt)
            ? run.createdAt
            : -1;

      if (run.errorMessage && runErrorTime > latestErrorAt) {
        latestErrorAt = runErrorTime;
        summary.latestError = run.errorMessage;
      }
    }

    const generated = toInt(run.imageCount, 0);
    const updated = toInt(run.updatedRecords, 0);
    summary.generatedSamples += Math.max(generated, updated);
  }

  return summary;
}

function resolveDashboardMetrics(
  datasetStatus: DatasetStatus | string | null | undefined,
  baselineSnapshot: unknown,
  augmentedSnapshot: unknown,
): Metrics | null {
  const baseline = mapSnapshotToMetrics(baselineSnapshot);
  const augmented = mapSnapshotToMetrics(augmentedSnapshot);

  if (
    datasetStatus === "complete" ||
    datasetStatus === "reevaluating" ||
    datasetStatus === "analysis_ready" ||
    datasetStatus === "balancing"
  ) {
    return augmented ?? baseline ?? null;
  }

  return baseline ?? augmented ?? null;
}

function deriveReportModeFromStatus(
  datasetStatus: DatasetStatus | string | null | undefined,
  qualityReport: unknown,
): ReportMode {
  if (!datasetStatus) {
    return qualityReport ? "inferred" : "baseline";
  }

  if (datasetStatus === "complete") {
    return "complete";
  }

  if (
    datasetStatus === "reevaluating" ||
    datasetStatus === "label_review" ||
    datasetStatus === "balancing"
  ) {
    return "inferred";
  }

  if (datasetStatus === "analysis_ready") {
    return "inferred";
  }

  if (datasetStatus === "evaluated" || datasetStatus === "analyzing") {
    return "measured";
  }

  return qualityReport ? "inferred" : "baseline";
}

function mapSnapshotToMetrics(snapshot: unknown): Metrics | null {
  if (!isRecord(snapshot)) {
    return null;
  }

  const quality =
    typeof snapshot.qualityScore === "number" && Number.isFinite(snapshot.qualityScore)
      ? snapshot.qualityScore
      : null;
  const balance =
    typeof snapshot.balanceScore === "number" && Number.isFinite(snapshot.balanceScore)
      ? snapshot.balanceScore
      : null;
  const coverage =
    typeof snapshot.coverageScore === "number" && Number.isFinite(snapshot.coverageScore)
      ? snapshot.coverageScore
      : null;
  const consistency =
    typeof snapshot.consistencyScore === "number" && Number.isFinite(snapshot.consistencyScore)
      ? snapshot.consistencyScore
      : null;

  if (
    quality === null ||
    balance === null ||
    coverage === null ||
    consistency === null
  ) {
    return null;
  }

  return {
    quality,
    balance,
    coverage,
    consistency,
    synthetic:
      typeof snapshot.syntheticCount === "number" && Number.isFinite(snapshot.syntheticCount)
        ? Math.max(0, Math.round(snapshot.syntheticCount))
        : undefined,
  };
}

function buildAugmentedDistribution(distribution: Record<string, number>, jobs: GapJob[]) {
  const nextDistribution = { ...distribution };
  for (const job of jobs) {
    nextDistribution[job.className] = (nextDistribution[job.className] ?? job.currentCount) + job.syntheticCount;
  }
  return nextDistribution;
}

function buildOriginalSamples(): Sample[] {
  const scenarios: Record<string, string[]> = {
    Cats: ["indoor daylight", "window light", "sofa portrait"],
    Dogs: ["park daylight", "street walk", "yard profile"],
    Birds: ["branch daylight", "sky profile", "feeder closeup"],
    Foxes: ["woodland edge", "field daylight"],
    Owls: ["perched daylight", "tree hollow"],
    "Low-light Wildlife": ["dim trail camera"],
  };

  return Object.entries(originalDistribution).flatMap(([className, count]) => {
    return Array.from({ length: Math.min(count, 12) }).map((_, index) => ({
      id: `${slug(className)}-${String(index + 1).padStart(3, "0")}`,
      className,
      source: "original",
      scenario: scenarios[className][index % scenarios[className].length],
      status: count < 20 ? "gap candidate" : "accepted",
    }));
  });
}

function buildSyntheticSamples(jobs: GapJob[]): Sample[] {
  return jobs.flatMap((job) => {
    return Array.from({ length: job.syntheticCount }).map((_, index) => ({
      id: `syn-${slug(job.className)}-${String(index + 1).padStart(3, "0")}`,
      className: job.className,
      source: "synthetic",
      scenario: job.className === "Low-light Wildlife" ? "night camera trap" : "targeted class repair",
      status: "pending review",
    }));
  });
}

/**
 * Error thrown by the API helpers when a route returns non-2xx. Carries
 * the server's `error` and optional `hint` so the cockpit can render a
 * helpful banner ("ADAPTION_API_KEY is not configured. Set it in
 * .env.local and restart the dev server.").
 */
class ApiError extends Error {
  hint?: string;
  status: number;
  constructor(message: string, hint: string | undefined, status: number) {
    super(message);
    this.hint = hint;
    this.status = status;
  }
}

async function readErrorBody(response: Response): Promise<{
  message: string;
  hint?: string;
  status: number;
}> {
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Body isn't JSON — fall through.
  }
  let message = `Route returned ${response.status}`;
  let hint: string | undefined;
  if (isRecord(parsed)) {
    if (typeof parsed.error === "string") message = parsed.error;
    else if (typeof parsed.message === "string") message = parsed.message;
    if (typeof parsed.hint === "string") hint = parsed.hint;
  }
  return { message, hint, status: response.status };
}

function makeQueuedStages(): Record<string, StageStatus> {
  return Object.fromEntries(stages.map((stage) => [stage.id, "queued"])) as Record<
    string,
    StageStatus
  >;
}

function totalCount(distribution: Record<string, number>) {
  return Object.values(distribution).reduce((sum, count) => sum + count, 0);
}

function toInt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function toFraction(value: unknown, fallback?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  if (value > 1 && value <= 100) {
    return value / 100;
  }

  return Math.max(0, Math.min(1, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
