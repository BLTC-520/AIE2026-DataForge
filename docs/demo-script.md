# DataForge: Demo Script

**Total Target Time:** ~2 minutes

## Intro (0:00 - 0:15)
**Presenter:** "Hi everyone, this is DataForge. We don't train models; we fix the datasets before the models ever see them. AI teams spend weeks debugging architecture when the real problem is data quality. As we like to say: a cat in the dog folder quietly poisons training before the model ever starts."

## Step 1: Upload & Baseline Evaluation (0:15 - 0:35)
*(Presenter drags the simulated training ZIP onto the dropzone, which reads the already-unzipped local `data/` directory)*
**Presenter:** "We're loading a deliberately corrupted subset of the Animals-10 dataset. The ZIP interaction is simulated, but the input is the real unzipped `data/animals/raw-img` folder. Immediately, DataForge runs a baseline evaluation. You can see missing labels, duplicates, and a severe class imbalance: `cane` has 100 raw images while `scoiattolo` has only 20. We're using Adaption Labs for a manifest-level quality evaluation so we know exactly where we stand."

## Step 2: Visual Audit & Relabeling (0:35 - 1:00)
*(Presenter clicks "Analyze Dataset", simulating the visual audit)*
**Presenter:** "Now we run the label audit. Using GPT Vision and Gemini's image understanding capabilities, DataForge identifies likely mistakes.
*(Presenter hovers over a mislabeled item)*
"Look here—this is labeled 'dog' but it's clearly a cat. I'll approve this correction. I'll also approve this completion for an unlabeled image."
*(Presenter clicks 'Approve' on a few items)*
"Because we're built on Convex, this state updates instantly across the dashboard."

## Step 3: Deduplication (1:00 - 1:15)
*(Presenter navigates to the Duplicate Review Panel)*
**Presenter:** "Next, duplicates. Duplicates leak validation data into training. DataForge has flagged a near-exact match here. I'll click 'Remove' to flag it for exclusion in the final export, while preserving the provenance."
*(Presenter removes a duplicate)*

## Step 4: Balancing with Fal AI (1:15 - 1:35)
*(Presenter scrolls to the Fal generation jobs section after analysis completes)*
**Presenter:** "Now for the imbalance. DataForge creates a bounded balancing plan, then reveals cached `fal.ai` generated recovery outputs without waiting for live generation on stage.
*(The generated-image gallery is visible with provider badges and cap metadata)*
"Notice the '✨ Fal AI' badges. Every class totals exactly 100 images across raw plus generated assets, and we maintain strict data tracking so you always know which images are synthetic, where they came from, and why they were added."

## Step 5: Re-evaluate & Export (1:35 - 2:00)
*(Presenter reviews the Quality Report Panel and clicks 'Export Manifest')*
**Presenter:** "With our corrections made and classes balanced, we re-evaluate the repair manifest. GPT-5.5 generates a structured explanation of the improvements. Our balance score is up, label consistency is fixed, and the overall Adaption Labs quality metric has improved significantly.
Finally, we export the clean dataset. The output isn't just images—it's a rich JSON manifest proving the before-and-after improvement, ready for training. Thank you."
