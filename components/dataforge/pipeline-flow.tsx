import type { ReactNode } from "react";
// React Flow Basic Setup: https://github.com/xyflow/xyflow/blob/main/packages/react/README.md
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Position,
  MarkerType,
  type Edge,
  type Node,
} from "@xyflow/react";
import type { StageStatus } from "../../lib/dataforge/types";
import styles from "./pipeline-flow.module.css";

export type PipelineFlowStage = {
  id: string;
  label: string;
  icon: string;
  status: StageStatus;
};

type PipelineNodeData = {
  label: ReactNode;
  status: StageStatus;
};

const stagePositions = [
  { x: 0, y: 0 },
  { x: 220, y: 0 },
  { x: 440, y: 0 },
  { x: 660, y: 0 },
  { x: 880, y: 0 },
  { x: 880, y: 210 },
  { x: 660, y: 210 },
  { x: 440, y: 210 },
  { x: 220, y: 210 },
];

const statusColor: Record<StageStatus, string> = {
  queued: "#636b62",
  running: "#ffbc42",
  complete: "#54f0b4",
  error: "#ff5d7d",
  skipped: "#636b62",
  degraded: "#52d6ff",
};

const statusClass: Record<StageStatus, string> = {
  queued: styles.queued,
  running: styles.running,
  complete: styles.complete,
  error: styles.error,
  skipped: styles.skipped,
  degraded: styles.degraded,
};

export function PipelineFlow({ stages }: { stages: PipelineFlowStage[] }) {
  const nodes: Node<PipelineNodeData>[] = stages.map((stage, index) => {
    const reverseLane = index >= 5;
    const status = stage.status;

    return {
      id: stage.id,
      type: index === 0 ? "input" : index === stages.length - 1 ? "output" : "default",
      position: stagePositions[index] ?? { x: index * 220, y: 0 },
      sourcePosition: reverseLane ? Position.Left : Position.Right,
      targetPosition: reverseLane ? Position.Right : Position.Left,
      className: `${styles.node} ${statusClass[status]}`,
      data: {
        status,
        label: (
          <span className={styles.nodeShell} data-status={status}>
            <span className={styles.nodeIcon} aria-hidden="true">
              {stage.icon}
            </span>
            <span className={styles.nodeCopy}>
              <strong>{stage.label}</strong>
              <small>{renderStageStatus(status)}</small>
            </span>
          </span>
        ),
      },
      draggable: false,
      selectable: false,
    };
  });

  const edges: Edge[] = stages.slice(0, -1).map((stage, index) => {
    const target = stages[index + 1];
    const sourceStatus = stage.status;
    const targetStatus = target.status;
    const active = sourceStatus === "running" || targetStatus === "running";
    const complete = sourceStatus === "complete" && targetStatus !== "queued";
    const edgeColor = active
      ? statusColor.running
      : complete
        ? statusColor.complete
        : statusColor.queued;

    return {
      id: `${stage.id}-${target.id}`,
      source: stage.id,
      target: target.id,
      type: "smoothstep",
      animated: active,
      className: complete ? styles.edgeComplete : active ? styles.edgeRunning : styles.edgeQueued,
      style: { stroke: edgeColor },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
      },
    };
  });

  return (
    <div className={styles.root} aria-label="React Flow DataForge pipeline graph">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnScroll={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => statusColor[readNodeStatus(node)]}
          nodeStrokeColor={(node) => statusColor[readNodeStatus(node)]}
          maskColor="rgba(9, 11, 12, 0.68)"
        />
        <Controls position="bottom-left" showInteractive={false} />
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(199, 255, 77, 0.24)" />
      </ReactFlow>
    </div>
  );
}

function readNodeStatus(node: Node): StageStatus {
  const status = (node.data as Partial<PipelineNodeData> | undefined)?.status;

  return status === "queued" ||
    status === "running" ||
    status === "complete" ||
    status === "error" ||
    status === "skipped" ||
    status === "degraded"
    ? status
    : "queued";
}

function renderStageStatus(status: StageStatus) {
  return status === "queued" ? "pending" : status;
}
