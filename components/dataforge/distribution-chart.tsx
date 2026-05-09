// Dependency-free before/after class distribution chart.
//
// Renders one row per class with two stacked bars: source (before) vs
// final (after). All styling lives in the colocated CSS module — no
// global classes touched.
//
// Brian's stub at components/dataforge/dataforge-demo-app.tsx renders
// `<DistributionChart before={...} after={...} />`. This is the real
// component he'll swap in.

import type { CSSProperties } from "react";
import type { ClassDistribution } from "../../lib/dataforge/types";
import styles from "./distribution-chart.module.css";

export type DistributionChartProps = {
  before: ClassDistribution;
  after: ClassDistribution;
  /** Optional per-class accent color. Falls back to the root CSS variable. */
  classColors?: Record<string, string>;
  /** Hide the legend (e.g. when used in a small embedded card). */
  hideLegend?: boolean;
  /** Override the section title; defaults to "Class distribution". */
  title?: string;
  /** Caption shown under the title. */
  caption?: string;
};

export function DistributionChart({
  before,
  after,
  classColors,
  hideLegend,
  title = "Class distribution",
  caption,
}: DistributionChartProps) {
  // Stable class order: union of both distributions, sorted by max count desc.
  const classes = mergeClasses(before, after);
  const max = Math.max(
    1,
    ...classes.map((name) => Math.max(before[name] ?? 0, after[name] ?? 0)),
  );

  return (
    <section className={styles.root} aria-label={title}>
      <header className={styles.header}>
        <span className={styles.kicker}>Before / after</span>
        <strong className={styles.title}>{title}</strong>
        {caption ? <small className={styles.caption}>{caption}</small> : null}
      </header>

      {!hideLegend ? (
        <ul className={styles.legend} aria-label="Chart legend">
          <li>
            <span className={`${styles.swatch} ${styles.swatchBefore}`} aria-hidden="true" />
            Source
          </li>
          <li>
            <span className={`${styles.swatch} ${styles.swatchAfter}`} aria-hidden="true" />
            Final
          </li>
        </ul>
      ) : null}

      <div className={styles.chart} role="table" aria-label={title}>
        {classes.length === 0 ? (
          <div className={styles.empty}>Load a dataset to populate distribution.</div>
        ) : (
          classes.map((name) => {
            const beforeCount = before[name] ?? 0;
            const afterCount = after[name] ?? 0;
            const beforeWidth = barWidth(beforeCount, max);
            const afterWidth = barWidth(afterCount, max);
            const accent = classColors?.[name];
            const delta = afterCount - beforeCount;
            const accentStyle: CSSProperties | undefined = accent
              ? ({ "--df-accent": accent } as CSSProperties)
              : undefined;
            return (
              <div className={styles.row} role="row" key={name}>
                <span className={styles.label} role="rowheader" style={accentStyle}>
                  <i className={styles.dot} aria-hidden="true" />
                  {name}
                </span>
                <span className={styles.bars} role="cell">
                  <span className={styles.track} aria-hidden="true">
                    <span
                      className={`${styles.fill} ${styles.fillBefore}`}
                      style={{ width: `${beforeWidth}%` }}
                    />
                  </span>
                  <span className={styles.track} aria-hidden="true">
                    <span
                      className={`${styles.fill} ${styles.fillAfter}`}
                      style={{ width: `${afterWidth}%` }}
                    />
                  </span>
                </span>
                <span className={styles.value} role="cell">
                  <span className={styles.beforeValue}>{beforeCount}</span>
                  <span className={styles.arrow} aria-hidden="true">→</span>
                  <span className={styles.afterValue}>{afterCount}</span>
                  {delta !== 0 ? (
                    <small
                      className={delta > 0 ? styles.deltaPositive : styles.deltaNegative}
                      aria-label={`change ${delta > 0 ? "+" : ""}${delta}`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </small>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function mergeClasses(before: ClassDistribution, after: ClassDistribution): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const map of [before, after]) {
    for (const name of Object.keys(map)) {
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
  }
  return result.sort(
    (a, b) =>
      Math.max(after[b] ?? 0, before[b] ?? 0) -
      Math.max(after[a] ?? 0, before[a] ?? 0),
  );
}

function barWidth(count: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(2, Math.round((count / max) * 100));
}
