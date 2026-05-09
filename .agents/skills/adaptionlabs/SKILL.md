---
name: adaptionlabs
description: Adaption Labs Adaptive Data API and SDK workflows for dataset ingestion, adaptation, evaluation, export, quality metrics, column mapping, large dataset controls, and DataForge-specific image-labeling use cases.
origin: local
---

# Adaption Labs Adaptive Data

Use this skill when implementing or reviewing DataForge features that call Adaption Labs, shape dataset payloads for Adaption, interpret Adaption evaluation results, or design fallback behavior around Adaption provider calls.

## When To Activate

- Creating or uploading datasets through the Adaption Labs API or Python SDK.
- Designing `adaptionClient` adapters for ingest, run, status polling, evaluation, download, or export.
- Mapping DataForge image dataset manifests into Adaption-compatible tabular rows.
- Evaluating dataset quality and displaying Adaption quality scores in the dashboard.
- Processing large datasets with subset limits, estimates, polling, and timeout-safe UX.
- Using column mapping, universal-prompt-equivalent fields, context columns, preferences, safety controls, or reasoning traces.
- Building demo-safe fallback behavior when the live Adaption API is unavailable.

## Core Lifecycle

Adaption exposes an Adaptive Data lifecycle: **ingest, adapt, evaluate, export**.

For DataForge, map that to:

1. **Normalize image dataset to a manifest table:** one row per image with `image_url` or `image_key`, `current_label`, optional `label`, `candidate_labels`, `source`, and metadata.
2. **Create or upload dataset:** use the API dataset create endpoint or SDK upload/import helpers.
3. **Run adaptation or evaluation setup:** map columns so Adaption has a prompt-like instruction and completion/label-like target where appropriate.
4. **Poll status:** dataset ingestion, adaptation, and evaluation are asynchronous.
5. **Fetch evaluation:** use evaluation-specific calls for quality metrics rather than relying only on run status.
6. **Export/download:** preserve the final clean labeled dataset, label provenance, and evaluation snapshots.

## REST API Dataset Methods

Base URL used in docs:

```text
https://api.adaptionlabs.ai
```

All API requests require:

```http
Authorization: Bearer $ADAPTION_API_KEY
```

### `POST /api/v1/datasets` - Create Dataset

The unified create endpoint is:

```http
POST https://api.adaptionlabs.ai/api/v1/datasets
Authorization: Bearer $ADAPTION_API_KEY
Content-Type: application/json
```

For file upload, send:

```json
{
  "source": {
    "type": "file",
    "name": "dataforge-animal-label-manifest",
    "file_format": "csv"
  }
}
```

The response includes:

- `dataset_id`
- `status`
- `upload_instructions` for file sources, including a presigned `url`, HTTP `method`, and `s3_key`

After this response, PUT the manifest file to the presigned URL. Treat exact completion/verification behavior as API-version-specific and verify against the current API reference before implementation.

Supported file formats in the create endpoint docs: `csv`, `json`, `jsonl`, and `parquet`.

Other ingestion sources:

- Hugging Face: `source.type = "huggingface"`, with `url` and `files`.
- Kaggle: `source.type = "kaggle"`, with `url` and `files`.

### `GET /api/v1/datasets` - List Datasets

Use this for dashboards, recently created datasets, and debugging whether a dataset already exists.

Query parameters:

- `limit`: max 100, default 20.
- `cursor`: previous response `next_cursor` for pagination.
- `q`: case-insensitive dataset-name search.
- `status`: `pending`, `running`, `succeeded`, or `failed`.
- `sort`: `created_at`, `updated_at`, or `name`.
- `sort_direction`: `asc` or `desc`.
- `created_after` and `created_before`: ISO 8601 datetime filters.

Response shape:

- `datasets`: array with `dataset_id`, `status`, `created_at`, `updated_at`, optional `description`, optional `name`, optional `row_count`.
- `next_cursor`: cursor for the next page, null when finished.

### `GET /api/v1/datasets/{dataset_id}` - Get Dataset

Use this for full dataset state and compact dashboard summaries.

Important fields:

- `dataset_id`
- `name`
- `status`: `pending`, `running`, `succeeded`, or `failed`
- `row_count`
- `configured_column_mapping`: `prompt`, `completion`, `context`, `chat`, or null before configuration
- `progress`: `percent`, `processed_rows`, `total_rows`, or null when no run is active
- `run_id`: active run ID
- `evaluation_summary`: compact quality summary when available
- `error.message`: failure details
- `created_at`, `updated_at`

`evaluation_summary` may include:

- `score_before`
- `score_after`
- `grade_before`
- `grade_after`
- `improvement_percent`

### `GET /api/v1/datasets/{dataset_id}/status` - Get Processing Status

Use this for ingestion/run progress, not quality.

Returns:

- `dataset_id`
- `status`: `pending`, `running`, `succeeded`, or `failed`
- `row_count`
- `progress`: `percent`, `processed_rows`, `total_rows`, or null
- `error.message`, if failed

Do not use this as the quality source. Use `/evaluation` for quality.

### `POST /api/v1/datasets/{dataset_id}/run` - Start Run Or Estimate

Starts the augmentation pipeline or validates and estimates cost when `estimate: true`.

Body fields:

- `column_mapping`: required for real runs, optional for estimate-only requests.
- `estimate`: boolean. When true, returns cost/time estimate without starting a run.
- `job_specification`: execution options.
- `recipe_specification`: recipe toggles.
- `brand_controls`: length, safety, hallucination mitigation, and blueprint controls.

`column_mapping` fields:

- `prompt`: prompt/instruction column.
- `completion`: optional completion/target column.
- `context`: optional array of context columns.
- `chat`: optional conversation column, alternative to prompt/completion/context.

`job_specification` fields:

- `idempotency_key`: client-generated retry key. Reusing it returns the original launch response.
- `max_rows`: maximum rows to process in that run.

`recipe_specification.recipes` fields:

- `deduplication`: remove near-duplicate rows.
- `prompt_rephrase`: rephrase prompts for variety and clarity.
- `reasoning_traces`: add reasoning traces to completions.

`brand_controls` fields:

- `length`: `minimal`, `concise`, `detailed`, or `extensive`.
- `safety_categories`: categories to filter/enforce.
- `hallucination_mitigation`: web-search grounding toggle.
- `blueprint`: freeform system prompt for generated completions.

Returns:

- `estimate`: whether this was estimate-only.
- `estimatedCreditsConsumed`
- `estimatedMinutes`
- `run_id`: null for estimate-only requests.

For DataForge demos, always set an `idempotency_key` and usually set `max_rows` for live runs.

### `GET /api/v1/datasets/{dataset_id}/evaluation` - Get Evaluation

Use this for provider-measured quality.

Returns:

- `dataset_id`
- `status`: `pending`, `running`, `succeeded`, `failed`, or `skipped`
- `quality`: null until evaluation completes
- `raw_results`: advanced payload, null until evaluation completes

`quality` may include:

- `score_before`: 0-10
- `score_after`: 0-10
- `grade_before`: A-E
- `grade_after`: A-E
- `improvement_percent`
- `percentile_after`: 0-100

### `GET /api/v1/datasets/{dataset_id}/download` - Download Processed Dataset

Streams processed rows in the requested format.

Query parameter:

- `fileFormat`: optional `csv`, `json`, `jsonl`, or `parquet`. Defaults to original upload format.

Important behavior from docs:

- Works on datasets with status `ready` for full output.
- Also works on failed datasets, returning successfully processed rows before the run aborted.
- Returns 422 only when no run has ever started on the dataset.

For DataForge, this means a failed run can still produce a partial recovery artifact, but the UI must label it as partial.

### `POST /api/v1/datasets/{dataset_id}/publish` - Publish Dataset

Publishes to Hugging Face or Kaggle but currently returns `501` and is not implemented.

Do not include publish in the MVP path. Use DataForge's own export manifest/download instead.

Body fields:

- `target`: `huggingface` or `kaggle`.
- `target_spec`: target-specific config.

## REST Upload Subresource Methods

Adaption currently documents two upload flows. Prefer the unified `POST /api/v1/datasets` file-source flow when possible because it creates a dataset and returns `upload_instructions`. The older/direct upload subresource flow is still useful to understand.

### `POST /api/v1/datasets/upload/initiate`

Initiates file upload and returns a presigned S3 `upload_url`.

Body fields:

- `name`
- `file_format`: `csv`, `json`, `jsonl`, or `parquet`

Returns:

- `upload_url`

### `POST /api/v1/datasets/upload/complete`

Completes a direct upload and creates/triggers dataset processing.

Body fields:

- `name`
- `file_format`
- `file_size_bytes`
- `s3_key`: from upload initiate/presigned URL response

Returns:

- `dataset_id`

### `POST /api/v1/datasets/{dataset_id}/upload/complete`

Completes a file upload after using `POST /api/v1/datasets` with `source.type = "file"`.

Body fields:

- `file_size_bytes`
- `sha256`: optional hex digest for integrity verification

Returns:

- `dataset_id`
- `status`, commonly `processing` after upload completion

For DataForge, use this after PUT-ing the manifest bytes to the presigned upload URL from `POST /api/v1/datasets`.

## SDK Mental Model

The Python SDK examples use:

```python
from adaption import Adaption

client = Adaption(api_key=os.environ["ADAPTION_API_KEY"])
```

Common SDK operations documented in guides:

- `client.datasets.upload_file("training_data.csv")`
- `client.datasets.create_from_huggingface(...)`
- `client.datasets.create_from_kaggle(...)`
- `client.datasets.get_status(dataset_id)`
- `client.datasets.run(dataset_id, column_mapping=..., ...)`
- `client.datasets.wait_for_completion(dataset_id, timeout=3600)`
- `client.datasets.get(dataset_id)`
- `client.datasets.get_evaluation(dataset_id)`
- `client.datasets.download(dataset_id)`

Use the SDK or REST API behind a thin project adapter. Do not leak SDK-specific response shapes into React components.

## Column Mapping

Adaption uses column mapping to understand dataset structure.

Core roles:

- `prompt`: the instruction/question/task column.
- `completion`: the answer/target column.
- `context`: an array of supporting columns.
- `chat`: multi-turn conversation column, mutually exclusive with prompt/completion/context.

At least one of `prompt` or `completion` is required for a run in the documented SDK flow.

For DataForge image labeling, convert image rows into a text/metadata manifest that Adaption can process. A practical MVP mapping is:

```python
column_mapping = {
    "prompt": "labeling_instruction",
    "completion": "label",
    "context": ["image_url", "current_label", "candidate_labels", "image_metadata"]
}
```

If labels are missing, create a fixed `labeling_instruction` column such as:

```text
Classify the animal in this image as one of: cat, dog, bird, fox, owl, unknown. Return only the label.
```

If labels are partially present, keep `current_label` as context and keep the reviewed or inferred `label` as completion when available.

## Universal Prompt Equivalent

Universal prompts are documented as a web-app feature. For SDK-driven workflows, emulate the same behavior by adding a fixed prompt/instruction column to every row and mapping that column as `prompt`.

Use this for DataForge:

```text
Review this image record for an animal image classification dataset. If the label is missing, provide the best label from the fixed class list. If the current label conflicts with the image content or metadata, suggest the corrected label. Return a structured label decision.
```

Keep DataForge output parsing strict in our own adapter. Do not assume Adaption's generic adapted output is already in the exact app schema unless validated.

## Evaluation Results

Quality evaluation is retrieved separately from run status.

Use `datasets.get_evaluation(dataset_id)` when you need explicit evaluation status and quality details.

Evaluation status values documented in guides:

- `pending`
- `running`
- `succeeded`
- `failed`
- `skipped`

When evaluation succeeds, `quality` may include:

- `score_before`
- `score_after`
- `grade_before`
- `grade_after`
- `improvement_percent`
- `percentile_after`

REST `/evaluation` also returns `raw_results`. Preserve it in Convex or export metadata for debugging instead of flattening away provider detail.

`datasets.get(dataset_id)` may include `evaluation_summary` after evaluation finishes. `get_status` focuses on ingestion/run progress and should not be treated as the quality source.

For DataForge UI:

- Label Adaption metrics as provider-measured.
- Label deterministic local metrics as fallback/derived.
- Do not let GPT-5.5 invent Adaption scores.
- Store raw Adaption metrics for later inspection.

## Polling Pattern

Adaption ingestion, adaptation, and evaluation are asynchronous. Poll with bounded intervals and timeouts.

Typical quality polling:

```python
import time

while True:
    evaluation = client.datasets.get_evaluation(dataset_id)
    if evaluation.status in ("succeeded", "failed", "skipped"):
        break
    time.sleep(5)
```

For the web app, expose stage updates early:

- `ingest.running`
- `ingest.complete`
- `evaluate.running`
- `evaluate.succeeded` or `evaluate.failed`
- `quality_metrics.stored`

Do not block the UI on one long synchronous request.

## Large Dataset Controls

Use `job_specification.max_rows` to process a subset for pilots and hackathon cost control.

```python
run = client.datasets.run(
    dataset_id,
    column_mapping={"prompt": "instruction", "completion": "response"},
    job_specification={"max_rows": 500},
)
```

Use `estimate=True` before a real run to estimate credits and duration:

```python
quote = client.datasets.run(
    dataset_id,
    column_mapping={"prompt": "instruction", "completion": "response"},
    job_specification={"max_rows": 500},
    estimate=True,
)
```

For DataForge MVP:

- Cap live Adaption calls to a small manifest subset.
- Prefer 50 to 200 rows for the live demo unless API latency is already proven.
- Cache or seed a fallback evaluation snapshot for the prepared demo dataset.

## Deduplication

Adaption's `datasets.run` supports a recipe toggle:

```python
recipe_specification = {
    "recipes": {
        "deduplication": True
    }
}
```

This means duplicate handling is an Adaption capability, not something DataForge should claim as novel infrastructure.

For DataForge:

- Use Adaption deduplication when available.
- Show duplicate findings as part of the image dataset repair cockpit.
- Let the user approve exclusion of duplicate image rows before final export.
- Preserve duplicate decisions in the manifest: `duplicate_of`, `duplicate_status`, and `removed_from_export`.
- Keep deterministic local perceptual-hash or filename/hash checks as fallback if live Adaption deduplication is unavailable.

Position duplicate removal as: **DataForge makes Adaption duplicate signals actionable for image datasets through visual review and export controls.**

## Preferences, Safety, And Controls

Adaption `brand_controls` can include:

- `length`: `minimal`, `concise`, `detailed`, or `extensive`.
- `safety_categories`: list of safety categories to enforce.
- `hallucination_mitigation`: boolean web-search grounding for fact-aligned generated text.
- `blueprint`: freeform system prompt applied to generated completions.

For DataForge image labeling, use a concise blueprint if we adapt through text instructions:

```python
brand_controls = {
    "length": "minimal",
    "blueprint": "Return only labels or compact JSON. Use only the allowed class names. Do not invent classes."
}
```

If we use Adaption for explanation or report text, keep `length` concise and preserve safety constraints. Do not use Adaption text generation as the sole source of visual truth for an image unless the image evidence is actually available to the model/API path.

## Reasoning Traces

Reasoning traces are enabled as a recipe:

```python
recipe_specification = {
    "recipes": {
        "reasoning_traces": True
    }
}
```

Use reasoning traces when auditability matters, such as explaining why a label is suspect. For the hackathon MVP, prefer compact rationales and do not expose private chain-of-thought. If traces are available, summarize them into reviewer-safe reasons like:

- `visual content appears feline while current label is dog`
- `label is missing but candidate class has high confidence`
- `sample should remain manual_review due to ambiguity`

## Unstructured Documents

Adaption supports raw document-style inputs such as PDFs, spreadsheets, word-processor docs, slide decks, and email-like exports, with extraction and splitting workflows. This is not the DataForge MVP path.

For DataForge, only use this concept if an image dataset arrives with messy annotation spreadsheets or PDFs. Normalize those into a manifest before the main image-label workflow.

## DataForge Adapter Shape

Recommended TypeScript adapter boundary:

```ts
export type AdaptionDatasetCreateInput = {
  name: string;
  fileFormat: "csv" | "json" | "jsonl" | "parquet";
};

export type AdaptionUploadInstructions = {
  method: string;
  s3Key?: string;
  url: string;
};

export type AdaptionDataset = {
  datasetId: string;
  name?: string;
  status: "pending" | "running" | "succeeded" | "failed" | string;
  rowCount?: number;
  runId?: string;
  configuredColumnMapping?: unknown;
  evaluationSummary?: AdaptionEvaluationQuality;
  progress?: {
    percent?: number;
    processedRows?: number;
    totalRows?: number;
  };
  error?: { message: string } | null;
  raw: unknown;
};

export type AdaptionEvaluationQuality = {
  scoreBefore?: number;
  scoreAfter?: number;
  gradeBefore?: string;
  gradeAfter?: string;
  improvementPercent?: number;
  percentileAfter?: number;
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

export const adaptionClient = {
  createDataset,
  completeDatasetUpload,
  uploadManifest,
  runDataset,
  listDatasets,
  getDataset,
  getStatus,
  getEvaluation,
  downloadDataset,
};
```

Recommended DataForge logical operations:

- `createDatasetFromManifest(manifestFile)`
- `completeManifestUpload(datasetId, { fileSizeBytes, sha256 })`
- `runLabelingEvaluation(datasetId, { maxRows, estimate, idempotencyKey })`
- `runDeduplicationEvaluation(datasetId, { maxRows, estimate, idempotencyKey })`
- `pollEvaluation(datasetId)`
- `extractQualityMetrics(evaluation)`
- `downloadCleanDataset(datasetId)`

## DataForge Positioning Against Adaption Labs

Adaption Labs already owns broad dataset primitives: ingest, run/adapt, recipes like deduplication, evaluate, download, and eventually publish. DataForge should not position itself as a general Adaptive Data clone.

DataForge should position as a narrow application layer:

- Image dataset labeling cockpit.
- Missing-label and wrong-label review queue.
- Visual duplicate review and removal flow.
- Class balancing plan for image classifiers.
- Clean labeled manifest export with provenance.
- Adaption-powered before/after quality proof.

If a feature is directly supported by Adaption, DataForge's value is the **computer-vision-specific UX and workflow** around it, not the underlying capability.

Use this language:

> DataForge is a computer-vision dataset repair cockpit powered by Adaption Labs evaluation and dataset processing.

Avoid this language:

> DataForge is an Adaptive Data platform.

> DataForge replaces Adaption Labs.

> DataForge has its own general dataset adaptation engine.

## Demo-Safe Fallback Rules

- If Adaption API keys are absent, use `mockAdaptionClient` with deterministic metrics.
- If upload or polling times out, keep the dashboard live and label the snapshot as fallback.
- If evaluation returns partial metrics, show only available metrics and mark missing metrics as unavailable.
- If live Adaption metrics conflict with deterministic parser metrics, show both with separate source labels.
- If `/publish` returns 501, hide or disable publish and use local/DataForge export.
- If `/download` succeeds on a failed dataset, label output as partial recovery.
- Never claim trained model accuracy improvement. Claim dataset quality, labeling completeness, balance, consistency, and provenance improvement.

## DataForge-Specific Output Contract

The final DataForge output should be:

- Clean labeled dataset manifest.
- Original images or image URLs/keys.
- Final label for every sample when possible.
- Original label, if present.
- Label status: `accepted`, `corrected`, `newly_labeled`, `manual_review`, or `rejected`.
- Label rationale and confidence source.
- Balance plan and any synthetic/provenance metadata.
- Adaption baseline and final evaluation snapshots.
- Human-readable quality report.
