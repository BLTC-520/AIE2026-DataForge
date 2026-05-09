"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
// Convex Document IDs: https://docs.convex.dev/using/document-ids
import type { Id } from "../convex/_generated/dataModel";

type StageStatus = "queued" | "running" | "complete" | "error";
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

const originalSamples = buildOriginalSamples();

export default function Home() {
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
    [currentGapJobs],
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
      "Dataset repair loop started with demo-adaption, GPT-5.5 analysis, and demo-fal adapters.",
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

    await step("analyze", "running", "gap_analysis.started", "GPT-5.5 is translating measured gaps into a structured repair plan.", 220);
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

    if (activeDatasetId) {
      await setDatasetStatus({ datasetId: activeDatasetId, status: "balancing" });
    }

    const generatedSamples: Sample[] = [];
    const syntheticSamples = buildSyntheticSamples(plannedGapJobs);
    for (const job of plannedGapJobs) {
      const newSamples = syntheticSamples.filter((sample) => sample.className === job.className);
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
            provider: "demo-fal",
          })),
        });
      }

      await logAndPersistEvent(
        "success",
        "synthetic_samples.generated",
        `${job.syntheticCount} demo-fal records generated for ${job.className}.`,
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
          scenarioGaps: ["low-light wildlife coverage", "camera-trap night scenes"],
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
      dataset: "demo-animal-camera-traps.zip",
      trainingIntent,
      generatedAt: new Date().toISOString(),
      adapters: {
        evaluation: "demo-adaption",
        analysis: qualityReport
          ? `${qualityReport.provider}:${qualityReport.model}`
          : "gpt-5.5-fallback",
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

                <button className="dropzone" type="button" onClick={loadDemoDataset}>
                  <span className="drop-icon" aria-hidden="true">
                    +
                  </span>
                  <span>
                    <strong>Drop dataset ZIP</strong>
                    <small>Mock upload accepts the seeded animal set for this teammate preview.</small>
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
                    Load demo animal dataset
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
                <strong>{datasetLoaded ? "demo-animal-camera-traps.zip" : "No dataset loaded"}</strong>
              </div>

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
                    <dt>Low-light</dt>
                    <dd>{datasetLoaded ? activeDistribution["Low-light Wildlife"] ?? 0 : 0}</dd>
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
              note="Low-light and wildlife gaps"
            />
            <MetricTile
              label="Synthetic samples"
              value={metrics?.synthetic ?? visibleSynthetic.length}
              note="Fal fallback records"
            />
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
                Export manifest
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
        </main>
      </div>
    </>
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
