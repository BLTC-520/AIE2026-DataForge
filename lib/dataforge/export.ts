// Manifest construction. Pure: takes a frozen view of the final dataset
// state and returns a JSON-serializable ExportManifest. The export button
// component just calls this and triggers a Blob download.

import type {
  AdaptionEvaluationSnapshot,
  BalancingPlan,
  DatasetSample,
  DuplicateIssue,
  ExportManifest,
  LabelIssue,
  QualityReport,
} from "./types";

export type BuildExportManifestInput = {
  datasetName: string;
  trainingIntent: string;
  samples: DatasetSample[];
  labelIssues: LabelIssue[];
  duplicateIssues: DuplicateIssue[];
  balancingPlan: BalancingPlan[];
  baselineEvaluation?: AdaptionEvaluationSnapshot | null;
  finalEvaluation?: AdaptionEvaluationSnapshot | null;
  qualityReport?: QualityReport | null;
  metadata?: Record<string, unknown>;
};

export function buildExportManifest(input: BuildExportManifestInput): ExportManifest {
  return {
    product: "DataForge",
    datasetName: input.datasetName,
    trainingIntent: input.trainingIntent,
    generatedAt: new Date().toISOString(),
    samples: input.samples.map(prepareSampleForExport),
    labelIssues: input.labelIssues,
    duplicateIssues: input.duplicateIssues,
    balancingPlan: input.balancingPlan,
    baselineEvaluation: input.baselineEvaluation ?? undefined,
    finalEvaluation: input.finalEvaluation ?? undefined,
    qualityReport: input.qualityReport ?? undefined,
    metadata: {
      ...input.metadata,
      sampleCount: input.samples.length,
      includedSampleCount: input.samples.filter((s) => s.duplicateStatus !== "removed").length,
      labelIssueCount: input.labelIssues.length,
      duplicateIssueCount: input.duplicateIssues.length,
      balancingPlanSize: input.balancingPlan.length,
      // Provider boundary: surfaced on the manifest so anyone reading it
      // understands what each metric source means.
      providerBoundary: {
        adaption:
          "Manifest-level dataset quality evaluation. Adaption Labs did not inspect image pixels.",
        deterministic: "Locally computed from sample list (distribution, completeness, balance).",
        visualAudit:
          "Label suggestions and mislabel detection come from seeded demo truth or GPT Vision/Gemini, not Adaption.",
      },
      // Always-on disclaimer.
      readinessClaim:
        "DataForge improves dataset readiness — labeling completeness, balance, consistency, and provenance. It does not claim trained-model accuracy improvement.",
    },
  };
}

/**
 * Stable JSON serialization for the manifest. Keys are sorted at every
 * level so two runs over the same input produce byte-identical output —
 * important for diff-based review and for reproducible demo recordings.
 */
export function serializeManifest(manifest: ExportManifest): string {
  return JSON.stringify(manifest, sortedKeysReplacer, 2);
}

/**
 * Build a CSV view of the samples — the "training-ready" flat output.
 * The full provenance lives in the JSON manifest; this CSV is the
 * convenience artifact most ML pipelines will actually consume.
 */
export function buildSamplesCsv(samples: DatasetSample[]): string {
  const columns = [
    "sample_key",
    "image_url",
    "final_label",
    "original_label",
    "label_status",
    "label_confidence",
    "label_reason",
    "source",
    "provider",
    "duplicate_status",
    "class_weight",
    "sampling_strategy",
  ] as const;

  const lines = [columns.join(",")];
  for (const sample of samples) {
    if (sample.duplicateStatus === "removed") continue;
    const final = sample.finalLabel ?? sample.currentLabel ?? sample.originalLabel ?? "";
    lines.push(
      [
        csvCell(sample.sampleKey),
        csvCell(sample.imageUrl),
        csvCell(final),
        csvCell(sample.originalLabel),
        csvCell(sample.labelStatus),
        csvCell(sample.labelConfidence),
        csvCell(sample.labelReason),
        csvCell(sample.source),
        csvCell(sample.provider),
        csvCell(sample.duplicateStatus),
        csvCell(sample.classWeight),
        csvCell(sample.samplingStrategy),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prepareSampleForExport(sample: DatasetSample): DatasetSample {
  // Strip any non-serializable bits from metadata. Defensive — the type
  // already says metadata is Record<string, unknown>, but if Convex hands
  // back undefined or class instances they'd serialize poorly.
  const cleanMetadata =
    sample.metadata !== undefined
      ? JSON.parse(JSON.stringify(sample.metadata))
      : undefined;

  return {
    ...sample,
    metadata: cleanMetadata,
  };
}

function sortedKeysReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = (value as Record<string, unknown>)[k];
        return acc;
      }, {});
  }
  return value;
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
