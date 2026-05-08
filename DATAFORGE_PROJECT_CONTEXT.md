# DataForge: Project Context & Product Specification

DataForge is a hackathon product concept for AI Engineer Singapore.

## 1. Vision & Core Thesis

**DataForge** is an intelligent dataset curator for ML engineers. It helps a team inspect an existing dataset, understand whether it is good enough for a training goal, generate targeted synthetic samples for missing coverage, and re-evaluate the improved dataset without needing to train a model during the demo.

The core philosophy is simple: **DataForge is a closed-loop data quality system, not a model training platform.**

Most ML teams do not fail because they cannot start a training run. They fail because the dataset is quietly broken before training begins: classes are imbalanced, edge cases are missing, labels are inconsistent, duplicates leak across splits, and visual diversity is too narrow. These problems usually surface late, after wasted training cycles and confusing evaluation results.

DataForge moves the quality loop earlier. A user uploads a dataset and describes the model they want to train. The system evaluates the dataset, explains the gaps, proposes targeted repair actions, generates synthetic samples only where they are needed, and then evaluates again. The key demo artifact is the **before/after dataset quality delta**, not a trained model.

This distinction matters for the hackathon. DataForge should not promise "we improved model accuracy" unless a model is actually trained and evaluated. Instead, it should prove a more realistic claim:

1. The original dataset had measurable quality issues.
2. Adaption Labs evaluation identified or scored those issues.
3. GPT-5.5 translated those metrics into an actionable gap report.
4. Fal generated targeted synthetic data to fill the detected gaps.
5. Adaption Labs evaluation showed the augmented dataset improved on quality, coverage, balance, or consistency metrics.

The winning thesis is that dataset curation can become an **adaptive improvement loop**:

1. Evaluate the dataset.
2. Explain the gaps.
3. Generate or recommend repairs.
4. Re-ingest the repaired dataset.
5. Evaluate again.
6. Export a better dataset.

DataForge should feel technical and credible. It should avoid the common hackathon trap of showing synthetic images as a gimmick. Synthetic data is valuable only when it is tied to a measured gap and a re-evaluation step. The user should see exactly why a generation job exists, what class or scenario it is meant to improve, and whether the second evaluation actually moved the quality score.

For the AI Engineer hackathon, DataForge should optimize for four judging moments:

1. **Adaption Labs centrality:** the evaluation API must be the core source of dataset quality truth.
2. **GPT-5.5 intelligence:** GPT-5.5 should explain metrics, detect likely issues, and produce structured repair plans.
3. **Fal usefulness:** Fal should generate targeted synthetic images for underrepresented classes or scenarios, not random images.
4. **Convex visibility:** the entire pipeline should be visible live through a realtime dashboard.

The MVP should focus on one clean dataset type: **animal image classification datasets**. Supporting CSV, JSON, and arbitrary images is useful later, but a 7-hour build should prioritize a pre-prepared animal classifier demo with deliberate class imbalance and missing visual scenarios. Animal classes are visually obvious, safe for synthetic generation, easy for judges to understand, and still support the evergreen thesis that AI companies need fresh, up-to-date data as the world changes. Tabular upload can be a lightweight parser if time allows, but the best live demo will come from images because Fal can visibly repair image-class gaps.

## 2. Market Context & Competitive Differentiators

Dataset quality is one of the highest-leverage problems in applied AI. Model architectures change, but data quality remains a bottleneck. Teams spend large amounts of time collecting, labeling, cleaning, deduplicating, balancing, augmenting, and documenting data before any model can be trusted.

The market has many tools, but they are usually fragmented across the dataset lifecycle.

Common buckets include:

1. **Annotation platforms:** Labelbox, Scale, CVAT, Label Studio, and similar tools help teams label data, review annotations, and manage labeling workflows.
2. **Dataset management and versioning:** DVC, Weights & Biases Artifacts, LakeFS, Hugging Face Datasets, and data catalogs help store, version, and reproduce datasets.
3. **Computer vision dataset platforms:** Roboflow and related tools help with image upload, annotation, augmentation, export formats, and deployment workflows.
4. **Synthetic data vendors:** Gretel, Mostly AI, Synthesis AI, and model-specific generation workflows create synthetic data, but they may not be tied to a specific measured gap in the user's current dataset.
5. **Data quality and observability systems:** Great Expectations, WhyLabs, Evidently, and Monte Carlo focus on validation, drift, and data quality checks, often more for production pipelines than rapid training-set repair.
6. **Manual notebooks and scripts:** Many ML engineers still use Python notebooks, pandas, augmentation libraries, and ad hoc scripts to inspect datasets and patch gaps.

The gap DataForge targets is the space between evaluation, explanation, and repair. Many tools can label data. Many tools can generate data. Many tools can chart data. Fewer tools provide a fast loop where dataset quality is evaluated, repaired, and evaluated again in one product flow.

**Where DataForge wins:**

1. **Evaluation-first workflow:** Adaption Labs evaluation is the anchor. The product does not ask judges to trust a pretty chart or an LLM's opinion. It shows a measured baseline and a measured post-repair state.
2. **No model training required:** DataForge proves dataset improvement without spending hackathon time training a model. This avoids slow, flaky, GPU-dependent demos.
3. **Intent-aware analysis:** The user describes what they want to train. GPT-5.5 interprets the dataset relative to that objective, so the gap report is not generic. A dataset for "cracked pavement detection at night" has different quality needs than a dataset for "daytime road surface classification."
4. **Targeted synthetic generation:** Fal is used to fill concrete gaps. If potholes are underrepresented, generate potholes. If nighttime cracked pavement is missing, generate varied nighttime cracked pavement. Do not generate synthetic data where the dataset is already healthy.
5. **Realtime pipeline visibility:** Convex turns a backend pipeline into a live operational interface. Judges can watch ingest, adapt, evaluate, augment, and re-evaluate stages progress without refreshing.
6. **Before/after quality delta:** The central UI primitive is a comparison: original dataset versus augmented dataset. Counts, distribution, score, and recommendations should visibly change.
7. **Exportable dataset artifact:** Even if export is a stretch feature, the architecture should treat the augmented dataset as a real artifact with source metadata, synthetic flags, prompts, and evaluation snapshots.

DataForge should not compete as a full annotation suite or full MLOps platform. It should compete as a **pre-training dataset repair cockpit**.

Primary users:

1. **ML engineers:** Need to catch data issues before training or fine-tuning.
2. **Computer vision builders:** Need enough image diversity for prototype classifiers and detectors.
3. **Research scientists:** Need quick audits of experimental datasets and coverage gaps.
4. **Data annotation leads:** Need to prioritize which labels, classes, or edge cases require attention.
5. **Startup AI teams:** Need good-enough datasets quickly without long collection cycles.
6. **Hackathon builders:** Need credible datasets for demos without spending days collecting data.

Primary hackathon positioning:

**DataForge is an adaptive dataset repair loop: evaluate, explain, augment, re-evaluate, export.**

The winning demo should show a deliberately imbalanced image dataset, run evaluation, generate missing examples, run evaluation again, and display an improved quality score or balance metric. The synthetic images are not the climax. The measured improvement is the climax.

## 3. Comprehensive User Flow & Lifecycle

### 3.1 Core Product Terms

- **Dataset Project:** A single dataset improvement workspace created from one upload and one training intent.
- **Training Intent:** The user's natural language description of the model they want to train, such as "a classifier that detects cracked pavement, potholes, and intact road surfaces in urban street photos."
- **Source Dataset:** The original uploaded dataset before any repair or synthetic augmentation.
- **Sample:** A single row, image, or data item in the dataset.
- **Label / Class:** The target category associated with a sample. For MVP, labels should map to image classification classes.
- **Dataset Manifest:** A CSV or JSON file that maps samples to labels and metadata. For zip uploads, the manifest may be inferred from folder names in the MVP.
- **Evaluation Snapshot:** A point-in-time Adaption Labs evaluation result for a dataset version.
- **Quality Score:** The primary score returned by Adaption Labs or derived from its metrics. It should be displayed with the metric name and source.
- **Gap:** A measurable issue in the dataset, such as an underrepresented class, missing scenario, skewed lighting condition, duplicate samples, or label inconsistency.
- **Repair Plan:** A GPT-5.5-generated structured set of recommended actions based on evaluation metrics and dataset metadata.
- **Synthetic Generation Job:** A Fal job that generates new samples for a specific class or scenario.
- **Synthetic Sample:** A generated sample tagged with its source provider, prompt, target class, and generation job ID.
- **Augmented Dataset:** The source dataset plus approved synthetic samples and optional adaptations.
- **Improvement Delta:** The comparison between baseline evaluation and post-augmentation evaluation.
- **Export Bundle:** A downloadable dataset package, optionally in Hugging Face-compatible format.

### 3.2 Roles

- **ML Engineer:** Primary user. Uploads a dataset, defines the training intent, reviews the quality report, approves synthetic generation, and exports the improved dataset.
- **Researcher:** Uses DataForge to inspect experimental data and compare dataset variants.
- **Data Lead:** Reviews labels, bias flags, and repair plans before approving dataset changes.
- **Reviewer / Judge:** Opens the live dashboard and watches the pipeline progress. For the hackathon, this can be a public dashboard URL.
- **System Operator:** Internal role responsible for API keys, provider errors, cost limits, and demo fallback data. This does not need a product UI in the MVP.

### 3.3 Phase 1: Entry, Upload, and Dataset Normalization

1. **Landing Page:** User lands on a technical dashboard-style page with the promise: "Evaluate and repair your training dataset before you train."
2. **Dataset Upload:** User uploads a CSV, JSON, or ZIP. For the hackathon MVP, the most important path is a ZIP of images arranged by class folder or an image manifest CSV.
3. **File Validation:** The app validates file type, file size, and basic structure. MVP file size should be capped to avoid timeouts and excessive memory usage.
4. **Dataset Parsing:** The app extracts labels, sample count, class distribution, and previewable records. For image datasets, it shows thumbnails grouped by class.
5. **Convex Dataset Record:** The app creates a dataset project in Convex with status `uploaded` and logs the first event.
6. **Preview Pane:** The UI displays total samples, detected classes, first rows or thumbnails, and any obvious parsing warnings.

Edge cases:

- **Unsupported format:** Reject with clear accepted formats.
- **Missing labels:** Ask for a manifest or infer folder names if possible.
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

The training intent should shape the explanation and synthetic prompts, but Adaption Labs evaluation should remain the objective metric source. GPT-5.5 should not invent final quality scores when an evaluation API metric exists.

### 3.5 Phase 3: Baseline Evaluation and Quality Report

1. **Baseline Ingest:** The backend sends the source dataset or dataset metadata to Adaption Labs for registration or evaluation, depending on the available API shape.
2. **Baseline Evaluate:** Adaption Labs returns dataset quality metrics. These may include completeness, balance, consistency, coverage, duplication, label confidence, or other provider-specific scores.
3. **Convex Stage Updates:** The app writes stage transitions to Convex: ingest queued, ingest running, ingest complete, evaluate running, evaluate complete.
4. **GPT-5.5 Report Generation:** GPT-5.5 receives the training intent, dataset summary, class distribution, sample previews, and Adaption Labs metrics. It returns a structured report.
5. **Quality Report UI:** The frontend renders score cards, class distribution charts, gap list, bias flags, label quality warnings, and ranked repair actions.

The quality report should separate measured metrics from LLM interpretation:

- **Measured:** values returned by Adaption Labs or deterministic dataset parsing.
- **Inferred:** GPT-5.5 explanations, likely causes, bias hypotheses, and suggested actions.
- **User-actionable:** generation jobs, relabeling suggestions, duplicate removal, class balancing.

Edge cases:

- **Adaption Labs API unavailable:** Use a thin mock adapter with clearly labeled demo metrics and keep the UI functional.
- **Evaluation returns partial metrics:** Display available metrics and have GPT-5.5 explain only what is supported.
- **GPT-5.5 JSON invalid:** Retry once with a repair prompt, then fall back to a minimal deterministic report.
- **No gaps detected:** Show a healthy dataset state and recommend export or targeted manual review instead of forcing synthetic generation.

### 3.6 Phase 4: Repair Plan and Synthetic Generation

1. **Gap Selection:** DataForge identifies underrepresented classes or scenarios from the quality report.
2. **Repair Plan Creation:** GPT-5.5 produces a repair plan with target class, current count, recommended count, generation count, prompt, and expected impact.
3. **Prompt Review:** User can review and edit the Fal prompt before generation. This is important because synthetic data quality depends heavily on prompt specificity.
4. **Fal Job Creation:** The backend calls Fal to generate images for each approved gap job. MVP should cap generation count to control cost and latency.
5. **Synthetic Gallery:** Generated images appear grouped by class with a "Synthetic" badge.
6. **Sample Registration:** Each synthetic image is stored with its label, prompt, provider, and job metadata.
7. **Convex Events:** Every job state change is logged live: queued, running, image generated, failed, complete.

Prompt principles for synthetic images:

- Match the training intent and class label.
- Generate diverse conditions, angles, lighting, backgrounds, and compositions.
- Avoid text overlays, watermarks, logos, or unrealistic artifacts.
- Keep images domain-specific rather than aesthetic.
- Prefer varied but plausible examples over near-duplicates.

Edge cases:

- **Fal generation off-domain:** Let user edit the prompt and regenerate.
- **Generated image quality poor:** Allow rejection or exclude from augmented dataset.
- **Too many requested images:** Cap count and explain the cap.
- **Class prompt ambiguous:** Ask GPT-5.5 to clarify or require user input.

### 3.7 Phase 5: Re-Ingest, Adapt, and Re-Evaluate

1. **Augmented Dataset Assembly:** DataForge combines source samples with approved synthetic samples.
2. **Adaption Labs Re-Ingest:** The augmented dataset is sent back into the Adaption Labs pipeline.
3. **Adapt Stage:** Adaption Labs applies supported transformations, such as normalization, deduplication, balancing, validation, or provider-specific adaptation.
4. **Second Evaluate Stage:** Adaption Labs evaluates the augmented dataset.
5. **Improvement Delta:** The frontend compares baseline and post-augmentation evaluation snapshots.
6. **Narrative Summary:** GPT-5.5 summarizes what improved, what remains weak, and what should happen next.

The second evaluation is the most important proof point. The UI should make this obvious:

- Baseline quality score versus augmented quality score.
- Baseline class distribution versus augmented class distribution.
- Baseline imbalance severity versus augmented imbalance severity.
- Remaining recommended actions.
- Synthetic sample count and affected classes.

Edge cases:

- **Score does not improve:** Show the honest result and explain likely reasons, such as poor synthetic diversity or metric not sensitive to class balance.
- **Evaluation worsens:** Flag the synthetic batch as harmful and let the user exclude it.
- **Evaluation API only supports metadata:** Use deterministic distribution metrics as supplemental, but label them separately from Adaption Labs metrics.

### 3.8 Phase 6: Realtime Dashboard and Review

1. **Pipeline Stepper:** Dashboard shows upload, ingest, evaluate, augment, re-evaluate, and export states.
2. **Metric Cards:** Total samples, original samples, synthetic samples, class count, quality score, imbalance score, label issues.
3. **Distribution Charts:** Recharts shows original versus augmented class distribution.
4. **Live Event Log:** Convex powers event streaming without refresh.
5. **Dataset Explorer:** User filters samples by class, source, label issue, or synthetic status.
6. **Result Summary:** Final panel explains the improvement delta and recommended next step.

Dashboard principle:

The dashboard should feel like an ML pipeline control room. Avoid a generic chatbot layout. The UI should be data-dense, dark, and status-driven.

### 3.9 Phase 7: Export and Handoff

1. **Export Preview:** User sees what will be included: original samples, accepted synthetic samples, manifest, quality report, and evaluation snapshots.
2. **Download ZIP:** MVP can export a ZIP if time permits. Otherwise, show an export manifest and mark this as a stretch feature.
3. **Hugging Face Format:** Stretch export includes `README.md` data card, manifest, split files, and metadata fields for synthetic samples.
4. **Data Card Generation:** GPT-5.5 can generate a short data card summarizing dataset purpose, classes, synthetic data usage, caveats, and evaluation results.

Export metadata should preserve provenance:

- Source: original or synthetic.
- Synthetic provider: Fal.
- Prompt used.
- Generation job ID.
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
- **Pipeline Visualization:** React Flow for a fixed, non-editable pipeline hero showing Upload -> Evaluate -> Analyze Gaps -> Generate Synthetic Data -> Re-evaluate -> Export.
- **Upload:** react-dropzone for file upload.
- **Parsing:** Papa Parse for CSV, native JSON parsing, JSZip for ZIP, image metadata extraction where needed.
- **Realtime Backend:** Convex for datasets, stage updates, events, gap jobs, synthetic samples, and dashboard subscriptions.
- **LLM Analysis:** OpenAI GPT-5.5 using structured JSON output through the Responses API or equivalent available endpoint.
- **Evaluation Platform:** Adaption Labs SDK/API for ingest, adapt, evaluate, and quality metrics.
- **Synthetic Image Generation:** Fal for generated image samples.
- **Storage:** Vercel Blob, Cloudflare R2, Supabase Storage, or Convex file storage for uploaded datasets and generated images.
- **Validation:** Zod for all provider outputs, request payloads, and structured report schemas.
- **Deployment:** Vercel.

### 4.2 Application Surfaces

- **`/` Home / Upload:** Dataset upload, training intent, task type, and analysis CTA.
- **`/datasets/:datasetId` Dashboard:** Live pipeline status, report, charts, synthetic gallery, and dataset explorer.
- **Dashboard Pipeline Hero:** Fixed React Flow graph with six nodes and five edges. Each node reflects Convex-backed status and can open a detail panel, but users cannot create, move, delete, or reconnect nodes in the MVP.
- **`/datasets/:datasetId/export` Export View:** Optional stretch route for manifest, data card, and ZIP export.
- **Server Route or Action: `createDataset`:** Creates Convex dataset record and stores upload metadata.
- **Server Route or Action: `analyzeDataset`:** Runs parsing, baseline evaluation, GPT-5.5 report, and stage updates.
- **Server Route or Action: `generateSyntheticSamples`:** Creates Fal jobs and writes generated sample records.
- **Server Route or Action: `reevaluateDataset`:** Sends augmented dataset to Adaption Labs and writes improvement metrics.

For the hackathon, server actions can be simple wrappers that call Convex mutations and provider APIs. Keep provider-specific code isolated behind adapter functions.

### 4.3 Convex Data Model

#### `datasets`

Represents one dataset project.

- `name` string
- `status` enum: `uploaded`, `analyzing`, `evaluated`, `augmenting`, `reevaluating`, `complete`, `error`
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
- `image_url` optional string
- `row_preview` optional any
- `source` enum: `original`, `synthetic`
- `provider` optional string
- `prompt` optional string
- `quality_flags` optional array
- `created_at` number

#### `evaluation_snapshots`

Stores Adaption Labs metrics and derived metrics for each dataset version.

- `dataset_id` id
- `version` enum: `baseline`, `augmented`
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
- `stage` enum: `upload`, `ingest`, `evaluate`, `analyze`, `augment`, `adapt`, `reevaluate`, `export`
- `status` enum: `queued`, `running`, `complete`, `error`
- `progress` optional number
- `metrics` optional any
- `error_message` optional string
- `started_at` optional number
- `completed_at` optional number

#### `gap_jobs`

Tracks proposed and executed synthetic generation jobs.

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
5. `analysis_running`: GPT-5.5 report generation running.
6. `analysis_ready`: Quality report and gap jobs available.
7. `augmenting`: Fal jobs running for approved gaps.
8. `augmented`: Synthetic samples stored and attached.
9. `reevaluating`: Augmented dataset sent back to Adaption Labs.
10. `complete`: Improvement delta available.
11. `error`: Terminal failure with actionable message.

Every state transition should write both a `pipeline_stages` update and an `events` row. This makes the dashboard feel alive and makes debugging easier.

React Flow node mapping:

- **Upload:** dataset parsed and previewed.
- **Evaluate:** Adaption Labs baseline quality evaluation.
- **Analyze Gaps:** GPT-5.5 report and repair plan.
- **Generate Synthetic Data:** Fal generation jobs for underrepresented classes or scenarios.
- **Re-evaluate:** Adaption Labs augmented dataset evaluation.
- **Export:** downloadable manifest or final dataset package.

React Flow is only a visualization layer. Convex remains the source of truth for node status, stage metrics, logs, and generated sample records. Recharts remains responsible for quantitative charts.

### 4.5 Provider Adapter Architecture

Use thin adapters so the rest of the app does not depend on exact provider signatures.

Recommended adapters:

- `adaptionClient.ingest(dataset)`
- `adaptionClient.adapt(datasetId)`
- `adaptionClient.evaluate(datasetIdOrPayload)`
- `openaiClient.generateQualityReport(input)`
- `openaiClient.generateFalPrompt(input)`
- `falClient.generateImages(prompt, count)`
- `storageClient.putFile(file)`
- `storageClient.putGeneratedImage(urlOrBuffer)`

Adaption Labs should have a demo-safe fallback adapter:

- If real API access works, use it.
- If endpoint signatures are unclear, use deterministic local metrics plus a clearly named `mockAdaptionClient` for the UI.
- If sponsor judges ask, be transparent about which parts are live and which are mocked.

### 4.6 GPT-5.5 Analysis Contract

GPT-5.5 should receive:

- Training intent.
- Task type.
- Class distribution.
- Dataset sample previews.
- Adaption Labs baseline metrics.
- Any deterministic parser warnings.

GPT-5.5 should return strict JSON:

- Summary.
- Gaps.
- Bias flags.
- Label quality issues.
- Recommended actions.
- Fal prompt suggestions.
- Expected impact.

Key rule:

GPT-5.5 can explain and recommend, but it should not fabricate provider metrics. If it estimates an impact, label it as estimated.

### 4.7 Adaption Labs Evaluation Contract

Adaption Labs is the primary sponsor target and the most important integration. Treat its API as the quality authority.

Required logical operations:

- **Ingest:** Register or validate the source dataset.
- **Evaluate baseline:** Produce quality metrics for the source dataset.
- **Adapt:** Apply supported transformations or prepare the augmented dataset.
- **Evaluate augmented:** Produce quality metrics after synthetic additions.

The UI should expose these operations in the language of the product, even if the exact API uses different names.

Important product rule:

Do not require model training to show improvement. The improvement proof is the difference between baseline and augmented evaluation snapshots.

### 4.8 Fal Synthetic Generation Contract

Fal should generate only approved samples for specific gap jobs.

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
- Augmented evaluation metrics.
- Number of synthetic samples generated.
- Fal job IDs.
- Error messages.

Hackathon cost controls:

- Limit preview analysis to first 100 rows or 12 to 24 images.
- Limit synthetic generation to 10 images per class by default.
- Cap total generated images per dataset.
- Cache demo results for the prepared dataset.
- Keep a precomputed fallback run in Convex in case live APIs are slow.

### 4.11 MVP vs Stretch Stack Decisions

**MVP stack:**

- Next.js on Vercel.
- Convex realtime backend.
- OpenAI GPT-5.5 structured quality report.
- Adaption Labs evaluation API for baseline and augmented scores.
- Fal image generation for one or two underrepresented classes.
- Recharts dashboard for before/after class distribution and quality delta.
- Pre-prepared demo dataset.

**Stretch stack:**

- Full CSV/JSON support beyond image classification.
- Automated annotation suggestions.
- Manual accept/reject review for each synthetic image.
- Hugging Face export bundle.
- Data card generation.
- Duplicate detection and split leakage checks.
- Multiple dataset versions and rollback.

### 4.12 Implementation Constraints

1. **Do not train a model during the hackathon demo:** It adds time, cost, and uncertainty. Use Adaption Labs evaluation API to show quality improvement.
2. **Do not over-support dataset types:** Image classification is the best MVP path because Fal can visibly repair gaps.
3. **Do not hide mocked provider behavior:** If any adapter is mocked, label it internally and be ready to explain the fallback.
4. **Do not let GPT-5.5 invent objective metrics:** Provider metrics and deterministic parser metrics must remain separate from LLM interpretation.
5. **Do not generate synthetic data without a measured gap:** Every generation job should be tied to a class, scenario, or quality issue.
6. **Do not treat synthetic samples as real samples:** Always preserve provenance and display a synthetic badge.
7. **Do not block the dashboard on long-running calls:** Write stage updates early and often so the UI remains alive.
8. **Do not use user-uploaded secrets or tokens in provider prompts:** Keep all credentials server-side and minimal.
9. **Do not make accuracy claims:** Claim dataset quality, balance, coverage, or consistency improvement only if supported by evaluation metrics.
10. **Do not attempt full MLOps:** The product ends at dataset evaluation, repair, and export.

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

Expected demo result:

- Baseline evaluation flags foxes and owls as underrepresented and identifies low-light wildlife as a missing scenario.
- GPT-5.5 recommends targeted synthetic generation with varied lighting, angles, environments, and camera-trap-style views.
- Fal generates 10 to 20 images for foxes, owls, or low-light wildlife examples.
- Augmented evaluation improves balance or quality metrics.
- Convex dashboard shows the full sequence live.

This dataset is ideal because the problem is intuitive and safe. Judges can understand class imbalance immediately, synthetic image repair is visually obvious, and the before/after chart should show clear improvement. It also avoids the ethical, privacy, and validity risks of medical-image demos while preserving a serious data-quality story.

### 4.14 Agent Skill Usage During Implementation

Use skills selectively. The goal is to constrain execution and ship the smallest credible demo, not expand scope.

Recommended skills:

- **`karpathy-guidelines`:** Use before implementation to keep scope surgical, define verifiable success criteria, and avoid overbuilding.
- **`nextjs`:** Use for Next.js App Router, server actions or route handlers, Vercel deployment, and app structure.
- **`ai-sdk-6` or `ai-sdk`:** Use if the team adopts Vercel AI SDK for OpenAI/GPT-5.5 structured outputs and provider boundaries.
- **`zod`:** Use for validating dataset metadata, GPT-5.5 quality report JSON, provider adapter responses, and Convex-facing payloads.
- **`shadcn`:** Use for cards, buttons, dialogs, badges, tabs, tables, and dashboard primitives.
- **`tailwind-design-system`:** Use for the dark technical dashboard theme, status colors, spacing, and reusable tokens.
- **`motion`:** Use sparingly for pipeline stage transitions, score deltas, and generated sample reveals.
- **`api-design`:** Use when shaping provider adapter contracts and server action or route boundaries.
- **`ai-agents-architect`:** Use for the evaluate -> explain -> repair -> re-evaluate loop and provider orchestration.
- **`prompt-engineer`:** Use for GPT-5.5 quality report prompts and Fal synthetic image prompt templates.
- **`impeccable` or `web-design-guidelines`:** Use for final UI polish, accessibility, visual hierarchy, and demo-readiness.

Implementation rule:

The core build remains: animal image dataset upload, Convex-backed live pipeline, Adaption Labs evaluation, GPT-5.5 gap report, Fal synthetic samples, and before/after quality visualization.
