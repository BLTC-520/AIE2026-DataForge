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

The current prototype should work without provider keys by falling back to deterministic demo data. Local Convex uses the checked-in defaults below:

```env
CONVEX_DEPLOYMENT=anonymous:anonymous-AIESG-May2026
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211

ADAPTION_API_KEY=
ADAPTION_LABS_BASE_URL=https://api.adaptionlabs.ai
OPENAI_API_KEY=
FAL_KEY=
```

Keep real provider keys only in `.env.local`. Do not commit secrets to `.env.example`.

## Repository Notes

- `app/page.tsx` contains the main interactive dashboard.
- `styles.css` contains the visual system and responsive styling.
- `PROJECT_CONTEXT.md` contains the product specification.

## Status

This repo is currently a polished frontend MVP/mock demo. The provider integrations, Convex backend, uploaded dataset parsing, and real export bundle are planned extension points.
