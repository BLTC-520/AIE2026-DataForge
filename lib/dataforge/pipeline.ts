import { demoPipelineStages } from "./demo-data";
import type { PipelineEvent, PipelineStage, PipelineStageId, StageStatus } from "./types";

export const demoStageOrder = demoPipelineStages.map((stage) => stage.id);

export const demoStageDelays: Record<PipelineStageId, number> = {
  normalize: 420,
  evaluate: 720,
  labelize: 560,
  deduplicate: 520,
  balance: 560,
  repair: 420,
  reevaluate: 720,
  report: 380,
  export: 380,
};

export function createQueuedStages(): PipelineStage[] {
  return demoPipelineStages.map((stage) => ({
    ...stage,
    status: "queued",
    progress: 0,
    message: undefined,
    startedAt: undefined,
    completedAt: undefined,
  }));
}

export function createQueuedStageMap(): Record<PipelineStageId, StageStatus> {
  return Object.fromEntries(demoStageOrder.map((stageId) => [stageId, "queued"])) as Record<
    PipelineStageId,
    StageStatus
  >;
}

export function updateStageStatus(
  stages: PipelineStage[],
  stageId: PipelineStageId,
  status: StageStatus,
  message?: string,
  timestamp = Date.now(),
): PipelineStage[] {
  return stages.map((stage) => {
    if (stage.id !== stageId) {
      return stage;
    }

    return {
      ...stage,
      status,
      message,
      progress: status === "complete" ? 100 : status === "running" ? 20 : stage.progress ?? 0,
      startedAt: status === "running" ? timestamp : stage.startedAt,
      completedAt: status === "complete" ? timestamp : undefined,
    };
  });
}

export function createPipelineEvent(
  eventName: string,
  message: string,
  level: PipelineEvent["level"] = "info",
  metadata?: Record<string, unknown>,
  timestamp = Date.now(),
): PipelineEvent {
  return {
    id: `${eventName}-${timestamp}`,
    timestamp,
    level,
    eventName,
    message,
    metadata,
  };
}

export function getStageDelay(stageId: PipelineStageId) {
  return demoStageDelays[stageId];
}

export function isTerminalStageStatus(status: StageStatus) {
  return status === "complete" || status === "error" || status === "skipped" || status === "degraded";
}
