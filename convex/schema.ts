import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const stageNames = ["upload", "evaluate", "analyze", "generate", "reevaluate", "export"] as const;
const stageStatuses = ["queued", "running", "complete", "error"] as const;
const sourceTypes = ["original", "synthetic"] as const;
const gapStatuses = ["proposed", "approved", "running", "complete", "error", "rejected"] as const;
const severityLevels = ["low", "medium", "high"] as const;
const repairJobTypes = ["generate", "relabel"] as const;
const relabelDecisions = ["pending", "accepted", "rejected", "applied", "requires_review"] as const;
const labelingStatuses = ["original", "candidate", "reviewed", "applied"] as const;
const falRunStatuses = ["queued", "running", "complete", "error"] as const;
const datasetStatuses = [
  "uploaded",
  "analyzing",
  "evaluated",
  "label_review",
  "analysis_ready",
  "balancing",
  "reevaluating",
  "complete",
  "error",
] as const;

export default defineSchema({
  datasets: defineTable({
    name: v.string(),
    status: v.union(...datasetStatuses.map((status) => v.literal(status))),
    trainingIntent: v.string(),
    sourceAssetName: v.optional(v.string()),
    classDistribution: v.record(v.string(), v.number()),
    sampleCount: v.number(),
    classCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_created", ["createdAt"]),

  pipeline_stages: defineTable({
    datasetId: v.id("datasets"),
    stage: v.union(...stageNames.map((stage) => v.literal(stage))),
    status: v.union(...stageStatuses.map((status) => v.literal(status))),
    message: v.optional(v.string()),
    progress: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_dataset", ["datasetId"])
    .index("by_dataset_stage", ["datasetId", "stage"]),

  samples: defineTable({
    datasetId: v.id("datasets"),
    sampleId: v.string(),
    className: v.string(),
    source: v.union(...sourceTypes.map((sourceType) => v.literal(sourceType))),
    scenario: v.string(),
    status: v.string(),
    groundTruthClassName: v.optional(v.string()),
    candidateClassName: v.optional(v.string()),
    labelConfidence: v.optional(v.number()),
    labelingStatus: v.optional(v.union(...labelingStatuses.map((status) => v.literal(status)))),
    relabelSourceJobId: v.optional(v.id("gap_jobs")),
    relabelReason: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewer: v.optional(v.string()),
    prompt: v.optional(v.string()),
    provider: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_dataset", ["datasetId"])
    .index("by_dataset_source", ["datasetId", "source"]),

  evaluation_snapshots: defineTable({
    datasetId: v.id("datasets"),
    version: v.union(v.literal("baseline"), v.literal("augmented")),
    provider: v.string(),
    qualityScore: v.number(),
    balanceScore: v.number(),
    coverageScore: v.number(),
    consistencyScore: v.number(),
    syntheticCount: v.optional(v.number()),
    classDistribution: v.record(v.string(), v.number()),
    rawMetrics: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_dataset", ["datasetId"])
    .index("by_dataset_version", ["datasetId", "version"]),

  quality_reports: defineTable({
    datasetId: v.id("datasets"),
    provider: v.string(),
    model: v.string(),
    responseId: v.optional(v.string()),
    fallbackReason: v.optional(v.string()),
    measuredFindings: v.array(v.string()),
    repairPlan: v.array(v.string()),
    completionSummary: v.array(v.string()),
    nextSteps: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_dataset", ["datasetId"]),

  gap_jobs: defineTable({
    datasetId: v.id("datasets"),
    type: v.optional(v.union(...repairJobTypes.map((value) => v.literal(value)))),
    className: v.optional(v.string()),
    scenario: v.optional(v.string()),
    currentCount: v.optional(v.number()),
    targetCount: v.optional(v.number()),
    syntheticCount: v.optional(v.number()),
    severity: v.optional(v.union(...severityLevels.map((severityLevel) => v.literal(severityLevel)))),
    accent: v.optional(v.string()),
    prompt: v.optional(v.string()),
    status: v.union(...gapStatuses.map((gapStatus) => v.literal(gapStatus))),
    falJobId: v.optional(v.string()),
    imagesGenerated: v.optional(v.number()),
    sampleId: v.optional(v.id("samples")),
    fromClassName: v.optional(v.string()),
    toClassName: v.optional(v.string()),
    confidence: v.optional(v.number()),
    reasoning: v.optional(v.string()),
    decision: v.optional(v.union(...relabelDecisions.map((decision) => v.literal(decision)))),
    reviewedAt: v.optional(v.number()),
    reviewer: v.optional(v.string()),
    providerInput: v.optional(v.any()),
    providerOutput: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dataset", ["datasetId"])
    .index("by_dataset_status", ["datasetId", "status"]),

  fal_job_runs: defineTable({
    datasetId: v.id("datasets"),
    jobId: v.optional(v.id("gap_jobs")),
    provider: v.string(),
    providerRunId: v.optional(v.string()),
    status: v.union(...falRunStatuses.map((status) => v.literal(status))),
    requestedPayload: v.optional(v.any()),
    responsePayload: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    imageCount: v.optional(v.number()),
    updatedRecords: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_dataset", ["datasetId"])
    .index("by_dataset_job", ["datasetId", "jobId"]),

  events: defineTable({
    datasetId: v.id("datasets"),
    timestamp: v.number(),
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("success")),
    eventName: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_dataset_timestamp", ["datasetId", "timestamp"]),
});
