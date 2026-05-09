// The quality report. Two columns:
//   - Measured  → numbers from Adaption (manifest-level) AND deterministic
//                 local computation. Each metric has a source badge so
//                 viewers can see which provider / computation produced it.
//   - Inferred  → GPT-5.5's structured analysis (gaps, recommendations).
//
// Per PLAN.md Step 3.4, every metric must be labeled with its source:
//   - "GPT"      — from /api/evaluate-dataset (OpenAI Responses API)
//   - "Local"    — deterministic locally computed
//   - "Seeded"   — pre-baked demo fixture
//   - "Vision"   — GPT Vision/Gemini estimate (e.g. label suggestions)
//
// Brian's stub signature:
//   { baselineEvaluation, finalEvaluation, qualityReport }
// This component matches that signature exactly so it drops in.

import type {
  AdaptionEvaluationSnapshot,
  DatasetMetrics,
  QualityReport,
} from "../../lib/dataforge/types";
import { buildImprovementDelta, type ImprovementDelta } from "../../lib/dataforge/metrics";
import styles from "./quality-report-panel.module.css";

export type QualityReportPanelProps = {
  baselineEvaluation: AdaptionEvaluationSnapshot;
  finalEvaluation: AdaptionEvaluationSnapshot;
  qualityReport: QualityReport;
  /**
   * Optional deterministic baseline + final metric summaries. When passed,
   * the report shows them in the "Local" column alongside Adaption's
   * manifest-level scores. Brian populates these from his orchestrator.
   */
  baselineMetrics?: DatasetMetrics;
  finalMetrics?: DatasetMetrics;
};

type SourceTag = "GPT" | "Local" | "Seeded" | "Vision";

export function QualityReportPanel({
  baselineEvaluation,
  finalEvaluation,
  qualityReport,
  baselineMetrics,
  finalMetrics,
}: QualityReportPanelProps) {
  const delta: ImprovementDelta = buildImprovementDelta(
    baselineMetrics
      ? { evaluation: baselineEvaluation, metrics: baselineMetrics }
      : null,
    finalMetrics ? { evaluation: finalEvaluation, metrics: finalMetrics } : null,
  );

  const evaluatorProvider = finalEvaluation.provider;
  const reportProvider = qualityReport.provider;
  const isMockEvaluator =
    evaluatorProvider === "demo-adaption" || evaluatorProvider.toString().startsWith("demo-");

  return (
    <section className={styles.root} aria-label="Quality report">
      <header className={styles.header}>
        <span className={styles.kicker}>Quality report</span>
        <h2 className={styles.title}>Measured gaps, inferred fixes</h2>
        <p className={styles.subtitle}>
          Every metric is labeled with its source. The GPT evaluator scores
          the manifest — it does not inspect image pixels. Visual findings
          come from seeded demo truth or a vision-capable model elsewhere
          in the pipeline.
        </p>
      </header>

      {(baselineMetrics || finalMetrics) && (
        <DeltaStrip delta={delta} />
      )}

      <div className={styles.grid}>
        {/* MEASURED — GPT evaluator scores + deterministic locals */}
        <article className={`${styles.card} ${styles.measured}`} aria-labelledby="qr-measured">
          <div className={styles.cardKicker}>
            <span>Measured</span>
            <small>
              GPT evaluator ({evaluatorProvider}
              {isMockEvaluator ? ", seeded fallback" : ""})
            </small>
          </div>
          <h3 id="qr-measured" className={styles.cardTitle}>
            Quality snapshots
          </h3>

          <div className={styles.scoreColumns}>
            <div className={styles.scoreCol}>
              <header className={styles.colHead}>
                <span>Baseline</span>
                <small>{formatVersion(baselineEvaluation.version)}</small>
              </header>
              <ul className={styles.scoreList}>
                {/* Score rows always tag source as Adaption — no Local fallback.
                    Undefined values render as "—" so it's visible when the
                    Adaption call hasn't returned (or doesn't include this
                    metric) instead of silently substituting a local proxy. */}
                <ScoreRow
                  label="Quality"
                  value={baselineEvaluation.qualityScore ?? null}
                  source="GPT"
                />
                <ScoreRow
                  label="Balance"
                  value={baselineEvaluation.balanceScore ?? null}
                  source="GPT"
                />
                <ScoreRow
                  label="Completeness"
                  value={baselineEvaluation.completenessScore ?? null}
                  source="GPT"
                />
                <ScoreRow
                  label="Consistency"
                  value={baselineEvaluation.consistencyScore ?? null}
                  source="GPT"
                />
              </ul>
            </div>

            <div className={styles.scoreCol}>
              <header className={styles.colHead}>
                <span>Final</span>
                <small>{formatVersion(finalEvaluation.version)}</small>
              </header>
              <ul className={styles.scoreList}>
                <ScoreRow
                  label="Quality"
                  value={finalEvaluation.qualityScore ?? null}
                  source="GPT"
                />
                <ScoreRow
                  label="Balance"
                  value={finalEvaluation.balanceScore ?? null}
                  source="GPT"
                />
                <ScoreRow
                  label="Completeness"
                  value={finalEvaluation.completenessScore ?? null}
                  source="GPT"
                />
                <ScoreRow
                  label="Consistency"
                  value={finalEvaluation.consistencyScore ?? null}
                  source="GPT"
                />
              </ul>
            </div>
          </div>

          {finalMetrics ? (
            <ul className={styles.countList}>
              <CountRow label="Samples" value={finalMetrics.sampleCount} source="Local" />
              <CountRow label="Classes" value={finalMetrics.classCount} source="Local" />
              <CountRow
                label="Missing labels"
                value={finalMetrics.missingLabelCount}
                tone={finalMetrics.missingLabelCount > 0 ? "warn" : "ok"}
                source="Local"
              />
              <CountRow
                label="Suspected mislabels"
                value={finalMetrics.suspectedLabelIssueCount}
                tone={finalMetrics.suspectedLabelIssueCount > 0 ? "warn" : "ok"}
                source="Vision"
              />
              <CountRow
                label="Duplicates"
                value={finalMetrics.duplicateIssueCount}
                tone={finalMetrics.duplicateIssueCount > 0 ? "warn" : "ok"}
                source="Local"
              />
              <CountRow
                label="Newly labeled"
                value={finalMetrics.newlyLabeledCount}
                tone="ok"
                source="Vision"
              />
              <CountRow
                label="Corrected"
                value={finalMetrics.correctedLabelCount}
                tone="ok"
                source="Vision"
              />
            </ul>
          ) : null}
        </article>

        {/* INFERRED — GPT-5.5 explanation, gaps, recommendations */}
        <article className={`${styles.card} ${styles.inferred}`} aria-labelledby="qr-inferred">
          <div className={styles.cardKicker}>
            <span>Inferred</span>
            <small>Source: {reportProvider} · {qualityReport.model}</small>
          </div>
          <h3 id="qr-inferred" className={styles.cardTitle}>
            GPT-5.5 repair plan
          </h3>

          <p className={styles.summary}>{qualityReport.summary}</p>

          {qualityReport.gaps.length > 0 ? (
            <div className={styles.subsection}>
              <h4 className={styles.subTitle}>Detected gaps</h4>
              <ul className={styles.gapList}>
                {qualityReport.gaps.map((gap) => (
                  <li key={gap.id} className={styles.gapItem} data-severity={gap.severity}>
                    <span className={styles.gapTitle}>
                      <strong>{gap.title}</strong>
                      <small>via {gap.measuredBy}</small>
                    </span>
                    <span className={styles.gapDescription}>{gap.description}</span>
                    <span className={styles.gapAction}>→ {gap.recommendedAction}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {qualityReport.recommendedActions.length > 0 ? (
            <div className={styles.subsection}>
              <h4 className={styles.subTitle}>Recommended actions</h4>
              <ul className={styles.actionList}>
                {qualityReport.recommendedActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {qualityReport.biasFlags.length > 0 ? (
            <div className={styles.subsection}>
              <h4 className={styles.subTitle}>Bias flags</h4>
              <ul className={styles.actionList}>
                {qualityReport.biasFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function DeltaStrip({ delta }: { delta: ImprovementDelta }) {
  if (!delta.baseline && !delta.final) return null;
  const items: { label: string; value: string; tone: "good" | "bad" | "neutral" }[] = [];

  if (delta.qualityScoreDelta !== null) {
    items.push({
      label: "Quality",
      value: formatScoreDelta(delta.qualityScoreDelta),
      tone: deltaTone(delta.qualityScoreDelta, "score"),
    });
  }
  if (delta.balanceScoreDelta !== null) {
    items.push({
      label: "Balance",
      value: formatScoreDelta(delta.balanceScoreDelta),
      tone: deltaTone(delta.balanceScoreDelta, "score"),
    });
  }
  if (delta.completenessScoreDelta !== null) {
    items.push({
      label: "Completeness",
      value: formatScoreDelta(delta.completenessScoreDelta),
      tone: deltaTone(delta.completenessScoreDelta, "score"),
    });
  }
  if (delta.consistencyScoreDelta !== null && delta.consistencyScoreDelta !== 0) {
    items.push({
      label: "Consistency",
      value: formatScoreDelta(delta.consistencyScoreDelta),
      tone: deltaTone(delta.consistencyScoreDelta, "score"),
    });
  }
  if (delta.missingLabelDelta !== 0) {
    items.push({
      label: "Missing labels",
      value: formatCountDelta(delta.missingLabelDelta),
      tone: deltaTone(delta.missingLabelDelta, "count"),
    });
  }
  if (delta.labelIssueDelta !== 0) {
    items.push({
      label: "Mislabels",
      value: formatCountDelta(delta.labelIssueDelta),
      tone: deltaTone(delta.labelIssueDelta, "count"),
    });
  }
  if (delta.duplicateIssueDelta !== 0) {
    items.push({
      label: "Duplicates",
      value: formatCountDelta(delta.duplicateIssueDelta),
      tone: deltaTone(delta.duplicateIssueDelta, "count"),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className={styles.deltaStrip} aria-label="Improvement delta">
      {items.map((item) => (
        <span key={item.label} className={styles.deltaPill} data-tone={item.tone}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
        </span>
      ))}
    </div>
  );
}

function ScoreRow({
  label,
  value,
  source,
}: {
  label: string;
  value: number | null;
  source: SourceTag;
}) {
  return (
    <li className={styles.scoreRow}>
      <span className={styles.scoreLabel}>{label}</span>
      <span className={styles.scoreValue}>
        {value === null ? "—" : Math.round(value)}
      </span>
      <SourceBadge source={source} />
    </li>
  );
}

function CountRow({
  label,
  value,
  tone,
  source,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
  source: SourceTag;
}) {
  return (
    <li className={styles.countRow} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <SourceBadge source={source} compact />
    </li>
  );
}

function SourceBadge({ source, compact }: { source: SourceTag; compact?: boolean }) {
  return (
    <small
      className={`${styles.sourceBadge} ${compact ? styles.sourceBadgeCompact : ""}`}
      data-source={source.toLowerCase()}
      title={SOURCE_TOOLTIPS[source]}
    >
      {source}
    </small>
  );
}

const SOURCE_TOOLTIPS: Record<SourceTag, string> = {
  GPT: "OpenAI Responses API — manifest-level scoring. Does not inspect image pixels.",
  Local: "Deterministic local computation (no provider call)",
  Seeded: "Pre-baked demo fixture used for repeatable presentations",
  Vision: "GPT Vision / Gemini visual audit estimate",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVersion(version: string): string {
  // baseline → "Original"; balanced → "After repair"; etc.
  switch (version) {
    case "baseline":
      return "Original";
    case "labelized":
      return "After labelize";
    case "balanced":
      return "After repair";
    case "augmented":
      return "After augment";
    default:
      return version;
  }
}

function formatScoreDelta(delta: number): string {
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function formatCountDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function deltaTone(value: number, kind: "score" | "count"): "good" | "bad" | "neutral" {
  if (value === 0) return "neutral";
  if (kind === "score") return value > 0 ? "good" : "bad";
  // For counts (mislabels, duplicates, missing labels), DOWN is good.
  return value < 0 ? "good" : "bad";
}
