// GPT-driven manifest-level evaluation. Server-side only.
//
// Adaption Labs has been removed. This route replaces it with OpenAI's
// Responses API (same OPENAI_API_KEY as /api/quality-report). GPT receives
// the manifest summary (class distribution + sample count + missing-label
// count) and returns balance / completeness / quality scores plus a short
// reasoning paragraph.
//
// Behavior:
//   - 500 with explicit hint when OPENAI_API_KEY is missing.
//   - 502 with explicit hint when the GPT call fails or returns invalid output.
//   - 200 with an AdaptionEvaluationSnapshot-shaped payload on success.
//
// There is intentionally NO demo fallback. The cockpit needs the failure
// to surface so the user can fix the missing key.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const sampleSchema = z.object({
  id: z.string(),
  sampleKey: z.string(),
  imageUrl: z.string().optional(),
  source: z.enum(["original", "synthetic", "external"]),
  provider: z.string().optional(),
  prompt: z.string().optional(),
  originalLabel: z.string().optional(),
  currentLabel: z.string().optional(),
  finalLabel: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const requestSchema = z.object({
  datasetName: z.string().min(1),
  version: z.enum(["baseline", "labelized", "balanced", "augmented"]),
  samples: z.array(sampleSchema).min(1).max(5000),
  classDistribution: z.record(z.string(), z.number().int().nonnegative()),
});

// What we ask GPT to return. Four 0-100 scores + a short reasoning string.
const evaluationSchema = z.object({
  qualityScore: z.number().min(0).max(100),
  balanceScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  consistencyScore: z.number().min(0).max(100),
  reasoning: z
    .string()
    .min(40)
    .max(600)
    .describe(
      "1–3 sentences explaining the scores. Reference specific class counts where helpful.",
    ),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured.",
        hint:
          "Set OPENAI_API_KEY in .env.local and restart the dev server. The evaluate / re-evaluate stages use GPT for class-balance reasoning — there is no demo fallback.",
      },
      { status: 500 },
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const sampleCount = parsed.data.samples.length;
  const missingLabelCount = parsed.data.samples.filter(
    (s) => !s.finalLabel && !s.currentLabel && !s.originalLabel,
  ).length;
  const classCount = Object.keys(parsed.data.classDistribution).length;
  const counts = Object.values(parsed.data.classDistribution);
  const minCount = counts.length ? Math.min(...counts) : 0;
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const totalLabeled = counts.reduce((sum, n) => sum + n, 0);

  try {
    const client = new OpenAI({ apiKey, timeout: 30000 });
    const response = await client.responses.parse({
      model,
      instructions: [
        "You are DataForge's dataset quality evaluator.",
        "Score the dataset on four 0-100 dimensions. The PRIMARY signal is class balance.",
        "Definitions (apply strictly):",
        "- balanceScore: how evenly distributed the per-class counts are. A perfectly even distribution scores 100. A single class dominating (max >> min) approaches 0. Use coefficient-of-variation reasoning.",
        "- completenessScore: 100 × (sampleCount − missingLabelCount) / sampleCount. Missing labels lower this proportionally.",
        "- qualityScore: an honest composite. Typically the average of balanceScore and completenessScore, adjusted slightly down if there are few classes (<3) or extreme outliers.",
        "- consistencyScore: how stable the labeling looks structurally. Without per-sample confidence, derive from regularity of class counts (smooth distribution = high; spiky = lower).",
        "Be deterministic and grounded — quote class counts in the reasoning when they motivate a low score.",
        "Do not invent classes that are not in the input.",
        "Return ONLY the structured output requested by the schema.",
      ].join("\n"),
      input: JSON.stringify(
        {
          datasetName: parsed.data.datasetName,
          version: parsed.data.version,
          sampleCount,
          classCount,
          missingLabelCount,
          totalLabeled,
          minClassCount: minCount,
          maxClassCount: maxCount,
          classDistribution: parsed.data.classDistribution,
        },
        null,
        2,
      ),
      text: {
        format: zodTextFormat(evaluationSchema, "dataforge_evaluation"),
        // verbosity intentionally omitted — gpt-4o only supports "medium",
        // older models accept "low". Letting it default works across both.
      },
    });

    const evaluation = evaluationSchema.parse(response.output_parsed);

    // Convert to the AdaptionEvaluationSnapshot shape the rest of the app
    // expects. Provider tag is "gpt-evaluator" so the QualityReportPanel
    // can render an honest source label.
    return NextResponse.json({
      id: `eval-${parsed.data.version}-${slug(parsed.data.datasetName)}`,
      version: parsed.data.version,
      provider: "gpt-evaluator",
      qualityScore: evaluation.qualityScore,
      balanceScore: evaluation.balanceScore,
      completenessScore: evaluation.completenessScore,
      consistencyScore: evaluation.consistencyScore,
      classDistribution: parsed.data.classDistribution,
      rawMetrics: {
        reasoning: evaluation.reasoning,
        model,
        responseId: response.id,
        sampleCount,
        missingLabelCount,
        classCount,
      },
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error("GPT dataset evaluation failed", error);
    const message =
      error instanceof Error ? error.message : "GPT evaluation failed.";
    // Fold the upstream error into `error` so the cockpit banner shows the
    // real reason (auth, model, schema, network) instead of a generic label.
    return NextResponse.json(
      {
        error: `GPT dataset evaluation failed: ${message}`,
        message,
        hint:
          "Check that OPENAI_API_KEY is valid and that OPENAI_MODEL (defaulted to gpt-4o) supports the Responses API with structured output. If the key just changed, restart the dev server.",
      },
      { status: 502 },
    );
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
