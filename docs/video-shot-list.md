# DataForge: Video Shot List

**Aspect Ratio:** 16:9 (Standard 1080p or 4K)
**Format:** Screen recording with voiceover

## Shot 1: The Idle Dashboard (0:00 - 0:05)
- **Visual:** The DataForge web interface in its initial "empty" state. Clean UI, ready for input.
- **Action:** Mouse drags a simulated training ZIP over the dropzone.

## Shot 2: Baseline Quality Evaluation (0:05 - 0:15)
- **Visual:** The dashboard immediately after simulated upload.
- **Action:**
  - Show the initial "Animals-10" dataset stats populating.
  - Smooth pan/zoom to highlight the baseline metrics (Adaption Labs manifest score, missing-label count, duplicate count, class imbalance).

## Shot 3: Label Audit in Action (0:15 - 0:35)
- **Visual:** The Label Audit Panel.
- **Action:**
  - Hover over a "Missing Label" item. Show the suggested completion. Click "Approve".
  - Hover over a "Wrong Label" item (e.g., cat labeled as dog). Show the GPT Vision/Gemini reasoning. Click "Approve".
  - Show the metric counters instantly updating (powered by Convex).

## Shot 4: Duplicate Removal (0:35 - 0:45)
- **Visual:** The Duplicate Review Panel.
- **Action:**
  - Show two visually identical images flagged as duplicates.
  - Click "Remove Duplicate".
  - Show the badge update to `Removed`.

## Shot 5: The Balancing Plan & Fal AI Generation (0:45 - 1:00)
- **Visual:** The distribution chart, Fal telemetry, and generated-image preview gallery.
- **Action:**
  - Show the heavily skewed distribution chart, from `cane=100` raw images down to `scoiattolo=20`.
  - Show the React Flow pipeline reaching the bounded Fal recovery stage.
  - Show the generated-image grid appearing, clearly emphasizing the `✨ Fal AI` / `Synthetic` badges on the new images.
  - Show the provider and 100-images-per-animal cap metadata before moving to export.

## Shot 6: The Quality Delta & Export (1:00 - 1:20)
- **Visual:** The Quality Report Panel and Export Manifest Button.
- **Action:**
  - Scroll down to show the final before/after quality delta.
  - Highlight the GPT-5.5 generated report summarizing the fixes.
  - Click "Export Manifest".
  - Show a quick split-screen or overlay of the resulting JSON manifest, proving that the original labels, final labels, and synthetic provenance are all cleanly documented.
