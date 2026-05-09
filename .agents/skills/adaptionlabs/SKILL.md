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

## API Dataset Creation

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
- letter grades
- `improvement_percent`
- `percentile_after`

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

export type AdaptionEvaluationQuality = {
  scoreBefore?: number;
  scoreAfter?: number;
  improvementPercent?: number;
  percentileAfter?: number;
  raw: unknown;
};

export const adaptionClient = {
  createDataset,
  uploadManifest,
  runDataset,
  getStatus,
  getEvaluation,
  downloadDataset,
};
```

Recommended DataForge logical operations:

- `createDatasetFromManifest(manifestFile)`
- `runLabelingEvaluation(datasetId, { maxRows, estimate })`
- `pollEvaluation(datasetId)`
- `extractQualityMetrics(evaluation)`
- `downloadCleanDataset(datasetId)`

## Demo-Safe Fallback Rules

- If Adaption API keys are absent, use `mockAdaptionClient` with deterministic metrics.
- If upload or polling times out, keep the dashboard live and label the snapshot as fallback.
- If evaluation returns partial metrics, show only available metrics and mark missing metrics as unavailable.
- If live Adaption metrics conflict with deterministic parser metrics, show both with separate source labels.
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
