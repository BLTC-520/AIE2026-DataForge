# DataForge Slide Outline

Seven slides. Each slide carries one idea. Total speaking time ~3 minutes
including the live demo cue.

---

## Slide 1 — DataForge one-liner

**Title:** DataForge

**Tagline:**
> Repair your training data before the model ever sees it.

**Visual:** Logo + a one-line subtitle: *"Closed-loop dataset readiness for
ML teams."*

**Speaker note:** This is the only slide that's pure framing. Every later
slide cashes in a specific claim from this one.

---

## Slide 2 — The data quality problem

**Title:** Most datasets ship broken

**Bullets (one per defect):**
- **Imbalance** — majority pets dominate; wildlife and edge cases are rare
- **Missing labels** — folders that nobody finished labeling
- **Mislabels** — *"a cat in the dog folder"* (← the hero line)
- **Duplicates** — burst captures that leak into evaluation splits

**Speaker note:** Land the hero line slowly. It's the one viewers remember.

**Visual:** Four icons in a 2×2 grid. No data, no metrics — visceral framing.

---

## Slide 3 — The closed-loop workflow

**Title:** Seven stages, deterministic and observable

**Visual:** Horizontal pipeline diagram:
```
Upload → Evaluate → Labelize → Deduplicate → Balance → Re-evaluate → Export
```

**Subtitle:** Each stage emits named events to a live dashboard. Reviewers
approve label and duplicate decisions before downstream metrics recompute.

**Speaker note:** Emphasize that approval is *manual*, not auto-applied —
that's what lets a human stay in the loop on what gets corrected.

---

## Slide 4 — The seeded demo dataset

**Title:** 285 animal images, four deliberate defects

**Two-column layout:**

| Defect | Count |
|---|---|
| Class imbalance | Cats 90 / Owls 18 / Low-light 6 |
| Missing labels | 22 unlabeled samples |
| Mislabels | 8 (cat→dog, dog→fox, bird→owl, etc.) |
| Duplicates | 7 near-duplicate bursts |

**Footnote:** Dataset is seeded for repeatable demo runs. Real datasets get
the same treatment with vision-model-based audit instead of seeded truth.

---

## Slide 5 — Before / after metrics

**Title:** Measurable dataset-readiness lift

**Side-by-side cards:**

| Metric | Baseline | Final | Source |
|---|---|---|---|
| Quality | 62 | **84** | Adaption (manifest) |
| Balance | 41 | **78** | Local (CV) |
| Completeness | 74 | **96** | Local |
| Consistency | 82 | **91** | Adaption |
| Missing labels | 22 | **3** | Local |
| Mislabels | 8 | **1** | Vision |
| Duplicates | 7 | **0** | Local |

**Footer:**
> Every metric carries a source badge in the live UI: Adaption (cyan),
> Local (green), Seeded (amber), Vision (lavender).

**Speaker note:** This is where the Inferred-vs-Measured argument lands. We
do *not* claim model accuracy improvement.

---

## Slide 6 — Architecture and provider boundaries

**Title:** Honest provider boundaries

**Diagram:**

```
                ┌─────────────────────────────┐
                │   Manifest (CSV / JSON)    │ ← tabular metadata only
                └────────────┬────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │  Adaption Labs       │ Manifest-level quality
                  │  (manifest only)     │ (does NOT inspect pixels)
                  └──────────────────────┘

                ┌─────────────────────────────┐
                │   Image pixels             │ ← stays local / per-pipeline
                └────────────┬────────────────┘
                             ▼
                  ┌──────────────────────┐
                  │ GPT Vision / Gemini  │ Visual audit:
                  │ (vision lane)        │ label suggestions, duplicates
                  └──────────────────────┘

   Deterministic local metrics: distribution, balance (CV), completeness
   GPT-5.5: structured repair plan from measurements + intent
```

**Speaker note:** This is the non-negotiable slide. Adaption is
**manifest-level only** — it scores tabular dataset metadata, not images.
Image-pixel understanding lives in the visual-audit lane (vision models or
seeded demo truth). Anyone who reads the exported manifest's
`metadata.providerBoundary` field sees the same statement in writing.

---

## Slide 7 — Why it matters and what's next

**Title:** Dataset readiness, before training begins

**Two columns:**

**Why it matters now:**
- Training is expensive; dataset issues compound through every epoch
- Most teams discover quality problems *after* a bad checkpoint
- We move that discovery to *before* training, with reviewable provenance

**What's next:**
- Live vision-audit lane (drop seeded mode for production datasets)
- Convex-backed multi-user review queue
- Fal opt-in synthetic generation for measured class gaps
- Adaption recipes for prompt rephrase + reasoning traces on text manifests

**Final line:**
> "Better data is the smallest reliable lever you can pull on a training run."
