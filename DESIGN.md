# DataForge Design Context

## Design Register

product

## Current Design Read

DataForge is implemented as a dark, pixel-console product cockpit. The interface uses a sticky topbar, large hero workspace, data-dense panels, metric tiles, stage nodes, event logs, distribution charts, synthetic job cards, and explorer tables. The visual language is closer to a hackathon control room than a standard enterprise dashboard.

Physical scene: an ML engineer is presenting a dataset repair run on a large monitor in a dim demo room while judges watch the pipeline state, event log, and before and after quality delta.

## Color Strategy

The current UI uses a dark full-palette cockpit strategy: tinted charcoal surfaces carry most of the interface, while acid green, mint, cyan, amber, rose, and violet encode actions, status, classes, and provider categories.

Current global tokens in `styles.css`:

- `--bg`: `#090b0c`, page background.
- `--panel`: `#111515`, base panel surface.
- `--panel-strong`: `#171c1b`, raised panel surface.
- `--ink`: `#f2f0dc`, primary text.
- `--muted`: `#a6ad9d`, secondary text and labels.
- `--faint`: `#636b62`, inactive text.
- `--line`: `#2d342e`, borders and dividers.
- `--acid`: `#c7ff4d`, primary action and main success accent.
- `--mint`: `#54f0b4`, complete and success states.
- `--cyan`: `#52d6ff`, focus, secondary action, measured data.
- `--amber`: `#ffbc42`, running state, warnings, and cavallo accents.
- `--rose`: `#ff5d7d`, error and farfalla accents.
- `--violet`: `#af8cff`, inferred analysis and gatto accents.

Class accents currently map to animal categories:

- cane: mint.
- cavallo: amber.
- elefante: cyan.
- farfalla: rose.
- gallina: warm ink.
- gatto: violet.
- mucca: green.
- pecora: cream.
- ragno: pink.
- scoiattolo: brown.

Design guidance:

- Keep color semantic. Acid green is primary action and final improvement, not generic decoration.
- Keep measured data in cyan or mint, inferred AI interpretation in violet, warnings in amber, errors in rose.
- Future token work should convert the palette to OKLCH while preserving the same roles.
- Avoid adding more accents unless they represent a new state or provider role.

## Typography

Current implementation uses `PixelCode` via `/fonts/PixelCode.woff2` and `/fonts/PixelCode-Bold.woff2`, with `Courier New` and monospace fallbacks.

Typography behavior:

- Product labels are mostly uppercase, compact, and muted.
- Hero headline uses a very large clamp scale for demo impact.
- Metric values use oversized numeric type for scannability.
- Tables and event logs use dense monospace-style rows.
- Component modules use smaller `rem` scales and sometimes feel more conventional than the global pixel shell.

Design guidance:

- Keep the pixel type for this hackathon identity, but avoid using it as an excuse for unclear labels.
- Use short headings and direct panel titles.
- Keep body copy under 75 characters per line where it reads as prose.
- Keep data tables dense, but ensure table labels are plain and unambiguous.

## Layout System

The current shell uses predictable product-dashboard structure:

- `page-shell`: centered max width of `1440px` with compact padding.
- `topbar`: sticky desktop header with brand, section links, and status pill.
- `hero-grid`: two-column hero with controls on the left and dataset preview on the right.
- `dashboard-band`: pipeline and event-log workspace.
- `metric-strip`: four equal metric tiles.
- `split-section`: quality report and distribution chart side by side.
- `synthetic-section`: auxiliary telemetry plus job-card grid.
- `explorer-section`: filter controls and horizontal table.

Responsive behavior:

- Below `1180px`, hero, split, and pipeline layouts collapse to one column.
- Below `860px`, topbar becomes stacked, pixel preview becomes two columns, and grids become single column.
- Below `560px`, action buttons, explorer controls, and export actions become full width.

Design guidance:

- Preserve the control-room flow: hero controls, live pipeline, metrics, quality proof, generation jobs, explorer, export.
- Do not add nested card grids unless the user needs comparison at that level.
- Keep tables horizontally scrollable rather than crushing columns on mobile.

## Components

Primary components currently visible or implemented:

- Brand mark: boxed `DF` pixel mark with acid border and offset shadow.
- Status pill: idle, running, and complete state with LED indicator.
- Training intent console: labeled textarea plus mock upload dropzone.
- Buttons: acid primary, cyan secondary, neutral ghost.
- Pipeline nodes: numbered stage cards with queued, running, complete, and error states.
- Event log: timestamped Convex-style stream.
- Metric tile: large score, compact label, and supporting note.
- Report cards: measured and inferred columns.
- Distribution chart: paired horizontal bars for source and augmented counts.
- Job card: synthetic mosaic, prompt, current count, target count, added count.
- Explorer table: filters, source pills, status tags, and overflow handling.
- Feature modules: label audit, duplicate review, quality report panel, balancing panel, dataset explorer, and export manifest button.

Component vocabulary guidance:

- Use the same button shapes and focus treatment across new modules.
- Keep provider source labels visible in metric-heavy components.
- Empty states should explain the next action, not just say there is no data.
- Disabled controls should stay readable but clearly inactive.
- Review actions should distinguish approve, reject, manual review, remove duplicate, and keep both.

## Motion And Feedback

Current motion is mostly functional:

- Running status LED blinks with a stepped animation.
- Button hover translates by one pixel.
- Bar-chart widths transition over `600ms` using steps.
- Pipeline progress is simulated by deterministic delays in the demo app.

Design guidance:

- Keep motion tied to state changes: running, complete, export ready, fallback active.
- Avoid page-load choreography.
- Avoid layout property animation in new work.
- Prefer short transitions around `150ms` to `250ms` for product interactions.

## Elevation And Surfaces

Global surfaces use one-pixel borders, dark gradients, `8px` radius, and large soft shadows. The shell includes scanline and grid effects to create the control-room feel.

Current surface pattern:

- Main panels use `border: 1px solid var(--line)`.
- Raised panels use dark vertical gradients.
- Primary hero and dashboard cards use `box-shadow: 0 24px 70px var(--shadow)`.
- Focus states use a cyan outline with offset.

Design guidance:

- Keep elevation subtle and structural. Do not add glass effects for decoration.
- Prefer full borders, tinted backgrounds, chips, and icons over side-stripe accents.
- The existing module CSS includes some side accents. New work should avoid expanding that pattern.

## Known Design Debt

- The main shell uses global pixel-console styling, while some feature CSS modules use softer rounded cards and local `--df-*` rgba tokens.
- Some implemented feature modules are represented in the current app shell by integration-slot placeholders rather than the full components.
- The current global palette is hex-based, not OKLCH.
- Synthetic generation is highly visible in the current shell, while the product strategy says label repair and dataset quality should remain the core story.
- Some existing comments and copy use punctuation and symbols that should be simplified in future polish passes.

## Do

- Keep DataForge dense, operational, and evidence-first.
- Keep measured and inferred sections visually distinct.
- Make the before and after quality delta the climax of the page.
- Keep provider boundaries visible in copy and badges.
- Preserve provenance labels in tables, reports, and exports.

## Do Not

- Do not turn the product into a chatbot.
- Do not imply model accuracy improved unless training and evaluation exist.
- Do not imply Adaption Labs inspected raw image pixels in this MVP.
- Do not make synthetic image generation the whole product story.
- Do not add decorative gradients, glass panels, or extra accent colors without a product state reason.
