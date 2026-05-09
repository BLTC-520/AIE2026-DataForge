# DataForge Product Context

## Register

product

## Product Purpose

DataForge is a dataset repair cockpit for ML engineers preparing image classification datasets before model training. The product helps a user load a messy animal image dataset, inspect measured quality issues, approve label and duplicate decisions, balance underrepresented classes, re-evaluate the repaired manifest, and export a clean dataset manifest with provenance.

The current UI is a hackathon MVP and demo-safe prototype. It prioritizes a clear, deterministic story over broad ingestion support: one seeded animal camera-trap dataset, a visible repair loop, before and after quality metrics, Convex-style live events, GPT-5.5 repair-plan copy, Adaption Labs-compatible manifest evaluation language, and Fal-style targeted synthetic additions.

## Core Users

- ML engineers who need to know whether a dataset is ready before training starts.
- Researchers comparing dataset variants, repair decisions, and quality snapshots.
- Data leads who care about label provenance, duplicate handling, and export trust.
- Hackathon judges who need to understand the loop within a short live demo.
- Internal operators who need deterministic fallback behavior when providers are unavailable.

## Product Thesis

DataForge is not a model training platform. It proves dataset readiness improvement before training begins.

The product should make one loop obvious:

- Load a partially labeled image dataset.
- Evaluate baseline manifest quality.
- Explain gaps with measured and inferred evidence separated.
- Review labels, duplicates, and balance recommendations.
- Re-evaluate the repaired dataset.
- Export a clean manifest with original labels, final labels, duplicate decisions, balancing metadata, provider notes, and quality snapshots.

## Current Demo Surface

- Top navigation anchors the demo around Pipeline, Quality, Synthetics, and Explorer.
- Hero controls collect a training intent and simulate a dataset ZIP upload.
- The dataset preview uses pixel animal tiles for cats, dogs, birds, foxes, owls, and low-light wildlife.
- Pipeline stages show upload, evaluate, analyze gaps, generate synthetic data, re-evaluate, and export.
- Live event logging shows Convex-style status messages and local fallback states.
- Metric tiles show quality, balance, coverage, and synthetic sample counts.
- Quality panels separate measured Adaption-style snapshots from GPT-5.5 inferred repair plans.
- Distribution charts compare source and augmented class counts.
- Synthetic job cards show targeted Fal-style prompts and per-class counts.
- Explorer tables show sample ID, class, source, scenario, and status.
- Feature modules exist for label audit, duplicate review, quality report, balancing, dataset explorer, and export manifest handoff.

## Brand Position

DataForge should feel like a technical control room for dataset integrity: dense, instrumented, credible, and explicit about provider boundaries. It should not feel like a generic AI chatbot, upload wizard, or synthetic-image showcase.

The name suggests turning raw data into a stronger asset. The visual tone can be industrial and terminal-like, but the copy must stay precise and honest.

## Tone Of Voice

- Direct, technical, and demo-readable.
- Honest about what is measured, inferred, mocked, or provider-backed.
- Confident about dataset repair, not model accuracy claims.
- Specific about labels, duplicates, class balance, provenance, and export outputs.
- Short enough for a judge to understand while watching the UI animate.

## Anti-References

- Chatbot-first dataset analysis where the UI hides the actual repair state.
- Generic SaaS dashboards with interchangeable metric cards and no workflow proof.
- Model training platforms that claim accuracy improvements without a training run.
- Synthetic image generators where generation becomes the whole product.
- Vague AI recommendations that do not preserve source, confidence, and review state.
- Provider claims that imply Adaption Labs inspects raw image pixels in the MVP.

## Strategic Principles

- Prove a before and after delta. The second quality snapshot is the strongest demo moment.
- Separate measured from inferred. Manifest metrics, deterministic metrics, seeded truth, and GPT-5.5 interpretation must be visually and verbally distinct.
- Keep the human in the loop. Label completion, relabeling, duplicate removal, and optional generation should be reviewable.
- Preserve provenance. Every exportable record should retain source, provider, original label, final label, duplicate status, balancing metadata, and review decisions.
- Stay deterministic for the hackathon. The app should work without provider keys by falling back to seeded local data.
- Treat synthetic additions as optional balance support. They should be tied to measured class gaps and marked clearly in the manifest.
- Optimize for a two-minute story. Every section should help the presenter explain the loop without detouring into implementation details.

## Product Boundaries

- Adaption Labs is positioned as a manifest-level dataset quality workflow where supported.
- Image understanding comes from seeded demo truth first, with vision-model integration as a future live path.
- GPT-5.5 explains quality findings and returns structured repair plans, but it should not invent objective quality scores.
- Convex provides realtime persistence and event visibility when available, with local fallback behavior when unavailable.
- Fal-style synthetic data is a balance-stage aid, not the core product.

## Success Criteria

- A first-time viewer understands that DataForge repairs data before training.
- The baseline and repaired dataset states are visibly different.
- Provider boundaries are clear without weakening the demo.
- Export feels trustworthy because provenance is visible before download.
- The interface feels dense and operational, not decorative.
