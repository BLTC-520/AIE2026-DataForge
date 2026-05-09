// Cleaned-dataset ZIP builder.
//
// Output structure:
//   <Class A>/<filename>           ← samples whose finalLabel is "Class A"
//   <Class B>/<filename>
//   _unlabeled/<filename>          ← samples still missing a final label
//   manifest.json                  ← full provenance (matches buildExportManifest)
//   labels.csv                     ← flat CSV view (one row per included sample)
//   README.md                      ← describes structure + provider boundary
//
// Excluded from the ZIP entirely:
//   - samples whose duplicateStatus === "removed"
//
// Excluded sample bytes that are missing from imageBlobs (e.g. seeded demo
// data without real bytes) are noted in the README's "Missing bytes" section
// rather than silently dropped — so the consumer of the ZIP knows what's up.

import JSZip from "jszip";
import type {
  AdaptionEvaluationSnapshot,
  BalancingPlan,
  DatasetSample,
  DuplicateIssue,
  LabelIssue,
  QualityReport,
} from "./types";
import { buildExportManifest, buildSamplesCsv, serializeManifest } from "./export";

export type BuildCleanDatasetZipInput = {
  datasetName: string;
  trainingIntent: string;
  samples: DatasetSample[];
  labelIssues: LabelIssue[];
  duplicateIssues: DuplicateIssue[];
  balancingPlan: BalancingPlan[];
  baselineEvaluation?: AdaptionEvaluationSnapshot | null;
  finalEvaluation?: AdaptionEvaluationSnapshot | null;
  qualityReport?: QualityReport | null;
  /** sampleKey → original Blob bytes. Samples with no entry are noted. */
  imageBlobs: Map<string, Blob>;
};

export type BuildCleanDatasetZipResult = {
  blob: Blob;
  includedCount: number;
  removedCount: number;
  missingByteCount: number;
};

export async function buildCleanDatasetZip(
  input: BuildCleanDatasetZipInput,
): Promise<BuildCleanDatasetZipResult> {
  const zip = new JSZip();
  let includedCount = 0;
  let removedCount = 0;
  let missingByteCount = 0;
  const missingByteSamples: string[] = [];
  const usedNames = new Set<string>();

  for (const sample of input.samples) {
    if (sample.duplicateStatus === "removed") {
      removedCount++;
      continue;
    }

    const blob = input.imageBlobs.get(sample.sampleKey);
    if (!blob) {
      missingByteCount++;
      if (missingByteSamples.length < 10) missingByteSamples.push(sample.sampleKey);
      continue;
    }

    const folder = chooseFolder(sample);
    const fileName = uniqueFileName(usedNames, folder, originalFileName(sample));
    // ArrayBuffer is the most portable shape JSZip accepts (browser Blob
    // works directly in browsers, but Node's Blob is rejected — convert
    // once here so this works in both runtimes).
    const bytes = await blob.arrayBuffer();
    zip.file(`${folder}/${fileName}`, bytes);
    includedCount++;
  }

  // ── manifest.json — full provenance, JSON-serializable ──────────────────
  const manifest = buildExportManifest({
    datasetName: input.datasetName,
    trainingIntent: input.trainingIntent,
    samples: input.samples,
    labelIssues: input.labelIssues,
    duplicateIssues: input.duplicateIssues,
    balancingPlan: input.balancingPlan,
    baselineEvaluation: input.baselineEvaluation ?? undefined,
    finalEvaluation: input.finalEvaluation ?? undefined,
    qualityReport: input.qualityReport ?? undefined,
    metadata: {
      exportedAs: "cleaned-dataset-zip",
      bundledImageCount: includedCount,
      removedDuplicateCount: removedCount,
      missingImageBytesCount: missingByteCount,
    },
  });
  zip.file("manifest.json", serializeManifest(manifest));

  // ── labels.csv — flat training-ready labels ─────────────────────────────
  const includedSamples = input.samples.filter(
    (s) => s.duplicateStatus !== "removed" && input.imageBlobs.has(s.sampleKey),
  );
  zip.file("labels.csv", buildSamplesCsv(includedSamples));

  // ── README.md — describe structure + provider boundary ─────────────────
  zip.file(
    "README.md",
    buildReadme({
      datasetName: input.datasetName,
      includedCount,
      removedCount,
      missingByteCount,
      missingByteSamples,
      classCount:
        manifest.finalEvaluation?.classDistribution &&
        Object.keys(manifest.finalEvaluation.classDistribution).length,
    }),
  );

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { blob, includedCount, removedCount, missingByteCount };
}

// ─── helpers ───────────────────────────────────────────────────────────────

function chooseFolder(sample: DatasetSample): string {
  const label = sample.finalLabel ?? sample.currentLabel ?? sample.originalLabel;
  if (!label) return "_unlabeled";
  // Sanitize for ZIP path safety; allow letters, digits, dash, underscore, space.
  return label.replace(/[^a-zA-Z0-9 _.-]+/g, "-").trim() || "_unlabeled";
}

function originalFileName(sample: DatasetSample): string {
  const path =
    typeof sample.metadata?.path === "string" ? (sample.metadata.path as string) : "";
  const base = path.split("/").filter(Boolean).pop() ?? `${sample.id}.bin`;
  // Strip path separators and other unsafe chars.
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/**
 * Disambiguate when two samples in the same target folder share a basename.
 * Append `-1`, `-2`, etc. before the extension.
 */
function uniqueFileName(
  used: Set<string>,
  folder: string,
  desired: string,
): string {
  const key = `${folder}/${desired}`;
  if (!used.has(key)) {
    used.add(key);
    return desired;
  }
  const dot = desired.lastIndexOf(".");
  const stem = dot === -1 ? desired : desired.slice(0, dot);
  const ext = dot === -1 ? "" : desired.slice(dot);
  let n = 1;
  while (used.has(`${folder}/${stem}-${n}${ext}`)) n++;
  const final = `${stem}-${n}${ext}`;
  used.add(`${folder}/${final}`);
  return final;
}

function buildReadme(args: {
  datasetName: string;
  includedCount: number;
  removedCount: number;
  missingByteCount: number;
  missingByteSamples: string[];
  classCount?: number;
}): string {
  const missingNote =
    args.missingByteCount === 0
      ? ""
      : `\n## Missing image bytes\n\n${args.missingByteCount} sample(s) had ` +
        `no image bytes available at export time and were not included in the ` +
        `bundle. Their metadata is still present in \`manifest.json\` and ` +
        `\`labels.csv\`. First few:\n\n` +
        args.missingByteSamples.map((k) => `- \`${k}\``).join("\n") +
        "\n";

  return `# ${args.datasetName} — cleaned dataset

Exported by DataForge.

## What's in this archive

- \`<Class>/...\` — image files organized by **final label**. Removed
  duplicates are excluded entirely. Samples still missing a label are
  placed under \`_unlabeled/\`.
- \`manifest.json\` — full provenance: original + final labels, label
  decisions, duplicate decisions, balancing plan, baseline + final
  Adaption snapshots, quality report, and \`metadata.providerBoundary\`.
- \`labels.csv\` — flat CSV with one row per included sample. Columns:
  \`sample_key, image_url, final_label, original_label, label_status,
  label_confidence, label_reason, source, provider, duplicate_status,
  class_weight, sampling_strategy\`.

## Counts

- Included images: ${args.includedCount}
- Removed (duplicates): ${args.removedCount}
${args.classCount !== undefined ? `- Classes: ${args.classCount}\n` : ""}${missingNote}
## Provider boundary (don't break this)

DataForge improves dataset readiness — labeling completeness, balance,
consistency, and provenance. It does **not** claim trained-model
accuracy improvement.

- **Adaption Labs** scored the manifest-level dataset quality only. It
  did not inspect image pixels.
- **Visual findings** (label suggestions, mislabel detection, image-
  content duplicates) come from seeded demo truth or a vision-capable
  model (GPT Vision / Gemini), not from Adaption.
- **Class weights** in the balancing plan are training-time advice.
  They are not new images.
`;
}
