# AIE2026-DataForge

DataForge is a hackathon prototype for **AI Engineer Singapore 2026**. It demonstrates an intelligent dataset repair loop for ML engineers: load a dataset, evaluate its quality, identify coverage gaps, generate targeted synthetic samples, re-evaluate, and export an improved dataset before training a model.

The demo focuses on an animal image classification dataset with intentional imbalance across cats, dogs, birds, foxes, owls, and low-light wildlife scenarios.

## What It Shows

- Seeded demo dataset with class imbalance and missing low-light examples
- Dashboard-style workflow for dataset upload, evaluation, gap analysis, synthetic generation, re-evaluation, and export
- Before/after quality metrics for quality, balance, coverage, and consistency
- Targeted repair plan for underrepresented fox, owl, and low-light wildlife classes
- Synthetic sample gallery with prompts and provenance labels
- Dataset explorer with class and source filters
- Event log that simulates the live pipeline from baseline evaluation to export

## Product Thesis

DataForge is not a model training platform. The core idea is to improve dataset readiness before training begins.

Instead of claiming model accuracy gains, the demo proves a cleaner loop:

1. Detect measurable dataset quality issues.
2. Explain the gaps in terms a training team can act on.
3. Generate targeted synthetic samples only where coverage is weak.
4. Re-evaluate the augmented dataset.
5. Show the before/after quality delta.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- CSS
- OpenAI Responses API for GPT-5.5 repair-plan generation
- Seeded local demo data and deterministic fallback adapters

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start the production build:

```bash
npm run start
```

## Demo Flow

1. Open the app in the browser.
2. Click **Load demo animal dataset**.
3. Click **Analyze dataset**.
4. Watch the pipeline progress through evaluation, gap analysis, synthetic generation, re-evaluation, and export.
5. Review the quality score improvement and class distribution changes.

## Environment Variables

The current prototype works without provider keys. Copy `.env.example` to `.env.local` and fill what you need:

```env
CONVEX_DEPLOYMENT=<convex deployment>
OPENAI_API_KEY=
FAL_AI_KEY=
ADAPTION_LABS_API_KEY=
ADAPTION_LABS_BASE_URL=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=
CONVEX_DEPLOY_KEY=
BLOB_READ_WRITE_TOKEN=
```

When keys are missing, the demo should use deterministic fallback behavior so the hackathon flow remains reliable.

## GPT-5.5 Usage

The Analyze Gaps stage calls `POST /api/quality-report`. That server route sends the training intent, class distribution, scenario gaps, and baseline metrics to GPT-5.5 using the OpenAI Responses API with a structured Zod schema.

GPT-5.5 returns:

- measured findings based on the provided evaluation snapshot
- an actionable repair plan
- synthetic generation jobs with counts and prompts
- post-repair summary text and next steps

If the OpenAI request fails or `OPENAI_API_KEY` is missing, the app falls back to the deterministic demo report.

## Repository Notes

- `app/page.tsx` contains the main interactive dashboard.
- `styles.css` contains the visual system and responsive styling.
- `DATAFORGE_PROJECT_CONTEXT.md` contains the product specification.
- `DATAFORGE_ONESHOT_BUILD_PROMPT.md` contains the original implementation prompt.

## Status

This repo is currently a polished frontend MVP/mock demo. The provider integrations, Convex backend, uploaded dataset parsing, and real export bundle are planned extension points.
