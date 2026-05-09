# Current Convex Integration Status

## Current State (What is implemented)

- Convex backend is wired into the app shell via `components/convex-provider.tsx` and `app/layout.tsx`.
- Main dashboard now drives a hybrid flow in `app/page.tsx`:
  - Try to use Convex persisted state when available.
  - Fall back to deterministic local demo state when Convex is not reachable.
- Dataset status model no longer includes legacy `"augmenting"`.
- New/updated Convex schema and mutation args are in `convex/schema.ts` and `convex/datasets.ts`.
- `getDashboardState` in `convex/datasets.ts` is the primary read endpoint for the UI (`app/page.tsx`)
  and returns:
  - dataset
  - stage list
  - samples
  - events
  - baseline / augmented snapshots
  - quality report
  - gap jobs
  - FAL job runs
  - `isPipelineActive`

## Canonical Status Model

- **Dataset stages** (`convex/datasets.ts`, `const STAGE_IDS`):
  - `upload` → `evaluate` → `analyze` → `generate` → `reevaluate` → `export`
- **Dataset statuses** (`convex/schema.ts`, `datasetStatuses` / `convex/datasets.ts`, `DATASET_STATUSES`):
  - `uploaded`
  - `analyzing`
  - `evaluated`
  - `label_review`
  - `analysis_ready`
  - `balancing`
  - `reevaluating`
  - `complete`
  - `error`
- UI treats pipeline as active for: `analyzing`, `label_review`, `analysis_ready`, `balancing`, `reevaluating`.

## Convex Entry Points (MVP)

### Mutations
- `api.datasets.createDemoDataset`
- `api.datasets.setDatasetStatus`
- `api.datasets.setStageStatus`
- `api.datasets.appendEvent`
- `api.datasets.saveBaselineSnapshot`
- `api.datasets.saveAugmentedSnapshot`
- `api.datasets.saveQualityReport`
- `api.datasets.saveGapJobs`
- `api.datasets.saveRelabelJobs`
- `api.datasets.setRelabelDecision`
- `api.datasets.createFalJobRun`
- `api.datasets.updateFalJobRun`
- `api.datasets.addSamples`

### Queries
- `api.datasets.getDashboardState`
- `api.datasets.getGapJobs`
- `api.datasets.getFalJobRuns`

### Notes on orchestration
- `runDemoPipeline` exists as an action in `convex/datasets.ts` but currently throws:
  - it is intentionally disabled for this stage and orchestration is client-driven.

## Important Data Tables / Records

From `convex/schema.ts`:
- `datasets`: dataset metadata + canonical `status` union above.
- `pipeline_stages`: per-stage status and progress (`queued`/`running`/`complete`/`error`).
- `samples`: original + synthetic samples with `source` and labeling fields.
- `evaluation_snapshots`: baseline + augmented versions.
- `quality_reports`: provider/model metadata + text arrays.
- `gap_jobs`: synthetic generation jobs and relabel jobs.
- `fal_job_runs`: provider/job telemetry for generation attempts.
- `events`: timestamped dashboard timeline events.

## API Route Dependencies

- `app/api/quality-report/route.ts` is used by `app/page.tsx` to generate `QualityReport` payload.
- Request schema expects:
  - `trainingIntent`
  - `classDistribution`
  - `baselineMetrics`
  - `scenarioGaps`
- Deterministic fallback report is used when API keys are missing or request fails.

## Persistence Fallback Behavior

- On **Load demo dataset**:
  1. UI seeds local demo samples first.
  2. Attempts `createDemoDataset` in Convex.
  3. If Convex write fails, app continues in local-only mode.
- On **Analyze dataset**:
  1. Writes baseline snapshot/status when dataset exists.
  2. Calls quality report API and persists report + gap jobs.
  3. Generates synthetic samples, persists them, persists augmented snapshot.
  4. Completes dataset status.
- If a Convex record is missing (`analysis_ready` without persisted report etc.), UI labels source as incomplete and shows a warning state.

## Environment / Setup for teammates

- Required runtime vars in `.env.example` / `.env.local`:
  - `CONVEX_DEPLOYMENT`
  - `NEXT_PUBLIC_CONVEX_URL`
  - `NEXT_PUBLIC_CONVEX_SITE_URL`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `FAL_AI_KEY`
- If `OPENAI_API_KEY` is absent, quality-report route falls back automatically.

## Next integration tasks

1. Replace deterministic demo generate loop in `app/page.tsx` with real job orchestration service (or background worker) that updates:
   - `gap_jobs`
   - `fal_job_runs`
   - `samples`
   - `datasets.status`
2. Implement real relabel ingestion and wire `setRelabelDecision` calls from a review UI flow.
3. Decide whether to keep `runDemoPipeline` as-is (noop/error) or move orchestration into Convex actions.
4. Add migration strategy for older datasets if any persisted docs still have previous status names.

## Files that matter for handoff

- `convex/schema.ts`
- `convex/datasets.ts`
- `convex/_generated/*` (regenerated from schema / functions)
- `components/convex-provider.tsx`
- `app/layout.tsx`
- `app/page.tsx`
- `app/api/quality-report/route.ts`
- `.env.example`
- `README.md`
