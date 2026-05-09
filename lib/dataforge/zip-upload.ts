// Client-side dataset ZIP parser.
//
// Folder convention:
//   <classA>/img001.jpg    → label "Class A"
//   <classB>/img002.png    → label "Class B"
//   img003.webp            → no label → emits a missing_label LabelIssue
//
// What this does:
//   - Iterates ZIP entries; keeps recognized image extensions.
//   - Infers a class label from the IMMEDIATE parent folder of each image.
//   - Computes SHA-1 of the file bytes for file-hash duplicate detection
//     (perfect duplicates only — perceptual hashing stays in the vision lane).
//   - Builds DatasetSample / LabelIssue / DuplicateIssue records that drop
//     into the existing Bazel + Joseph pipeline without any other changes.
//   - Creates browser object URLs for previews. The caller MUST call
//     revokeUploadedDataset() when swapping in a new ZIP.
//
// What this DOES NOT do:
//   - Visual mislabel detection — that's the GPT Vision / Gemini lane.
//   - Perceptual-hash duplicate detection — keep this honest about limits.
//   - Cross-folder hierarchy — only the immediate parent matters.

import JSZip, { type JSZipObject } from "jszip";
import type {
  ClassDistribution,
  DatasetSample,
  DuplicateIssue,
  LabelIssue,
} from "./types";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
]);

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB per file
const MAX_IMAGES = 5000;

export type UploadedDataset = {
  datasetName: string;
  samples: DatasetSample[];
  labelIssues: LabelIssue[];
  duplicateIssues: DuplicateIssue[];
  classDistribution: ClassDistribution;
  /** Non-fatal issues encountered during parsing (skipped files etc.). */
  warnings: string[];
  /** Object URLs created for image previews. Pass to revokeUploadedDataset. */
  imageObjectUrls: string[];
  /**
   * Image bytes keyed by sampleKey — kept so the export pipeline can
   * re-zip the cleaned dataset (organized by finalLabel, duplicates
   * excluded) instead of shipping JSON-only metadata. Not added to
   * DatasetSample so the canonical types stay JSON-serializable.
   */
  imageBlobs: Map<string, Blob>;
};

export async function parseDatasetZip(file: File): Promise<UploadedDataset> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const datasetName = stripExtension(file.name) || "uploaded-dataset";
  const warnings: string[] = [];

  type Entry = {
    path: string;
    fileName: string;
    parentFolder: string | null;
    file: JSZipObject;
  };
  const entries: Entry[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    if (relativePath.startsWith("__MACOSX/")) return;

    const parts = relativePath.split("/").filter(Boolean);
    const fileName = parts[parts.length - 1] ?? relativePath;
    if (fileName.startsWith(".")) return; // hidden files (.DS_Store etc.)

    const ext = getExtension(fileName).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      warnings.push(`Skipped non-image: ${relativePath}`);
      return;
    }

    const parentFolder = parts.length >= 2 ? parts[parts.length - 2] : null;
    entries.push({ path: relativePath, fileName, parentFolder, file: zipEntry });
  });

  if (entries.length === 0) {
    throw new Error(
      "No image files found in ZIP. Expected .jpg/.png/.webp images, ideally inside per-class folders.",
    );
  }
  if (entries.length > MAX_IMAGES) {
    throw new Error(
      `Too many images (${entries.length}). Demo limit is ${MAX_IMAGES}.`,
    );
  }

  const samples: DatasetSample[] = [];
  const imageObjectUrls: string[] = [];
  const imageBlobs = new Map<string, Blob>();
  const hashIndex = new Map<string, number>(); // sha1 -> first sample index
  const duplicateIssues: DuplicateIssue[] = [];
  const labelIssues: LabelIssue[] = [];
  const classDistribution: ClassDistribution = {};
  const now = Date.now();

  for (const entry of entries) {
    const blob = await entry.file.async("blob");
    if (blob.size > MAX_FILE_BYTES) {
      warnings.push(
        `Skipped oversize file: ${entry.path} (${formatBytes(blob.size)})`,
      );
      continue;
    }

    const bytes = await blob.arrayBuffer();
    const sha1 = await sha1Hex(bytes);

    const className = entry.parentFolder
      ? normalizeClassName(entry.parentFolder)
      : null;
    const sampleKey = sanitizeSampleKey(entry.path);
    const sampleIndex = samples.length;
    const id = `upl-${sampleIndex.toString().padStart(4, "0")}`;
    const objectUrl = URL.createObjectURL(blob);
    imageObjectUrls.push(objectUrl);
    imageBlobs.set(sampleKey, blob);

    const sample: DatasetSample = {
      id,
      sampleKey,
      imageUrl: objectUrl,
      source: "original",
      originalLabel: className ?? undefined,
      currentLabel: className ?? undefined,
      finalLabel: className ?? undefined,
      labelStatus: className ? "accepted" : "unlabeled",
      duplicateStatus: "unique",
      qualityFlags: className ? [] : ["missing_label"],
      metadata: {
        path: entry.path,
        sha1,
        bytes: blob.size,
      },
    };

    // ── duplicate detection by file-hash ────────────────────────────────────
    const firstIndex = hashIndex.get(sha1);
    if (firstIndex !== undefined) {
      const firstSample = samples[firstIndex];
      sample.duplicateOf = firstSample.sampleKey;
      sample.duplicateStatus = "suspected_duplicate";
      sample.qualityFlags = [...(sample.qualityFlags ?? []), "duplicate"];

      duplicateIssues.push({
        id: `dup-${duplicateIssues.length.toString().padStart(3, "0")}`,
        sampleId: id,
        sampleKey,
        duplicateOfSampleKey: firstSample.sampleKey,
        similarityScore: 1.0,
        reason: `Identical file content as ${firstSample.sampleKey} (SHA-1 match).`,
        status: "open",
        source: "file_hash",
        createdAt: now,
      });
    } else {
      hashIndex.set(sha1, sampleIndex);
    }

    // ── missing-label issues for root-level files ───────────────────────────
    if (!className) {
      labelIssues.push({
        id: `mlbl-${labelIssues.length.toString().padStart(3, "0")}`,
        sampleId: id,
        sampleKey,
        issueType: "missing_label",
        reason:
          "File is not under a per-class folder; no label could be inferred from path.",
        status: "open",
        source: "user",
        createdAt: now,
      });
    } else {
      classDistribution[className] = (classDistribution[className] ?? 0) + 1;
    }

    samples.push(sample);
  }

  return {
    datasetName,
    samples,
    labelIssues,
    duplicateIssues,
    classDistribution,
    warnings,
    imageObjectUrls,
    imageBlobs,
  };
}

/**
 * Release the browser object URLs created during parseDatasetZip and clear
 * the retained image blobs. Call before swapping in a new ZIP, or on unmount.
 */
export function revokeUploadedDataset(uploaded: UploadedDataset): void {
  for (const url of uploaded.imageObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore — already revoked or invalid URL
    }
  }
  uploaded.imageBlobs.clear();
}

// ─── helpers ──────────────────────────────────────────────────────────────

async function sha1Hex(bytes: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SubtleCrypto is not available in this environment.");
  }
  const digest = await subtle.digest("SHA-1", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (const b of view) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1);
}

function stripExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? path : path.slice(0, dot);
}

function sanitizeSampleKey(path: string): string {
  return path.replace(/[^a-zA-Z0-9._/-]+/g, "-");
}

/**
 * Title-case folder names with separators normalized:
 *   "low_light_wildlife" → "Low Light Wildlife"
 *   "low-light-wildlife" → "Low Light Wildlife"
 *   "Cats"               → "Cats"
 */
function normalizeClassName(folderName: string): string {
  return folderName
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
