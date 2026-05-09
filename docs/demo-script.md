# DataForge Demo Script

> Target runtime: under 2 minutes from "load demo" click to "exported manifest"
> Stack: Next.js 16 + React (live demo runs entirely on deterministic seeded data)

---

## Hero line — land it slowly

> **"A cat in the dog folder quietly poisons training before the model ever starts."**

Pause for one beat after delivery. This is the line that anchors the talk.

---

## 0:00 → 0:10 — Set the stage

> "AI teams obsess over models. We're here to fix the layer below: the dataset.
> Imbalance, missing labels, mislabels, and duplicates poison training before
> the first epoch. DataForge audits and repairs the dataset *before* the model
> ever sees it."

(Open DataForge dashboard at idle state.)

---

## 0:10 → 0:25 — Load the seeded dataset

> "We're loading a 285-image animal classifier dataset with **four deliberate
> defects**: 22 missing labels, 8 likely mislabels, 7 near-duplicate bursts,
> and severe class imbalance favoring pets over wildlife."

**Click**: "Load demo animal dataset"

The dashboard shows:
- 6 detected classes (Cats, Dogs, Birds, Foxes, Owls, Low-light Wildlife)
- Class chips colored by class
- Sample count, missing-label count, duplicate count visible

---

## 0:25 → 0:45 — Baseline evaluation

> "First we run a baseline pass. Notice **every metric carries a source
> badge**. Adaption Labs evaluates the *manifest* — the tabular metadata.
> Local computation handles deterministic counts. The vision model handles
> image-content findings. We never claim Adaption inspected pixels."

**Click**: "Analyze dataset"

The pipeline animates. Point at the Quality Report panel:
- **Quality 62, Balance 41, Completeness 74, Consistency 82** — each tagged
  `Adaption` (cyan), `Local` (green), or `Vision` (lavender)
- Missing labels: 22 · Suspected mislabels: 8 · Duplicates: 7

> "Adaption Labs gives us manifest-level quality. The visual audit found 8
> mislabels, including..." *(point at first wrong-label entry)*
> **"...a cat in the dog folder."**

---

## 0:45 → 1:15 — Approve repairs

Three deliberate clicks:

1. **Approve a missing label**: pick `unlabeled-001` (suggested: Owls, 0.86 confidence).
   Click "Approve". Watch the missing-label count drop from 22 → 21.

2. **Approve a mislabel correction**: pick `dog-006` → `Cats`, 0.94 confidence.
   Click "Approve". Watch the suspected-mislabels count drop from 8 → 7.
   The class distribution chart updates in real time.

3. **Remove a duplicate**: pick `cat-012` (matches `cat-011`, 0.99 file-hash).
   Click "Remove". Watch the duplicate count drop from 7 → 6, and the
   sample count drop by 1.

> "Decisions cascade. Class distribution, completeness, and balance all
> recompute live. **Original labels are preserved as provenance**, not
> overwritten — so reviewers can audit every change later."

---

## 1:15 → 1:30 — Balancing plan

Scroll to the **Balancing Plan** card.

> "Balancing is **advice, not images**. Class weights are training-time loss
> multipliers — they do not duplicate samples. Foxes and Owls get 1.85× and
> 2.1× weights. Low-light wildlife is so sparse we recommend `collect_more`,
> not `upsample`, because upsampling 6 images to 35 produces a degenerate
> effective sample size."

---

## 1:30 → 1:45 — Re-evaluate and prove the lift

> "Adaption re-evaluates the cleaned manifest. Quality moved from 62 to 84.
> Balance from 41 to 78. Completeness from 74 to 96. Three measurable
> structural improvements."

(Point at the Before/After delta strip in the Quality Report panel.)

> "Note we are **not** claiming model accuracy improvement. We're claiming
> dataset readiness improvement: completeness, balance, consistency, and
> provenance. That's the honest claim, and it's the one that matters before
> training even starts."

---

## 1:45 → 2:00 — Export

**Click**: "Export manifest"

A `dataforge-clean-dataset-manifest-YYYYMMDD-HHMM.json` file downloads.

> "The export contains every layer of provenance: original labels, final
> labels, label decisions, duplicate decisions, balancing weights, both
> Adaption snapshots, the GPT repair plan, and a `metadata.providerBoundary`
> field that documents which provider produced which metric."

(Open the downloaded JSON. Zoom on `metadata.providerBoundary` and on a
sample with both `originalLabel` and `finalLabel`.)

---

## Sponsor mentions

Drop these naturally during the relevant moments — never as a list:

- **Adaption Labs** — manifest-level dataset evaluation (manifest-only;
  do not claim Adaption inspected pixels)
- **GPT Vision / Gemini** — image-content understanding for label suggestions
  and duplicate detection (the visual audit lane)
- **GPT-5.5** — structured repair plan generation in the Inferred column
- **Convex** — realtime dashboard event stream (visible in the live event log)
- **Fal** — opt-in synthetic image generation (stretch — not part of the
  default 2-minute path)

---

## Self-evaluation defense

The judge will ask: **"You're scoring with the same model that labeled —
isn't that circular?"**

Answer:

> "Two answers. First, the **deterministic local metrics** — sample counts,
> missing-label percentage, duplicate count, class distribution, balance score
> from coefficient-of-variation — are computed by code, not by an LLM. They
> catch structural improvements independently of any model. Second, the
> Quality Report **shows both columns side by side** with source badges.
> If the Adaption column moves and the Local column doesn't, that's
> suspicious and visible. We surface the disagreement, not hide it."

---

## What we are NOT claiming

- ❌ Model accuracy improvement
- ❌ Adaption Labs inspecting image pixels
- ❌ Synthetic samples replacing real data
- ❌ Class weights creating new images

## What we ARE claiming

- ✅ Measurable dataset-readiness improvement (completeness, balance, consistency)
- ✅ Reviewable provenance for every label and duplicate decision
- ✅ Provider-boundary honesty: every metric carries its source
- ✅ A reproducible 2-minute click path that demos end-to-end
