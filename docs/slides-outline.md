# DataForge: Slides Outline

## Slide 1: Title Slide
- **Headline:** DataForge
- **Sub-headline:** The closed-loop dataset repair cockpit.
- **Visual:** Clean, modern logo or a subtle abstract data visualization.
- **Speaker Notes:** "Welcome. We're presenting DataForge, a tool designed not for training models, but for fixing the data *before* training ever begins."

## Slide 2: The Data Quality Problem
- **Headline:** Garbage In, Garbage Out
- **Points:**
  - Imbalanced classes bias model predictions.
  - Missing labels waste usable data.
  - Wrong labels actively teach the model incorrect associations.
  - Duplicates leak validation data into training.
- **Visual:** Diagram showing raw messy data leading to a failed or biased model.
- **Speaker Notes:** "AI teams spend weeks debugging model architecture, only to realize the problem was in the dataset all along. A cat in the dog folder quietly poisons training before the model ever starts."

## Slide 3: The Closed-Loop Workflow
- **Headline:** The DataForge Approach
- **Workflow Steps:**
  1. **Upload & Evaluate:** Assess the baseline damage.
  2. **Audit & Correct:** Fix missing/wrong labels and duplicates.
  3. **Balance:** Address class imbalances.
  4. **Re-evaluate & Export:** Prove the improvement.
- **Visual:** Circular flowchart moving from "Raw Data" -> "DataForge Cockpit" -> "Clean Training Asset".

## Slide 4: The Demo Dataset
- **Headline:** Fixing "Animals-10"
- **Content:**
  - Base: Kaggle Animals-10
  - Introduced Defects: 90 cats vs. 20 dogs (Imbalance), missing labels, obvious mislabels, and near-duplicates.
- **Visual:** A grid of animal images with red "X"s over duplicates and wrong labels.
- **Speaker Notes:** "We took a standard dataset and deliberately broke it to simulate real-world conditions. Watch how DataForge handles it."

## Slide 5: Proving the Improvement (Before/After)
- **Headline:** Metrics That Matter
- **Content:**
  - Compare Baseline Quality Score vs. Final Quality Score.
  - Highlight the change in Label Consistency and Class Balance.
- **Visual:** Side-by-side distribution charts or gauge metrics showing significant improvement.
- **Speaker Notes:** "We don't claim to improve model accuracy directly. We prove that we provide a structurally superior, training-ready dataset."

## Slide 6: Architecture & Integrations
- **Headline:** Powered By Our Sponsors
- **Points:**
  - **Adaption Labs:** Rigorous manifest-level quality workflows and evaluations.
  - **OpenAI (GPT-5.5 / Vision):** Visual auditing, reasoning, and structured reporting.
  - **Convex:** Real-time state management and live dashboard updates.
  - **Vercel:** Seamless, high-performance edge deployment.
  - **Fal AI:** Synthetic data generation for class balancing.
- **Visual:** Simple architecture diagram with sponsor logos at their respective layers.
- **Speaker Notes:** "We're utilizing best-in-class tools. Adaption handles our manifest evaluations, GPT provides the reasoning layer, Convex gives us a live multiplayer-ready dashboard, Fal AI supplies instant synthetic balancing samples, and it all runs on Vercel."

## Slide 7: Why It Matters & Next Steps
- **Headline:** The Future of Data Readiness
- **Points:**
  - High-quality labeled data is the biggest bottleneck in AI.
  - DataForge turns weeks of manual auditing into a 2-minute workflow.
- **Call to Action:** Try the demo today.
- **Speaker Notes:** "AI demand is growing, but data quality isn't keeping up. DataForge is the bridge. Thank you."