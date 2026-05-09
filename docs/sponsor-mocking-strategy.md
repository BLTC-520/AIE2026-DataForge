# Hackathon Sponsor Mocking & Simulation Strategy

To guarantee a flawless 2-minute demo on stage while aggressively targeting sponsor prize tracks, DataForge relies on several intentional mocks, simulations, and seeded data. Real-world dataset processing takes 30+ minutes; our demo condenses this into 120 seconds using deterministic fallbacks. 

Here is exactly what is deterministic or simulated so the stage demo stays reliable while still matching a production-capable workflow.

## 1. Adaption Labs (Primary Prize Track)
**The Goal:** Win the Adaption Labs track by demonstrating a manifest-level dataset quality workflow.
**What is Mocked/Faked:**
* **Image Pixel Analysis:** We *explicitly do not* claim Adaption Labs looks at the image pixels. We normalize images into a repair manifest and only evaluate the tabular manifest path.
* **Evaluation Latency:** If the Adaption API is slow or rate-limited on stage, we use a `mockAdaptionClient`. This returns a pre-computed "Evaluation Snapshot" containing deterministic quality, balance, completeness, and consistency scores. 
* **The "Improvement" Delta:** The before-and-after metrics are deterministic demo snapshots tied to label fixes, duplicate removals, bounded balancing, and manifest completeness. We claim dataset readiness improvement, not trained model accuracy.

## 2. Fal AI (Stretch / Generation Prize Track)
**The Goal:** Show Fal AI being used intelligently to fix class imbalances via synthetic data generation.
**What is Mocked/Faked:**
* **Live Generation Latency:** We cannot afford a 45-second API wait on stage. We simulate the wait and instantly return cached Fal AI recovery records.
* **The "Generated" Images:** We show cached `fal.ai` generated recovery outputs from `data/animals/fal-ai-generated/`. They top up `cavallo`, `elefante`, `farfalla`, `gallina`, `gatto`, `mucca`, `pecora`, `ragno`, and `scoiattolo` so raw plus generated totals exactly 100 images per animal. `cane` already has 100 raw images and receives 0 generated images. Generated records are badged as `✨ Fal AI` / `Synthetic` and preserved with provider, prompt, source path, and cap provenance.
* **The Pitch:** We present this as the same Fal-backed workflow with cached generated outputs for demo reliability, not as unbounded live generation. No class exceeds the measured majority-class count.

## 3. OpenAI / GPT-5.5 / Vision (Intelligence Layer)
**The Goal:** Use GPT models as the reasoning and vision engine to identify dataset flaws and generate the final report.
**What is Mocked/Faked:**
* **The Vision Audit:** Scanning hundreds of images with GPT Vision is too slow for the demo. We use **seeded demo truth** to instantly flag specific, pre-planned defects: cross-class Animals-10 label swaps, missing labels, and duplicate images. We describe GPT Vision/Gemini as the optional live path and seeded demo truth as the stage-safe path.
* **Cluster Identification:** Identifying visual clusters is mocked by simply reading the underlying folder names of the demo dataset.
* **The Quality Report:** The GPT-5.5 generated report explaining the repairs and balancing plan may use a cached JSON response to ensure it formats perfectly and highlights the exact metrics we want the judges to see.

## 4. The "Soft Orchestrator" & Iterative Loop
**The Goal:** Show an advanced, adaptive agent that loops until a target confidence score is met.
**What is Mocked/Faked:**
* **The Confidence Score:** The score is a deterministic, seeded number designed to show the loop stopping criteria clearly during the demo.
* **The Stopping Criteria:** The orchestrator stops after one scripted loop when confidence reaches 93%, and the React Flow pipeline visualization marks the run export-ready.

## 5. Platform Basics (Convex & Vercel)
**The Goal:** Win platform prizes by demonstrating realtime, multiplayer dashboard capabilities.
**What is Mocked/Faked:**
* **File Uploads:** We don't actually upload a ZIP file over the network. Dragging/dropping or clicking the simulated training ZIP instantly loads the already-unzipped, deliberately corrupted subset from the local `data/` directory.
* **Convex usage is REAL, but data is scripted:** We actually use Convex for the live dashboard state, stage rows, Fal run telemetry, and event stream. The events it broadcasts (e.g., `labelize.started`, `duplicate.removed`) are fired by deterministic pipeline scripts to simulate heavy backend processing on the same path a live worker would use.

---

### The "Honesty" Boundary for the Pitch
To avoid losing credibility with judges, we maintain a strict pitch boundary:
* **We DO NOT claim** we improve trained model accuracy (we claim we improve dataset *readiness*).
* **We DO NOT claim** Adaption Labs analyzes image pixels.
* **We DO claim** our workflow represents a real production pipeline, using mocked data purely to fit the 2-minute stage constraint.
