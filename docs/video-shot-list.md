# DataForge Video Shot List

Order matters. Each shot maps to a specific moment in `demo-script.md`.
Capture in 1080p; pause 1s after every click before the next action so the
edit can breathe.

---

## Shot 1 — Idle dashboard

**Frame:** Full dashboard at idle. Browser at desktop width 1440px.
**Capture:** Static hero, "Drop dataset ZIP" pill, intent textarea, status
pill reading "Idle".
**Duration:** ~3s

**Why this shot:** Establishes the dashboard surface before any action.

---

## Shot 2 — Loaded dataset and class chips

**Action:** Click "Load demo animal dataset".
**Frame:** Hero + dataset rig (right column) showing 285 samples, 6 classes,
class chips with the seeded counts (Cats 90, Dogs 80, Foxes 24, Owls 18,
Low-light 6, Unlabeled 22).
**Duration:** ~4s

**Why this shot:** Shows the seeded defects visually — Owls and Low-light
are visibly tiny next to Cats.

---

## Shot 3 — Baseline analysis with source badges

**Action:** Click "Analyze dataset". Watch the pipeline animation.
**Frame:** Quality Report panel after baseline completes. **Zoom on the
source badges**: cyan `Adaption`, green `Local`, amber `Seeded`, lavender
`Vision`.
**Duration:** ~6s

**Why this shot:** Critical. The badges make the provider boundary visible
on screen, not just in the script.

---

## Shot 4 — Approving a missing label

**Action:** In Label Audit Panel, click "Approve" on `unlabeled-001` →
suggested `Owls` with 0.86 confidence.
**Frame:** Tight on the row before approval; pull back to show the
missing-label count drop from 22 to 21 in the Quality Report card.
**Duration:** ~5s

**Why this shot:** Demonstrates that decisions cascade live through the
metrics.

---

## Shot 5 — Approving a mislabel correction

**Action:** Click "Approve" on `dog-006` → `Cats` (0.94 confidence).
**Frame:** Tight on the suggestion row + the suspected-mislabels counter
dropping from 8 → 7. Land the hero line over voice: *"a cat in the dog
folder."*
**Duration:** ~5s

**Why this shot:** This is the line viewers remember. Frame it cleanly.

---

## Shot 6 — Removing a duplicate

**Action:** In Duplicate Review Panel, click "Remove" on `cat-012`
(matches `cat-011`, 0.99 file hash).
**Frame:** Show the duplicate count drop from 7 → 6 and the included-sample
count drop by 1 in the Export panel summary.
**Duration:** ~4s

**Why this shot:** Establishes that removed duplicates don't vanish — they
get duplicateStatus="removed" in the manifest, which we'll see at the end.

---

## Shot 7 — Balancing plan appears

**Action:** Scroll to the Balancing Panel. (No click — the plan regenerates
from the labelization-approved trigger.)
**Frame:** Pan across the rows: Cats (Keep, 0.65×), Foxes (Collect more,
1.85×), Owls (Generate optional, 2.10×), Low-light (Collect more, 2.40×).
Hover over a "Weight" badge so the tooltip "Loss weight applied at
training time, not new samples" appears on screen.
**Duration:** ~6s

**Why this shot:** The "advice, not images" framing is what stops viewers
from misreading the panel as "we generated more wildlife photos."

---

## Shot 8 — Before / after delta animating

**Action:** None — just hold on the Quality Report's delta strip.
**Frame:** Tight on the delta pills: `+22 Quality`, `+37 Balance`,
`+22 Completeness`, `−19 Missing labels`, `−7 Mislabels`, `−7 Duplicates`.
Color the score deltas green and the count deltas green (down=good).
**Duration:** ~5s

**Why this shot:** This is the proof. Stay long enough that viewers can
read every number.

---

## Shot 9 — Distribution chart

**Action:** None — pan across the Distribution Chart rows.
**Frame:** Show the `Source` (before) and `Final` (after) bars side by
side. Owls and Low-light bars visibly grow toward the median target.
**Duration:** ~4s

---

## Shot 10 — Export click

**Action:** Click "↓ Export manifest".
**Frame:** Button transitions through "Building manifest…" → "✓ Downloaded".
Browser download bar appears with `dataforge-clean-dataset-manifest-…json`.
**Duration:** ~4s

---

## Shot 11 — Manifest JSON close-up

**Action:** Open the downloaded JSON in a code editor.
**Frame 1:** Scroll to `metadata.providerBoundary`. Highlight the three
keys: `adaption` (manifest-only disclaimer), `deterministic`, `visualAudit`.
**Frame 2:** Scroll to a sample with both `originalLabel` and `finalLabel`
set differently (e.g. `dog-006` → originalLabel: "Dogs", finalLabel: "Cats",
labelStatus: "accepted"). Highlight `labelReason` and `labelConfidence`.
**Frame 3:** Scroll to `balancingPlan` to show the per-class entries with
`samplingStrategy` and `recommendedWeight` fields.
**Duration:** ~10s total across three frames

**Why this shot:** This is where the provenance claim cashes in. The
manifest is the artifact reviewers can audit later.

---

## Shot 12 — Final dashboard pull-back

**Action:** None — return to the dashboard, status pill reads "Complete".
**Frame:** Wide shot showing the cleaned distribution chart, balanced
quality scores, and a clean event log.
**Duration:** ~3s

**Why this shot:** Closes the loop visually. The dashboard before-and-after
is the "we did this" signature.

---

## B-roll cues (optional, not required)

- Class chips colored by class — useful for the "imbalance" framing
- Live event log scrolling during the pipeline animation — sponsor-friendly
  shot (Convex stream visibility)
- Hover state on a source badge → tooltip reveal — supports slide 6
- The delta strip's red/green color shift on count deltas (negative=good)

---

## Audio direction

- Voiceover lands the hero line **once**, on Shot 5.
- Don't over-explain badges — let the visual carry it.
- Avoid words "model accuracy" anywhere in the audio. Say "dataset
  readiness," "labeling completeness," "class balance," "provenance."
- Avoid claiming Adaption "looked at images." It scored the manifest.
