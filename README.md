# AIE2026-DataForge

DataForge is a hackathon prototype for **AI Engineer Singapore 2026**. It demonstrates an intelligent dataset repair loop for ML engineers: load a dataset, evaluate its quality, fix missing labels, likely mislabels, duplicate images, and class imbalance, re-evaluate, and export a cleaner labeled dataset before training a model.

The demo focuses on an animal image classification dataset with intentional imbalance, missing labels, mislabeled samples, and duplicate images.

## What It Shows

- Seeded demo dataset with class imbalance, missing labels, mislabeled samples, and duplicates
- Dashboard-style workflow for dataset upload, evaluation, label completion, relabeling, deduplication, balancing, re-evaluation, and export
- Before/after quality metrics for label completeness, consistency, duplication, balance, and overall quality
- Human review queues for suggested label completions, label corrections, and duplicate removals
- Balancing plan with class weights, sampling recommendations, and export metadata
- Dataset explorer with class, label status, issue, and duplicate filters
- Event log that simulates the live pipeline from baseline evaluation to cleaned export

## Product Thesis

DataForge is not a model training platform. The core idea is to improve dataset readiness before training begins.

Instead of claiming model accuracy gains, the demo proves a cleaner loop:

1. Detect measurable dataset quality issues.
2. Explain the gaps in terms a training team can act on.
3. Approve label completions, label corrections, and duplicate removals.
4. Create a balancing plan and cleaned dataset manifest.
5. Re-evaluate the labelized, deduplicated, and balanced dataset.
6. Show the before/after quality delta.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- CSS
- Convex for realtime pipeline state
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
4. Watch the pipeline progress through evaluation, labelization, deduplication, balancing, re-evaluation, and export.
5. Review the quality score improvement, label repair counts, duplicate removals, and class distribution changes.

## Environment Variables

The current prototype should work without provider keys by falling back to deterministic demo data. Local Convex uses the checked-in defaults below:

```env
CONVEX_DEPLOYMENT=anonymous:anonymous-AIESG-May2026
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211

ADAPTION_API_KEY=
ADAPTION_LABS_BASE_URL=https://api.adaptionlabs.ai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
FAL_KEY=
```

Keep real provider keys only in `.env.local`. Do not commit secrets to `.env.example`.

## Using Convex Cloud (hosted deployment)

Yes — you can run the app against a hosted Convex deployment (Convex “cloud”).

What changes:

- `NEXT_PUBLIC_CONVEX_URL` becomes your hosted Convex client URL (typically ends in `.convex.cloud`).
- `NEXT_PUBLIC_CONVEX_SITE_URL` becomes your hosted HTTP Actions site URL (typically ends in `.convex.site`).
- `CONVEX_DEPLOYMENT` is used by the Convex CLI for dev/deploy. It is not required by the Next.js runtime, but it’s fine to keep it in `.env.local`.

How to set it up:

1. Connect to a hosted deployment (first time prompts you to log in / pick a project):

```bash
npx convex dev
```

2. Deploy backend functions (HTTP Actions + schema) to the hosted deployment:

```bash
npx convex deploy
```

3. Copy your hosted URLs into `.env.local` (or set them in your hosting provider):

```env
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

The image upload button specifically calls:

- `GET {NEXT_PUBLIC_CONVEX_SITE_URL}/generateUploadUrl`
- uploads the file to the returned `uploadUrl`
- `POST {NEXT_PUBLIC_CONVEX_SITE_URL}/getImageUrl` to resolve a public URL

## GPT-5.5 Usage

The quality report flow calls `POST /api/quality-report`. That server route sends the training intent, class distribution, label issues, duplicate issues, balancing plan, and baseline metrics to GPT-5.5 using the OpenAI Responses API with a structured schema.

GPT-5.5 returns:

- measured findings based on the provided evaluation snapshot
- suggested label completions and corrections
- duplicate and balancing recommendations
- post-repair summary text and next steps

If the OpenAI request fails or `OPENAI_API_KEY` is missing, the app falls back to the deterministic demo report.

## Repository Notes

- `app/page.tsx` contains the main interactive dashboard.
- `styles.css` contains the visual system and responsive styling.
- `PROJECT_CONTEXT.md` contains the product specification.

## Status

This repo is currently a polished frontend MVP/mock demo. Full provider integrations, uploaded dataset parsing, and real export bundle generation are planned extension points.
