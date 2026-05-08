"use client";

import { useMemo, useState } from "react";

type StageStatus = "queued" | "running" | "complete" | "error";
type SourceType = "original" | "synthetic";

type Sample = {
  id: string;
  className: string;
  source: SourceType;
  scenario: string;
  status: string;
};

type Metrics = {
  quality: number;
  balance: number;
  coverage: number;
  consistency: number;
  synthetic?: number;
};

type EventRecord = {
  id: number;
  name: string;
  message: string;
  time: string;
};

const stages = [
  { id: "upload", label: "Upload", icon: "01" },
  { id: "evaluate", label: "Evaluate", icon: "02" },
  { id: "analyze", label: "Analyze Gaps", icon: "03" },
  { id: "generate", label: "Generate Synthetic Data", icon: "04" },
  { id: "reevaluate", label: "Re-evaluate", icon: "05" },
  { id: "export", label: "Export", icon: "06" },
] as const;

const classColors: Record<string, string> = {
  Cats: "#ffbc42",
  Dogs: "#54f0b4",
  Birds: "#52d6ff",
  Foxes: "#ff5d7d",
  Owls: "#af8cff",
  "Low-light Wildlife": "#f2f0dc",
};

const originalDistribution: Record<string, number> = {
  Cats: 120,
  Dogs: 100,
  Birds: 70,
  Foxes: 15,
  Owls: 10,
  "Low-light Wildlife": 3,
};

const augmentedDistribution: Record<string, number> = {
  Cats: 120,
  Dogs: 100,
  Birds: 70,
  Foxes: 60,
  Owls: 50,
  "Low-light Wildlife": 33,
};

const baselineMetrics: Metrics = {
  quality: 62,
  balance: 41,
  coverage: 35,
  consistency: 88,
};

const augmentedMetrics: Metrics = {
  quality: 84,
  balance: 78,
  coverage: 81,
  consistency: 90,
};

const gapJobs = [
  {
    className: "Foxes",
    currentCount: 15,
    targetCount: 60,
    syntheticCount: 45,
    severity: "high",
    accent: "#ff5d7d",
    prompt:
      "Photorealistic foxes in mixed woodland and suburban edges, varied poses, clean labels, no text, no watermark.",
  },
  {
    className: "Owls",
    currentCount: 10,
    targetCount: 50,
    syntheticCount: 40,
    severity: "high",
    accent: "#af8cff",
    prompt:
      "Owls perched and in flight across natural backgrounds, side and frontal angles, realistic feather detail, no overlays.",
  },
  {
    className: "Low-light Wildlife",
    currentCount: 3,
    targetCount: 33,
    syntheticCount: 30,
    severity: "high",
    accent: "#f2f0dc",
    prompt:
      "Low-light camera-trap wildlife photos with infrared glare, motion blur, night foliage, plausible animal framing.",
  },
];

const measuredCopy = {
  baseline: ["Load the demo dataset to create a baseline snapshot."],
  measured: [
    "Class distribution is skewed: cats 120, dogs 100, foxes 15, owls 10.",
    "Coverage score is 35 because low-light wildlife records are almost absent.",
    "Consistency remains strong at 88, so repair should focus on coverage rather than relabeling.",
  ],
  inferred: [
    "Class distribution is skewed: cats 120, dogs 100, foxes 15, owls 10.",
    "Coverage score is 35 because low-light wildlife records are almost absent.",
    "Consistency remains strong at 88, so repair should focus on coverage rather than relabeling.",
  ],
  complete: [
    "Post-repair quality increased to 84 after targeted synthetic records were added.",
    "Balance improved to 78 with foxes and owls lifted near the minimum target count.",
    "Coverage improved to 81 after adding low-light camera-trap scenarios.",
  ],
};

const inferredCopy = {
  baseline: ["The repair plan will target underrepresented wildlife and missing night scenes."],
  measured: [
    "Foxes and owls should be prioritized before generating more common pet images.",
    "Synthetic data should be tied to measured class gaps, not broad aesthetic variation.",
    "Night scenes need camera-trap artifacts so the dataset matches the training intent.",
  ],
  inferred: [
    "Generate 45 fox records across woodland and suburban edge conditions.",
    "Generate 40 owl records with perched, flight, frontal, and side-angle compositions.",
    "Generate 30 low-light wildlife records with infrared glare and plausible motion blur.",
  ],
  complete: [
    "Keep synthetic records flagged in the manifest for downstream filtering.",
    "Review remaining pet-to-wildlife imbalance before a larger training run.",
    "Export the augmented dataset with both evaluation snapshots as proof of improvement.",
  ],
};

const originalSamples = buildOriginalSamples();
const syntheticSamples = buildSyntheticSamples();

export default function Home() {
  const [trainingIntent, setTrainingIntent] = useState(
    "Train an animal image classifier that works across common pets and wildlife, including low-light camera-trap photos.",
  );
  const [datasetLoaded, setDatasetLoaded] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(
    makeQueuedStages(),
  );
  const [samples, setSamples] = useState<Sample[]>([]);
  const [visibleSynthetic, setVisibleSynthetic] = useState<Sample[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [reportMode, setReportMode] = useState<keyof typeof measuredCopy>("baseline");
  const [classFilter, setClassFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | SourceType>("all");

  const systemTone = analysisRunning ? "running" : analysisComplete ? "complete" : datasetLoaded ? "idle" : "idle";
  const systemLabel = analysisRunning ? "Running" : analysisComplete ? "Complete" : datasetLoaded ? "Dataset loaded" : "Idle";

  const activeJobs = useMemo(
    () =>
      gapJobs.filter((job) =>
        visibleSynthetic.some((sample) => sample.className === job.className),
      ),
    [visibleSynthetic],
  );

  const filteredSamples = useMemo(() => {
    return samples
      .filter((sample) => classFilter === "all" || sample.className === classFilter)
      .filter((sample) => sourceFilter === "all" || sample.source === sourceFilter)
      .slice(0, 32);
  }, [classFilter, samples, sourceFilter]);

  function logEvent(name: string, message: string) {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setEvents((current) => [{ id: Date.now() + Math.random(), name, message, time }, ...current]);
  }

  function loadDemoDataset() {
    setDatasetLoaded(true);
    setAnalysisComplete(false);
    setSamples(originalSamples);
    setVisibleSynthetic([]);
    setStageStatuses({ ...makeQueuedStages(), upload: "complete" });
    setMetrics(null);
    setReportMode("baseline");
    setEvents([]);
    setClassFilter("all");
    setSourceFilter("all");
    window.setTimeout(() => {
      logEvent(
        "dataset.loaded",
        "Seeded animal dataset detected: cats, dogs, birds, foxes, owls, and sparse low-light wildlife.",
      );
    }, 0);
  }

  async function runAnalysis() {
    if (!datasetLoaded || analysisRunning) return;

    setAnalysisRunning(true);
    setAnalysisComplete(false);
    setEvents([]);
    logEvent(
      "pipeline.started",
      "Dataset repair loop started with demo-adaption, GPT fallback, and demo-fal adapters.",
    );

    await step("upload", "complete", "upload.complete", "Source dataset registered with 318 records and 6 detected labels.", 420);
    await step("evaluate", "running", "baseline_evaluation.started", "Adaption baseline evaluation queued for imbalance and coverage checks.", 720);
    setMetrics(baselineMetrics);
    setReportMode("measured");
    await step("evaluate", "complete", "baseline_evaluation.complete", "Quality 62, balance 41, coverage 35, consistency 88.", 520);
    await step("analyze", "running", "gap_analysis.started", "GPT-5.5 fallback report is translating measured gaps into repair actions.", 720);
    setReportMode("inferred");
    await step("analyze", "complete", "gap_analysis.complete", "Repair plan created for foxes, owls, and low-light camera-trap scenarios.", 560);
    await step("generate", "running", "fal_jobs.queued", "Three synthetic generation jobs queued with targeted prompts.", 720);

    const generatedSamples: Sample[] = [];
    for (const job of gapJobs) {
      const newSamples = syntheticSamples.filter((sample) => sample.className === job.className);
      generatedSamples.push(...newSamples);
      setVisibleSynthetic([...generatedSamples]);
      setSamples([...originalSamples, ...generatedSamples]);
      setMetrics({ ...baselineMetrics, synthetic: generatedSamples.length });
      logEvent("synthetic_samples.generated", `${job.syntheticCount} demo-fal records generated for ${job.className}.`);
      await wait(520);
    }

    await step("generate", "complete", "fal_jobs.complete", "115 synthetic records added with provider prompts and source metadata.", 560);
    await step("reevaluate", "running", "augmented_evaluation.started", "Augmented dataset re-ingested for second quality snapshot.", 720);
    setMetrics({ ...augmentedMetrics, synthetic: generatedSamples.length });
    setReportMode("complete");
    await step("reevaluate", "complete", "augmented_evaluation.complete", "Quality improved from 62 to 84. Balance improved from 41 to 78.", 620);
    await step("export", "complete", "export.ready", "Export manifest is ready with provenance fields for each synthetic sample.", 380);

    setAnalysisRunning(false);
    setAnalysisComplete(true);
  }

  async function step(
    stageId: string,
    status: StageStatus,
    eventName: string,
    message: string,
    delay: number,
  ) {
    setStageStatuses((current) => ({ ...current, [stageId]: status }));
    logEvent(eventName, message);
    await wait(delay);
  }

  function downloadManifest() {
    if (!datasetLoaded) return;

    const manifest = {
      product: "DataForge",
      dataset: "demo-animal-camera-traps.zip",
      trainingIntent,
      generatedAt: new Date().toISOString(),
      adapters: {
        evaluation: "demo-adaption",
        analysis: "gpt-5.5-fallback",
        generation: "demo-fal",
      },
      metrics: {
        baseline: baselineMetrics,
        augmented: analysisComplete ? augmentedMetrics : null,
      },
      classDistribution: {
        source: originalDistribution,
        augmented: analysisComplete ? augmentedDistribution : originalDistribution,
      },
      gapJobs,
      samples,
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dataforge-demo-manifest.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logEvent(
      "export_manifest.downloaded",
      "Manifest includes original samples, synthetic flags, prompts, and evaluation snapshots.",
    );
  }

  return (
    <>
      <div className="scanline" aria-hidden="true" />
      <div className="page-shell">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="DataForge home">
            <span className="brand-mark" aria-hidden="true">
              DF
            </span>
            <span>
              <strong>DataForge</strong>
              <small>Adaptive dataset repair loop</small>
            </span>
          </a>

          <nav className="nav-links" aria-label="Page navigation">
            <a href="#pipeline">Pipeline</a>
            <a href="#quality">Quality</a>
            <a href="#synthetics">Synthetics</a>
            <a href="#explorer">Explorer</a>
          </nav>

          <div className="status-pill" data-tone={systemTone}>
            <span className="status-led" aria-hidden="true" />
            <span>{systemLabel}</span>
          </div>
        </header>

        <main id="top">
          <section className="hero-grid" aria-labelledby="heroTitle">
            <div className="hero-copy">
              <div className="eyebrow">
                <span>Hackathon MVP</span>
                <span>Animal classifier demo</span>
              </div>

              <h1 id="heroTitle">Repair your training data before the model ever sees it.</h1>
              <p className="hero-lede">
                DataForge evaluates an image dataset, explains coverage gaps, generates targeted
                synthetic samples, and proves the improvement with a second quality pass.
              </p>

              <div className="intent-console" aria-label="Dataset analysis controls">
                <label htmlFor="trainingIntent">Training intent</label>
                <textarea
                  id="trainingIntent"
                  rows={4}
                  value={trainingIntent}
                  onChange={(event) => setTrainingIntent(event.target.value)}
                />

                <button className="dropzone" type="button" onClick={loadDemoDataset}>
                  <span className="drop-icon" aria-hidden="true">
                    +
                  </span>
                  <span>
                    <strong>Drop dataset ZIP</strong>
                    <small>Mock upload accepts the seeded animal set for this teammate preview.</small>
                  </span>
                </button>

                <div className="action-row">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={loadDemoDataset}
                    disabled={analysisRunning}
                  >
                    <span aria-hidden="true">▣</span>
                    Load demo animal dataset
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={runAnalysis}
                    disabled={!datasetLoaded || analysisRunning}
                  >
                    <span aria-hidden="true">▶</span>
                    Analyze dataset
                  </button>
                </div>
              </div>
            </div>

            <aside className="dataset-rig" aria-label="Demo dataset preview">
              <div className="rig-header">
                <span>Source Dataset</span>
                <strong>{datasetLoaded ? "demo-animal-camera-traps.zip" : "No dataset loaded"}</strong>
              </div>

              <div className="pixel-field" aria-hidden="true">
                <div className="pixel-card cat-card">
                  <span>CAT</span>
                </div>
                <div className="pixel-card dog-card">
                  <span>DOG</span>
                </div>
                <div className="pixel-card bird-card">
                  <span>BIRD</span>
                </div>
                <div className="pixel-card fox-card">
                  <span>FOX</span>
                </div>
                <div className="pixel-card owl-card">
                  <span>OWL</span>
                </div>
                <div className="pixel-card night-card">
                  <span>NIGHT</span>
                </div>
              </div>

              <dl className="dataset-stats">
                <div>
                  <dt>Samples</dt>
                  <dd>{datasetLoaded ? totalCount(originalDistribution) : 0}</dd>
                </div>
                <div>
                  <dt>Classes</dt>
                  <dd>{datasetLoaded ? Object.keys(originalDistribution).length : 0}</dd>
                </div>
                <div>
                  <dt>Low-light</dt>
                  <dd>{datasetLoaded ? originalDistribution["Low-light Wildlife"] : 0}</dd>
                </div>
              </dl>

              <div className="class-chip-grid" aria-label="Detected classes">
                {datasetLoaded &&
                  Object.entries(originalDistribution).map(([className, count]) => (
                    <span className="class-chip" key={className}>
                      <i style={{ background: classColors[className] }} />
                      {className}: {count}
                    </span>
                  ))}
              </div>
            </aside>
          </section>

          <section className="dashboard-band" id="pipeline">
            <div className="section-heading">
              <span>Realtime cockpit</span>
              <h2>Closed-loop repair pipeline</h2>
            </div>

            <div className="pipeline-layout">
              <div className="pipeline-card">
                <div className="pipeline-flow" aria-label="DataForge pipeline stages">
                  {stages.map((stage) => {
                    const status = stageStatuses[stage.id] || "queued";
                    return (
                      <button
                        className="flow-node"
                        type="button"
                        data-status={status}
                        aria-label={`${stage.label}: ${status}`}
                        key={stage.id}
                      >
                        <span className="flow-icon" aria-hidden="true">
                          {stage.icon}
                        </span>
                        <strong>{stage.label}</strong>
                        <small>{status}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <aside className="event-panel" aria-label="Live event log">
                <div className="panel-title">
                  <span>Convex stream</span>
                  <strong>Live events</strong>
                </div>
                <ol className="event-log">
                  {events.length ? (
                    events.map((event) => (
                      <li key={event.id}>
                        <time>{event.time}</time>
                        <span>
                          <strong>{event.name}</strong>
                          <small>{event.message}</small>
                        </span>
                      </li>
                    ))
                  ) : (
                    <li>
                      <time>--:--</time>
                      <span>
                        <strong>waiting</strong>
                        <small>Load the demo dataset to start the stream.</small>
                      </span>
                    </li>
                  )}
                </ol>
              </aside>
            </div>
          </section>

          <section className="metric-strip" aria-label="Dataset quality metrics">
            <MetricTile
              label="Quality score"
              value={metrics ? metrics.quality : "--"}
              note={metrics && metrics.quality > baselineMetrics.quality ? `+${metrics.quality - baselineMetrics.quality} after repair` : "Waiting for baseline"}
            />
            <MetricTile
              label="Balance score"
              value={metrics ? metrics.balance : "--"}
              note="Measured by demo-adaption"
            />
            <MetricTile
              label="Coverage score"
              value={metrics ? metrics.coverage : "--"}
              note="Low-light and wildlife gaps"
            />
            <MetricTile
              label="Synthetic samples"
              value={metrics?.synthetic ?? visibleSynthetic.length}
              note="Fal fallback records"
            />
          </section>

          <section className="split-section" id="quality">
            <div className="quality-panel">
              <div className="section-heading">
                <span>Quality report</span>
                <h2>Measured gaps, inferred fixes</h2>
              </div>

              <div className="report-grid">
                <ReportCard
                  tone="measured-card"
                  kicker="Measured"
                  title="Adaption evaluation snapshot"
                  items={measuredCopy[reportMode]}
                />
                <ReportCard
                  tone="inferred-card"
                  kicker="Inferred"
                  title="GPT-5.5 repair plan"
                  items={inferredCopy[reportMode]}
                />
              </div>
            </div>

            <div className="chart-panel" aria-label="Before and after class distribution">
              <div className="panel-title">
                <span>Before / after</span>
                <strong>Class distribution</strong>
              </div>
              <div className="legend">
                <span>
                  <i className="legend-before" /> Source
                </span>
                <span>
                  <i className="legend-after" /> Augmented
                </span>
              </div>
              <DistributionChart
                before={originalDistribution}
                after={analysisComplete ? augmentedDistribution : originalDistribution}
              />
            </div>
          </section>

          <section className="synthetic-section" id="synthetics">
            <div className="section-heading">
              <span>Fal generation jobs</span>
              <h2>Targeted synthetic image gallery</h2>
            </div>

            <div className="job-grid">
              {activeJobs.length ? (
                activeJobs.map((job) => (
                  <JobCard
                    key={job.className}
                    job={job}
                    count={visibleSynthetic.filter((sample) => sample.className === job.className).length}
                  />
                ))
              ) : (
                <article className="empty-state">
                  <span>
                    <strong>No generation jobs yet</strong>
                    Run analysis to populate fox, owl, and low-light camera-trap samples.
                  </span>
                </article>
              )}
            </div>
          </section>

          <section className="explorer-section" id="explorer">
            <div className="section-heading">
              <span>Dataset explorer</span>
              <h2>Inspect sample provenance</h2>
            </div>

            <div className="explorer-toolbar" aria-label="Dataset filters">
              <label>
                Class
                <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                  <option value="all">All classes</option>
                  {Object.keys(originalDistribution).map((className) => (
                    <option value={className} key={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Source
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value as "all" | SourceType)}
                >
                  <option value="all">All sources</option>
                  <option value="original">Original</option>
                  <option value="synthetic">Synthetic</option>
                </select>
              </label>
              <button
                className="ghost-button"
                type="button"
                onClick={downloadManifest}
                disabled={!analysisComplete}
              >
                <span aria-hidden="true">↓</span>
                Export manifest
              </button>
            </div>

            <div className="sample-table-wrap">
              <table className="sample-table">
                <thead>
                  <tr>
                    <th>Sample</th>
                    <th>Class</th>
                    <th>Source</th>
                    <th>Scenario</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSamples.length ? (
                    filteredSamples.map((sample) => (
                      <tr key={sample.id}>
                        <td>{sample.id}</td>
                        <td>{sample.className}</td>
                        <td>
                          <span className={`source-pill ${sample.source}`}>{sample.source}</span>
                        </td>
                        <td>{sample.scenario}</td>
                        <td>
                          <span className="status-tag">{sample.status}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        {datasetLoaded ? "No records match the current filters." : "Load the demo dataset to inspect records."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note: string;
}) {
  return (
    <article className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function ReportCard({
  tone,
  kicker,
  title,
  items,
}: {
  tone: string;
  kicker: string;
  title: string;
  items: string[];
}) {
  return (
    <article className={`report-card ${tone}`}>
      <div className="card-kicker">{kicker}</div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function DistributionChart({
  before,
  after,
}: {
  before: Record<string, number>;
  after: Record<string, number>;
}) {
  const max = Math.max(...Object.values(before), ...Object.values(after), 1);

  return (
    <div className="bar-chart">
      {Object.keys(before).map((className) => {
        const beforeCount = before[className];
        const afterCount = after[className] ?? beforeCount;
        const beforeWidth = Math.max(2, (beforeCount / max) * 100);
        const afterWidth = Math.max(2, (afterCount / max) * 100);

        return (
          <div className="bar-row" key={className}>
            <span className="bar-label">{className}</span>
            <span className="bar-pair">
              <span className="bar-track">
                <span className="bar-fill before" style={{ width: `${beforeWidth}%` }} />
              </span>
              <span className="bar-track">
                <span className="bar-fill after" style={{ width: `${afterWidth}%` }} />
              </span>
            </span>
            <span className="bar-value">
              {beforeCount}/{afterCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function JobCard({
  job,
  count,
}: {
  job: (typeof gapJobs)[number];
  count: number;
}) {
  return (
    <article className="job-card">
      <h3>
        {job.className}
        <span className="synthetic-badge">Synthetic</span>
      </h3>
      <div className="synthetic-mosaic" aria-label={`${job.className} synthetic thumbnails`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            className="mini-sample"
            key={index}
            style={{
              "--accent": job.accent,
              filter: `hue-rotate(${index * 8}deg)`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <p>{job.prompt}</p>
      <div className="job-meta">
        <div>
          <small>Current</small>
          <strong>{job.currentCount}</strong>
        </div>
        <div>
          <small>Target</small>
          <strong>{job.targetCount}</strong>
        </div>
        <div>
          <small>Added</small>
          <strong>{count}</strong>
        </div>
      </div>
    </article>
  );
}

function buildOriginalSamples(): Sample[] {
  const scenarios: Record<string, string[]> = {
    Cats: ["indoor daylight", "window light", "sofa portrait"],
    Dogs: ["park daylight", "street walk", "yard profile"],
    Birds: ["branch daylight", "sky profile", "feeder closeup"],
    Foxes: ["woodland edge", "field daylight"],
    Owls: ["perched daylight", "tree hollow"],
    "Low-light Wildlife": ["dim trail camera"],
  };

  return Object.entries(originalDistribution).flatMap(([className, count]) => {
    return Array.from({ length: Math.min(count, 12) }).map((_, index) => ({
      id: `${slug(className)}-${String(index + 1).padStart(3, "0")}`,
      className,
      source: "original",
      scenario: scenarios[className][index % scenarios[className].length],
      status: count < 20 ? "gap candidate" : "accepted",
    }));
  });
}

function buildSyntheticSamples(): Sample[] {
  return gapJobs.flatMap((job) => {
    return Array.from({ length: job.syntheticCount }).map((_, index) => ({
      id: `syn-${slug(job.className)}-${String(index + 1).padStart(3, "0")}`,
      className: job.className,
      source: "synthetic",
      scenario: job.className === "Low-light Wildlife" ? "night camera trap" : "targeted class repair",
      status: "pending review",
    }));
  });
}

function makeQueuedStages(): Record<string, StageStatus> {
  return Object.fromEntries(stages.map((stage) => [stage.id, "queued"])) as Record<
    string,
    StageStatus
  >;
}

function totalCount(distribution: Record<string, number>) {
  return Object.values(distribution).reduce((sum, count) => sum + count, 0);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
