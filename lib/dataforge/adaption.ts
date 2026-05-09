// Adaption Labs adapter — MANIFEST-LEVEL ONLY.
//
// IMPORTANT framing (per PLAN.md provider boundary decision):
//
//   * Adaption Labs does NOT inspect image pixels in this MVP.
//   * The manifest sent to Adaption is a normalized CSV/JSON of dataset
//     metadata (sample keys, current labels, source, etc.). It is not raw
//     image input.
//   * Visual findings (label suggestions, mislabel detection, image-content
//     duplicates) come from seeded demo truth or from a vision model
//     (GPT Vision/Gemini) elsewhere in the pipeline — NOT from Adaption.
//   * Surface this honestly in the UI. Never describe Adaption as a
//     vision-capable evaluator.
//
// Two clients are exported:
//
//   - `adaptionClient`        — calls the real Adaption Labs REST API
//   - `mockAdaptionClient`    — deterministic fixture for the demo and
//                               for environments without ADAPTION_API_KEY
//
// Pick one with `getAdaptionClient()`. Per the skill in
// .agents/skills/adaptionlabs/SKILL.md, do NOT call this from React
// components — only from server actions or orchestration code.

import type {
  AdaptionEvaluationSnapshot,
  AdaptionEvaluationVersion,
  ClassDistribution,
  DatasetSample,
} from "./types";

// ---------------------------------------------------------------------------
// Public adapter contract
// ---------------------------------------------------------------------------

export type AdaptionFileFormat = "csv" | "json" | "jsonl" | "parquet";

export type AdaptionDatasetCreateInput = {
  name: string;
  fileFormat: AdaptionFileFormat;
};

export type AdaptionUploadInstructions = {
  method: string;
  url: string;
  s3Key?: string;
};

export type AdaptionDatasetHandle = {
  datasetId: string;
  status: "pending" | "running" | "succeeded" | "failed" | string;
  uploadInstructions?: AdaptionUploadInstructions;
  raw: unknown;
};

export type AdaptionRunOptions = {
  columnMapping: {
    prompt?: string;
    completion?: string;
    context?: string[];
    chat?: string;
  };
  estimate?: boolean;
  maxRows?: number;
  idempotencyKey?: string;
  recipes?: {
    deduplication?: boolean;
    promptRephrase?: boolean;
    reasoningTraces?: boolean;
  };
  brandControls?: {
    length?: "minimal" | "concise" | "detailed" | "extensive";
    safetyCategories?: string[];
    hallucinationMitigation?: boolean;
    blueprint?: string;
  };
};

export type AdaptionRunResponse = {
  estimate: boolean;
  estimatedCreditsConsumed?: number;
  estimatedMinutes?: number;
  runId: string | null;
  raw: unknown;
};

export type AdaptionEvaluationStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type AdaptionEvaluationRaw = {
  datasetId: string;
  status: AdaptionEvaluationStatus;
  quality: {
    scoreBefore?: number;
    scoreAfter?: number;
    gradeBefore?: string;
    gradeAfter?: string;
    improvementPercent?: number;
    percentileAfter?: number;
  } | null;
  rawResults: unknown;
};

/**
 * One row in the manifest sent to Adaption — one per image. This is
 * tabular metadata. Adaption does NOT receive image pixels.
 */
export type AdaptionManifestRow = {
  sample_key: string;
  image_url?: string;
  current_label?: string;
  candidate_labels?: string;
  source: "original" | "synthetic" | "external";
  metadata?: string;
};

export type AdaptionClient = {
  /** POST /api/v1/datasets with file source. Returns dataset_id + presigned upload instructions. */
  createDataset(input: AdaptionDatasetCreateInput): Promise<AdaptionDatasetHandle>;
  /** PUT the manifest bytes to the presigned URL from createDataset. */
  uploadManifest(
    instructions: AdaptionUploadInstructions,
    body: BodyInit,
    contentType: string,
  ): Promise<void>;
  /** POST /api/v1/datasets/{id}/upload/complete after the PUT succeeds. */
  completeManifestUpload(
    datasetId: string,
    args: { fileSizeBytes: number; sha256?: string },
  ): Promise<AdaptionDatasetHandle>;
  /** POST /api/v1/datasets/{id}/run — start a real run or estimate-only. */
  runDataset(datasetId: string, options: AdaptionRunOptions): Promise<AdaptionRunResponse>;
  /** GET /api/v1/datasets/{id}/evaluation — provider-measured manifest quality. */
  pollEvaluation(datasetId: string): Promise<AdaptionEvaluationRaw>;
};

// ---------------------------------------------------------------------------
// Helpers shared between real and mock clients
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://api.adaptionlabs.ai";

/**
 * Convert raw Adaption evaluation data into the app's
 * AdaptionEvaluationSnapshot. Adaption returns score_before/score_after on
 * a 0-10 scale; the rest of the app uses 0-100, so we rescale ×10 here.
 *
 * Adaption's evaluation payload doesn't break out balance/completeness —
 * those are conflated into the overall quality score. We leave them
 * undefined so the UI falls back to deterministic local metrics, clearly
 * source-tagged.
 */
export function normalizeEvaluation(
  raw: AdaptionEvaluationRaw,
  args: {
    version: AdaptionEvaluationVersion;
    classDistribution: ClassDistribution;
    provider?: AdaptionEvaluationSnapshot["provider"];
  },
): AdaptionEvaluationSnapshot {
  const { quality } = raw;
  const scoreAfter = quality?.scoreAfter;
  const scoreBefore = quality?.scoreBefore;

  return {
    id: `eval-${args.version}-${raw.datasetId}`,
    version: args.version,
    provider: args.provider ?? "adaption",
    qualityScore: scoreAfter !== undefined ? roundToOne(scoreAfter * 10) : undefined,
    balanceScore: undefined, // Adaption doesn't compute this — UI uses deterministic fallback
    completenessScore: undefined, // Same — deterministic fallback
    consistencyScore: scoreBefore !== undefined ? roundToOne(scoreBefore * 10) : undefined,
    classDistribution: args.classDistribution,
    rawMetrics: raw,
    createdAt: Date.now(),
  };
}

/**
 * Build an Adaption-compatible manifest row from a DataForge sample.
 * Used by the orchestrator before calling createDatasetFromManifest.
 */
export function manifestRowFromSample(sample: DatasetSample): AdaptionManifestRow {
  return {
    sample_key: sample.sampleKey,
    image_url: sample.imageUrl,
    current_label: sample.currentLabel ?? sample.originalLabel,
    candidate_labels: undefined,
    source: sample.source,
    metadata: sample.metadata ? JSON.stringify(sample.metadata) : undefined,
  };
}

/**
 * Encode an array of manifest rows as a CSV body for the PUT to the
 * presigned upload URL. CSV is the most-supported format and the smallest
 * payload for tabular metadata.
 */
export function manifestRowsToCsv(rows: AdaptionManifestRow[]): string {
  const columns = [
    "sample_key",
    "image_url",
    "current_label",
    "candidate_labels",
    "source",
    "metadata",
  ] as const;
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((col) => csvCell((row as Record<string, unknown>)[col]))
        .join(","),
    );
  }
  return lines.join("\n");
}

/**
 * High-level convenience: build the CSV body and call createDataset +
 * uploadManifest + completeManifestUpload in sequence. Returns the final
 * dataset handle ready for runDataset / pollEvaluation. Pure orchestration
 * over the underlying AdaptionClient.
 */
export async function createDatasetFromManifest(
  client: AdaptionClient,
  args: { name: string; rows: AdaptionManifestRow[] },
): Promise<AdaptionDatasetHandle> {
  const created = await client.createDataset({ name: args.name, fileFormat: "csv" });
  if (!created.uploadInstructions) {
    // Some endpoints (or the mock) skip presigned uploads — return as-is.
    return created;
  }
  const csv = manifestRowsToCsv(args.rows);
  await client.uploadManifest(created.uploadInstructions, csv, "text/csv");
  return client.completeManifestUpload(created.datasetId, {
    fileSizeBytes: byteLength(csv),
  });
}

// ---------------------------------------------------------------------------
// Real client — talks to the Adaption Labs REST API
// ---------------------------------------------------------------------------

export type RealClientConfig = {
  apiKey: string;
  baseUrl?: string;
  /** Optional fetch override (useful for tests). */
  fetchImpl?: typeof fetch;
};

export function createAdaptionClient(config: RealClientConfig): AdaptionClient {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const fetchImpl = config.fetchImpl ?? fetch;

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "<no body>");
      throw new Error(`Adaption ${path} failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }

  return {
    async createDataset({ name, fileFormat }) {
      const raw = await call<{
        dataset_id: string;
        status: string;
        upload_instructions?: { url: string; method: string; s3_key?: string };
      }>("/api/v1/datasets", {
        method: "POST",
        body: JSON.stringify({
          source: { type: "file", name, file_format: fileFormat },
        }),
      });
      return {
        datasetId: raw.dataset_id,
        status: raw.status,
        uploadInstructions: raw.upload_instructions
          ? {
              method: raw.upload_instructions.method,
              url: raw.upload_instructions.url,
              s3Key: raw.upload_instructions.s3_key,
            }
          : undefined,
        raw,
      };
    },

    async uploadManifest(instructions, body, contentType) {
      const response = await fetchImpl(instructions.url, {
        method: instructions.method,
        body,
        headers: { "Content-Type": contentType },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "<no body>");
        throw new Error(`Adaption upload PUT failed: ${response.status} ${text}`);
      }
    },

    async completeManifestUpload(datasetId, { fileSizeBytes, sha256 }) {
      const raw = await call<{ dataset_id: string; status: string }>(
        `/api/v1/datasets/${datasetId}/upload/complete`,
        {
          method: "POST",
          body: JSON.stringify({ file_size_bytes: fileSizeBytes, sha256 }),
        },
      );
      return { datasetId: raw.dataset_id, status: raw.status, raw };
    },

    async runDataset(datasetId, options) {
      const body: Record<string, unknown> = {
        column_mapping: options.columnMapping,
        estimate: options.estimate ?? false,
        job_specification: {
          idempotency_key: options.idempotencyKey,
          max_rows: options.maxRows,
        },
      };
      if (options.recipes) {
        body.recipe_specification = {
          recipes: {
            deduplication: options.recipes.deduplication,
            prompt_rephrase: options.recipes.promptRephrase,
            reasoning_traces: options.recipes.reasoningTraces,
          },
        };
      }
      if (options.brandControls) {
        body.brand_controls = {
          length: options.brandControls.length,
          safety_categories: options.brandControls.safetyCategories,
          hallucination_mitigation: options.brandControls.hallucinationMitigation,
          blueprint: options.brandControls.blueprint,
        };
      }
      const raw = await call<{
        estimate: boolean;
        estimatedCreditsConsumed?: number;
        estimatedMinutes?: number;
        run_id?: string | null;
      }>(`/api/v1/datasets/${datasetId}/run`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return {
        estimate: raw.estimate,
        estimatedCreditsConsumed: raw.estimatedCreditsConsumed,
        estimatedMinutes: raw.estimatedMinutes,
        runId: raw.run_id ?? null,
        raw,
      };
    },

    async pollEvaluation(datasetId) {
      const raw = await call<{
        dataset_id: string;
        status: AdaptionEvaluationStatus;
        quality: {
          score_before?: number;
          score_after?: number;
          grade_before?: string;
          grade_after?: string;
          improvement_percent?: number;
          percentile_after?: number;
        } | null;
        raw_results?: unknown;
      }>(`/api/v1/datasets/${datasetId}/evaluation`);
      return {
        datasetId: raw.dataset_id,
        status: raw.status,
        quality: raw.quality
          ? {
              scoreBefore: raw.quality.score_before,
              scoreAfter: raw.quality.score_after,
              gradeBefore: raw.quality.grade_before,
              gradeAfter: raw.quality.grade_after,
              improvementPercent: raw.quality.improvement_percent,
              percentileAfter: raw.quality.percentile_after,
            }
          : null,
        rawResults: raw.raw_results,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Mock client — deterministic fixture for the demo
// ---------------------------------------------------------------------------

export const mockAdaptionClient: AdaptionClient = {
  async createDataset({ name }) {
    return {
      datasetId: `mock-${slug(name)}`,
      status: "pending",
      uploadInstructions: {
        method: "PUT",
        url: `https://mock-adaption.local/upload/${slug(name)}`,
        s3Key: `mock/${slug(name)}.csv`,
      },
      raw: { mock: true, name, note: "Manifest-level only — no image pixels." },
    };
  },

  async uploadManifest() {
    // No-op for the mock — the manifest never leaves the browser/server.
  },

  async completeManifestUpload(datasetId) {
    return { datasetId, status: "processing", raw: { mock: true } };
  },

  async runDataset(_datasetId, options) {
    return {
      estimate: options.estimate ?? false,
      estimatedCreditsConsumed: 12,
      estimatedMinutes: 1,
      runId: options.estimate ? null : `mock-run-${Date.now()}`,
      raw: { mock: true, options },
    };
  },

  async pollEvaluation(datasetId) {
    // Deterministic fixture matching demo-data.ts seeded snapshots:
    // baseline 6.2 → final 8.4 on Adaption's 0-10 scale (62 → 84 in our 0-100 UI).
    return {
      datasetId,
      status: "succeeded",
      quality: {
        scoreBefore: 6.2,
        scoreAfter: 8.4,
        gradeBefore: "C",
        gradeAfter: "A",
        improvementPercent: 35,
        percentileAfter: 84,
      },
      rawResults: {
        mock: true,
        note: "Manifest-level evaluation. Adaption did not inspect image pixels.",
      },
    };
  },
};

/**
 * Pick the right client based on environment. Used by server actions —
 * never imported into React components.
 *
 *   - If ADAPTION_API_KEY is set, returns the real client.
 *   - Otherwise returns mockAdaptionClient.
 */
export function getAdaptionClient(env: NodeJS.ProcessEnv = process.env): AdaptionClient {
  const apiKey = env.ADAPTION_API_KEY;
  if (apiKey && apiKey.length > 0) {
    return createAdaptionClient({
      apiKey,
      baseUrl: env.ADAPTION_BASE_URL,
    });
  }
  return mockAdaptionClient;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function byteLength(text: string): number {
  // Use TextEncoder when available (Node 18+, all modern browsers); fall
  // back to byte-length-of-UTF-8 string for older runtimes.
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  return Buffer.byteLength(text, "utf-8");
}
