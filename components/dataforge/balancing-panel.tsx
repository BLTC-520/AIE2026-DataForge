// Balancing recommendations grouped by class.
//
// The panel is deliberately honest: class weights are *training-time
// advice*, not new images. The "weight" badge and the strategy chip
// make this explicit so judges and users don't conflate balancing
// metadata with synthetic data.
//
// Brian's stub signature: `{ balancingPlan }`. Match exactly.

import type { CSSProperties } from "react";
import type { BalancingPlan, SamplingStrategy } from "../../lib/dataforge/types";
import styles from "./balancing-panel.module.css";

export type BalancingPanelProps = {
  balancingPlan: BalancingPlan[];
  /** Optional per-class accent color used as the row indicator. */
  classColors?: Record<string, string>;
  /** Optional click handlers if you want users to tweak the plan from here. */
  onAccept?: (planId: string) => void;
  onReject?: (planId: string) => void;
};

const STRATEGY_LABELS: Record<SamplingStrategy, string> = {
  keep: "Keep",
  downsample: "Downsample",
  upsample: "Upsample",
  collect_more: "Collect more",
  optional_generate: "Generate (optional)",
};

const STRATEGY_DESCRIPTIONS: Record<SamplingStrategy, string> = {
  keep: "Class is within balance band — no change.",
  downsample: "Cut samples or apply lower training weight.",
  upsample: "Apply inverse-frequency class weight at training time.",
  collect_more: "Too few real samples for safe upsampling.",
  optional_generate: "Generate targeted synthetic — flag in manifest.",
};

export function BalancingPanel({
  balancingPlan,
  classColors,
  onAccept,
  onReject,
}: BalancingPanelProps) {
  const summary = summarizePlan(balancingPlan);

  return (
    <section className={styles.root} aria-label="Class balancing plan">
      <header className={styles.header}>
        <span className={styles.kicker}>Balancing plan</span>
        <h2 className={styles.title}>Class weight &amp; sampling recommendations</h2>
        <p className={styles.subtitle}>
          These are <em>recommendations</em>, not new images. Class weights
          apply at training time. Synthetic generation is opt-in and flagged
          in the export manifest.
        </p>
      </header>

      {balancingPlan.length === 0 ? (
        <div className={styles.empty}>
          The balancing plan appears once labelization completes.
        </div>
      ) : (
        <>
          <ul className={styles.summaryStrip}>
            {Object.entries(summary).map(([strategy, count]) =>
              count === 0 ? null : (
                <li key={strategy} data-strategy={strategy}>
                  <strong>{count}</strong>
                  <small>{STRATEGY_LABELS[strategy as SamplingStrategy]}</small>
                </li>
              ),
            )}
          </ul>

          <ol className={styles.list}>
            {balancingPlan.map((entry) => {
              const accent = classColors?.[entry.className];
              const accentStyle: CSSProperties | undefined = accent
                ? ({ "--df-accent": accent } as CSSProperties)
                : undefined;
              return (
                <li
                  key={entry.id}
                  className={styles.row}
                  data-strategy={entry.samplingStrategy}
                  data-status={entry.status}
                  style={accentStyle}
                >
                  <div className={styles.rowHead}>
                    <span className={styles.rowLabel}>
                      <i className={styles.dot} aria-hidden="true" />
                      <strong>{entry.className}</strong>
                    </span>
                    <span className={styles.strategyChip}>
                      {STRATEGY_LABELS[entry.samplingStrategy]}
                    </span>
                  </div>

                  <dl className={styles.rowMeta}>
                    <div>
                      <dt>Current</dt>
                      <dd>{entry.currentCount}</dd>
                    </div>
                    {entry.targetCount !== undefined ? (
                      <div>
                        <dt>Target</dt>
                        <dd>{entry.targetCount}</dd>
                      </div>
                    ) : null}
                    {entry.recommendedWeight !== undefined ? (
                      <div title="Loss weight applied at training time, not new samples">
                        <dt>Weight</dt>
                        <dd>{entry.recommendedWeight.toFixed(2)}×</dd>
                      </div>
                    ) : null}
                  </dl>

                  <p className={styles.reason}>{entry.reason}</p>
                  <p className={styles.help}>
                    <small>{STRATEGY_DESCRIPTIONS[entry.samplingStrategy]}</small>
                  </p>

                  {(onAccept || onReject) && entry.status === "proposed" ? (
                    <div className={styles.actions}>
                      {onAccept ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => onAccept(entry.id)}
                        >
                          Accept
                        </button>
                      ) : null}
                      {onReject ? (
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => onReject(entry.id)}
                        >
                          Reject
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {entry.status !== "proposed" ? (
                    <span className={styles.statusPill} data-status={entry.status}>
                      {entry.status}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

function summarizePlan(plan: BalancingPlan[]): Record<SamplingStrategy, number> {
  const summary: Record<SamplingStrategy, number> = {
    keep: 0,
    downsample: 0,
    upsample: 0,
    collect_more: 0,
    optional_generate: 0,
  };
  for (const entry of plan) {
    summary[entry.samplingStrategy] += 1;
  }
  return summary;
}
