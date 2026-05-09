# DataForge Parallel Implementation Plan

This document is the authoritative implementation plan for the DataForge hackathon build. It is optimized for a four-person team where three people code in parallel and one person owns slides/video after the demo flow is stable.

The product target is a credible, demo-safe loop:

1. Load the animal image dataset (simulated "upload" using the local `data/` directory).
2. Evaluate dataset quality.
3. Detect likely label mistakes.
4. Approve relabeling fixes.
5. Detect and remove duplicate or near-duplicate images.
6. Balance class weightage through class weights, sampling recommendations, or optional additions.
7. Re-evaluate the clean labeled repair manifest with the same quality source used for baseline.
8. Export the clean labelized dataset, manifest, and report.

30-second judge pitch:

> DataForge turns messy image datasets into training-ready assets. Teams upload a partially labeled dataset, DataForge uses a seeded or GPT Vision/Gemini visual audit to find missing labels, wrong labels, and duplicates, then evaluates the cleaned repair manifest and quality deltas. The output is a clean labeled dataset plus a report proving the before-and-after improvement. This matters because AI teams always need more high-quality labeled data, and that demand keeps growing every year.

Recommended demo dataset:

- **Base source:** Kaggle Animals-10, `alessiocorrado99/animals10`.
- **Verdict:** Good fit as a base image-classification dataset because animal classes are visually understandable for judges.
- **Constraint:** Do not use it raw. Build a controlled demo subset with deliberate defects: missing labels, wrong labels, duplicates, and class imbalance.
- **Demo subset target:** 4 to 6 classes, around 150 to 300 images total, with a skew such as 90 cats and 20 dogs so balancing is obvious.
- **Why it works:** The source is realistic enough to feel credible, while the curated corruption makes the two-minute repair loop predictable.

Provider boundary decision:

- Adaption Labs does not inspect image pixels for this MVP.
- Image-specific findings come from seeded demo truth first, with GPT Vision/Gemini as the optional live path.
- Adaption Labs, if used, receives only a normalized CSV/JSON repair manifest and should be described as manifest-level dataset evaluation, not visual image analysis.
- The live presentation may be fully mocked, but the UI and pitch must not claim that Adaption analyzed image content.

## Parallel Work Rules

*Objective: Keep Brian, Bazel, and Joseph coding without creating avoidable merge conflicts.*

- [ ] **Rule 0.1: One owner per shared file**
  - **Owner:** Brian.
  - **Shared files:** `app/page.tsx`, `app/layout.tsx`, `styles.css`, `package.json`, `package-lock.json`, `README.md`.
  - **Constraint:** Bazel and Joseph must not edit these files directly. If they need an import, dependency, global token, or route-level layout change, they ask Brian to make it.

- [ ] **Rule 0.2: Component-level ownership**
  - **Owner:** Each developer owns their own component directory/files.
  - **Constraint:** New UI work should use component files under `components/dataforge/` and colocated CSS modules, for example `label-audit-panel.tsx` and `label-audit-panel.module.css`.
  - **Constraint:** Avoid adding more global CSS unless Brian explicitly coordinates it.

- [ ] **Rule 0.3: Shared types before feature branches**
  - **Owner:** Brian.
  - **Dependency:** Bazel and Joseph start feature implementation after `lib/dataforge/types.ts` exists and is merged or copied into their branches.
  - **Constraint:** After the shared types are agreed, do not rename exported type fields without notifying all devs.

- [ ] **Rule 0.4: Branch names**
  - **Brian:** `feature/brian-orchestration-shell`.
  - **Bazel:** `feature/bazel-label-audit`.
  - **Joseph:** `feature/joseph-adaption-balance-report`.
  - **Slides/video owner:** `docs/slides-video`.

- [ ] **Rule 0.5: Merge order**
  - **Step 1:** Merge Brian's foundation branch first.
  - **Step 2:** Merge Bazel and Joseph feature branches after foundation.
  - **Step 3:** Brian creates the final integration pass that imports Bazel and Joseph's completed components into `app/page.tsx`.
  - **Constraint:** Bazel and Joseph should export components and pure helpers only. They should not wire themselves into the page.

---

## Brian Phases

### Brian Phase 1: Foundation Contracts And App Shell

*Objective: Create the stable contracts and page composition surface that let the three code workstreams proceed independently.*

*Owner: Brian.*

*Blocks: Bazel Phase 1 and Joseph Phase 1.*

- [x] **Step 1.1: Create shared DataForge directories**
  - **Action:** Create `components/dataforge/` for feature components.
  - **Action:** Create `lib/dataforge/` for deterministic demo data, pipeline state, metrics, label audit helpers, Adaption helpers, balancing helpers, and export helpers.
  - **Action:** Keep new files small and named by feature so ownership is obvious.

- [x] **Step 1.1.1: Verify local environment files**
  - **Action:** Keep `.env.example` committed with blank provider keys and local Convex defaults.
  - **Action:** Keep `.env.local` ignored and use it for real provider keys.
  - **Action:** Confirm Convex local values are present: `CONVEX_DEPLOYMENT=anonymous:anonymous-AIESG-May2026`, `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210`, and `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211`.
  - **Constraint:** Never commit real `ADAPTION_API_KEY`, `OPENAI_API_KEY`, or `FAL_KEY` values.

- [x] **Step 1.2: Define shared TypeScript contracts (`lib/dataforge/types.ts`)**
  - **Action:** Define `StageStatus`, `PipelineStage`, `SampleSource`, `DatasetSample`, `DatasetMetrics`, `ClassDistribution`, `LabelIssue`, `DuplicateIssue`, `LabelDecisionAction`, `BalancingPlan`, `AdaptionEvaluationSnapshot`, `PipelineEvent`, `QualityReport`, and `ExportManifest`.
  - **Action:** Include labelization fields in `DatasetSample`: `originalLabel`, `currentLabel`, `finalLabel`, `labelStatus`, `labelConfidence`, `labelReason`, and `qualityFlags`.
  - **Action:** Include duplicate and balancing fields: `duplicateOf`, `duplicateStatus`, `classWeight`, `samplingStrategy`, and optional provenance for generated or externally added samples.
  - **Constraint:** Types should support the demo without requiring Convex, Fal, OpenAI, or Adaption Labs keys.

- [x] **Step 1.2.1: Fix next-env and add Convex dev script**
  - **Action:** Update `package.json` to add `dev:with-convex` script that runs convex dev concurrently with next dev.
  - **Action:** Fix `next-env.d.ts` reference path for Next.js routes.

- [x] **Step 1.3: Create deterministic demo seed (`lib/dataforge/demo-data.ts`)**
  - **Action:** Move class distributions, baseline metrics, final metrics, stage definitions, and seeded animal samples into this file.
  - **Action:** Use Kaggle Animals-10 (`alessiocorrado99/animals10`) as the base dataset if download access is available, then create a curated demo subset rather than using the full dataset raw.
  - **Action:** Include 15 to 30 missing-label samples, 5 to 10 known label issues such as cat images assigned to dogs, and 5 to 10 duplicate or near-duplicate image records.
  - **Action:** Create an obvious imbalance, such as 90 cats and 20 dogs, with target balance metadata such as 90 cats and 80 dogs.
  - **Action:** Export pure data only. Do not export React state or UI code from this file.

- [ ] **Step 1.3.1: Recover Fal AI Synthetic Mock Data**
  - **Action:** Recover the images that were deleted in commit `7dbd4f14` (which created the deliberate imbalance).
  - **Action:** Add these recovered images into the demo seed as `falSyntheticSamples` (or similar).
  - **Constraint:** These must be presented to judges and hardcoded in the data as "actual synthetic images from fal ai" (never "simulated"). This exactly mirrors the real-world workflow and saves us from hitting 45-second generation limits on stage.

- [x] **Step 1.4: Create pipeline state helpers (`lib/dataforge/pipeline.ts`)**
  - **Action:** Implement helpers for queued stage creation, event creation, staged delay metadata, and demo pipeline transitions.
  - **Action:** Add the new stage order: Upload, Evaluate, Labelize, Deduplicate, Balance, Re-evaluate, Export.
  - **Constraint:** Keep timing deterministic so the live demo is repeatable.

- [x] **Step 1.5: Extract the page shell (`components/dataforge/dataforge-demo-app.tsx`)**
  - **Action:** Move most of the existing `app/page.tsx` logic into `DataForgeDemoApp`.
  - **Action:** Keep `app/page.tsx` as a thin route entry that imports and renders `DataForgeDemoApp`.
  - **Constraint:** Brian owns this file until final integration is complete.

- [x] **Step 1.6: Create integration slots for parallel features**
  - **Action:** Add placeholder imports or placeholder components for `LabelAuditPanel`, `DuplicateReviewPanel`, `QualityReportPanel`, `BalancingPanel`, `DatasetExplorer`, and `ExportManifestButton`.
  - **Action:** Pass props using shared types only, not feature-specific internal types.
  - **Dependency:** Real components arrive from Bazel and Joseph later.

- [x] **Step 1.7: Verify foundation build**
  - **Action:** Run `npm run build`.
  - **Action:** Fix TypeScript errors before other branches integrate.
  - **Validation:** The existing demo still loads, analyzes, and exports a manifest after the extraction.

### Brian Phase 2: Final Orchestration And Integration

*Objective: Combine Brian, Bazel, and Joseph's work into one deterministic demo flow with no feature branches touching the route entry at the same time.*

*Owner: Brian.*

*Depends on: Bazel Phase 1 and Joseph Phase 1.*

- [ ] **Step B2.1: Import completed feature components into the app shell**
  - **Action:** Wire `LabelAuditPanel` into the pipeline after baseline evaluation.
  - **Action:** Wire `QualityReportPanel`, `DistributionChart`, `DuplicateReviewPanel`, `BalancingPanel`, `DatasetExplorer`, and `ExportManifestButton` into the dashboard.
  - **Constraint:** Keep `app/page.tsx` thin. Use `DataForgeDemoApp` for orchestration.

- [ ] **Step B2.2: Add the labelization, deduplication, and balancing stages to the live pipeline**
  - **Action:** Update the stage flow to run Upload, Evaluate, Labelize, Deduplicate, Balance, Re-evaluate, Export.
  - **Action:** Add events such as `labelize.started`, `missing_label.detected`, `label_issue.detected`, `label_decision.approved`, `duplicate.detected`, `duplicate.removed`, `balance_plan.created`, and `labelize.complete`.
  - **Validation:** The UI can pause after labelization so the presenter can approve completions/corrections before continuing.

- [ ] **Step B2.3: Connect approved label decisions to downstream metrics**
  - **Action:** Apply Bazel's `applyLabelDecisions` before Joseph's metrics, balancing, final quality evaluation, and export helpers run.
  - **Action:** Make class distribution, missing-label counts, and label issue counts change after approvals.
  - **Constraint:** Do not auto-apply label decisions on page load. The user must approve them.

- [ ] **Step B2.4: Connect duplicate review, balancing, and final quality evaluation to labelized data**
  - **Action:** Run duplicate review after label review and before balancing.
  - **Action:** Run Joseph's balancing helpers only after label and duplicate decisions are applied.
  - **Action:** Ensure final evaluation receives the clean labelized and deduplicated repair manifest, not stale original samples.
  - **Validation:** Manifest contains original, newly labeled, relabeled, duplicate removal, balancing, visual-audit, and quality-evaluation provenance.

- [ ] **Step B2.5: Demo timing pass (Mocked Processing)**
  - **Action:** Tune artificial staged delays (spinners and loading visuals) so the demo feels live and processing-heavy but advances predictably.
  - **Action:** Use pre-computed, mocked data for visual audit, duplicate detection, manifest evaluation, and LLM explanation to bypass the 30+ minute real-world processing times. Include the 3-second loader for the Fal AI image generation that instantly returns the recovered imbalance images.
  - **Action:** Make the whole click-through complete in under 2 minutes.
  - **Constraint:** Keep behavior strictly deterministic. The "live" pipeline is entirely simulated for the presentation and must not imply Adaption Labs read image pixels.

- [ ] **Step B2.6: Responsive and build validation**
  - **Action:** Test desktop width around 1440px.
  - **Action:** Test mobile width around 390px.
  - **Action:** Run `npm run build`.
  - **Validation:** No TypeScript errors, no hydration errors, no horizontal page overflow.

---

## Bazel Phases

### Bazel Phase 1: Label Completion, Relabeling, And Duplicate Review

*Objective: Implement the teammate-requested labeling feature: use seeded demo truth or GPT Vision/Gemini outputs to detect missing labels and likely mislabels, let the user approve completions/corrections, and show labelization improvement.*

*Owner: Bazel.*

*Depends on: Brian Step 1.2 shared types.*

*Owned files: `components/dataforge/label-audit-panel.tsx`, `components/dataforge/label-audit-panel.module.css`, `components/dataforge/duplicate-review-panel.tsx`, `components/dataforge/duplicate-review-panel.module.css`, `components/dataforge/dataset-explorer.tsx`, `components/dataforge/dataset-explorer.module.css`, `lib/dataforge/label-audit.ts`, `lib/dataforge/duplicates.ts`.*

- [x] **Step 2.1: Implement label audit helper (`lib/dataforge/label-audit.ts`)**
  - **Action:** Export `getOpenLabelIssues(samples, labelIssues)`.
  - **Action:** Export `getMissingLabelIssues(samples)`.
  - **Action:** Export `applyLabelDecisions(samples, actions)` for both missing-label completions and wrong-label corrections.
  - **Action:** Export `summarizeLabelIssues(labelIssues)` with counts for missing, corrected, newly labeled, accepted, rejected, and manual review.
  - **Constraint:** Use pure functions. Do not import React. Do not mutate input arrays.

- [x] **Step 2.1.1: Implement duplicate helper (`lib/dataforge/duplicates.ts`)**
  - **Action:** Export `getOpenDuplicateIssues(samples, duplicateIssues)`.
  - **Action:** Export `applyDuplicateDecisions(samples, actions)`.
  - **Action:** Export `summarizeDuplicateIssues(duplicateIssues)` with counts for suspected, removed, kept, and manual review.
  - **Constraint:** Use deterministic seeded duplicate data for the demo, with file hash, perceptual hash, or GPT Vision/Gemini as the future live path.

- [x] **Step 2.2: Build label review UI (`components/dataforge/label-audit-panel.tsx`)**
  - **Action:** Show current label, suggested final label, issue type, confidence, reason, and sample scenario.
  - **Action:** Provide Approve, Reject, and Manual Review actions.
  - **Action:** Make confidence visually clear without implying it is an objective provider metric if it is demo-estimated.
  - **Constraint:** Component receives `labelIssues`, `samples`, and callback props from Brian's orchestrator. It does not own global state.

- [x] **Step 2.3: Add label issue metric cards inside the panel**
  - **Action:** Display missing labels, suspected wrong labels, accepted completions, accepted corrections, rejected suggestions, and remaining review count.
  - **Action:** Make the demo story obvious: "24 missing labels, 7 suspected mislabels, 26 approved, 5 manual review".

- [x] **Step 2.3.1: Build duplicate review UI (`components/dataforge/duplicate-review-panel.tsx`)**
  - **Action:** Show suspected duplicate pairs with sample IDs, current/final labels, similarity reason, and source.
  - **Action:** Provide Remove Duplicate, Keep Both, and Manual Review actions.
  - **Action:** Make it clear duplicate removal affects export, not source image deletion.

- [x] **Step 2.4: Build dataset explorer with label provenance (`components/dataforge/dataset-explorer.tsx`)**
  - **Action:** Support filters for class, source, and label status.
  - **Action:** Show original label, current label, final label, and correction/completion reason when changed.
  - **Action:** Show `Unlabeled`, `Newly labeled`, `Relabeled`, `Duplicate`, `Removed`, `Accepted`, and `Manual Review` badges.
  - **Constraint:** This component owns the explorer table so Joseph does not edit it.

- [x] **Step 2.5: Style label audit and explorer via CSS modules only**
  - **Action:** Use `label-audit-panel.module.css` and `dataset-explorer.module.css`.
  - **Constraint:** Do not edit `styles.css`.

- [x] **Step 2.6: Local validation**
  - **Action:** Temporarily render the panel in an isolated local fixture or Story-style test area if needed.
  - **Action:** Run `npm run build` before handing off.
  - **Validation:** Approving corrections returns updated samples with preserved original labels.

---

## Joseph Phases

### Joseph Phase 1: Manifest Evaluation, Balancing, Report, And Export Workflow

*Objective: Own the manifest-level quality evaluation contract and the visual proof of improvement: quality cards, before/after charts, class balancing plan, quality report, and export manifest generation.*

*Owner: Joseph.*

*Depends on: Brian Step 1.2 shared types.*

*Soft dependency: Bazel Step 2.1 output shape for labelized samples. Joseph should accept labelized samples as props instead of importing Bazel internals.*

*Owned files: `components/dataforge/quality-report-panel.tsx`, `components/dataforge/quality-report-panel.module.css`, `components/dataforge/distribution-chart.tsx`, `components/dataforge/distribution-chart.module.css`, `components/dataforge/balancing-panel.tsx`, `components/dataforge/balancing-panel.module.css`, `components/dataforge/export-manifest-button.tsx`, `lib/dataforge/adaption.ts`, `lib/dataforge/metrics.ts`, `lib/dataforge/balancing.ts`, `lib/dataforge/export.ts`.*

- [x] **Step 3.0: Use the Adaption Labs skill**
  - **Action:** Activate `adaptionlabs` before implementing the adapter or report flow.
  - **Action:** Treat Adaption Labs as a manifest-level quality provider where its API supports the input shape and keep fallback metrics clearly labeled.
  - **Action:** Do not present Adaption Labs as the source of image-pixel understanding or image duplicate detection.

- [ ] **Step 3.1: Implement Adaption adapter contract (`lib/dataforge/adaption.ts`)**
  - **Action:** Export `createDatasetFromManifest(manifest)` for the `POST /api/v1/datasets` file-source flow using a normalized CSV/JSON repair manifest, not raw image input.
  - **Action:** Export `uploadManifest(uploadInstructions, file)` for presigned upload instructions.
  - **Action:** Export `runDataset(datasetId, columnMapping, options)` with support for `maxRows` and `estimate`.
  - **Action:** Support recipe toggles only where they make sense for manifest rows; image duplicate review remains seeded, hash-based, perceptual-hash-based, or GPT Vision/Gemini-based.
  - **Action:** Export `pollEvaluation(datasetId)` and `normalizeEvaluation(raw)`.
  - **Action:** Include a deterministic `mockAdaptionClient` fallback when API keys are absent, endpoints are unstable, or Adaption cannot evaluate the image-native input directly.
  - **Constraint:** Do not call Adaption directly from React components. Keep provider access behind adapter functions or server actions.

- [ ] **Step 3.2: Implement metrics helpers (`lib/dataforge/metrics.ts`)**
  - **Action:** Export `calculateDistribution(samples)`.
  - **Action:** Export `calculateBalanceScore(distribution)` for deterministic fallback display.
  - **Action:** Export `buildImprovementDelta(baseline, labelizedOrBalanced)`.
  - **Constraint:** Clearly separate deterministic fallback metrics from provider metrics.

- [ ] **Step 3.3: Implement balancing helpers (`lib/dataforge/balancing.ts`)**
  - **Action:** Export `createBalancingPlan(samples)`.
  - **Action:** Export class-level recommendations with current count after duplicate removal, target count, class weight, and sampling strategy.
  - **Action:** Strategies should include `keep`, `downsample`, `upsample`, `collect_more`, and optional `generate`.
  - **Constraint:** Do not represent class weights as new real samples.

- [ ] **Step 3.4: Build quality report panel (`components/dataforge/quality-report-panel.tsx`)**
  - **Action:** Show measured metrics separately from GPT-5.5 inferred recommendations and label every metric source: Adaption manifest evaluation, deterministic parser metric, seeded demo metric, or GPT Vision/Gemini estimate.
  - **Action:** Include missing-label and relabeling language after Bazel's decisions are available: newly labeled samples, corrected labels, and remaining manual review risk.
  - **Action:** Show quality, balance, completeness, consistency, missing-label delta, label issue delta, and duplicate issue delta.

- [ ] **Step 3.5: Build before/after chart (`components/dataforge/distribution-chart.tsx`)**
  - **Action:** Render original versus final labelized class distribution.
  - **Action:** Keep the chart dependency-free unless Brian approves a dependency install.
  - **Constraint:** Use a CSS module, not global chart classes.

- [ ] **Step 3.6: Build balancing panel (`components/dataforge/balancing-panel.tsx`)**
  - **Action:** Show balancing recommendations grouped by class.
  - **Action:** Show current count, target count, recommended weight, sampling strategy, and reason.
  - **Action:** Add a "Run Fal AI Generation" button that triggers the 3-second mocked loader and injects the recovered held-out images.
  - **Action:** Render the generated images in a grid, each marked with a clear `✨ Fal AI` or `Synthetic` badge to prove strict data tracking to the judges.

- [ ] **Step 3.7: Build export manifest button (`components/dataforge/export-manifest-button.tsx`)**
  - **Action:** Generate a JSON manifest with original samples, final labels, missing-label completions, corrected labels, duplicate removal decisions, balancing metadata, visual-audit provenance, baseline quality snapshot, and final quality snapshot.
  - **Action:** Preserve label decision provenance in exported records.
  - **Constraint:** Component receives final dataset state via props. It does not recompute global state.

- [ ] **Step 3.8: Local validation**
  - **Action:** Run `npm run build`.
  - **Validation:** Exported JSON includes `originalLabel`, `finalLabel`, `labelStatus`, `labelReason`, `duplicateStatus`, class weights, sampling strategy, before/after quality metrics, and metric source labels.

---

## Slides/Video Phases

### Slides Phase 1: Slides, Video, And Pitch Assets

*Objective: Turn the final product into a clear hackathon story after the demo path is stable.*

*Owner: Slides/video teammate.*

*Depends on: Brian Phase 2 demo flow being mostly stable.*

*Owned files: `docs/slides-outline.md`, `docs/demo-script.md`, `docs/video-shot-list.md`, final deck/video files outside the code path.*

- [ ] **Step 5.1: Build the pitch narrative**
  - **Action:** Frame the problem as broken datasets before training: class imbalance, missing labels, wrong labels, and duplicates.
  - **Action:** State the thesis: DataForge is a closed-loop dataset repair cockpit, not a model training platform.
  - **Action:** Keep the story centered on before/after dataset quality delta.

- [ ] **Step 5.2: Create the demo script (`docs/demo-script.md`)**
  - **Action:** Script the exact click path: load dataset, run the visual audit, approve missing-label completions, approve relabels, remove duplicates, review balancing plan, re-evaluate the repair manifest, export.
  - **Action:** Include one memorable line for the labeling feature: "A cat in the dog folder quietly poisons training before the model ever starts."
  - **Action:** Include sponsor mentions carefully: Adaption Labs for manifest-level dataset quality workflow where used, GPT Vision/Gemini for image understanding, GPT-5.5 for explanation and structured report, Convex-style live dashboard visibility, and optional Fal only if used for stretch additions.

- [ ] **Step 5.3: Create the slide outline (`docs/slides-outline.md`)**
  - **Action:** Slide 1: DataForge one-liner.
  - **Action:** Slide 2: The data quality problem.
  - **Action:** Slide 3: Closed-loop workflow.
  - **Action:** Slide 4: Demo dataset with imbalance, missing labels, mislabels, and duplicates.
  - **Action:** Slide 5: Before/after metrics.
  - **Action:** Slide 6: Architecture, provider boundaries, and Adaption Labs-compatible manifest workflow.
  - **Action:** Slide 7: Why it matters and next steps.

- [ ] **Step 5.4: Record video shot list (`docs/video-shot-list.md`)**
  - **Action:** Capture the initial dashboard idle state.
  - **Action:** Capture baseline quality evaluation and visual label audit results.
  - **Action:** Capture approving a missing label, a mislabeled cat/dog correction, and a duplicate removal.
  - **Action:** Capture the balancing plan appearing.
  - **Action:** Capture before/after quality delta, clean dataset report, and exported manifest.

- [ ] **Step 5.5: Final pitch rehearsal**
  - **Action:** Rehearse a 3-minute version and a 90-second backup version.
  - **Action:** Prepare fallback screenshots in case the live app fails.
  - **Constraint:** Do not claim model accuracy improvement. Claim dataset quality, labeling completeness, balance, consistency, and provenance improvement.

---

## Integration Contracts

*Objective: Make dependencies explicit so each branch can be reviewed independently.*

- [ ] **Contract A: `LabelAuditPanel` props**
  - **Provided by:** Bazel.
  - **Consumed by:** Brian.
  - **Expected shape:** `samples`, `labelIssues`, `disabled`, `onApprove(issueId)`, `onReject(issueId)`, `onManualReview(issueId)`, `onEditLabel(issueId, finalLabel)`.

- [ ] **Contract A2: `DuplicateReviewPanel` props**
  - **Provided by:** Bazel.
  - **Consumed by:** Brian.
  - **Expected shape:** `samples`, `duplicateIssues`, `disabled`, `onRemove(issueId)`, `onKeep(issueId)`, `onManualReview(issueId)`.

- [ ] **Contract B: label decision helpers**
  - **Provided by:** Bazel.
  - **Consumed by:** Brian and Joseph through orchestrated props.
  - **Expected functions:** `applyLabelDecisions`, `summarizeLabelIssues`, `getMissingLabelIssues`, `applyDuplicateDecisions`, `summarizeDuplicateIssues`.

- [ ] **Contract C: quality and distribution helpers**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian.
  - **Expected functions:** `calculateDistribution`, `buildImprovementDelta`, `normalizeEvaluation`.

- [ ] **Contract D: balancing helpers**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian.
  - **Expected functions:** `createBalancingPlan`, `calculateClassWeights`.

- [ ] **Contract E: export manifest button**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian.
  - **Expected props:** final samples, label issues, duplicate issues, balancing plan, baseline quality snapshot, final quality snapshot, training intent, quality report.

- [ ] **Contract F: Manifest quality adapter**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian through orchestration/server actions.
  - **Expected functions:** `createDatasetFromManifest`, `runDataset`, `pollEvaluation`, `normalizeEvaluation`, `mockAdaptionClient`, with no raw image-pixel analysis claims.

---

## File Ownership Map

*Objective: Avoid merge conflicts by making ownership explicit.*

- [ ] **Brian owns orchestration and shared files**
  - **Files:** `app/page.tsx`, `app/layout.tsx`, `styles.css`, `package.json`, `package-lock.json`, `README.md`, `components/dataforge/dataforge-demo-app.tsx`, `lib/dataforge/types.ts`, `lib/dataforge/demo-data.ts`, `lib/dataforge/pipeline.ts`.

- [ ] **Bazel owns label audit and explorer files**
  - **Files:** `components/dataforge/label-audit-panel.tsx`, `components/dataforge/label-audit-panel.module.css`, `components/dataforge/duplicate-review-panel.tsx`, `components/dataforge/duplicate-review-panel.module.css`, `components/dataforge/dataset-explorer.tsx`, `components/dataforge/dataset-explorer.module.css`, `lib/dataforge/label-audit.ts`, `lib/dataforge/duplicates.ts`.

- [ ] **Joseph owns manifest quality, balancing, report, and export files**
  - **Files:** `components/dataforge/quality-report-panel.tsx`, `components/dataforge/quality-report-panel.module.css`, `components/dataforge/distribution-chart.tsx`, `components/dataforge/distribution-chart.module.css`, `components/dataforge/balancing-panel.tsx`, `components/dataforge/balancing-panel.module.css`, `components/dataforge/export-manifest-button.tsx`, `lib/dataforge/adaption.ts`, `lib/dataforge/metrics.ts`, `lib/dataforge/balancing.ts`, `lib/dataforge/export.ts`.

- [ ] **Slides/video teammate owns communication artifacts**
  - **Files:** `docs/slides-outline.md`, `docs/demo-script.md`, `docs/video-shot-list.md`, exported slides, final video.

---

## Final Demo Acceptance Criteria

*Objective: Know when the build is good enough to present.*

- [ ] **Acceptance 1: Dataset load works**
  - **Validation:** Clicking "Upload ZIP" (which simulates an upload by loading from the local `data/` directory) shows classes, sample count, missing-label count, duplicate count, and seeded label issue count.

- [ ] **Acceptance 2: Baseline evaluation works**
  - **Validation:** Clicking Analyze Dataset shows baseline quality, balance, completeness, consistency, missing-label, duplicate, and label issue metrics with visible metric source labels.

- [ ] **Acceptance 3: Label audit works**
  - **Validation:** User can approve at least one missing-label completion and one obvious mislabeled sample while original labels remain preserved.

- [ ] **Acceptance 4: Duplicate review works**
  - **Validation:** User can remove at least one duplicate image from export while preserving duplicate provenance.

- [ ] **Acceptance 5: Balancing plan works**
  - **Validation:** The app shows deterministic class weights or sampling recommendations for foxes, owls, and low-light wildlife without pretending they are real images.

- [ ] **Acceptance 6: Re-evaluation works**
  - **Validation:** Before/after cards show improved labeling completeness, duplicate count, balance, label issue count, or quality score without implying Adaption Labs inspected image pixels.

- [ ] **Acceptance 7: Export works**
  - **Validation:** Exported JSON contains training intent, original labels, final labels, newly labeled samples, corrected labels, duplicate removals, balancing metadata, visual-audit provenance, quality report, and before/after quality snapshots.

- [ ] **Acceptance 8: The pitch is honest**
  - **Validation:** The team says DataForge improves dataset readiness, not trained model accuracy.
