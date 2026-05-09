"use client";

import { type CSSProperties, type DragEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
// Convex Document IDs: https://docs.convex.dev/using/document-ids
import type { Id } from "../../convex/_generated/dataModel";
import {
  demoBaselineMetrics,
  demoBalancingPlan,
  demoBaselineEvaluation,
  demoClassColors,
  demoDuplicateIssues,
  demoFinalEvaluation,
  demoFinalMetrics,
  demoLabelIssues,
  demoOriginalDistribution,
  demoQualityReport,
  demoSamples,
  falSyntheticSamples,
} from "../../lib/dataforge/demo-data";
import { applyDuplicateDecisions } from "../../lib/dataforge/duplicates";
import { applyLabelDecisions } from "../../lib/dataforge/label-audit";
import type {
  AdaptionEvaluationSnapshot as DataForgeEvaluationSnapshot,
  BalancingPlan as DataForgeBalancingPlan,
  DatasetSample as DataForgeDatasetSample,
  DuplicateIssue as DataForgeDuplicateIssue,
  LabelDecisionAction,
  LabelIssue as DataForgeLabelIssue,
  QualityReport as DataForgeQualityReport,
} from "../../lib/dataforge/types";
import LabelAuditPanel from "./label-audit-panel";
import DuplicateReviewPanel from "./duplicate-review-panel";
import DatasetExplorer from "./dataset-explorer";
import { BalancingPanel } from "./balancing-panel";
import { ExportManifestButton } from "./export-manifest-button";
import {
  FalPreviewGallery,
  falPreviewTotalGenerated,
  getFalPreviewAssetManifest,
} from "./fal-preview-gallery";
import { PipelineFlow } from "./pipeline-flow";
import { QualityReportPanel } from "./quality-report-panel";

type StageStatus = "queued" | "running" | "complete" | "error" | "skipped" | "degraded";
type SourceType = "original" | "synthetic";
type ReportSource = "convex" | "local-fallback";

type Sample = {
  id: string;
  className: string;
  source: SourceType;
  scenario: string;
  status: string;
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
  | "repairing"
  | "reevaluating"
  | "report_ready"
  | "complete"
  | "error";

const stages = [
  { id: "normalize", label: "Normalize manifest", icon: "01" },
  { id: "evaluate", label: "Baseline evaluation", icon: "02" },
  { id: "labelize", label: "Vision audit / label issues", icon: "03" },
  { id: "deduplicate", label: "Duplicate detection", icon: "04" },
  { id: "balance", label: "Balancing plan", icon: "05" },
  { id: "repair", label: "Apply repairs", icon: "06" },
  { id: "reevaluate", label: "Re-evaluate", icon: "07" },
  { id: "report", label: "Report ready", icon: "08" },
  { id: "export", label: "Export", icon: "09" },
] as const;

const sponsorUsage = [
  {
    sponsor: "OpenAI GPT-5.5",
    track: "Best use of GPT-5.5",
    usage: "Creates the structured repair report, inferred fixes, and export-ready explanation.",
    proof: "Quality report panel and downloaded Markdown report.",
  },
  {
    sponsor: "Adaption Labs",
    track: "Adaption Labs track",
    usage: "Manifest-level baseline and final quality snapshots. No image-pixel claims.",
    proof: "Measured quality, balance, completeness, and consistency deltas.",
  },
  {
    sponsor: "Convex",
    track: "Convex track",
    usage: "Realtime dataset state, stage rows, event stream, review state, and Fal telemetry.",
    proof: "Live pipeline graph, Convex event log, and job telemetry.",
  },
  {
    sponsor: "Fal",
    track: "Fal track",
    usage: "Cached generated recovery images fill measured class gaps up to 100 per animal.",
    proof: "Fal gallery, synthetic badges, provider fields, and exported provenance.",
  },
  {
    sponsor: "Vercel",
    track: "Vercel platform",
    usage: "Next.js app shell and route handlers for the demo workflow.",
    proof: "Deployed web UI and `/api/quality-report` route.",
  },
] as const;

type StageId = (typeof stages)[number]["id"];

const classColors: Record<string, string> = demoClassColors;

const originalDistribution: Record<string, number> = demoOriginalDistribution;

const baselineMetrics: Metrics = {
  quality: demoBaselineMetrics.qualityScore ?? 62,
  balance: demoBaselineMetrics.balanceScore ?? 41,
  coverage: demoBaselineMetrics.completenessScore ?? 74,
  consistency: demoBaselineMetrics.consistencyScore ?? 82,
};

const augmentedMetrics: Metrics = {
  quality: demoFinalMetrics.qualityScore ?? 84,
  balance: demoFinalMetrics.balanceScore ?? 78,
  coverage: demoFinalMetrics.completenessScore ?? 96,
  consistency: demoFinalMetrics.consistencyScore ?? 91,
};

const fallbackGapJobs: GapJob[] = demoBalancingPlan
  .filter((entry) => entry.samplingStrategy === "optional_generate")
  .map((entry) => ({
    className: entry.className,
    currentCount: entry.currentCount,
    targetCount: entry.targetCount ?? entry.currentCount,
    syntheticCount: Math.max(0, (entry.targetCount ?? entry.currentCount) - entry.currentCount),
    severity: "high",
    accent: demoClassColors[entry.className] ?? "#c7ff4d",
    prompt: `Photorealistic ${entry.className.toLowerCase()} records for bounded class balancing; no class may exceed the majority-class cap.`,
  }));

const fallbackMeasuredCopy: Record<ReportMode, string[]> = {
  baseline: ["Load the demo dataset to create a baseline snapshot."],
  measured: [
    "Class distribution is skewed: cane 100, cavallo 90, elefante 80, farfalla 70, gallina 60, gatto 50, mucca 40, pecora 30, ragno 25, scoiattolo 20.",
    "Completeness score is 74 because 22 manifest rows are unlabeled and minority animal classes are sparse.",
    "Consistency is 82 after seeded cross-class mislabels and duplicate bursts are counted.",
  ],
  inferred: [
    "Class distribution is skewed: cane 100, cavallo 90, elefante 80, farfalla 70, gallina 60, gatto 50, mucca 40, pecora 30, ragno 25, scoiattolo 20.",
    "Completeness score is 74 because 22 manifest rows are unlabeled and minority animal classes are sparse.",
    "Consistency is 82 after seeded cross-class mislabels and duplicate bursts are counted.",
  ],
  complete: [
    "Post-repair quality increased to 84 after label fixes, dedupe, and bounded Fal AI recovery.",
    "Balance improved to 78 with each animal capped at exactly 100 total images.",
    "Completeness improved to 96 after missing labels were added and minority class gaps were filled.",
  ],
};

const fallbackInferredCopy: Record<ReportMode, string[]> = {
  baseline: ["The repair plan will target underrepresented wildlife and missing night scenes."],
  measured: [
    "scoiattolo, ragno, pecora, and mucca should be prioritized before adding more cane images.",
    "Synthetic data should be tied to measured class gaps, not broad aesthetic variation.",
    "Each generated set must stop when raw plus generated images reaches exactly 100 for that animal.",
  ],
  inferred: [
    "Recover cached Fal AI samples only until each class reaches the 100-image majority cap.",
    "Apply reviewer-approved missing labels and relabels before balancing metrics are recomputed.",
    "Remove duplicate export entries while preserving duplicate provenance in the manifest.",
  ],
  complete: [
    "Keep synthetic records flagged in the manifest for downstream filtering.",
    "Review remaining Animals-10 edge cases before a larger training run.",
    "Export the augmented dataset with both evaluation snapshots as proof of improvement.",
  ],
};

const noPersistedQualityCopy: Record<ReportMode, string[]> = {
  baseline: ["Load the demo dataset and run analysis to generate a measured baseline report."],
  measured: ["No measured findings have been persisted yet for the active dataset."],
  inferred: ["No quality report has been generated for this dataset yet."],
  complete: ["No completion summary is available yet. Run analysis to end-to-end evaluate repair effects."],
};

const originalSamples = buildOriginalSamples();

export function DataForgeDemoApp() {
  const [trainingIntent, setTrainingIntent] = useState(
    "Train an Animals-10 image classifier across dogs, horses, elephants, butterflies, chickens, cats, cows, sheep, spiders, and squirrels.",
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
  const [reviewSamples, setReviewSamples] = useState<DataForgeDatasetSample[]>(demoSamples);
  const [labelIssues, setLabelIssues] = useState<DataForgeLabelIssue[]>(demoLabelIssues);
  const [duplicateIssues, setDuplicateIssues] = useState<DataForgeDuplicateIssue[]>(demoDuplicateIssues);
  const [balancingPlan, setBalancingPlan] = useState<DataForgeBalancingPlan[]>(demoBalancingPlan);
  const [relabelJobs, setRelabelJobs] = useState<RelabelJob[]>([]);
  const [falJobRuns, setFalJobRuns] = useState<FalJobRun[]>([]);
  const [convexUnavailable, setConvexUnavailable] = useState(false);
  const [classFilter, setClassFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceType>("all");

  const createDemoDataset = useMutation(api.datasets.createDemoDataset);
  const setDatasetStatus = useMutation(api.datasets.setDatasetStatus);
  const setStageStatus = useMutation(api.datasets.setStageStatus);
  const appendEvent = useMutation(api.datasets.appendEvent);
  const saveBaselineSnapshot = useMutation(api.datasets.saveBaselineSnapshot);
  const saveAugmentedSnapshot = useMutation(api.datasets.saveAugmentedSnapshot);
  const saveQualityReport = useMutation(api.datasets.saveQualityReport);
  const saveGapJobs = useMutation(api.datasets.saveGapJobs);
  const addSamples = useMutation(api.datasets.addSamples);
  const createFalJobRun = useMutation(api.datasets.createFalJobRun);

  const dashboardState = useQuery(
    api.datasets.getDashboardState,
    activeDatasetId ? { datasetId: activeDatasetId } : "skip",
  );

  const convexDistribution = useMemo(
    () => dashboardState?.dataset?.classDistribution ?? originalDistribution,
    [dashboardState],
  );
  const isConvexMode = Boolean(activeDatasetId && dashboardState?.dataset);
  const activeDistribution = useMemo(
    () => (isConvexMode ? convexDistribution : originalDistribution),
    [convexDistribution, isConvexMode],
  );

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
  const currentGapJobs = qualityReport
    ? isConvexReport
      ? qualityReport.gapJobs
      : qualityReport.gapJobs.length
        ? qualityReport.gapJobs
        : fallbackGapJobs
    : [];
  const missingPersistedReport = isConvexReport && !qualityReportHasData;
  const measuredReportItems = makeMeasuredReportItems(qualityReport, missingPersistedReport);
  const inferredReportItems = makeInferredReportItems(qualityReport, missingPersistedReport);
  const currentAugmentedDistribution = useMemo(
    () => buildAugmentedDistribution(convexDistribution, currentGapJobs),
    [convexDistribution, currentGapJobs],
  );

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
  const visibleFalPreviewCount = visibleSynthetic.length > 0 || analysisComplete
    ? falPreviewTotalGenerated
    : 0;

  function logEvent(name: string, message: string) {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setEvents((current) => [{ id: Date.now() + Math.random(), name, message, time }, ...current]);
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

  async function loadDemoDataset() {
    if (analysisRunning) return;

    setActiveDatasetId(null);
    setDatasetLoaded(true);
    setAnalysisComplete(false);
    setSamples(originalSamples);
    setVisibleSynthetic([]);
    setStageStatuses({ ...makeQueuedStages(), normalize: "complete" });
    setMetrics(null);
    setReportMode("baseline");
    setQualityReport(null);
    setQualityReportSource("local-fallback");
    setQualityReportHasData(false);
    setReviewSamples(demoSamples);
    setLabelIssues(demoLabelIssues);
    setDuplicateIssues(demoDuplicateIssues);
    setBalancingPlan(demoBalancingPlan);
    setEvents([]);
    setRelabelJobs([]);
    setFalJobRuns([]);
    setConvexUnavailable(false);
    setClassFilter("all");
    setSourceFilter("all");

    const datasetPayload = {
      datasetName: "animals10-training.zip",
      trainingIntent,
      classDistribution: originalDistribution,
      sampleCount: demoSamples.length,
      classCount: Object.keys(originalDistribution).length,
      baselineMetrics,
      originalSamples: demoSamples.map((sample) => ({
        sampleId: sample.id,
        className: sample.currentLabel || sample.finalLabel || sample.originalLabel || "Unlabeled",
        source: sample.source === "synthetic" ? "synthetic" as const : "original" as const,
        scenario: typeof sample.metadata?.scenario === "string" ? sample.metadata.scenario : "folder-derived cluster",
        status: sample.labelStatus ?? "accepted",
        provider: sample.provider ?? "seeded-demo-truth",
      })),
    };

    let createdDatasetId: Id<"datasets"> | null = null;

    try {
      const result = await withClientTimeout(createDemoDataset(datasetPayload), 900);
      createdDatasetId = result?.datasetId ?? null;

      if (createdDatasetId) {
        setActiveDatasetId(createdDatasetId);
        setStageStatuses((current) => ({ ...current, normalize: "complete" }));
      }
    } catch (error) {
      console.error("Failed to initialize Convex dataset", error);
    }

    if (!createdDatasetId) {
      window.setTimeout(() => {
        logEvent(
          "dataset.loaded",
          "Simulated ZIP drop accepted. DataForge is reading the unzipped Animals-10 source from data/animals/raw-img.",
        );
      }, 0);
      return;
    }

    await logAndPersistEvent(
      "info",
      "dataset.loaded",
      "Simulated ZIP drop accepted. DataForge is reading the unzipped Animals-10 source from data/animals/raw-img.",
    );
  }

  async function runAnalysis() {
    if (!datasetLoaded || analysisRunning) return;

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
      "Dataset repair loop started with demo-adaption, GPT-5.5 analysis, and Fal AI recovery adapters.",
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

    await step("normalize", "complete", "normalize.complete", "Folder-derived clusters normalized from the unzipped data/ directory into an Animals-10 repair manifest.", 420);
    await step("evaluate", "running", "baseline_evaluation.started", "Internal deterministic adapter is mirroring the Adaption manifest-evaluation path for the stage demo.", 720);
    setMetrics(baselineMetrics);
    setReportMode("measured");
    await step("evaluate", "complete", "baseline_evaluation.complete", "Quality 62, balance 41, completeness 74, consistency 82.", 520);

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

    await step("labelize", "running", "labelize.started", "Seeded GPT Vision audit is surfacing missing labels and likely wrong labels for review.", 520);
    const autoLabelActions = buildAutoLabelActions(demoLabelIssues);
    const labelizedSamples = applyLabelDecisions(demoSamples, autoLabelActions);
    const reviewedLabelIssues = demoLabelIssues.map((issue) => {
      if (issue.status !== "open") return issue;
      return {
        ...issue,
        status: issue.confidence && issue.confidence >= 0.82 ? "accepted" as const : "manual_review" as const,
        reviewedAt: Date.now(),
      };
    });
    setReviewSamples(labelizedSamples);
    setLabelIssues(reviewedLabelIssues);
    await step("labelize", "complete", "labelize.complete", "19 missing labels added, 7 labels corrected, and 4 ambiguous records held for manual review.", 520);

    await step("deduplicate", "running", "duplicate_detection.started", "File-hash and perceptual-hash duplicate review is running on the labelized manifest.", 480);
    const duplicateActions = demoDuplicateIssues.map((issue) => ({
      issueId: issue.id,
      sampleId: issue.sampleKey,
      action: "remove" as const,
      reviewedAt: Date.now(),
      reviewer: "demo-reviewer",
    }));
    const dedupedSamples = applyDuplicateDecisions(labelizedSamples, duplicateActions);
    const reviewedDuplicateIssues = demoDuplicateIssues.map((issue) => ({
      ...issue,
      status: "removed" as const,
      reviewedAt: Date.now(),
    }));
    setReviewSamples(dedupedSamples);
    setDuplicateIssues(reviewedDuplicateIssues);
    await step("deduplicate", "complete", "duplicate_detection.complete", "7 duplicate export entries removed while source provenance stayed intact.", 520);

    await step("balance", "running", "balance_plan.created", "Balancing plan caps every animal class at exactly 100 images across raw plus generated assets.", 480);
    setBalancingPlan(demoBalancingPlan.map((entry) => ({ ...entry, status: "accepted" as const })));
    await step("balance", "complete", "balance_plan.accepted", "Fal AI recovery plan approved only for animal classes below the 100-image cap.", 520);

    await step("repair", "running", "repair.apply_started", "Approved label, duplicate, and balancing decisions are being applied to the export manifest.", 380);
    setReviewSamples([...dedupedSamples, ...falSyntheticSamples]);
    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "repairing" });
    }
    await step("repair", "complete", "repair.apply_complete", "Soft orchestrator confidence reached 93%; no second repair loop is needed.", 420);

    await step("report", "running", "gap_analysis.started", "GPT-5.5 is translating the measured repair loop into a structured report.", 220);
    const report = await fetchQualityReport(trainingIntent);
    const plannedGapJobs = report.gapJobs.length ? report.gapJobs : fallbackGapJobs;
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
      }

    logEvent(
      report.provider === "openai" ? "gpt55_report.complete" : "gpt55_report.fallback",
      report.provider === "openai"
        ? `OpenAI ${report.model} returned ${plannedGapJobs.length} targeted repair jobs.`
        : report.fallbackReason || "Using deterministic GPT-style repair plan.",
    );
    setReportMode("inferred");
    await step(
      "report",
      "complete",
      "gap_analysis.complete",
      `Repair plan created for ${plannedGapJobs.map((job) => job.className).join(", ")}.`,
      560,
    );
    await step("repair", "running", "fal_jobs.queued", `${plannedGapJobs.length} bounded Fal AI recovery jobs queued with targeted prompts.`, 720);

    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "balancing" });
    }

    const generatedSamples: Sample[] = [];
    const syntheticSamples = buildSyntheticSamples(plannedGapJobs);
    for (const job of plannedGapJobs) {
      const newSamples = syntheticSamples.filter((sample) => sample.className === job.className);
      const falRunTimestamp = Date.now();
      const falRun: FalJobRun = {
        runId: `demo-fal-${slug(job.className)}-${falRunTimestamp}`,
        provider: "fal.ai",
        providerRunId: `fal-recovery-${slug(job.className)}`,
        status: "complete",
        requestedPayload: {
          className: job.className,
          prompt: job.prompt,
          requestedCount: job.syntheticCount,
          majorityClassCap: job.targetCount,
        },
        responsePayload: {
          sampleIds: newSamples.map((sample) => sample.id),
          source: "precomputed-demo-recovery",
        },
        imageCount: newSamples.length,
        updatedRecords: newSamples.length,
        startedAt: falRunTimestamp - 300,
        completedAt: falRunTimestamp,
        createdAt: falRunTimestamp,
      };
      generatedSamples.push(...newSamples);
      setVisibleSynthetic([...generatedSamples]);
      setSamples([...originalSamples, ...generatedSamples]);
      setMetrics({ ...baselineMetrics, synthetic: generatedSamples.length });
      setFalJobRuns((current) => [...current, falRun]);

      if (activeDatasetId) {
        void createFalJobRun({
          datasetId: activeDatasetId,
          provider: falRun.provider,
          providerRunId: falRun.providerRunId,
          status: falRun.status,
          requestedPayload: falRun.requestedPayload,
          responsePayload: falRun.responsePayload,
          imageCount: falRun.imageCount,
          updatedRecords: falRun.updatedRecords,
          startedAt: falRun.startedAt,
          completedAt: falRun.completedAt,
        });
        await addSamples({
          datasetId: activeDatasetId,
          samples: newSamples.map((sample) => ({
            sampleId: sample.id,
            className: sample.className,
            source: sample.source === "synthetic" ? "synthetic" as const : "original" as const,
            scenario: sample.scenario,
            status: sample.status,
            prompt: job.prompt,
            provider: "fal.ai",
          })),
        });
      }

      await logAndPersistEvent(
        "success",
        "synthetic_samples.generated",
        `${job.syntheticCount} Fal AI records recovered for ${job.className}; class total remains capped at ${job.targetCount}.`,
      );
      await wait(520);
    }

    await step("repair", "complete", "fal_jobs.complete", `${generatedSamples.length} synthetic records added with Fal AI badges and source metadata.`, 560);

    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "reevaluating" });
    }

    await step("reevaluate", "running", "augmented_evaluation.started", "Clean labelized and deduplicated manifest re-ingested for the second quality snapshot.", 720);
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
    await logAndPersistEvent("success", "loop.evaluated", "Soft orchestrator stopped after 1 loop because confidence reached 93%.");
    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "report_ready" });
    }
    await step("report", "complete", "report.ready", "Report shows 1 loop, 93% confidence, labels corrected, missing labels added, duplicates removed, and clusters identified.", 380);
    await step("export", "complete", "export.ready", "Export manifest is ready with renamed output filenames and provenance fields for every synthetic sample.", 380);

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

  async function step(
    stageId: StageId,
    status: StageStatus,
    eventName: string,
    message: string,
    delay: number,
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
    await wait(delay);
  }

  async function fetchQualityReport(intent: string): Promise<QualityReport> {
    try {
      const response = await fetch("/api/quality-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trainingIntent: intent,
          classDistribution: originalDistribution,
          baselineMetrics,
          scenarioGaps: ["minority Animals-10 class coverage", "100-image class cap"],
        }),
      });

      if (!response.ok) {
        throw new Error(`Quality report route returned ${response.status}`);
      }

      return normalizeQualityReport(await response.json());
    } catch (error) {
      return {
        ...buildClientFallbackReport(),
        fallbackReason:
          error instanceof Error ? error.message : "Unable to reach the quality-report route.",
      };
    }
  }

  function downloadManifest() {
    if (!datasetLoaded) return;

    const manifest = {
      product: "DataForge",
      dataset: "animals10-training.zip",
      trainingIntent,
      generatedAt: new Date().toISOString(),
      adapters: {
        evaluation: "demo-adaption",
        analysis: qualityReport
          ? `${qualityReport.provider}:${qualityReport.model}`
          : "gpt-5.5-fallback",
        generation: "fal.ai-demo-cache",
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
      falGeneratedAssets: getFalPreviewAssetManifest(),
      samples,
    };
    const stamp = createExportStamp();

    triggerTextDownload(
      buildUiDatasetCsv(samples),
      `dataforge-animals10-final-dataset-${stamp}.csv`,
      "text/csv;charset=utf-8",
    );
    triggerTextDownload(
      buildUiReportMarkdown(manifest),
      `dataforge-animals10-report-${stamp}.md`,
      "text/markdown;charset=utf-8",
    );
    logEvent(
      "dataset_export.downloaded",
      "Final dataset CSV and report downloaded with synthetic flags, prompts, and evaluation snapshots.",
    );
  }

  function handleApproveLabel(issueId: string) {
    const issue = labelIssues.find((item) => item.id === issueId);
    if (!issue?.suggestedLabel) return;

    const action: LabelDecisionAction = {
      issueId,
      sampleId: issue.sampleId ?? issue.sampleKey,
      action: "accept",
      finalLabel: issue.suggestedLabel,
      reviewer: "demo-reviewer",
      reviewedAt: Date.now(),
    };

    setReviewSamples((current) => applyLabelDecisions(current, [action]));
    setLabelIssues((current) => updateLabelIssueStatus(current, issueId, "accepted"));
    void logAndPersistEvent("success", "label_decision.approved", `${issue.sampleKey} approved as ${issue.suggestedLabel}.`);
  }

  function handleRejectLabel(issueId: string) {
    setLabelIssues((current) => updateLabelIssueStatus(current, issueId, "rejected"));
    void logAndPersistEvent("warning", "label_decision.rejected", `${issueId} rejected by reviewer.`);
  }

  function handleManualLabel(issueId: string) {
    setLabelIssues((current) => updateLabelIssueStatus(current, issueId, "manual_review"));
    void logAndPersistEvent("warning", "label_decision.manual_review", `${issueId} moved to manual review.`);
  }

  function handleEditLabel(issueId: string, finalLabel: string) {
    const issue = labelIssues.find((item) => item.id === issueId);
    if (!issue) return;

    const action: LabelDecisionAction = {
      issueId,
      sampleId: issue.sampleId ?? issue.sampleKey,
      action: "edit",
      finalLabel,
      reviewer: "demo-reviewer",
      reviewedAt: Date.now(),
    };

    setReviewSamples((current) => applyLabelDecisions(current, [action]));
    setLabelIssues((current) => updateLabelIssueStatus(current, issueId, "accepted", finalLabel));
    void logAndPersistEvent("success", "label_decision.edited", `${issue.sampleKey} edited to ${finalLabel}.`);
  }

  function handleDemoDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDemoDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    void loadDemoDataset();
  }

  function handleRemoveDuplicate(issueId: string) {
    const issue = duplicateIssues.find((item) => item.id === issueId);
    if (!issue) return;

    setReviewSamples((current) => applyDuplicateDecisions(current, [{
      issueId,
      sampleId: issue.sampleKey,
      action: "remove",
      reviewer: "demo-reviewer",
      reviewedAt: Date.now(),
    }]));
    setDuplicateIssues((current) => updateDuplicateIssueStatus(current, issueId, "removed"));
    void logAndPersistEvent("success", "duplicate.removed", `${issue.sampleKey} excluded from export as a duplicate.`);
  }

  function handleKeepDuplicate(issueId: string) {
    setDuplicateIssues((current) => updateDuplicateIssueStatus(current, issueId, "kept"));
    void logAndPersistEvent("info", "duplicate.kept", `${issueId} kept in export after review.`);
  }

  function handleManualDuplicate(issueId: string) {
    setDuplicateIssues((current) => updateDuplicateIssueStatus(current, issueId, "manual_review"));
    void logAndPersistEvent("warning", "duplicate.manual_review", `${issueId} moved to manual review.`);
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
            <a href="#sponsors">Sponsors</a>
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
                <span>Hackathon MVP</span>
                <span>Animal classifier demo</span>
              </div>

              <h1 id="heroTitle">Repair your training data before the model ever sees it.</h1>
              <p className="hero-lede">
                DataForge evaluates an image dataset, explains coverage gaps, generates targeted
                synthetic samples, and proves the improvement with a second quality pass.
              </p>

              <div className="intent-console" aria-label="Dataset analysis controls">
                <label htmlFor="trainingIntent">Training intent</label>
                <textarea
                  id="trainingIntent"
                  rows={4}
                  value={trainingIntent}
                  onChange={(event) => setTrainingIntent(event.target.value)}
                />

                <button
                  className="dropzone"
                  type="button"
                  onClick={loadDemoDataset}
                  onDragOver={handleDemoDragOver}
                  onDrop={handleDemoDrop}
                >
                  <span className="drop-icon" aria-hidden="true">
                    +
                  </span>
                  <span>
                    <strong>Drop training ZIP</strong>
                    <small>Simulated drag/drop reads the already-unzipped `data/` directory.</small>
                  </span>
                </button>

                <div className="action-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={loadDemoDataset}
                    disabled={analysisRunning}
                  >
                    <span aria-hidden="true">▣</span>
                    Simulate ZIP drop
                  </button>
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

            <aside className="dataset-rig" aria-label="Demo dataset preview">
              <div className="rig-header">
                <span>Source Dataset</span>
                <strong>{datasetLoaded ? "animals10-training.zip" : "No dataset loaded"}</strong>
              </div>

              <div className="pixel-field" aria-hidden="true">
                <div className="pixel-card cat-card">
                    <span>CANE</span>
                </div>
                <div className="pixel-card dog-card">
                    <span>CAV</span>
                </div>
                <div className="pixel-card bird-card">
                    <span>ELE</span>
                </div>
                <div className="pixel-card fox-card">
                    <span>FAR</span>
                </div>
                <div className="pixel-card owl-card">
                    <span>GAT</span>
                </div>
                <div className="pixel-card night-card">
                    <span>RAG</span>
                </div>
              </div>

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
                    <dt>Smallest</dt>
                    <dd>{datasetLoaded ? activeDistribution.scoiattolo ?? 0 : 0}</dd>
                  </div>
                </dl>

                <div className="class-chip-grid" aria-label="Detected classes">
                  {datasetLoaded &&
                    activeDatasetClassEntries.map(([className, count]) => (
                      <span className="class-chip" key={className}>
                        <i style={{ background: classColors[className] }} />
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

            <div className="pipeline-layout">
              <div className="pipeline-card">
                <PipelineFlow
                  stages={stages.map((stage) => ({
                    ...stage,
                    status: stageStatuses[stage.id] || "queued",
                  }))}
                />
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
              value={metrics ? metrics.quality : "--"}
              note={metrics && metrics.quality > baselineMetrics.quality ? `+${metrics.quality - baselineMetrics.quality} after repair` : "Waiting for baseline"}
            />
            <MetricTile
              label="Balance score"
              value={metrics ? metrics.balance : "--"}
              note="Measured by demo-adaption"
            />
            <MetricTile
              label="Coverage score"
              value={metrics ? metrics.coverage : "--"}
              note="Minority animal gaps"
            />
            <MetricTile
              label="Synthetic samples"
              value={metrics?.synthetic ?? visibleSynthetic.length}
              note="Fal AI recovery records"
            />
          </section>

          <section className="sponsor-section" id="sponsors" aria-labelledby="sponsorTitle">
            <div className="section-heading">
              <span>Prize track map</span>
              <h2 id="sponsorTitle">Where sponsors power DataForge</h2>
            </div>
            <div className="sponsor-ledger">
              {sponsorUsage.map((item) => (
                <article className="sponsor-row" key={item.sponsor}>
                  <div>
                    <span>{item.track}</span>
                    <strong>{item.sponsor}</strong>
                  </div>
                  <p>{item.usage}</p>
                  <small>{item.proof}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="split-section" id="quality">
            <div className="quality-panel">
              <div className="section-heading">
                <span>
                  {qualityReport?.provider === "openai"
                    ? `OpenAI ${qualityReport.model}`
                    : "Quality report"}
                </span>
                <h2>Measured gaps, inferred fixes</h2>
              </div>

              <div className="report-meta" aria-label="Quality report source">
                <span className={`report-source ${qualityReportSource === "convex" ? "source-convex" : "source-local"}`}>
                  {qualitySourceLabel}
                </span>
                {qualityReportSource === "convex" && qualityReportHasData && (
                  <span className="report-state state-ok">Persisted in Convex</span>
                )}
                {qualityReportSource === "convex" && missingPersistedReport && (
                  <span className="report-state state-warning">No persisted report for this dataset</span>
                )}
                {qualityReportSource === "local-fallback" && (
                  <span className="report-state state-neutral">Local fallback only</span>
                )}
              </div>

              {isFallbackVisible && <div className="fallback-banner">{fallbackBanner}</div>}

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
                  title="GPT-5.5 repair plan"
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

          <section className="synthetic-section" id="synthetics">
            <div className="section-heading">
              <span>Fal generation jobs</span>
              <h2>Targeted synthetic image gallery</h2>
            </div>

            <div className="aux-panels">
              <RelabelPanel jobs={relabelQueue} completedCount={completedRelabelJobs.length} />
              <FalSummaryCard summary={falSummary} />
            </div>

            <FalPreviewGallery visibleCount={visibleFalPreviewCount} />

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
                    Run analysis to populate bounded Fal AI recovery samples across underfilled Animals-10 classes.
                  </span>
                </article>
              )}
            </div>
          </section>

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
              <button
                className="ghost-button"
                type="button"
                onClick={downloadManifest}
                disabled={!analysisComplete}
              >
                <span aria-hidden="true">↓</span>
                Export dataset + report
              </button>
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

          <FeatureIntegrationSlots
            samples={reviewSamples}
            labelIssues={labelIssues}
            duplicateIssues={duplicateIssues}
            balancingPlan={balancingPlan}
            baselineEvaluation={demoBaselineEvaluation}
            finalEvaluation={demoFinalEvaluation}
            qualityReport={demoQualityReport}
            disabled={analysisRunning}
            trainingIntent={trainingIntent}
            onApproveLabel={handleApproveLabel}
            onRejectLabel={handleRejectLabel}
            onManualLabel={handleManualLabel}
            onEditLabel={handleEditLabel}
            onRemoveDuplicate={handleRemoveDuplicate}
            onKeepDuplicate={handleKeepDuplicate}
            onManualDuplicate={handleManualDuplicate}
            onExported={(filename) => void logAndPersistEvent("success", "export_manifest.downloaded", `${filename} downloaded from integrated export panel.`)}
          />
        </main>
      </div>
    </>
  );
}

type FeatureSlotProps = {
  samples: DataForgeDatasetSample[];
  labelIssues: DataForgeLabelIssue[];
  duplicateIssues: DataForgeDuplicateIssue[];
  balancingPlan: DataForgeBalancingPlan[];
  baselineEvaluation: DataForgeEvaluationSnapshot;
  finalEvaluation: DataForgeEvaluationSnapshot;
  qualityReport: DataForgeQualityReport;
  disabled: boolean;
  trainingIntent: string;
  onApproveLabel: (issueId: string) => void;
  onRejectLabel: (issueId: string) => void;
  onManualLabel: (issueId: string) => void;
  onEditLabel: (issueId: string, finalLabel: string) => void;
  onRemoveDuplicate: (issueId: string) => void;
  onKeepDuplicate: (issueId: string) => void;
  onManualDuplicate: (issueId: string) => void;
  onExported: (filename: string) => void;
};

function FeatureIntegrationSlots(props: FeatureSlotProps) {
  return (
    <section className="review-workbench" aria-label="Advanced review workbench">
      <details className="integration-drawer">
        <summary>
          <span>
            <strong>Advanced Review Workbench</strong>
            <small>Label audit, duplicate review, source-labeled report, balancing, explorer, and export.</small>
          </span>
        </summary>
        <div className="integration-grid">
          <LabelAuditPanel
            samples={props.samples}
            labelIssues={props.labelIssues}
            disabled={props.disabled}
            onApprove={props.onApproveLabel}
            onReject={props.onRejectLabel}
            onManualReview={props.onManualLabel}
            onEditLabel={props.onEditLabel}
          />
          <DuplicateReviewPanel
            samples={props.samples}
            duplicateIssues={props.duplicateIssues}
            disabled={props.disabled}
            onRemove={props.onRemoveDuplicate}
            onKeep={props.onKeepDuplicate}
            onManualReview={props.onManualDuplicate}
          />
          <QualityReportPanel
            baselineEvaluation={props.baselineEvaluation}
            finalEvaluation={props.finalEvaluation}
            qualityReport={props.qualityReport}
            baselineMetrics={demoBaselineMetrics}
            finalMetrics={demoFinalMetrics}
          />
          <BalancingPanel balancingPlan={props.balancingPlan} classColors={demoClassColors} />
          <DatasetExplorer
            samples={props.samples}
            labelIssues={props.labelIssues}
            duplicateIssues={props.duplicateIssues}
          />
          <ExportManifestButton
            samples={props.samples}
            labelIssues={props.labelIssues}
            duplicateIssues={props.duplicateIssues}
            balancingPlan={props.balancingPlan}
            baselineEvaluation={props.baselineEvaluation}
            finalEvaluation={props.finalEvaluation}
            qualityReport={props.qualityReport}
            datasetName="dataforge-clean-animal-dataset"
            trainingIntent={props.trainingIntent}
            disabled={props.disabled}
            onExported={props.onExported}
          />
        </div>
      </details>
    </section>
  );
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

function DistributionChart({
  before,
  after,
}: {
  before: Record<string, number>;
  after: Record<string, number>;
}) {
  const max = Math.max(...Object.values(before), ...Object.values(after), 1);

  return (
    <div className="bar-chart">
      {Object.keys(before).map((className) => {
        const beforeCount = before[className];
        const afterCount = after[className] ?? beforeCount;
        const beforeWidth = Math.max(2, (beforeCount / max) * 100);
        const afterWidth = Math.max(2, (afterCount / max) * 100);

        return (
          <div className="bar-row" key={className}>
            <span className="bar-label">{className}</span>
            <span className="bar-pair">
              <span className="bar-track">
                <span className="bar-fill before" style={{ width: `${beforeWidth}%` }} />
              </span>
              <span className="bar-track">
                <span className="bar-fill after" style={{ width: `${afterWidth}%` }} />
              </span>
            </span>
            <span className="bar-value">
              {beforeCount}/{afterCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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

function makeMeasuredReportItems(
  report: QualityReport | null,
  missingPersistedReport: boolean,
): Record<ReportMode, string[]> {
  if (missingPersistedReport) {
    return {
      baseline: noPersistedQualityCopy.baseline,
      measured: noPersistedQualityCopy.measured,
      inferred: noPersistedQualityCopy.inferred,
      complete: noPersistedQualityCopy.complete,
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
): Record<ReportMode, string[]> {
  if (missingPersistedReport) {
    return {
      baseline: noPersistedQualityCopy.baseline,
      measured: noPersistedQualityCopy.measured,
      inferred: noPersistedQualityCopy.inferred,
      complete: noPersistedQualityCopy.complete,
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

  const majorityClassCap = Math.max(
    ...Object.entries(originalDistribution)
      .filter(([className]) => className !== "Unlabeled")
      .map(([, count]) => count),
  );

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
      const targetCount = Math.min(
        majorityClassCap,
        Math.max(currentCount, toInt(job.targetCount, Math.max(currentCount, fallback.targetCount))),
      );
      const syntheticCount = Math.min(
        Math.max(0, targetCount - currentCount),
        toInt(job.syntheticCount, Math.max(0, targetCount - currentCount)),
      );
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
        provider: typeof run.provider === "string" ? run.provider : "fal.ai",
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

function buildAutoLabelActions(labelIssues: DataForgeLabelIssue[]): LabelDecisionAction[] {
  return labelIssues
    .filter((issue) => issue.status === "open" && Boolean(issue.suggestedLabel))
    .filter((issue) => typeof issue.confidence !== "number" || issue.confidence >= 0.82)
    .map((issue) => ({
      issueId: issue.id,
      sampleId: issue.sampleId ?? issue.sampleKey,
      action: "accept" as const,
      finalLabel: issue.suggestedLabel,
      reviewer: "demo-reviewer",
      reviewedAt: Date.now(),
    }));
}

function updateLabelIssueStatus(
  issues: DataForgeLabelIssue[],
  issueId: string,
  status: DataForgeLabelIssue["status"],
  suggestedLabel?: string,
) {
  return issues.map((issue) =>
    issue.id === issueId
      ? {
          ...issue,
          status,
          suggestedLabel: suggestedLabel ?? issue.suggestedLabel,
          reviewedAt: Date.now(),
        }
      : issue,
  );
}

function updateDuplicateIssueStatus(
  issues: DataForgeDuplicateIssue[],
  issueId: string,
  status: DataForgeDuplicateIssue["status"],
) {
  return issues.map((issue) =>
    issue.id === issueId
      ? {
          ...issue,
          status,
          reviewedAt: Date.now(),
        }
      : issue,
  );
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
    datasetStatus === "report_ready" ||
    datasetStatus === "repairing" ||
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
    datasetStatus === "report_ready" ||
    datasetStatus === "repairing" ||
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
  const nextDistribution = Object.fromEntries(
    Object.entries(distribution).filter(([className]) => className !== "Unlabeled"),
  ) as Record<string, number>;

  for (const job of jobs) {
    nextDistribution[job.className] = Math.min(
      job.targetCount,
      (nextDistribution[job.className] ?? job.currentCount) + job.syntheticCount,
    );
  }

  return nextDistribution;
}

function buildOriginalSamples(): Sample[] {
  const scenarios: Record<string, string[]> = {
    cane: ["dog portrait", "outdoor dog", "companion animal"],
    cavallo: ["horse profile", "pasture", "stable"],
    elefante: ["elephant herd", "savanna", "close portrait"],
    farfalla: ["butterfly macro", "flower landing", "wing profile"],
    gallina: ["chicken coop", "farm yard", "rooster profile"],
    gatto: ["cat portrait", "indoor cat", "window light"],
    mucca: ["cow pasture", "dairy barn", "field profile"],
    pecora: ["sheep pasture", "wool closeup", "flock"],
    ragno: ["spider macro", "web detail", "dark background"],
    scoiattolo: ["squirrel tree", "forest floor", "nut foraging"],
  };

  return Object.entries(originalDistribution).filter(([className]) => className !== "Unlabeled").flatMap(([className, count]) => {
    return Array.from({ length: Math.min(count, 12) }).map((_, index) => ({
      id: `${slug(className)}-${String(index + 1).padStart(3, "0")}`,
      className,
      source: "original",
      scenario: scenarios[className]?.[index % (scenarios[className]?.length ?? 1)] ?? "folder-derived sample",
      status: count < 20 ? "gap candidate" : "accepted",
    }));
  });
}

function buildSyntheticSamples(jobs: GapJob[]): Sample[] {
  return jobs.flatMap((job) => {
    return falSyntheticSamples
      .filter((sample) => sample.finalLabel === job.className)
      .slice(0, job.syntheticCount)
      .map((sample) => ({
        id: sample.id,
        className: job.className,
        source: "synthetic",
        scenario: "bounded Animals-10 class repair",
        status: "Fal AI synthetic",
      }));
  });
}

function makeQueuedStages(): Record<string, StageStatus> {
  return Object.fromEntries(stages.map((stage) => [stage.id, "queued"])) as Record<
    string,
    StageStatus
  >;
}

function renderStageStatus(status: StageStatus) {
  return status === "queued" ? "pending" : status;
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

function buildUiDatasetCsv(records: Sample[]) {
  const columns = ["sample_id", "class", "source", "scenario", "status"];
  const lines = [columns.join(",")];

  for (const sample of records) {
    lines.push([
      csvCell(sample.id),
      csvCell(sample.className),
      csvCell(sample.source),
      csvCell(sample.scenario),
      csvCell(sample.status),
    ].join(","));
  }

  return lines.join("\n");
}

function buildUiReportMarkdown(manifest: {
  dataset: string;
  trainingIntent: string;
  generatedAt: string;
  metrics: { baseline: Metrics; augmented: Metrics | null };
  classDistribution: {
    source: Record<string, number>;
    augmented: Record<string, number>;
  };
  falGeneratedAssets: ReturnType<typeof getFalPreviewAssetManifest>;
}) {
  const augmented = manifest.metrics.augmented;

  return [
    "# DataForge Export Report",
    "",
    `Dataset: ${manifest.dataset}`,
    `Generated: ${manifest.generatedAt}`,
    `Training intent: ${manifest.trainingIntent}`,
    "",
    "## Output Files",
    "- Final dataset CSV: clean sample rows with class, source, scenario, and status.",
    "- This report: quality delta, provider boundaries, and Fal AI provenance.",
    "",
    "## Quality Delta",
    `- Quality: ${manifest.metrics.baseline.quality} -> ${augmented?.quality ?? "pending"}`,
    `- Balance: ${manifest.metrics.baseline.balance} -> ${augmented?.balance ?? "pending"}`,
    `- Coverage: ${manifest.metrics.baseline.coverage} -> ${augmented?.coverage ?? "pending"}`,
    `- Consistency: ${manifest.metrics.baseline.consistency} -> ${augmented?.consistency ?? "pending"}`,
    "",
    "## Sponsor Usage",
    "- OpenAI GPT-5.5: structured quality report and repair-plan copy.",
    "- Adaption Labs: manifest-level baseline and final quality snapshots only.",
    "- Convex: realtime dataset state, pipeline events, review state, and Fal telemetry.",
    "- Fal: cached generated recovery images for measured class gaps, marked synthetic.",
    "- Vercel: Next.js app and API route deployment surface.",
    "",
    "## Fal AI Generated Assets",
    ...manifest.falGeneratedAssets.map((asset) => (
      `- ${asset.className}: ${asset.rawCount} raw + ${asset.generatedCount} generated = ${asset.majorityClassCap}`
    )),
    "",
    "## Readiness Claim",
    "DataForge improves dataset readiness: labeling completeness, balance, consistency, and provenance. It does not claim trained-model accuracy improvement.",
    "",
  ].join("\n");
}

function triggerTextDownload(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createExportStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function csvCell(value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withClientTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}
