import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
// Convex Document IDs: https://docs.convex.dev/using/document-ids
import type { Doc, Id } from "./_generated/dataModel";

const STAGE_IDS = ["normalize", "evaluate", "labelize", "deduplicate", "balance", "repair", "reevaluate", "report", "export"] as const;
const STAGE_STATUSES = ["queued", "running", "complete", "error", "skipped", "degraded"] as const;
const DATASET_STATUSES = [
  "uploaded",
  "analyzing",
  "evaluated",
  "label_review",
  "analysis_ready",
  "balancing",
  "repairing",
  "reevaluating",
  "report_ready",
  "complete",
  "error",
] as const;

const SOURCE_TYPES = ["original", "synthetic"] as const;
const EVENT_LEVELS = ["info", "warning", "error", "success"] as const;
const QUALITY_STATUSES = ["baseline", "augmented"] as const;
const GAP_STATUSES = ["proposed", "approved", "running", "complete", "error", "rejected"] as const;
const SEVERITY_LEVELS = ["low", "medium", "high"] as const;
const REPAIR_JOB_TYPES = ["generate", "relabel"] as const;
const RELABEL_DECISIONS = ["pending", "accepted", "rejected", "applied", "requires_review"] as const;
const FAL_RUN_STATUSES = ["queued", "running", "complete", "error"] as const;

type StageId = (typeof STAGE_IDS)[number];
type StageStatus = (typeof STAGE_STATUSES)[number];
type StageStatusMap = Record<StageId, StageStatus>;
type LabelingStatus = "original" | "candidate" | "reviewed" | "applied";
type SourceType = (typeof SOURCE_TYPES)[number];
type GapJobRecord = Omit<Doc<"gap_jobs">, "_id" | "_creationTime">;
type SampleRecord = Omit<Doc<"samples">, "_id" | "_creationTime">;

const sampleSchema = {
  sampleId: v.string(),
  className: v.string(),
  source: v.union(...SOURCE_TYPES.map((sourceType) => v.literal(sourceType))),
  scenario: v.string(),
  status: v.string(),
  groundTruthClassName: v.optional(v.string()),
  candidateClassName: v.optional(v.string()),
  labelConfidence: v.optional(v.number()),
  labelingStatus: v.optional(v.union(v.literal("original"), v.literal("candidate"), v.literal("reviewed"), v.literal("applied"))),
  relabelSourceJobId: v.optional(v.id("gap_jobs")),
  relabelReason: v.optional(v.string()),
  reviewedAt: v.optional(v.number()),
  reviewer: v.optional(v.string()),
  prompt: v.optional(v.string()),
  provider: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
};

const gapJobSchema = {
  type: v.optional(v.union(...REPAIR_JOB_TYPES.map((value) => v.literal(value)))),
  className: v.optional(v.string()),
  scenario: v.optional(v.string()),
  currentCount: v.optional(v.number()),
  targetCount: v.optional(v.number()),
  syntheticCount: v.optional(v.number()),
  severity: v.optional(v.union(...SEVERITY_LEVELS.map((value) => v.literal(value)))),
  accent: v.optional(v.string()),
  prompt: v.optional(v.string()),
  status: v.optional(v.union(...GAP_STATUSES.map((value) => v.literal(value)))),
  falJobId: v.optional(v.string()),
  imagesGenerated: v.optional(v.number()),
  sampleId: v.optional(v.id("samples")),
  fromClassName: v.optional(v.string()),
  toClassName: v.optional(v.string()),
  confidence: v.optional(v.number()),
  reasoning: v.optional(v.string()),
  decision: v.optional(v.union(...RELABEL_DECISIONS.map((value) => v.literal(value)))),
  reviewedAt: v.optional(v.number()),
  reviewer: v.optional(v.string()),
  providerInput: v.optional(v.any()),
  providerOutput: v.optional(v.any()),
};

const falRunSchema = {
  provider: v.string(),
  providerRunId: v.optional(v.string()),
  status: v.union(...FAL_RUN_STATUSES.map((value) => v.literal(value))),
  requestedPayload: v.optional(v.any()),
  responsePayload: v.optional(v.any()),
  errorMessage: v.optional(v.string()),
  imageCount: v.optional(v.number()),
  updatedRecords: v.optional(v.number()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
};

function parseGapStatus(value: unknown) {
  return value === "approved" || value === "running" || value === "complete" || value === "error" || value === "rejected"
    ? value
    : "proposed";
}

function parseRelabelDecision(value: unknown) {
  return value === "accepted" || value === "applied" || value === "rejected" || value === "requires_review"
    ? value
    : value === "pending"
      ? "pending"
      : undefined;
}

function parseSeverity(value: unknown) {
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function parseLabelingStatus(value: unknown): LabelingStatus | undefined {
  return value === "original" ||
    value === "candidate" ||
    value === "reviewed" ||
    value === "applied"
    ? value
    : undefined;
}

function parseSourceType(value: unknown): SourceType {
  return value === "synthetic" ? "synthetic" : "original";
}

function parseGapJobId(value: unknown): Id<"gap_jobs"> | undefined {
  return typeof value === "string" ? value as Id<"gap_jobs"> : undefined;
}

function parseSampleId(value: unknown): Id<"samples"> | undefined {
  return typeof value === "string" ? value as Id<"samples"> : undefined;
}

function normalizeToInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
}

function normalizeToRatio(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function normalizeRepairJob(datasetId: Id<"datasets">, value: Record<string, unknown>): GapJobRecord {
  const nowTimestamp = now();
  const status = parseGapStatus(value.status);

  const jobType = value.type === "relabel" ? "relabel" : "generate";
  const syntheticCount = normalizeToInteger(value.syntheticCount, 0);
  const imagesGenerated = normalizeToInteger(value.imagesGenerated, 0);
  const currentCount = typeof value.currentCount === "number" && Number.isFinite(value.currentCount)
    ? Math.max(0, Math.round(value.currentCount))
    : undefined;
  const targetCount = typeof value.targetCount === "number" && Number.isFinite(value.targetCount)
    ? Math.max(0, Math.round(value.targetCount))
    : undefined;
  const confidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? normalizeToRatio(value.confidence, 0)
      : undefined;

  return {
    datasetId,
    type: jobType,
    className: typeof value.className === "string" ? value.className : undefined,
    scenario: typeof value.scenario === "string" ? value.scenario : undefined,
    currentCount,
    targetCount,
    syntheticCount,
    severity: parseSeverity(value.severity),
    accent: typeof value.accent === "string" ? value.accent : undefined,
    prompt: typeof value.prompt === "string" ? value.prompt : undefined,
    status,
    falJobId: typeof value.falJobId === "string" ? value.falJobId : undefined,
    imagesGenerated,
    sampleId: parseSampleId(value.sampleId),
    fromClassName:
      typeof value.fromClassName === "string" ? value.fromClassName : undefined,
    toClassName: typeof value.toClassName === "string" ? value.toClassName : undefined,
    confidence,
    reasoning: typeof value.reasoning === "string" ? value.reasoning : undefined,
    decision: parseRelabelDecision(value.decision),
    reviewedAt: typeof value.reviewedAt === "number" && Number.isFinite(value.reviewedAt)
      ? value.reviewedAt
      : undefined,
    reviewer: typeof value.reviewer === "string" ? value.reviewer : undefined,
    providerInput: value.providerInput,
    providerOutput: value.providerOutput,
    createdAt: nowTimestamp,
    updatedAt: nowTimestamp,
  };
}

function normalizeSampleRecord(datasetId: Id<"datasets">, value: Record<string, unknown>): SampleRecord {
  const nowTimestamp = now();
  const source = parseSourceType(value.source);
  const status = typeof value.status === "string" ? value.status : "received";

  return {
    datasetId,
    sampleId: typeof value.sampleId === "string" ? value.sampleId : `sample-${nowTimestamp}`,
    className: typeof value.className === "string" ? value.className : "Unknown",
    source,
    scenario: typeof value.scenario === "string" ? value.scenario : "unlabeled",
    status,
    groundTruthClassName:
      typeof value.groundTruthClassName === "string" ? value.groundTruthClassName : undefined,
    candidateClassName:
      typeof value.candidateClassName === "string" ? value.candidateClassName : undefined,
    labelConfidence:
      typeof value.labelConfidence === "number" && Number.isFinite(value.labelConfidence)
        ? normalizeToRatio(value.labelConfidence, 0)
        : undefined,
    labelingStatus: parseLabelingStatus(value.labelingStatus),
    relabelSourceJobId: parseGapJobId(value.relabelSourceJobId),
    relabelReason: typeof value.relabelReason === "string" ? value.relabelReason : undefined,
    reviewedAt:
      typeof value.reviewedAt === "number" && Number.isFinite(value.reviewedAt)
        ? value.reviewedAt
        : undefined,
    reviewer: typeof value.reviewer === "string" ? value.reviewer : undefined,
    prompt: typeof value.prompt === "string" ? value.prompt : undefined,
    provider: typeof value.provider === "string" ? value.provider : undefined,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    createdAt: nowTimestamp,
  };
}

function resolveGapStatusFromDecision(decision: (typeof RELABEL_DECISIONS)[number]) {
  if (decision === "accepted") return "approved";
  if (decision === "applied") return "complete";
  if (decision === "rejected") return "rejected";
  return "proposed";
}

function resolveLabelingStatusFromDecision(decision: (typeof RELABEL_DECISIONS)[number]) {
  if (decision === "applied") return "applied";
  if (decision === "accepted") return "reviewed";
  return undefined;
}

async function applyRelabelDecisionToSample(ctx: any, job: any, reviewedAt: number, decision: (typeof RELABEL_DECISIONS)[number]) {
  const sampleId = parseSampleId(job.sampleId);
  const toClassName = job.toClassName;

  if (!sampleId || typeof toClassName !== "string") {
    return;
  }

  const sample = await ctx.db.get(sampleId);
  if (!sample) return;

  const samplePatch: Record<string, unknown> = {
    relabelSourceJobId: job._id,
    relabelReason: typeof job.reasoning === "string" ? job.reasoning : sample.relabelReason,
    reviewedAt,
    reviewer: typeof job.reviewer === "string" ? job.reviewer : sample.reviewer,
  };

  const labelingStatus = resolveLabelingStatusFromDecision(decision);
  if (labelingStatus) {
    samplePatch.labelingStatus = labelingStatus;
  }

  samplePatch.labelConfidence =
    typeof job.confidence === "number" && Number.isFinite(job.confidence)
      ? normalizeToRatio(job.confidence, 0)
      : sample.labelConfidence;

  if (typeof job.fromClassName === "string") {
    samplePatch.groundTruthClassName = job.fromClassName;
  }

  samplePatch.candidateClassName = toClassName;

  if (decision === "applied") {
    samplePatch.className = toClassName;
  }

  await ctx.db.patch(sampleId, samplePatch);
}

type MetricShape = {
  quality: number;
  balance: number;
  coverage: number;
  consistency: number;
};

function now() {
  return Date.now();
}

function isStageId(value: string): value is StageId {
  return (STAGE_IDS as readonly string[]).includes(value);
}

function isStageStatus(value: string): value is StageStatus {
  return (STAGE_STATUSES as readonly string[]).includes(value);
}

async function upsertByVersion(
  ctx: any,
  datasetId: any,
  version: "baseline" | "augmented",
  payload: {
    provider: string;
    quality: number;
    balance: number;
    coverage: number;
    consistency: number;
    syntheticCount?: number;
    classDistribution: Record<string, number>;
    rawMetrics?: unknown;
  },
) {
  const existing = await ctx.db
    .query("evaluation_snapshots")
    .withIndex("by_dataset_version", (q: any) => q.eq("datasetId", datasetId).eq("version", version))
    .first();

  const record = {
    datasetId,
    version,
    provider: payload.provider,
    qualityScore: payload.quality,
    balanceScore: payload.balance,
    coverageScore: payload.coverage,
    consistencyScore: payload.consistency,
    syntheticCount: payload.syntheticCount,
    classDistribution: payload.classDistribution,
    rawMetrics: payload.rawMetrics,
    createdAt: now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, record);
    return;
  }

  await ctx.db.insert("evaluation_snapshots", record);
}

function normalizeStageStatuses(stages: Array<{ stage: string; status: string }>): StageStatusMap {
  const map = Object.fromEntries(STAGE_IDS.map((stage) => [stage, "queued"])) as StageStatusMap;

  for (const stage of stages) {
    if (isStageId(stage.stage) && isStageStatus(stage.status)) {
      map[stage.stage] = stage.status;
    }
  }

  return map;
}

export const createDemoDataset = mutation({
  args: {
    datasetName: v.string(),
    trainingIntent: v.string(),
    classDistribution: v.record(v.string(), v.number()),
    sampleCount: v.number(),
    classCount: v.number(),
    baselineMetrics: v.object({
      quality: v.number(),
      balance: v.number(),
      coverage: v.number(),
      consistency: v.number(),
    }),
    originalSamples: v.array(v.object(sampleSchema)),
  },
  handler: async (ctx, args) => {
    const created = now();

    const datasetId = await ctx.db.insert("datasets", {
      name: args.datasetName,
      status: "uploaded",
      trainingIntent: args.trainingIntent,
      sourceAssetName: args.datasetName,
      classDistribution: args.classDistribution,
      sampleCount: args.sampleCount,
      classCount: args.classCount,
      createdAt: created,
      updatedAt: created,
    });

    for (const stage of STAGE_IDS) {
      await ctx.db.insert("pipeline_stages", {
        datasetId,
        stage,
        status: stage === "normalize" ? "complete" : "queued",
        message: stage === "normalize" ? "Source manifest normalized from folder-derived labels." : "Waiting in queue.",
        progress: stage === "normalize" ? 100 : 0,
        startedAt: stage === "normalize" ? created : undefined,
        completedAt: stage === "normalize" ? created : undefined,
        updatedAt: created,
      });
    }

    for (const sample of args.originalSamples) {
      await ctx.db.insert("samples", normalizeSampleRecord(datasetId, sample));
    }

    await upsertByVersion(ctx, datasetId, "baseline", {
      provider: "demo-adaption",
      quality: args.baselineMetrics.quality,
      balance: args.baselineMetrics.balance,
      coverage: args.baselineMetrics.coverage,
      consistency: args.baselineMetrics.consistency,
      syntheticCount: 0,
      classDistribution: args.classDistribution,
      rawMetrics: args.baselineMetrics,
    });

    await ctx.db.insert("events", {
      datasetId,
      timestamp: created,
      level: "info",
      eventName: "dataset.created",
      message: `${args.datasetName} loaded into Convex with ${args.sampleCount} records and ${args.classCount} classes.`,
      metadata: {
        source: args.datasetName,
        baselineQuality: args.baselineMetrics,
      },
    });

    return { datasetId };
  },
});

export const setDatasetStatus = mutation({
  args: {
    datasetId: v.id("datasets"),
    status: v.union(...DATASET_STATUSES.map((value) => v.literal(value))),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.datasetId, {
      status: args.status,
      updatedAt: now(),
    });
  },
});

export const setStageStatus = mutation({
  args: {
    datasetId: v.id("datasets"),
    stage: v.union(...STAGE_IDS.map((value) => v.literal(value))),
    status: v.union(...STAGE_STATUSES.map((value) => v.literal(value))),
    message: v.optional(v.string()),
    progress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stage = await ctx.db
      .query("pipeline_stages")
      .withIndex("by_dataset_stage", (q: any) => q.eq("datasetId", args.datasetId).eq("stage", args.stage))
      .first();

    const timestamp = now();

    if (!stage) {
      await ctx.db.insert("pipeline_stages", {
        datasetId: args.datasetId,
        stage: args.stage,
        status: args.status,
        message: args.message,
        progress: args.progress,
        startedAt: args.status === "running" || args.status === "complete" ? timestamp : undefined,
        completedAt: args.status === "complete" ? timestamp : undefined,
        updatedAt: timestamp,
      });
      return;
    }

    await ctx.db.patch(stage._id, {
      status: args.status,
      message: args.message,
      progress: args.progress,
      updatedAt: timestamp,
      ...(args.status === "running" && !stage.startedAt ? { startedAt: timestamp } : {}),
      ...(args.status === "complete" ? { completedAt: timestamp } : {}),
    });
  },
});

export const appendEvent = mutation({
  args: {
    datasetId: v.id("datasets"),
    level: v.union(...EVENT_LEVELS.map((value) => v.literal(value))),
    eventName: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      datasetId: args.datasetId,
      timestamp: now(),
      level: args.level,
      eventName: args.eventName,
      message: args.message,
      metadata: args.metadata,
    });
  },
});

export const saveBaselineSnapshot = mutation({
  args: {
    datasetId: v.id("datasets"),
    provider: v.string(),
    quality: v.number(),
    balance: v.number(),
    coverage: v.number(),
    consistency: v.number(),
    syntheticCount: v.optional(v.number()),
    classDistribution: v.record(v.string(), v.number()),
    rawMetrics: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await upsertByVersion(ctx, args.datasetId, "baseline", {
      provider: args.provider,
      quality: args.quality,
      balance: args.balance,
      coverage: args.coverage,
      consistency: args.consistency,
      syntheticCount: args.syntheticCount,
      classDistribution: args.classDistribution,
      rawMetrics: args.rawMetrics,
    });
  },
});

export const saveAugmentedSnapshot = mutation({
  args: {
    datasetId: v.id("datasets"),
    provider: v.string(),
    quality: v.number(),
    balance: v.number(),
    coverage: v.number(),
    consistency: v.number(),
    syntheticCount: v.number(),
    classDistribution: v.record(v.string(), v.number()),
    rawMetrics: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await upsertByVersion(ctx, args.datasetId, "augmented", {
      provider: args.provider,
      quality: args.quality,
      balance: args.balance,
      coverage: args.coverage,
      consistency: args.consistency,
      syntheticCount: args.syntheticCount,
      classDistribution: args.classDistribution,
      rawMetrics: args.rawMetrics,
    });
  },
});

export const saveQualityReport = mutation({
  args: {
    datasetId: v.id("datasets"),
    provider: v.string(),
    model: v.string(),
    responseId: v.optional(v.string()),
    fallbackReason: v.optional(v.string()),
    measuredFindings: v.array(v.string()),
    repairPlan: v.array(v.string()),
    completionSummary: v.array(v.string()),
    nextSteps: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("quality_reports")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", args.datasetId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        model: args.model,
        responseId: args.responseId,
        fallbackReason: args.fallbackReason,
        measuredFindings: args.measuredFindings,
        repairPlan: args.repairPlan,
        completionSummary: args.completionSummary,
        nextSteps: args.nextSteps,
        createdAt: now(),
      });
      return;
    }

    await ctx.db.insert("quality_reports", {
      datasetId: args.datasetId,
      provider: args.provider,
      model: args.model,
      responseId: args.responseId,
      fallbackReason: args.fallbackReason,
      measuredFindings: args.measuredFindings,
      repairPlan: args.repairPlan,
      completionSummary: args.completionSummary,
      nextSteps: args.nextSteps,
      createdAt: now(),
    });
  },
});

export const saveGapJobs = mutation({
  args: {
    datasetId: v.id("datasets"),
    gapJobs: v.array(v.object(gapJobSchema)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gap_jobs")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", args.datasetId))
      .collect();

    for (const existingJob of existing) {
      if (existingJob.type !== "relabel") {
        await ctx.db.delete(existingJob._id);
      }
    }

    for (const gapJob of args.gapJobs) {
      await ctx.db.insert("gap_jobs", normalizeRepairJob(args.datasetId, gapJob));
    }
  },
});

export const saveRelabelJobs = mutation({
  args: {
    datasetId: v.id("datasets"),
    gapJobs: v.array(
      v.object({
        ...gapJobSchema,
        type: v.literal("relabel"),
        sampleId: v.id("samples"),
        fromClassName: v.string(),
        toClassName: v.string(),
        confidence: v.optional(v.number()),
        reasoning: v.optional(v.string()),
        decision: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"), v.literal("applied"), v.literal("requires_review"))),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gap_jobs")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", args.datasetId))
      .collect();

    for (const existingJob of existing) {
      const existingIsRelabel =
        existingJob.type === "relabel" ||
        typeof existingJob.fromClassName === "string" ||
        typeof existingJob.toClassName === "string";

      if (existingIsRelabel) {
        await ctx.db.delete(existingJob._id);
      }
    }

    for (const gapJob of args.gapJobs) {
      await ctx.db.insert("gap_jobs", {
        ...normalizeRepairJob(args.datasetId, gapJob),
        type: "relabel",
      });
    }
  },
});

export const setRelabelDecision = mutation({
  args: {
    jobId: v.id("gap_jobs"),
    decision: v.union(...RELABEL_DECISIONS.map((value) => v.literal(value))),
    reviewer: v.optional(v.string()),
    reasoning: v.optional(v.string()),
    confidence: v.optional(v.number()),
    reviewerOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const gapJob = await ctx.db.get(args.jobId);
    if (!gapJob) return;

    const reviewedAt = now();
    const patch: Record<string, unknown> = {
      reviewedAt,
      updatedAt: reviewedAt,
      status: resolveGapStatusFromDecision(args.decision),
      decision: args.decision,
      reviewer: args.reviewer || args.reviewerOverride,
    };

    if (typeof args.reasoning === "string") {
      patch.reasoning = args.reasoning;
    }

    if (typeof args.confidence === "number" && Number.isFinite(args.confidence)) {
      patch.confidence = normalizeToRatio(args.confidence, 0);
    }

    await ctx.db.patch(args.jobId, patch);

    if (gapJob.type === "relabel") {
      await applyRelabelDecisionToSample(ctx, {
        ...gapJob,
        ...patch,
      }, reviewedAt, args.decision);
    }
  },
});

export const createFalJobRun = mutation({
  args: {
    datasetId: v.id("datasets"),
    jobId: v.optional(v.id("gap_jobs")),
    provider: v.string(),
    providerRunId: v.optional(v.string()),
    status: v.union(...FAL_RUN_STATUSES.map((value) => v.literal(value))),
    requestedPayload: v.optional(v.any()),
    responsePayload: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    imageCount: v.optional(v.number()),
    updatedRecords: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const nowTimestamp = now();
    const runId = await ctx.db.insert("fal_job_runs", {
      datasetId: args.datasetId,
      jobId: args.jobId,
      provider: args.provider,
      providerRunId: args.providerRunId,
      status: args.status,
      requestedPayload: args.requestedPayload,
      responsePayload: args.responsePayload,
      errorMessage: args.errorMessage,
      imageCount: args.imageCount,
      updatedRecords: args.updatedRecords,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      createdAt: nowTimestamp,
    });

    if (args.jobId && args.providerRunId) {
      const job = await ctx.db.get(args.jobId);
      if (job) {
        await ctx.db.patch(args.jobId, {
          falJobId: args.providerRunId,
          updatedAt: nowTimestamp,
        });
      }
    }

    return { runId };
  },
});

export const updateFalJobRun = mutation({
  args: {
    runId: v.id("fal_job_runs"),
    status: v.optional(v.union(...FAL_RUN_STATUSES.map((value) => v.literal(value)))),
    responsePayload: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    imageCount: v.optional(v.number()),
    updatedRecords: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const nowTimestamp = now();
    const existing = await ctx.db.get(args.runId);

    if (!existing) {
      return;
    }

    const patch: Record<string, unknown> = {
      updatedAt: nowTimestamp,
      ...(typeof args.responsePayload !== "undefined" ? { responsePayload: args.responsePayload } : {}),
      ...(typeof args.errorMessage !== "undefined" ? { errorMessage: args.errorMessage } : {}),
      ...(typeof args.imageCount === "number" && Number.isFinite(args.imageCount)
        ? { imageCount: args.imageCount }
        : {}),
      ...(typeof args.updatedRecords === "number" && Number.isFinite(args.updatedRecords)
        ? { updatedRecords: args.updatedRecords }
        : {}),
      ...(typeof args.startedAt === "number" && Number.isFinite(args.startedAt)
        ? { startedAt: args.startedAt }
        : {}),
      ...(typeof args.completedAt === "number" && Number.isFinite(args.completedAt)
        ? { completedAt: args.completedAt }
        : {}),
    };

    if (args.status) {
      patch.status = args.status;
    }

    await ctx.db.patch(args.runId, patch);
  },
});

export const getGapJobs = query({
  args: {
    datasetId: v.id("datasets"),
    type: v.optional(v.union(...REPAIR_JOB_TYPES.map((value) => v.literal(value)))),
  },
  handler: async (ctx, args) => {
    const gapJobs = await ctx.db
      .query("gap_jobs")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", args.datasetId))
      .collect();

    if (!args.type) {
      return gapJobs;
    }

    return gapJobs.filter((job) => job.type === args.type);
  },
});

export const getFalJobRuns = query({
  args: {
    datasetId: v.id("datasets"),
    jobId: v.optional(v.id("gap_jobs")),
  },
  handler: async (ctx, args) => {
    const falJobRuns = await ctx.db
      .query("fal_job_runs")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", args.datasetId))
      .collect();

    if (!args.jobId) {
      return falJobRuns;
    }

    return falJobRuns.filter((run) => run.jobId === args.jobId);
  },
});

export const addSamples = mutation({
  args: {
    datasetId: v.id("datasets"),
    samples: v.array(v.object(sampleSchema)),
  },
  handler: async (ctx, args) => {
    for (const sample of args.samples) {
      await ctx.db.insert("samples", normalizeSampleRecord(args.datasetId, sample));
    }
  },
});

export const runDemoPipeline = action({
  args: { datasetId: v.id("datasets") },
  handler: async () => {
    throw new Error("Run orchestration from client for this MVP.");
  },
});

export const getDashboardState = query({
  args: { datasetId: v.optional(v.id("datasets")) },
  handler: async (ctx, args) => {
    const dataset = args.datasetId
      ? await ctx.db.get(args.datasetId)
      : await ctx.db
          .query("datasets")
          .withIndex("by_created", (q: any) => q.order("desc" as const))
          .first();

    if (!dataset) {
      return null;
    }

    const stages = await ctx.db
      .query("pipeline_stages")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", dataset._id))
      .collect();

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", dataset._id))
      .collect();

    const events = await ctx.db
      .query("events")
      .withIndex("by_dataset_timestamp", (q: any) => q.eq("datasetId", dataset._id))
      .collect();

    const [baselineSnapshot, augmentedSnapshot] = await Promise.all([
      ctx.db
        .query("evaluation_snapshots")
        .withIndex("by_dataset_version", (q: any) => q.eq("datasetId", dataset._id).eq("version", "baseline"))
        .first(),
      ctx.db
        .query("evaluation_snapshots")
        .withIndex("by_dataset_version", (q: any) => q.eq("datasetId", dataset._id).eq("version", "augmented"))
        .first(),
    ]);

    const qualityReport = await ctx.db
      .query("quality_reports")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", dataset._id))
      .first();

    const gapJobs = await ctx.db
      .query("gap_jobs")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", dataset._id))
      .collect();

    const falJobRuns = await ctx.db
      .query("fal_job_runs")
      .withIndex("by_dataset", (q: any) => q.eq("datasetId", dataset._id))
      .collect();

    return {
      dataset,
      stages,
      samples,
      events,
      baselineSnapshot,
      augmentedSnapshot,
      qualityReport,
      gapJobs,
      falJobRuns,
      stageStatuses: normalizeStageStatuses(stages),
      isPipelineActive:
        dataset.status === "analyzing" ||
        dataset.status === "evaluated" ||
        dataset.status === "label_review" ||
        dataset.status === "analysis_ready" ||
        dataset.status === "balancing" ||
        dataset.status === "repairing" ||
        dataset.status === "reevaluating" ||
        dataset.status === "report_ready",
      };
  },
});
