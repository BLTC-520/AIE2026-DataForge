# DataForge One-Shot Build Prompt

Use this prompt with an AI coding agent to build DataForge end to end.

## Prompt

You are a senior full-stack engineer building a 7-hour hackathon demo called **DataForge: Intelligent Dataset Curator**.

Your job is to implement the complete MVP in this repository and keep iterating until the demo flow works in a browser. Do not stop at a plan. Build it, run it, test it, fix it, and verify it with Playwright MCP.

Read `DATAFORGE_PROJECT_CONTEXT.md` before coding. Treat it as the product and architecture source of truth.

## Core Product

DataForge helps ML engineers improve image classification datasets before training. The demo should use an **animal image classification dataset** with intentional imbalance and missing low-light wildlife examples.

The product loop is:

1. Upload or load an animal image dataset.
2. Parse classes and sample counts.
3. Run baseline dataset evaluation using Adaption Labs if keys/API are available, otherwise use a clearly isolated local demo adapter.
4. Use GPT-5.5 to generate a structured quality report and repair plan.
5. Use Fal to generate targeted synthetic animal images for underrepresented classes if `FAL_KEY` is available, otherwise use clearly isolated seeded placeholder image records.
6. Re-evaluate the augmented dataset.
7. Show before/after quality metrics and class distribution in a realtime Convex-backed dashboard.

The demo must not train a model. Dataset quality improvement is proven through Adaption Labs evaluation or the fallback evaluation adapter.

## Recommended Stack Decisions

Use these decisions unless the existing repo already strongly dictates otherwise:

- Use **Next.js App Router** on Vercel.
- Use **Convex** for realtime state, metadata, pipeline stages, events, generated sample records, and evaluation snapshots.
- Use **Vercel Blob** for uploaded/generated image files only if file persistence is needed and `BLOB_READ_WRITE_TOKEN` is available.
- Do **not** use Cloudflare R2 for this MVP. It adds setup friction and no demo-critical value.
- Do **not** add auth. Use sessionless demo flows and public dashboard URLs.
- Do **not** add Postgres, Drizzle, Prisma, Supabase, or a custom backend server unless the repo already uses them.
- Do **not** train or fine-tune a model.
- Do **not** build broad CSV/JSON/ZIP support first. Prioritize the animal image demo path.
- Do **not** block the demo on live provider APIs. Implement provider adapters with real calls when env vars exist and deterministic demo fallbacks when they do not.
- Use **React Flow** only for a fixed, non-editable pipeline visualization.
- Use **Recharts** for quantitative charts.
- Use **Zod** for all provider outputs and critical payload validation.

## Required Dependencies

Install what is missing:

```bash
npm install convex @fal-ai/client openai zod react-dropzone recharts @xyflow/react jszip papaparse
npm install -D @types/papaparse @playwright/test
```

If shadcn/ui is not present, use existing components or simple Tailwind components. Do not spend excessive time setting up a component system.

If Playwright browsers are missing, install them:

```bash
npx playwright install
```

## Environment Variables

Support these environment variables:

```env
OPENAI_API_KEY=
FAL_KEY=
ADAPTION_LABS_API_KEY=
ADAPTION_LABS_BASE_URL=
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=
BLOB_READ_WRITE_TOKEN=
```

Behavior rules:

- If `OPENAI_API_KEY` is missing, use deterministic seeded GPT-style analysis JSON from a local fallback adapter.
- If `FAL_KEY` is missing, use deterministic seeded synthetic image records and visible placeholder images.
- If `ADAPTION_LABS_API_KEY` or `ADAPTION_LABS_BASE_URL` is missing, use deterministic local evaluation metrics in a `mockAdaptionClient` or `demoAdaptionClient`.
- Never expose provider keys to the browser.
- Keep all provider calls server-side.

## MVP Demo Dataset

Implement a seeded demo dataset path so the demo works even without uploading files.

Dataset:

- Cats: 120 samples.
- Dogs: 100 samples.
- Birds: 70 samples.
- Foxes: 15 samples.
- Owls: 10 samples.
- Low-light wildlife examples: 0 to 5 samples.

Training intent:

```txt
Train an animal image classifier that works across common pets and wildlife, including low-light camera-trap photos.
```

The seeded dataset should make the pipeline identify:

- Foxes are underrepresented.
- Owls are underrepresented.
- Low-light wildlife coverage is missing.
- Suggested synthetic images should target foxes, owls, and night-time/camera-trap scenarios.

Use either small local placeholder images, remote safe image URLs, or generated colored/image cards for sample previews. The demo does not need a real 315-image upload if the seeded path is convincing and clearly represented as a demo dataset.

## User Interface Requirements

Build a polished dark technical dashboard.

Required screens or sections:

1. **Home / Upload Section**
   - Product headline.
   - Training intent text area prefilled with the animal classifier intent.
   - Drag-and-drop upload if feasible.
   - Prominent `Load demo animal dataset` button.
   - Prominent `Analyze dataset` button.

2. **React Flow Pipeline Hero**
   - Fixed nodes: `Upload`, `Evaluate`, `Analyze Gaps`, `Generate Synthetic Data`, `Re-evaluate`, `Export`.
   - Fixed edges in that order.
   - Node status should update from Convex state: queued, running, complete, error.
   - Nodes can be clicked to show details, but graph editing is not required.

3. **Realtime Status + Event Log**
   - Convex-backed live event log.
   - Events such as: dataset loaded, baseline evaluation started, baseline complete, GPT report complete, Fal job queued, synthetic samples generated, re-evaluation complete.

4. **Quality Report Cards**
   - Baseline quality score.
   - Imbalance score.
   - Missing coverage flags.
   - Recommended repair actions.
   - Clearly distinguish measured metrics from GPT-5.5 interpretation.

5. **Charts**
   - Before/after class distribution bar chart.
   - Optional quality score delta chart.
   - Use Recharts.

6. **Synthetic Image Gallery**
   - Group generated or placeholder synthetic samples by class/scenario.
   - Show `Synthetic` badge.
   - Show prompt used for each gap job.

7. **Dataset Explorer**
   - Basic grid/table of samples.
   - Filter by class and source: original or synthetic.
   - Keep this simple.

## Convex Requirements

Define Convex schema and functions for:

- `datasets`
- `samples`
- `evaluation_snapshots`
- `quality_reports`
- `pipeline_stages`
- `gap_jobs`
- `events`

At minimum, implement mutations/queries equivalent to:

- `createDemoDataset`
- `startAnalysis`
- `updateStageStatus`
- `logEvent`
- `createEvaluationSnapshot`
- `createQualityReport`
- `createGapJob`
- `addSyntheticSamples`
- `getDatasetDashboard`
- `listEvents`

The frontend should subscribe to Convex queries so updates appear without page refresh.

If Convex setup is not possible in the current environment, implement a local in-memory fallback only as a last resort, but prefer Convex.

## Provider Adapter Requirements

Create provider adapters with identical app-facing contracts regardless of live or mock mode.

Recommended files:

- `src/lib/providers/adaption.ts`
- `src/lib/providers/openai.ts`
- `src/lib/providers/fal.ts`
- `src/lib/demo/demo-data.ts`
- `src/lib/schemas/dataforge.ts`

Adaption adapter contract:

```ts
type EvaluationInput = {
  datasetId: string;
  trainingIntent: string;
  classDistribution: Record<string, number>;
  scenarioGaps?: string[];
};

type EvaluationResult = {
  provider: "adaption" | "demo-adaption";
  qualityScore: number;
  balanceScore: number;
  coverageScore: number;
  consistencyScore: number;
  classDistribution: Record<string, number>;
  gaps: Array<{
    className: string;
    currentCount: number;
    targetCount: number;
    severity: "low" | "medium" | "high";
    reason: string;
  }>;
  rawMetrics?: unknown;
};
```

OpenAI adapter contract:

```ts
type QualityReport = {
  summary: string;
  imbalanceScore: number;
  measuredMetricNotes: string[];
  inferredInsights: string[];
  gaps: Array<{
    className: string;
    currentCount: number;
    recommendedCount: number;
    severity: "low" | "medium" | "high";
    recommendedSyntheticCount: number;
    prompt: string;
  }>;
  biasFlags: Array<{
    description: string;
    severity: "low" | "medium" | "high";
  }>;
  recommendedActions: Array<{
    priority: number;
    action: string;
    expectedImpact: string;
  }>;
};
```

Fal adapter contract:

```ts
type SyntheticImageResult = {
  imageUrl: string;
  className: string;
  prompt: string;
  provider: "fal" | "demo-fal";
  jobId?: string;
};
```

## Pipeline Behavior

When the user clicks `Analyze dataset`, run the whole pipeline with visible stage updates.

Pipeline:

1. Set `Upload` complete.
2. Set `Evaluate` running.
3. Run baseline Adaption evaluation or demo fallback.
4. Store baseline evaluation snapshot.
5. Set `Evaluate` complete.
6. Set `Analyze Gaps` running.
7. Run GPT-5.5 quality report or demo fallback.
8. Store quality report and proposed gap jobs.
9. Set `Analyze Gaps` complete.
10. Set `Generate Synthetic Data` running.
11. Run Fal generation for foxes, owls, and low-light wildlife gaps, or demo fallback.
12. Store synthetic sample records.
13. Set `Generate Synthetic Data` complete.
14. Set `Re-evaluate` running.
15. Run augmented Adaption evaluation or demo fallback.
16. Store augmented evaluation snapshot.
17. Set `Re-evaluate` complete.
18. Set `Export` queued or complete if a manifest export is implemented.
19. Mark dataset complete.

The UI should remain interactive while this runs. Add small artificial delays in demo fallback mode so the live pipeline is visible during demo.

## Playwright MCP Verification Loop

After implementation, use Playwright MCP to verify the app in a browser.

You must keep looping until the critical demo path passes.

Verification requirements:

1. Start the dev server.
2. Open the app in a browser with Playwright MCP.
3. Click `Load demo animal dataset`.
4. Confirm the dataset preview shows cats, dogs, birds, foxes, owls.
5. Click `Analyze dataset`.
6. Wait for pipeline nodes to progress.
7. Confirm React Flow nodes show the expected statuses.
8. Confirm event log receives live events.
9. Confirm quality report appears.
10. Confirm before/after chart shows foxes/owls improved.
11. Confirm synthetic image gallery shows generated or demo synthetic samples with `Synthetic` badges.
12. Confirm no browser console errors that break the demo.
13. Confirm page remains responsive and does not crash.

If any step fails:

1. Inspect the browser state and console.
2. Inspect terminal errors.
3. Fix the root cause.
4. Re-run the dev server if needed.
5. Re-run the Playwright MCP verification from the beginning.

Do not stop until the demo path works end to end.

## Acceptance Criteria

The task is complete only when all of these are true:

- The app builds or at least runs locally without fatal errors.
- The demo animal dataset can be loaded without external files.
- The user can trigger the analysis pipeline from the UI.
- The dashboard updates live from Convex or the implemented realtime fallback.
- React Flow pipeline visualization is visible and status-driven.
- GPT-5.5 live call works when `OPENAI_API_KEY` is present, with deterministic fallback when absent.
- Adaption Labs adapter works when env vars are present, with deterministic fallback when absent.
- Fal live call works when `FAL_KEY` is present, with deterministic fallback when absent.
- Quality report, class distribution chart, synthetic gallery, and before/after metrics are visible.
- Synthetic samples are clearly marked as synthetic.
- The app does not claim model accuracy improvement or train any model.
- Playwright MCP has verified the critical demo path.

## Demo Copy

Use this pitch in the app or README:

> AI datasets go stale. DataForge evaluates what your training data is missing, generates targeted new samples, and verifies the dataset improved before you train.

Use this final result wording:

> DataForge improved dataset balance and coverage by targeting underrepresented fox, owl, and low-light wildlife examples, then re-evaluating the augmented dataset through the evaluation pipeline.

Avoid saying:

- "Model accuracy improved."
- "Synthetic data is equivalent to real data."
- "This dataset is production-ready."
- "Medical/clinical quality" or any medical claim.

## Final Response Expected From The Agent

When finished, report:

- Files changed.
- Dependencies installed.
- Environment variables required.
- What is live versus fallback.
- How to run locally.
- Playwright MCP verification result.
- Any known limitations.
