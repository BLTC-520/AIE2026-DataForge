# DataForge: Project Context & Product Specification

DataForge is a hackathon product concept for AI Engineer Singapore.

## 1. Vision & Core Thesis

**DataForge** is an intelligent dataset curator for ML engineers working with partially labeled image datasets. A user uploads images with incomplete, noisy, or incorrect labels; DataForge evaluates the dataset with Adaption Labs, identifies missing labels and likely mislabels, helps the user approve label fixes, balances class weightage or sample distribution, and exports a clean labeled dataset with a quality report.

The core philosophy is simple: **DataForge is a closed-loop data quality system, not a model training platform.**

Most ML teams do not fail because they cannot start a training run. They fail because the dataset is quietly broken before training begins: classes are imbalanced, many samples are unlabeled, labels are inconsistent, objects are mislabeled, duplicates or near-duplicates distort the dataset, duplicates leak across splits, and visual diversity is too narrow. These problems usually surface late, after wasted training cycles and confusing evaluation results.

DataForge moves the quality loop earlier. A user uploads a partially labeled image dataset and describes the classifier they want to train. The system evaluates the dataset, explains missing labels, likely wrong labels, and class imbalance, proposes label completions and corrections, creates a balancing plan, and then evaluates the cleaned dataset again. The key demo artifact is the **before/after dataset quality and labelization delta**, not a trained model.

This distinction matters for the hackathon. DataForge should not promise "we improved model accuracy" unless a model is actually trained and evaluated. Instead, it should prove a more realistic claim:

1. The original dataset had measurable quality issues: missing labels, wrong labels, duplicate images, and class imbalance.
2. Adaption Labs evaluation identified or scored those issues where supported and provided the primary quality signal.
3. GPT-5.5 translated those metrics and dataset metadata into an actionable label-quality and balancing report.
4. The user reviewed missing-label suggestions and likely mislabeled samples, then approved corrected labels.
5. DataForge produced a cleaned and labelized dataset manifest with balancing metadata.
6. Adaption Labs evaluation showed the cleaned dataset improved on quality, balance, completeness, or consistency metrics.

The winning thesis is that dataset curation can become an **adaptive improvement loop**:

1. Evaluate the dataset.
2. Explain missing labels, likely wrong labels, duplicate images, and class imbalance.
3. Review and apply label completions, corrections, and duplicate removals.
4. Balance the dataset through class weights, sampling recommendations, or optional generated/collected additions.
5. Re-ingest the cleaned dataset.
6. Evaluate again with Adaption Labs.
7. Export a clean labeled, deduplicated dataset and report.

DataForge should feel technical and credible. It should avoid the common hackathon trap of treating generated images as the product. The core value is labelization and dataset quality repair: every sample should end with a clear label status, every correction should preserve provenance, and every balancing decision should be tied to measured dataset gaps and a second Adaption Labs evaluation.

For the AI Engineer hackathon, DataForge should optimize for four judging moments:

1. **Adaption Labs centrality:** the evaluation API must be the core source of dataset quality truth.
2. **GPT-5.5 intelligence:** GPT-5.5 should explain metrics, detect likely issues, suggest label corrections, and produce structured repair plans.
3. **Balancing usefulness:** DataForge should produce a concrete balancing plan for underrepresented classes through weights, sampling recommendations, and optional targeted synthetic or collected additions.
4. **Convex visibility:** the entire pipeline should be visible live through a realtime dashboard.

The MVP should focus on one clean dataset type: **partially labeled animal image classification datasets**. Supporting CSV, JSON, and arbitrary images is useful later, but a 7-hour build should prioritize a pre-prepared animal classifier demo with deliberate class imbalance, missing labels, and obvious mislabeled samples such as a cat image placed in the dog class. Animal classes are visually obvious, easy for judges to understand, and ideal for showing label completion, relabeling, and balancing without training a model.

## 2. Market Context & Competitive Differentiators

Dataset quality is one of the highest-leverage problems in applied AI. Model architectures change, but data quality remains a bottleneck. Teams spend large amounts of time collecting, labeling, cleaning, deduplicating, balancing, synthesizing, and documenting data before any model can be trusted.

The market has many tools, but they are usually fragmented across the dataset lifecycle.

Common buckets include:

1. **Annotation platforms:** Labelbox, Scale, CVAT, Label Studio, and similar tools help teams label data, review annotations, and manage labeling workflows.
2. **Dataset management and versioning:** DVC, Weights & Biases Artifacts, LakeFS, Hugging Face Datasets, and data catalogs help store, version, and reproduce datasets.
3. **Computer vision dataset platforms:** Roboflow and related tools help with image upload, annotation, augmentation, export formats, and deployment workflows.
4. **Synthetic data vendors:** Gretel, Mostly AI, Synthesis AI, and model-specific generation workflows create synthetic data, but they may not be tied to a specific measured gap in the user's current dataset.
5. **Data quality and observability systems:** Great Expectations, WhyLabs, Evidently, and Monte Carlo focus on validation, drift, and data quality checks, often more for production pipelines than rapid training-set repair.
6. **Manual notebooks and scripts:** Many ML engineers still use Python notebooks, pandas, augmentation libraries, and ad hoc scripts to inspect datasets and patch gaps.

The gap DataForge targets is the space between evaluation, explanation, labelization, and dataset balancing. Many tools can label data. Many tools can generate data. Many tools can chart data. Fewer tools provide a fast loop where partially labeled image datasets are evaluated, missing labels are filled, wrong labels are reviewed, imbalance is repaired, and the cleaned dataset is evaluated again in one product flow.

**Where DataForge wins:**

1. **Evaluation-first workflow:** Adaption Labs evaluation is the anchor. The product does not ask judges to trust a pretty chart or an LLM's opinion. It shows a measured baseline and a measured post-repair state.
2. **No model training required:** DataForge proves dataset improvement without spending hackathon time training a model. This avoids slow, flaky, GPU-dependent demos.
3. **Intent-aware analysis:** The user describes what they want to train. GPT-5.5 interprets the dataset relative to that objective, so the gap report is not generic. A dataset for "cracked pavement detection at night" has different quality needs than a dataset for "daytime road surface classification."
4. **AI-assisted labelization:** DataForge highlights unlabeled samples and likely mislabeled examples, then suggests labels or corrected labels, such as a cat image currently assigned to the dog class. The user stays in control by approving or rejecting corrections before they affect the dataset.
5. **Balancing plan:** DataForge calculates class imbalance and recommends class weights, sampling changes, or optional targeted additions for underrepresented classes. Do not add data where the dataset is already healthy.
6. **Realtime pipeline visibility:** Convex turns a backend pipeline into a live operational interface. Judges can watch ingest, evaluate, labelize, balance, and re-evaluate stages progress without refreshing.
7. **Before/after quality delta:** The central UI primitive is a comparison: original dataset versus cleaned labeled dataset. Counts, distribution, score, missing labels, label issues, and recommendations should visibly change.
8. **Exportable dataset artifact:** The architecture should treat the cleaned dataset as a real artifact with source metadata, original labels, final labels, label correction history, balancing metadata, and evaluation snapshots.

DataForge should not compete as a full annotation suite or full MLOps platform. It should compete as a **pre-training dataset repair cockpit**.

Primary users:

1. **ML engineers:** Need to catch data issues before training or fine-tuning.
2. **Computer vision builders:** Need enough image diversity for prototype classifiers and detectors.
3. **Research scientists:** Need quick audits of experimental datasets and coverage gaps.
4. **Data annotation leads:** Need to prioritize which labels, classes, or edge cases require attention.
5. **Startup AI teams:** Need good-enough datasets quickly without long collection cycles.
6. **Hackathon builders:** Need credible datasets for demos without spending days collecting data.

Primary hackathon positioning:

**DataForge is an adaptive image dataset repair loop: evaluate, labelize, deduplicate, balance, re-evaluate, export.**

The winning demo should show a deliberately imbalanced, partially labeled image dataset, run Adaption Labs evaluation, surface missing labels, likely label mistakes, and duplicate images, apply approved labels, relabels, and duplicate removals, rebalance class weightage, run evaluation again, and display an improved quality score, label completeness score, duplicate issue count, consistency score, or balance metric. The cleaned labelized dataset and report are the climax.

Adaption Labs overlap is real and should be handled explicitly. Adaption Labs owns broad Adaptive Data primitives such as dataset creation, run configuration, recipes like deduplication, evaluation, download, and export-style lifecycle operations. DataForge should position itself as a **computer-vision dataset repair cockpit powered by Adaption Labs**, not as a replacement for Adaption Labs. DataForge's value is the image-specific workflow: visual label review, missing-label completion, wrong-label correction, duplicate-image review/removal, class balancing, and an exportable image manifest with provenance.

## 3. Comprehensive User Flow & Lifecycle

### 3.1 Core Product Terms

- **Dataset Project:** A single dataset improvement workspace created from one upload and one training intent.
- **Training Intent:** The user's natural language description of the model they want to train, such as "a classifier that detects cracked pavement, potholes, and intact road surfaces in urban street photos."
- **Source Dataset:** The original uploaded dataset before any labeling, relabeling, balancing, or optional augmentation.
- **Sample:** A single row, image, or data item in the dataset.
- **Label / Class:** The target category associated with a sample. For MVP, labels should map to image classification classes.
- **Label Issue:** A suspected problem where a sample's assigned label may not match its visual content or expected class taxonomy.
- **Missing Label:** A sample with no assigned class, empty manifest label, or unknown folder/category.
- **Duplicate Image:** An exact or near-duplicate image that may overrepresent a class or leak across train/test splits.
- **Suggested Label Correction:** An AI-proposed replacement label with confidence, rationale, and review status.
- **Suggested Label Completion:** An AI-proposed label for an unlabeled sample with confidence, rationale, and review status.
- **Relabeled Sample:** An original sample whose label was changed after user approval. This is distinct from a synthetic sample.
- **Labelized Dataset:** The dataset after missing labels have been filled where possible and incorrect labels have been corrected or marked for manual review.
- **Dataset Manifest:** A CSV or JSON file that maps samples to labels and metadata. For zip uploads, the manifest may be inferred from folder names in the MVP.
- **Evaluation Snapshot:** A point-in-time Adaption Labs evaluation result for a dataset version.
- **Quality Score:** The primary score returned by Adaption Labs or derived from its metrics. It should be displayed with the metric name and source.
- **Gap:** A measurable issue in the dataset, such as an underrepresented class, missing label, missing scenario, duplicate sample, or label inconsistency.
- **Balancing Plan:** A structured set of recommended class weights, sampling adjustments, or optional additions for underrepresented classes.
- **Repair Plan:** A GPT-5.5-generated structured set of recommended actions based on Adaption Labs evaluation metrics, label issues, missing labels, and dataset metadata.
- **Synthetic Generation Job:** Optional stretch Fal job that generates new samples for a specific underrepresented class or scenario.
- **Synthetic Sample:** Optional generated sample tagged with its source provider, prompt, target class, and generation job ID.
- **Corrected Dataset:** The source dataset after approved label completions and corrections.
- **Balanced Dataset:** The labelized dataset plus class weights, sampling metadata, and optional approved additions for underrepresented classes.
- **Augmented Dataset:** The corrected dataset plus optional approved synthetic samples and adaptations.
- **Improvement Delta:** The comparison between baseline evaluation and final labelized or balanced evaluation.
- **Quality Report:** A report containing Adaption Labs evaluation metrics, deterministic distribution metrics, label issue summary, balancing plan, and remaining manual review items.
- **Export Bundle:** A downloadable clean labeled dataset package and report, optionally in Hugging Face-compatible format.

### 3.2 Roles

- **ML Engineer:** Primary user. Uploads a partially labeled image dataset, defines the training intent, reviews the quality report, approves label completions and corrections, reviews the balancing plan, and exports the clean labeled dataset.
- **Researcher:** Uses DataForge to inspect experimental data and compare dataset variants.
- **Data Lead:** Reviews labels, bias flags, and repair plans before approving dataset changes.
- **Reviewer / Judge:** Opens the live dashboard and watches the pipeline progress. For the hackathon, this can be a public dashboard URL.
- **System Operator:** Internal role responsible for API keys, provider errors, cost limits, and demo fallback data. This does not need a product UI in the MVP.

### 3.3 Phase 1: Entry, Upload, and Dataset Normalization

1. **Landing Page:** User lands on a technical dashboard-style page with the promise: "Evaluate and repair your training dataset before you train."
2. **Dataset Upload:** User uploads a ZIP of images, an image manifest CSV/JSON, or both. For the hackathon MVP, the most important path is a partially labeled ZIP of images arranged by class folder plus unlabeled or unknown folders.
3. **File Validation:** The app validates file type, file size, and basic structure. MVP file size should be capped to avoid timeouts and excessive memory usage.
4. **Dataset Parsing:** The app extracts existing labels, missing-label count, sample count, class distribution, and previewable records. For image datasets, it shows thumbnails grouped by current label, unlabeled status, and suspected issue state.
5. **Convex Dataset Record:** The app creates a dataset project in Convex with status `uploaded` and logs the first event.
6. **Preview Pane:** The UI displays total samples, detected classes, first rows or thumbnails, and any obvious parsing warnings.

Edge cases:

- **Unsupported format:** Reject with clear accepted formats.
- **Missing labels:** Keep samples in the dataset as `unlabeled` and route them into the label completion queue.
- **No class column:** Let the user select a label column for CSV/JSON datasets.
- **Oversized dataset:** Ask the user to upload a smaller demo subset.
- **Corrupt ZIP or broken image:** Skip broken samples, log warnings, and continue if enough valid samples remain.
- **Private data risk:** Warn the user before uploading sensitive or regulated datasets.

### 3.4 Phase 2: Training Intent and Task Framing

1. **Intent Input:** User describes the intended model. The input should be free text, not just a dropdown.
2. **Task Type Selection:** User optionally selects classification, object detection, segmentation, regression, or unknown. MVP should default to classification.
3. **Context Extraction:** GPT-5.5 reads the training intent and dataset summary to infer what coverage matters.
4. **Dataset Goal Definition:** The system converts the intent into structured target criteria, such as target classes, important edge cases, visual conditions, and minimum per-class sample recommendations.
5. **User Confirmation:** The UI can show a short "DataForge will evaluate this as an image classification dataset for road-surface defects" confirmation before analysis.

Important MVP constraint:

The training intent should shape labelization, balancing recommendations, and optional addition prompts, but Adaption Labs evaluation should remain the objective metric source. GPT-5.5 should not invent final quality scores when an evaluation API metric exists.

### 3.5 Phase 3: Baseline Evaluation and Quality Report

1. **Baseline Ingest:** The backend sends the source dataset or dataset metadata to Adaption Labs for registration or evaluation, depending on the available API shape.
2. **Baseline Evaluate:** Adaption Labs returns dataset quality metrics. These may include completeness, balance, consistency, coverage, duplication, label confidence, or other provider-specific scores.
3. **Convex Stage Updates:** The app writes stage transitions to Convex: ingest queued, ingest running, ingest complete, evaluate running, evaluate complete.
4. **GPT-5.5 Report Generation:** GPT-5.5 receives the training intent, dataset summary, class distribution, sample previews, inferred or provider-supplied label-confidence signals, and Adaption Labs metrics. It returns a structured report.
5. **Quality Report UI:** The frontend renders score cards, class distribution charts, gap list, bias flags, label quality warnings, suspected mislabels, and ranked repair actions.

The quality report should separate measured metrics from LLM interpretation:

- **Measured:** values returned by Adaption Labs or deterministic dataset parsing.
- **Inferred:** GPT-5.5 explanations, likely causes, bias hypotheses, and suggested actions.
- **User-actionable:** generation jobs, relabeling suggestions, duplicate removal, class balancing.

Edge cases:

- **Adaption Labs API unavailable:** Use a thin mock adapter with clearly labeled demo metrics and keep the UI functional.
- **Evaluation returns partial metrics:** Display available metrics and have GPT-5.5 explain only what is supported.
- **GPT-5.5 JSON invalid:** Retry once with a repair prompt, then fall back to a minimal deterministic report.
- **No gaps detected:** Show a healthy dataset state and recommend export or targeted manual review instead of forcing optional generation.

### 3.6 Phase 4: Label Completion, Relabeling, Deduplication, and Balancing Plan

1. **Missing Label Queue:** DataForge identifies unlabeled samples and proposes labels from the allowed class taxonomy. For image classification, this can be shown as "current label: unlabeled, suggested label: cat" with confidence and rationale.
2. **Label Issue Selection:** DataForge identifies likely mislabeled samples from Adaption Labs signals, deterministic checks, and GPT-5.5 interpretation. For image classification, this can be shown as "current label: dog, suggested label: cat" with confidence and rationale.
3. **Human Review:** User approves, rejects, or edits suggested label completions and corrections. MVP can support one-click accept/reject for obvious issues instead of building a full annotation suite.
4. **Labelized Manifest Update:** Approved label changes update the dataset manifest and preserve original label, final label, reviewer action, timestamp, confidence source, and reason.
5. **Duplicate Review:** DataForge flags exact or near-duplicate images using Adaption deduplication signals where available and deterministic local checks as fallback. User can keep or exclude duplicates from export.
6. **Class Balance Analysis:** DataForge recalculates class counts after labelization and duplicate removal, then identifies underrepresented classes.
7. **Balancing Plan Creation:** DataForge produces a balancing plan with current count, target count, recommended class weight, recommended sampling strategy, and optional sample additions.
8. **Optional Addition Review:** If the team uses Fal or external collection, user can review optional prompts or collection recommendations. This is not required for the core MVP.
9. **Convex Events:** Every label review, duplicate review, and balancing state change is logged live: proposed, approved, rejected, manual_review, duplicate_removed, balanced, failed, complete.

Edge cases:

- **Unlabeled sample ambiguous:** Mark it for manual review instead of forcing a guessed label.
- **Balancing would overfit minority classes:** Prefer class weights or sampling metadata over aggressive duplication.
- **Duplicate is intentional burst capture:** Let the user keep it and preserve duplicate metadata rather than forcing removal.
- **Optional generated image quality poor:** Allow rejection or exclude from the balanced dataset.
- **Too many requested additions:** Cap count and explain the cap.
- **Low-confidence label suggestion:** Keep it as a review warning and do not auto-apply the correction.
- **No obvious corrected label:** Mark the sample for manual review instead of forcing a guessed label.

### 3.7 Phase 5: Re-Ingest, Adapt, and Re-Evaluate

1. **Labelized Dataset Assembly:** DataForge applies approved label completions and corrections to the manifest while preserving original labels for provenance.
2. **Deduplicated Dataset Assembly:** DataForge excludes approved duplicate removals from the export manifest while preserving duplicate provenance.
3. **Balanced Dataset Assembly:** DataForge attaches class weights, sampling metadata, and optional approved additions.
4. **Adaption Labs Re-Ingest:** The clean labelized and deduplicated dataset is sent back into the Adaption Labs pipeline.
5. **Adapt Stage:** Adaption Labs applies supported transformations, such as normalization, deduplication, balancing, validation, or provider-specific adaptation.
6. **Second Evaluate Stage:** Adaption Labs evaluates the clean labelized, deduplicated, and balanced dataset.
7. **Improvement Delta:** The frontend compares baseline and post-repair evaluation snapshots.
8. **Narrative Summary:** GPT-5.5 summarizes what improved, what remains weak, and what should happen next.

The second evaluation is the most important proof point. The UI should make this obvious:

- Baseline quality score versus clean labeled dataset quality score.
- Baseline class distribution versus balanced class distribution or class weights.
- Baseline missing-label count versus final missing-label count.
- Baseline label issue count versus remaining label issue count.
- Baseline duplicate count versus removed or remaining duplicate count.
- Baseline imbalance severity versus final imbalance severity.
- Remaining recommended actions.
- Newly labeled count, corrected label count, and affected classes.

Edge cases:

- **Score does not improve:** Show the honest result and explain likely reasons, such as ambiguous labels, unresolved manual review items, or metrics not sensitive to class balance.
- **Evaluation worsens:** Flag the label changes or additions as harmful and let the user exclude them.
- **Evaluation API only supports metadata:** Use deterministic distribution metrics as supplemental, but label them separately from Adaption Labs metrics.

### 3.8 Phase 6: Realtime Dashboard and Review

1. **Pipeline Stepper:** Dashboard shows upload, ingest, evaluate, labelize, balance, re-evaluate, and export states.
2. **Metric Cards:** Total samples, unlabeled samples, newly labeled samples, corrected labels, class count, quality score, imbalance score, label issues.
3. **Distribution Charts:** Recharts shows original versus final labeled distribution and recommended class weights.
4. **Live Event Log:** Convex powers event streaming without refresh.
5. **Dataset Explorer:** User filters samples by class, source, label status, label issue, or optional synthetic status.
6. **Result Summary:** Final panel explains the improvement delta and recommended next step.

Dashboard principle:

The dashboard should feel like an ML pipeline control room. Avoid a generic chatbot layout. The UI should be data-dense, dark, and status-driven.

### 3.9 Phase 7: Export and Handoff

1. **Export Preview:** User sees what will be included: original samples, final labels, corrected labels, newly labeled samples, balancing metadata, manifest, quality report, and evaluation snapshots.
2. **Download ZIP:** MVP can export a ZIP if time permits. Otherwise, show an export manifest and mark this as a stretch feature.
3. **Hugging Face Format:** Stretch export includes `README.md` data card, manifest, split files, label provenance fields, and optional metadata fields for synthetic samples.
4. **Data Card Generation:** GPT-5.5 can generate a short data card summarizing dataset purpose, classes, labelization decisions, balancing metadata, caveats, and evaluation results.

Export metadata should preserve provenance:

- Source: original or synthetic.
- Original label and corrected label, if changed.
- Missing-label completion provenance, if newly labeled.
- Class weight or sampling metadata, if used for balancing.
- Label correction confidence and review status.
- Optional synthetic provider, prompt used, and generation job ID.
- Target class.
- Approval state.
- Evaluation snapshot ID.

## 4. Technical Architecture & New Stack

DataForge should use a lean, hackathon-friendly architecture with one web app, Convex as the realtime data layer, provider adapters for model APIs, and object storage for uploaded/generated assets.

### 4.1 Core Tech Stack

- **Frontend:** Next.js App Router or Vite React. Prefer Next.js on Vercel if the team wants server routes and deployment simplicity.
- **Language:** TypeScript.
- **Styling:** Tailwind CSS with a dark, technical UI.
- **Components:** shadcn/ui or lightweight custom components.
- **Charts:** Recharts for class distribution, score trends, and before/after comparisons.
- **Pipeline Visualization:** React Flow for a fixed, non-editable pipeline hero showing Upload -> Evaluate -> Labelize -> Deduplicate -> Balance -> Re-evaluate -> Export.
- **Upload:** react-dropzone for file upload.
- **Parsing:** Papa Parse for CSV, native JSON parsing, JSZip for ZIP, image metadata extraction where needed.
- **Realtime Backend:** Convex for datasets, stage updates, events, missing labels, label issues, balancing plans, optional additions, and dashboard subscriptions.
- **LLM Analysis:** OpenAI GPT-5.5 using structured JSON output through the Responses API or equivalent available endpoint.
- **Evaluation Platform:** Adaption Labs SDK/API for ingest, adapt, evaluate, and quality metrics.
- **Synthetic Image Generation:** Fal as an optional stretch path for underrepresented classes after labelization and balancing decisions.
- **Storage:** Vercel Blob, Cloudflare R2, Supabase Storage, or Convex file storage for uploaded datasets and generated images.
- **Validation:** Zod for all provider outputs, request payloads, and structured report schemas.
- **Deployment:** Vercel.

### 4.2 Application Surfaces

- **`/` Home / Upload:** Dataset upload, training intent, task type, and analysis CTA.
- **`/datasets/:datasetId` Dashboard:** Live pipeline status, report, label completion queue, relabeling queue, balancing plan, charts, and dataset explorer.
- **Dashboard Pipeline Hero:** Fixed React Flow graph with seven nodes and six edges. Each node reflects Convex-backed status and can open a detail panel, but users cannot create, move, delete, or reconnect nodes in the MVP.
- **`/datasets/:datasetId/export` Export View:** Optional stretch route for manifest, data card, and ZIP export.
- **Server Route or Action: `createDataset`:** Creates Convex dataset record and stores upload metadata.
- **Server Route or Action: `analyzeDataset`:** Runs parsing, Adaption Labs baseline evaluation, missing-label detection, label issue detection, GPT-5.5 report, and stage updates.
- **Server Route or Action: `applyLabelDecisions`:** Applies approved label completions and corrections to the dataset manifest and sample records.
- **Server Route or Action: `reviewDuplicates`:** Surfaces exact or near-duplicate images and applies approved removals to the export manifest.
- **Server Route or Action: `balanceDataset`:** Creates class weights, sampling metadata, and optional addition recommendations after labelization and duplicate review.
- **Server Route or Action: `reevaluateDataset`:** Sends the clean labelized dataset to Adaption Labs and writes improvement metrics.

For the hackathon, server actions can be simple wrappers that call Convex mutations and provider APIs. Keep provider-specific code isolated behind adapter functions.

### 4.3 Convex Data Model

#### `datasets`

Represents one dataset project.

- `name` string
- `status` enum: `uploaded`, `analyzing`, `evaluated`, `label_review`, `balancing`, `reevaluating`, `complete`, `error`
- `task_type` enum: `classification`, `object_detection`, `segmentation`, `regression`, `unknown`
- `training_intent` string
- `format` enum: `csv`, `json`, `zip_images`, `image_manifest`
- `sample_count` number
- `class_count` number
- `source_asset_url` optional string
- `created_at` number
- `updated_at` number

#### `samples`

Stores previewable metadata for samples. For MVP, do not store every large file payload in Convex; store URLs and metadata.

- `dataset_id` id
- `sample_key` string
- `label` optional string
- `original_label` optional string
- `corrected_label` optional string
- `final_label` optional string
- `label_status` optional enum: `unlabeled`, `suggested`, `newly_labeled`, `corrected`, `accepted`, `rejected`, `manual_review`
- `duplicate_of` optional string
- `duplicate_status` optional enum: `unique`, `suspected_duplicate`, `removed`, `kept`
- `image_url` optional string
- `row_preview` optional any
- `source` enum: `original`, `synthetic`, `external`
- `provider` optional string
- `prompt` optional string
- `quality_flags` optional array
- `created_at` number

#### `label_issues`

Tracks missing labels, suspected mislabels, and user review decisions.

- `dataset_id` id
- `sample_id` optional id
- `sample_key` string
- `issue_type` enum: `missing_label`, `wrong_label`, `ambiguous`, `imbalance_related`
- `current_label` optional string
- `suggested_label` optional string
- `confidence` optional number
- `reason` string
- `status` enum: `open`, `accepted`, `rejected`, `manual_review`
- `source` enum: `adaption`, `gpt`, `deterministic`, `user`
- `reviewed_at` optional number
- `created_at` number

#### `balancing_plans`

Tracks class balance recommendations after labelization.

- `dataset_id` id
- `class_name` string
- `current_count` number
- `target_count` optional number
- `recommended_weight` optional number
- `sampling_strategy` enum: `keep`, `downsample`, `upsample`, `collect_more`, `optional_generate`
- `reason` string
- `status` enum: `proposed`, `accepted`, `rejected`, `applied`
- `created_at` number
- `updated_at` number

#### `duplicate_issues`

Tracks suspected duplicate or near-duplicate images and review decisions.

- `dataset_id` id
- `sample_id` optional id
- `sample_key` string
- `duplicate_of_sample_key` string
- `similarity_score` optional number
- `reason` string
- `status` enum: `open`, `removed`, `kept`, `manual_review`
- `source` enum: `adaption`, `perceptual_hash`, `file_hash`, `user`
- `reviewed_at` optional number
- `created_at` number

#### `evaluation_snapshots`

Stores Adaption Labs metrics and derived metrics for each dataset version.

- `dataset_id` id
- `version` enum: `baseline`, `labelized`, `balanced`, `augmented`
- `provider` string
- `quality_score` optional number
- `balance_score` optional number
- `consistency_score` optional number
- `completeness_score` optional number
- `class_distribution` any
- `raw_metrics` any
- `created_at` number

#### `quality_reports`

Stores the GPT-5.5 structured analysis.

- `dataset_id` id
- `evaluation_snapshot_id` optional id
- `summary` string
- `imbalance_score` number
- `gaps` array
- `bias_flags` array
- `label_issues` array
- `recommended_actions` array
- `created_at` number

#### `pipeline_stages`

Tracks each visible pipeline step.

- `dataset_id` id
- `stage` enum: `upload`, `ingest`, `evaluate`, `labelize`, `balance`, `adapt`, `reevaluate`, `export`
- `status` enum: `queued`, `running`, `complete`, `error`
- `progress` optional number
- `metrics` optional any
- `error_message` optional string
- `started_at` optional number
- `completed_at` optional number

#### `gap_jobs`

Tracks optional proposed additions for underrepresented classes. For the MVP this may represent sampling or collection recommendations rather than live generation.

- `dataset_id` id
- `class_name` string
- `scenario` optional string
- `current_count` number
- `target_count` number
- `generation_count` number
- `prompt` string
- `status` enum: `proposed`, `approved`, `running`, `complete`, `error`, `rejected`
- `fal_job_id` optional string
- `images_generated` number
- `created_at` number
- `updated_at` number

#### `events`

Realtime event log for dashboard visibility.

- `dataset_id` id
- `timestamp` number
- `level` enum: `info`, `warning`, `error`, `success`
- `message` string
- `metadata` optional any

### 4.4 Pipeline State Machine

The pipeline should be explicit, even if some stages are mocked during the demo.

1. `uploaded`: Dataset file accepted and parsed.
2. `ingest_running`: Adaption Labs ingest started.
3. `baseline_evaluate_running`: Baseline evaluation requested.
4. `baseline_evaluated`: Baseline metrics stored.
5. `labelize_running`: missing labels and likely wrong labels are being identified.
6. `label_review_ready`: suggested label completions and corrections are available for user review.
7. `labels_applied`: approved label decisions have been applied to the manifest.
8. `dedupe_running`: duplicate and near-duplicate images are being identified.
9. `dedupe_review_ready`: duplicate removal decisions are available for user review.
10. `dedupe_applied`: approved duplicate removals have been applied to the export manifest.
11. `balance_running`: class distribution and weightage recommendations are being calculated.
12. `balance_ready`: class weights, sampling recommendations, and optional additions are available.
13. `analysis_running`: GPT-5.5 report generation running.
14. `analysis_ready`: Quality report and balancing plan available.
15. `reevaluating`: clean labelized and deduplicated dataset sent back to Adaption Labs.
16. `complete`: Improvement delta available.
17. `error`: Terminal failure with actionable message.

Every state transition should write both a `pipeline_stages` update and an `events` row. This makes the dashboard feel alive and makes debugging easier.

React Flow node mapping:

- **Upload:** dataset parsed and previewed.
- **Evaluate:** Adaption Labs baseline quality evaluation.
- **Labelize:** missing labels, likely mislabeled samples, and suggested final labels.
- **Deduplicate:** exact or near-duplicate image review and removal decisions.
- **Balance:** class weights, sampling recommendations, and optional additions.
- **Re-evaluate:** Adaption Labs clean labeled and deduplicated dataset evaluation.
- **Export:** downloadable manifest or final dataset package.

React Flow is only a visualization layer. Convex remains the source of truth for node status, stage metrics, logs, missing labels, label issues, duplicate issues, balancing plans, and optional generated sample records. Recharts remains responsible for quantitative charts.

### 4.5 Provider Adapter Architecture

Use thin adapters so the rest of the app does not depend on exact provider signatures.

Recommended adapters:

- `adaptionClient.createDataset(manifest)`
- `adaptionClient.uploadManifest(uploadInstructions, file)`
- `adaptionClient.runDataset(datasetId, columnMapping, options)`
- `adaptionClient.getStatus(datasetId)`
- `adaptionClient.getEvaluation(datasetId)`
- `adaptionClient.downloadDataset(datasetId)`
- `labelAuditClient.detectMissingAndWrongLabels(datasetSummary, samplePreviews)`
- `duplicateClient.detectDuplicates(datasetSummary, samplePreviews)`
- `duplicateClient.applyDuplicateDecisions(datasetId, approvedDecisions)`
- `datasetRepairClient.applyLabelDecisions(datasetId, approvedDecisions)`
- `balanceClient.createBalancingPlan(labelizedDataset)`
- `openaiClient.generateQualityReport(input)`
- `openaiClient.generateLabelAndBalanceReport(input)`
- `openaiClient.generateOptionalAdditionPrompt(input)`
- `falClient.generateImages(prompt, count)` optional stretch
- `storageClient.putFile(file)`
- `storageClient.putGeneratedImage(urlOrBuffer)`

Adaption Labs should have a demo-safe fallback adapter:

- If real API access works, use it for dataset creation, bounded runs, evaluation polling, and final evaluation snapshots.
- If endpoint signatures are unclear, use deterministic local metrics plus a clearly named `mockAdaptionClient` for the UI.
- If API keys are missing or evaluation times out, preserve the live dashboard and show a clearly labeled fallback snapshot.
- If sponsor judges ask, be transparent about which parts are live and which are mocked.

### 4.6 GPT-5.5 Analysis Contract

GPT-5.5 should receive:

- Training intent.
- Task type.
- Class distribution.
- Missing-label count and unlabeled sample previews.
- Dataset sample previews.
- Candidate label issues and label-confidence signals.
- Adaption Labs baseline metrics.
- Any deterministic parser warnings.

GPT-5.5 should return strict JSON:

- Summary.
- Gaps.
- Bias flags.
- Label quality issues.
- Suggested label corrections with confidence and rationale.
- Suggested label completions with confidence and rationale.
- Balancing plan summary with class weights or sampling recommendations.
- Recommended actions.
- Optional addition or generation suggestions.
- Expected impact.

Key rule:

GPT-5.5 can explain and recommend, but it should not fabricate provider metrics. If it estimates an impact or label confidence, label it as estimated. Suggested label corrections should require user approval before changing the dataset.

### 4.7 Adaption Labs Evaluation Contract

Adaption Labs is the primary sponsor target and the most important integration. Treat its API as the quality authority.

Required logical operations:

- **Create dataset:** Create an Adaption dataset from a normalized manifest. The REST endpoint `POST /api/v1/datasets` supports file sources with `csv`, `json`, `jsonl`, or `parquet`, returning `dataset_id`, `status`, and presigned upload instructions.
- **Upload manifest:** Upload the manifest file to the presigned URL when using the file source flow.
- **Run with column mapping:** Map DataForge manifest columns into Adaption roles such as `prompt`, `completion`, and `context`. For image labeling, use a fixed labeling instruction as `prompt`, label or final label as `completion`, and image URL/current label/candidate labels/metadata as `context`.
- **Evaluate baseline:** Produce quality metrics for the source dataset, including label consistency, completeness, or quality where supported.
- **Evaluate labelized/balanced dataset:** Produce quality metrics after approved label completions, label corrections, and balancing metadata.
- **Export/download:** Download the resulting dataset or preserve the Adaption snapshot URL/metadata in the DataForge export bundle.

Adaption Labs documentation notes:

- `datasets.get_evaluation(dataset_id)` is the quality-focused call. Evaluation status can be `pending`, `running`, `succeeded`, `failed`, or `skipped`.
- `quality` may include `score_before`, `score_after`, letter grades, `improvement_percent`, and `percentile_after` when evaluation succeeds.
- `datasets.get(dataset_id)` may include `evaluation_summary`, useful for dashboard summaries.
- `get_status` is for ingestion or run progress and should not be treated as the quality source.
- Use `job_specification.max_rows` for bounded live demos and `estimate=True` for cost or duration estimates before full runs.
- Universal prompts are a web-app concept; for SDK-style runs, emulate them by adding a fixed prompt/instruction column to every manifest row.

The UI should expose these operations in the language of the product, even if the exact API uses different names.

Important product rule:

Do not require model training to show improvement. The improvement proof is the difference between baseline and labelized or balanced Adaption evaluation snapshots.

### 4.8 Optional Fal Synthetic Generation Contract

Fal is optional for the aligned MVP. The core output is a clean labelized dataset and report. If the team uses Fal, it should generate only approved samples for specific underrepresented classes after Adaption Labs evaluation and balancing analysis show a concrete need.

Inputs:

- Class name.
- Training intent.
- Visual scenario.
- Existing sample description.
- Diversity requirements.
- Count cap.

Outputs:

- Image URL.
- Provider metadata.
- Prompt.
- Target label.
- Generation job ID.

Generated samples should be displayed before inclusion if time allows. If the MVP auto-includes generated images, the UI must still tag them as synthetic.

### 4.9 Upload, Privacy, and Safety Constraints

- API keys must remain server-side.
- Uploaded datasets may contain sensitive information. The UI should warn users not to upload regulated or private data during the demo.
- Strip EXIF metadata from images if feasible.
- Limit upload size and sample count.
- Do not train models on uploaded data.
- Do not automatically overwrite labels without explicit user approval.
- Preserve original labels and correction provenance for every relabeled sample.
- Preserve unlabeled samples as `manual_review` if no confident label exists.
- Do not present class weights or sampling metadata as new real images.
- Do not claim synthetic data is equivalent to real-world collection.
- Mark all generated samples as synthetic.
- Preserve prompts and provenance for every synthetic sample.
- Handle unsafe generation or provider policy errors gracefully.

### 4.10 Observability and Cost Controls

Track for every dataset run:

- Dataset ID.
- Sample count.
- Class count.
- Provider calls.
- Stage timings.
- Baseline evaluation metrics.
- Labelized and balanced evaluation metrics.
- Missing-label count before and after.
- Number of suspected label issues.
- Number of accepted, rejected, newly labeled, corrected, and manually reviewed label decisions.
- Number of suspected, removed, kept, and manually reviewed duplicate images.
- Class weights and sampling recommendations.
- Optional number of synthetic samples generated and Fal job IDs.
- Error messages.

Hackathon cost controls:

- Limit preview analysis to first 100 rows or 12 to 24 images.
- Use Adaption Labs `max_rows` for bounded pilot runs where applicable.
- Use Adaption Labs `estimate=True` before larger runs where applicable.
- Limit optional synthetic generation to 10 images per class by default.
- Cap total optional generated images per dataset.
- Cache demo results for the prepared dataset.
- Keep a precomputed fallback run in Convex in case live APIs are slow.

### 4.11 MVP vs Stretch Stack Decisions

**MVP stack:**

- Next.js on Vercel.
- Convex realtime backend.
- OpenAI GPT-5.5 structured quality report.
- Adaption Labs dataset creation, bounded run, evaluation polling, and baseline/final quality snapshots.
- AI-assisted label completion and relabeling queue for partially labeled image classification datasets.
- Duplicate image review and removal queue, using Adaption deduplication signals where available and deterministic fallback checks where needed.
- Class balancing plan with weights, sampling recommendations, and visible before/after distribution.
- Recharts dashboard for before/after class distribution, missing-label delta, label issue delta, and quality delta.
- Pre-prepared demo dataset with imbalance, missing labels, and known mislabeled examples.

**Stretch stack:**

- Full CSV/JSON support beyond image classification.
- Live Fal image generation for one or two underrepresented classes.
- Full annotation workspace for drawing boxes, masks, and bulk label editing.
- Manual accept/reject review for each synthetic image.
- Hugging Face export bundle.
- Data card generation.
- Duplicate detection and split leakage checks.
- Multiple dataset versions and rollback.

### 4.12 Implementation Constraints

1. **Do not train a model during the hackathon demo:** It adds time, cost, and uncertainty. Use Adaption Labs evaluation API to show quality improvement.
2. **Do not over-support dataset types:** Image classification is the best MVP path because missing labels, wrong labels, and class imbalance are easy to understand visually.
3. **Do not hide mocked provider behavior:** If any adapter is mocked, label it internally and be ready to explain the fallback.
4. **Do not let GPT-5.5 invent objective metrics:** Provider metrics and deterministic parser metrics must remain separate from LLM interpretation.
5. **Do not auto-apply label decisions:** AI can suggest labels and relabels, but the user must approve them before the manifest changes.
6. **Do not erase original labels:** Labelized samples must preserve original label, final label, confidence, reason, and review status.
7. **Do not fake balancing:** Class weights and sampling recommendations must be labeled as balancing metadata, not new real samples.
8. **Do not generate synthetic data without a measured gap:** Optional generation jobs should be tied to a class, scenario, or quality issue.
9. **Do not treat synthetic samples as real samples:** Always preserve provenance and display a synthetic badge.
10. **Do not block the dashboard on long-running calls:** Write stage updates early and often so the UI remains alive.
11. **Do not use user-uploaded secrets or tokens in provider prompts:** Keep all credentials server-side and minimal.
12. **Do not make accuracy claims:** Claim dataset quality, labeling completeness, balance, coverage, or consistency improvement only if supported by evaluation metrics.
13. **Do not attempt full MLOps:** The product ends at dataset evaluation, labelization, deduplication, balancing, report generation, and export.

### 4.13 Demo Dataset Recommendation

Prepare a small image classification dataset before the hackathon. The dataset should be intentionally imbalanced and visually understandable.

Recommended demo:

- Task: animal image classification across pets and wildlife.
- Training intent: "Train an animal image classifier that works across common pets and wildlife, including low-light camera-trap photos."
- Class 1: cats, 120 images.
- Class 2: dogs, 100 images.
- Class 3: birds, 70 images.
- Class 4: foxes, 15 images.
- Class 5: owls, 10 images.
- Scenario gap: night-time or low-light wildlife examples, 0 to 5 images.
- Missing-label seed: 15 to 30 images in an unlabeled or unknown folder.
- Label issue seed: 5 to 10 intentionally mislabeled images, such as cats in the dog folder, foxes labeled as dogs, or owls labeled as birds.

Expected demo result:

- Baseline evaluation flags missing labels, likely wrong labels, fox and owl underrepresentation, and low-light wildlife gaps.
- GPT-5.5 explains why the suspected labels are risky, suggests labels and corrected labels for review, and summarizes the balancing plan.
- User approves obvious completions and corrections, such as labeling an unknown owl image and moving a cat image out of the dog class.
- DataForge applies class weights or sampling recommendations for foxes, owls, and low-light wildlife.
- Final Adaption Labs evaluation improves labeling completeness, balance, consistency, or quality metrics.
- Convex dashboard shows the full sequence live.

This dataset is ideal because the problem is intuitive and safe. Judges can understand class imbalance, missing labels, and wrong labels immediately, and the before/after chart should show clear improvement. It also avoids the ethical, privacy, and validity risks of medical-image demos while preserving a serious data-quality story.

### 4.14 Agent Skill Usage During Implementation

Use skills selectively. The goal is to constrain execution and ship the smallest credible demo, not expand scope.

Recommended skills:

- **`karpathy-guidelines`:** Use before implementation to keep scope surgical, define verifiable success criteria, and avoid overbuilding.
- **`adaptionlabs`:** Use for Adaption Labs dataset creation, upload, run configuration, evaluation polling, large-dataset controls, and fallback adapter design.
- **`nextjs`:** Use for Next.js App Router, server actions or route handlers, Vercel deployment, and app structure.
- **`ai-sdk-6` or `ai-sdk`:** Use if the team adopts Vercel AI SDK for OpenAI/GPT-5.5 structured outputs and provider boundaries.
- **`zod`:** Use for validating dataset metadata, GPT-5.5 quality report JSON, provider adapter responses, and Convex-facing payloads.
- **`shadcn`:** Use for cards, buttons, dialogs, badges, tabs, tables, and dashboard primitives.
- **`tailwind-design-system`:** Use for the dark technical dashboard theme, status colors, spacing, and reusable tokens.
- **`motion`:** Use sparingly for pipeline stage transitions, score deltas, and generated sample reveals.
- **`api-design`:** Use when shaping provider adapter contracts and server action or route boundaries.
- **`ai-agents-architect`:** Use for the evaluate -> explain -> repair -> re-evaluate loop and provider orchestration.
- **`prompt-engineer`:** Use for GPT-5.5 labelization report prompts and optional synthetic image prompt templates.
- **`impeccable` or `web-design-guidelines`:** Use for final UI polish, accessibility, visual hierarchy, and demo-readiness.

Implementation rule:

The core build remains: partially labeled animal image dataset upload, Convex-backed live pipeline, Adaption Labs evaluation, GPT-5.5 label and balance report, user-approved label completions and corrections, class balancing metadata, clean dataset export, and before/after quality visualization.
