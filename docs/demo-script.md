# DataForge: Demo Script

**Total Target Time:** ~2 minutes

## Intro (0:00 - 0:15)
**Presenter:** "Hi everyone, this is DataForge. We don't train models; we fix the datasets before the models ever see them. AI teams spend weeks debugging architecture when the real problem is data quality. As we like to say: a cat in the dog folder quietly poisons training before the model ever starts."

## Step 1: Upload & Baseline Evaluation (0:15 - 0:35)
*(Presenter clicks "Upload ZIP" simulating loading the local `data/` directory)*
**Presenter:** "We're loading a deliberately corrupted subset of the Animals-10 dataset. Immediately, DataForge runs a baseline evaluation. You can see we have missing labels, duplicates, and a severe class imbalance—90 cats but only 20 dogs. We're using Adaption Labs to run a rigorous manifest-level quality evaluation so we know exactly where we stand."

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
*(Presenter navigates to the Balancing Panel)*
**Presenter:** "Now for the imbalance. We have too few dogs. DataForge generates a balancing plan. I'll click 'Run Fal AI Generation'.
*(3-second mocked loader appears, then reveals the generated images)*
"In seconds, we've injected actual synthetic images from Fal AI to balance our classes. Notice the '✨ Fal AI' badges—we maintain strict data tracking so you always know which images are synthetic."

## Step 5: Re-evaluate & Export (1:35 - 2:00)
*(Presenter reviews the Quality Report Panel and clicks 'Export Manifest')*
**Presenter:** "With our corrections made and classes balanced, we re-evaluate the repair manifest. GPT-5.5 generates a structured explanation of the improvements. Our balance score is up, label consistency is fixed, and the overall Adaption Labs quality metric has improved significantly.
Finally, we export the clean dataset. The output isn't just images—it's a rich JSON manifest proving the before-and-after improvement, ready for training. Thank you."