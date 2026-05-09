# DataForge Parallel Implementation Plan

This document is the authoritative implementation plan for the DataForge hackathon build. It is optimized for a four-person team where three people code in parallel and one person owns slides/video after the demo flow is stable.

The product target is a credible, demo-safe loop:

1. Load the animal image dataset.
2. Evaluate dataset quality.
3. Detect likely label mistakes.
4. Approve relabeling fixes.
5. Generate targeted synthetic samples for measured gaps.
6. Re-evaluate the corrected or augmented dataset.
7. Export the manifest and tell the before/after story.

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
  - **Joseph:** `feature/joseph-synthetic-quality-export`.
  - **Slides/video owner:** `docs/slides-video`.

- [ ] **Rule 0.5: Merge order**
  - **Step 1:** Merge Brian's foundation branch first.
  - **Step 2:** Merge Bazel and Joseph feature branches after foundation.
  - **Step 3:** Brian creates the final integration pass that imports Bazel and Joseph's completed components into `app/page.tsx`.
  - **Constraint:** Bazel and Joseph should export components and pure helpers only. They should not wire themselves into the page.

---

## Phase 1: Foundation Contracts And App Shell

*Objective: Create the stable contracts and page composition surface that let the three code workstreams proceed independently.*

*Owner: Brian.*

*Blocks: Bazel Phase 2 and Joseph Phase 3.*

- [ ] **Step 1.1: Create shared DataForge directories**
  - **Action:** Create `components/dataforge/` for feature components.
  - **Action:** Create `lib/dataforge/` for deterministic demo data, pipeline state, metrics, label audit helpers, synthetic helpers, and export helpers.
  - **Action:** Keep new files small and named by feature so ownership is obvious.

- [ ] **Step 1.2: Define shared TypeScript contracts (`lib/dataforge/types.ts`)**
  - **Action:** Define `StageStatus`, `PipelineStage`, `SampleSource`, `DatasetSample`, `DatasetMetrics`, `ClassDistribution`, `LabelIssue`, `LabelCorrectionAction`, `GapJob`, `PipelineEvent`, and `ExportManifest`.
  - **Action:** Include label correction fields in `DatasetSample`: `originalLabel`, `correctedLabel`, `labelStatus`, and `qualityFlags`.
  - **Action:** Include synthetic provenance fields in `DatasetSample`: `provider`, `prompt`, `generationJobId`, and `source`.
  - **Constraint:** Types should support the demo without requiring Convex, Fal, OpenAI, or Adaption Labs keys.

- [ ] **Step 1.3: Create deterministic demo seed (`lib/dataforge/demo-data.ts`)**
  - **Action:** Move class distributions, baseline metrics, augmented metrics, stage definitions, and seeded animal samples into this file.
  - **Action:** Include 5 to 10 known label issues such as cat images assigned to dogs, fox images assigned to dogs, and owl images assigned to birds.
  - **Action:** Export pure data only. Do not export React state or UI code from this file.

- [ ] **Step 1.4: Create pipeline state helpers (`lib/dataforge/pipeline.ts`)**
  - **Action:** Implement helpers for queued stage creation, event creation, staged delay metadata, and demo pipeline transitions.
  - **Action:** Add the new stage order: Upload, Evaluate, Label Audit, Analyze Gaps, Generate Synthetic Data, Re-evaluate, Export.
  - **Constraint:** Keep timing deterministic so the live demo is repeatable.

- [ ] **Step 1.5: Extract the page shell (`components/dataforge/dataforge-demo-app.tsx`)**
  - **Action:** Move most of the existing `app/page.tsx` logic into `DataForgeDemoApp`.
  - **Action:** Keep `app/page.tsx` as a thin route entry that imports and renders `DataForgeDemoApp`.
  - **Constraint:** Brian owns this file until final integration is complete.

- [ ] **Step 1.6: Create integration slots for parallel features**
  - **Action:** Add placeholder imports or placeholder components for `LabelAuditPanel`, `QualityReportPanel`, `SyntheticGallery`, `DatasetExplorer`, and `ExportManifestButton`.
  - **Action:** Pass props using shared types only, not feature-specific internal types.
  - **Dependency:** Real components arrive from Bazel and Joseph later.

- [ ] **Step 1.7: Verify foundation build**
  - **Action:** Run `npm run build`.
  - **Action:** Fix TypeScript errors before other branches integrate.
  - **Validation:** The existing demo still loads, analyzes, and exports a manifest after the extraction.

---

## Phase 2: Label Audit And Relabeling Workflow

*Objective: Implement the teammate-requested labeling feature: detect likely mislabels, let the user approve corrections, and show label issue improvement.*

*Owner: Bazel.*

*Depends on: Brian Step 1.2 shared types.*

*Owned files: `components/dataforge/label-audit-panel.tsx`, `components/dataforge/label-audit-panel.module.css`, `components/dataforge/dataset-explorer.tsx`, `components/dataforge/dataset-explorer.module.css`, `lib/dataforge/label-audit.ts`.*

- [ ] **Step 2.1: Implement label audit helper (`lib/dataforge/label-audit.ts`)**
  - **Action:** Export `getOpenLabelIssues(samples, labelIssues)`.
  - **Action:** Export `applyLabelCorrections(samples, actions)`.
  - **Action:** Export `summarizeLabelIssues(labelIssues)` with counts for open, accepted, rejected, and manual review.
  - **Constraint:** Use pure functions. Do not import React. Do not mutate input arrays.

- [ ] **Step 2.2: Build label review UI (`components/dataforge/label-audit-panel.tsx`)**
  - **Action:** Show current label, suggested label, confidence, reason, and sample scenario.
  - **Action:** Provide Approve, Reject, and Manual Review actions.
  - **Action:** Make confidence visually clear without implying it is an objective provider metric if it is demo-estimated.
  - **Constraint:** Component receives `labelIssues`, `samples`, and callback props from Brian's orchestrator. It does not own global state.

- [ ] **Step 2.3: Add label issue metric cards inside the panel**
  - **Action:** Display baseline label issues, accepted corrections, rejected suggestions, and remaining review count.
  - **Action:** Make the demo story obvious: "5 suspected mislabels, 4 approved, 1 manual review".

- [ ] **Step 2.4: Build dataset explorer with label provenance (`components/dataforge/dataset-explorer.tsx`)**
  - **Action:** Support filters for class, source, and label status.
  - **Action:** Show original label and corrected label when changed.
  - **Action:** Show `Synthetic`, `Relabeled`, `Gap Candidate`, and `Manual Review` badges.
  - **Constraint:** This component owns the explorer table so Joseph does not edit it.

- [ ] **Step 2.5: Style label audit and explorer via CSS modules only**
  - **Action:** Use `label-audit-panel.module.css` and `dataset-explorer.module.css`.
  - **Constraint:** Do not edit `styles.css`.

- [ ] **Step 2.6: Local validation**
  - **Action:** Temporarily render the panel in an isolated local fixture or Story-style test area if needed.
  - **Action:** Run `npm run build` before handing off.
  - **Validation:** Approving corrections returns updated samples with preserved original labels.

---

## Phase 3: Quality, Synthetic Repair, And Export Workflow

*Objective: Own the visual proof of improvement: quality cards, before/after charts, targeted synthetic jobs, synthetic gallery, and export manifest generation.*

*Owner: Joseph.*

*Depends on: Brian Step 1.2 shared types.*

*Soft dependency: Bazel Step 2.1 output shape for corrected samples. Joseph should accept corrected distributions as props instead of importing Bazel internals.*

*Owned files: `components/dataforge/quality-report-panel.tsx`, `components/dataforge/quality-report-panel.module.css`, `components/dataforge/distribution-chart.tsx`, `components/dataforge/distribution-chart.module.css`, `components/dataforge/synthetic-gallery.tsx`, `components/dataforge/synthetic-gallery.module.css`, `components/dataforge/export-manifest-button.tsx`, `lib/dataforge/metrics.ts`, `lib/dataforge/synthetic.ts`, `lib/dataforge/export.ts`.*

- [ ] **Step 3.1: Implement metrics helpers (`lib/dataforge/metrics.ts`)**
  - **Action:** Export `calculateDistribution(samples)`.
  - **Action:** Export `calculateBalanceScore(distribution)` for deterministic fallback display.
  - **Action:** Export `buildImprovementDelta(baseline, correctedOrAugmented)`.
  - **Constraint:** Clearly separate deterministic fallback metrics from provider metrics.

- [ ] **Step 3.2: Implement synthetic helpers (`lib/dataforge/synthetic.ts`)**
  - **Action:** Export seeded `GapJob` generation plans for foxes, owls, and low-light wildlife.
  - **Action:** Export `buildSyntheticSamples(gapJobs)`.
  - **Action:** Preserve provider metadata: `provider: "demo-fal"`, prompt, generation job ID, target class, and source `synthetic`.
  - **Constraint:** Do not generate random results that change between demo runs.

- [ ] **Step 3.3: Build quality report panel (`components/dataforge/quality-report-panel.tsx`)**
  - **Action:** Show measured metrics separately from GPT-5.5 inferred recommendations.
  - **Action:** Include label-quality language after Bazel's corrections are available: suspected mislabels, approved fixes, and remaining risk.
  - **Action:** Show quality, balance, coverage, consistency, and label issue delta.

- [ ] **Step 3.4: Build before/after chart (`components/dataforge/distribution-chart.tsx`)**
  - **Action:** Render original versus corrected or augmented class distribution.
  - **Action:** Keep the chart dependency-free unless Brian approves a dependency install.
  - **Constraint:** Use a CSS module, not global chart classes.

- [ ] **Step 3.5: Build synthetic generation gallery (`components/dataforge/synthetic-gallery.tsx`)**
  - **Action:** Show active generation jobs grouped by target class.
  - **Action:** Show prompt, current count, target count, generated count, and synthetic badge.
  - **Action:** Make it visually clear that synthetic data is tied to measured gaps.

- [ ] **Step 3.6: Build export manifest button (`components/dataforge/export-manifest-button.tsx`)**
  - **Action:** Generate a JSON manifest with original samples, corrected labels, synthetic samples, prompts, provider metadata, baseline metrics, and augmented metrics.
  - **Action:** Preserve label correction provenance in exported records.
  - **Constraint:** Component receives final dataset state via props. It does not recompute global state.

- [ ] **Step 3.7: Local validation**
  - **Action:** Run `npm run build`.
  - **Validation:** Exported JSON includes `originalLabel`, `correctedLabel`, `source`, `provider`, `prompt`, and before/after metrics.

---

## Phase 4: Final Orchestration And Integration

*Objective: Combine Brian, Bazel, and Joseph's work into one deterministic demo flow with no feature branches touching the route entry at the same time.*

*Owner: Brian.*

*Depends on: Bazel Phase 2 and Joseph Phase 3.*

- [ ] **Step 4.1: Import completed feature components into the app shell**
  - **Action:** Wire `LabelAuditPanel` into the pipeline after baseline evaluation.
  - **Action:** Wire `QualityReportPanel`, `DistributionChart`, `SyntheticGallery`, `DatasetExplorer`, and `ExportManifestButton` into the dashboard.
  - **Constraint:** Keep `app/page.tsx` thin. Use `DataForgeDemoApp` for orchestration.

- [ ] **Step 4.2: Add the label audit stage to the live pipeline**
  - **Action:** Update the stage flow to run Upload, Evaluate, Label Audit, Analyze Gaps, Generate Synthetic Data, Re-evaluate, Export.
  - **Action:** Add events such as `label_audit.started`, `label_issue.detected`, `label_correction.approved`, and `label_audit.complete`.
  - **Validation:** The UI can pause after label audit so the presenter can approve corrections before continuing.

- [ ] **Step 4.3: Connect approved label corrections to downstream metrics**
  - **Action:** Apply Bazel's `applyLabelCorrections` before Joseph's metrics and export helpers run.
  - **Action:** Make class distribution and label issue counts change after approvals.
  - **Constraint:** Do not auto-apply corrections on page load. The user must approve them.

- [ ] **Step 4.4: Connect synthetic generation to corrected data**
  - **Action:** Run Joseph's synthetic helpers only after label review.
  - **Action:** Ensure synthetic records are appended to corrected samples, not to stale original samples.
  - **Validation:** Manifest contains original, relabeled, and synthetic provenance.

- [ ] **Step 4.5: Demo timing pass**
  - **Action:** Tune staged delays so the demo feels live but not slow.
  - **Action:** Make the whole click-through complete in under 2 minutes.
  - **Constraint:** Keep fallback behavior deterministic so no live provider outage can break the demo.

- [ ] **Step 4.6: Responsive and build validation**
  - **Action:** Test desktop width around 1440px.
  - **Action:** Test mobile width around 390px.
  - **Action:** Run `npm run build`.
  - **Validation:** No TypeScript errors, no hydration errors, no horizontal page overflow.

---

## Phase 5: Slides, Video, And Pitch Assets

*Objective: Turn the final product into a clear hackathon story after the demo path is stable.*

*Owner: Slides/video teammate.*

*Depends on: Phase 4 demo flow being mostly stable.*

*Owned files: `docs/slides-outline.md`, `docs/demo-script.md`, `docs/video-shot-list.md`, final deck/video files outside the code path.*

- [ ] **Step 5.1: Build the pitch narrative**
  - **Action:** Frame the problem as broken datasets before training: imbalance, missing edge cases, and mislabels.
  - **Action:** State the thesis: DataForge is a closed-loop dataset repair cockpit, not a model training platform.
  - **Action:** Keep the story centered on before/after dataset quality delta.

- [ ] **Step 5.2: Create the demo script (`docs/demo-script.md`)**
  - **Action:** Script the exact click path: load dataset, analyze, approve relabels, generate synthetic samples, re-evaluate, export.
  - **Action:** Include one memorable line for the labeling feature: "A cat in the dog folder quietly poisons training before the model ever starts."
  - **Action:** Include sponsor mentions: Adaption Labs for evaluation, GPT-5.5 for explanation, Fal for targeted generation, Convex-style live dashboard visibility.

- [ ] **Step 5.3: Create the slide outline (`docs/slides-outline.md`)**
  - **Action:** Slide 1: DataForge one-liner.
  - **Action:** Slide 2: The data quality problem.
  - **Action:** Slide 3: Closed-loop workflow.
  - **Action:** Slide 4: Demo dataset with imbalance and mislabels.
  - **Action:** Slide 5: Before/after metrics.
  - **Action:** Slide 6: Architecture and sponsor integrations.
  - **Action:** Slide 7: Why it matters and next steps.

- [ ] **Step 5.4: Record video shot list (`docs/video-shot-list.md`)**
  - **Action:** Capture the initial dashboard idle state.
  - **Action:** Capture baseline evaluation and label audit results.
  - **Action:** Capture approving a mislabeled cat/dog correction.
  - **Action:** Capture synthetic generation jobs appearing.
  - **Action:** Capture before/after quality delta and exported manifest.

- [ ] **Step 5.5: Final pitch rehearsal**
  - **Action:** Rehearse a 3-minute version and a 90-second backup version.
  - **Action:** Prepare fallback screenshots in case the live app fails.
  - **Constraint:** Do not claim model accuracy improvement. Claim dataset quality, balance, coverage, label consistency, and provenance improvement.

---

## Integration Contracts

*Objective: Make dependencies explicit so each branch can be reviewed independently.*

- [ ] **Contract A: `LabelAuditPanel` props**
  - **Provided by:** Bazel.
  - **Consumed by:** Brian.
  - **Expected shape:** `samples`, `labelIssues`, `disabled`, `onApprove(issueId)`, `onReject(issueId)`, `onManualReview(issueId)`.

- [ ] **Contract B: label correction helpers**
  - **Provided by:** Bazel.
  - **Consumed by:** Brian and Joseph through orchestrated props.
  - **Expected functions:** `applyLabelCorrections`, `summarizeLabelIssues`.

- [ ] **Contract C: quality and distribution helpers**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian.
  - **Expected functions:** `calculateDistribution`, `buildImprovementDelta`.

- [ ] **Contract D: synthetic sample helpers**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian.
  - **Expected functions:** `buildSyntheticSamples`.

- [ ] **Contract E: export manifest button**
  - **Provided by:** Joseph.
  - **Consumed by:** Brian.
  - **Expected props:** final samples, label issues, gap jobs, baseline metrics, corrected metrics, augmented metrics, training intent.

---

## File Ownership Map

*Objective: Avoid merge conflicts by making ownership explicit.*

- [ ] **Brian owns orchestration and shared files**
  - **Files:** `app/page.tsx`, `app/layout.tsx`, `styles.css`, `package.json`, `package-lock.json`, `README.md`, `components/dataforge/dataforge-demo-app.tsx`, `lib/dataforge/types.ts`, `lib/dataforge/demo-data.ts`, `lib/dataforge/pipeline.ts`.

- [ ] **Bazel owns label audit and explorer files**
  - **Files:** `components/dataforge/label-audit-panel.tsx`, `components/dataforge/label-audit-panel.module.css`, `components/dataforge/dataset-explorer.tsx`, `components/dataforge/dataset-explorer.module.css`, `lib/dataforge/label-audit.ts`.

- [ ] **Joseph owns quality, synthetic, and export files**
  - **Files:** `components/dataforge/quality-report-panel.tsx`, `components/dataforge/quality-report-panel.module.css`, `components/dataforge/distribution-chart.tsx`, `components/dataforge/distribution-chart.module.css`, `components/dataforge/synthetic-gallery.tsx`, `components/dataforge/synthetic-gallery.module.css`, `components/dataforge/export-manifest-button.tsx`, `lib/dataforge/metrics.ts`, `lib/dataforge/synthetic.ts`, `lib/dataforge/export.ts`.

- [ ] **Slides/video teammate owns communication artifacts**
  - **Files:** `docs/slides-outline.md`, `docs/demo-script.md`, `docs/video-shot-list.md`, exported slides, final video.

---

## Final Demo Acceptance Criteria

*Objective: Know when the build is good enough to present.*

- [ ] **Acceptance 1: Dataset load works**
  - **Validation:** Clicking Load Demo Animal Dataset shows classes, sample count, and seeded label issue count.

- [ ] **Acceptance 2: Baseline evaluation works**
  - **Validation:** Clicking Analyze Dataset shows baseline quality, balance, coverage, consistency, and label issue metrics.

- [ ] **Acceptance 3: Label audit works**
  - **Validation:** User can approve at least one obvious mislabeled sample and see the original label preserved.

- [ ] **Acceptance 4: Synthetic generation works**
  - **Validation:** The app generates deterministic fox, owl, and low-light wildlife synthetic records with prompts and source metadata.

- [ ] **Acceptance 5: Re-evaluation works**
  - **Validation:** Before/after cards show improved balance, coverage, label issue count, or quality score.

- [ ] **Acceptance 6: Export works**
  - **Validation:** Exported JSON contains training intent, original labels, corrected labels, synthetic provenance, prompts, gap jobs, and evaluation snapshots.

- [ ] **Acceptance 7: The pitch is honest**
  - **Validation:** The team says DataForge improves dataset readiness, not trained model accuracy.
