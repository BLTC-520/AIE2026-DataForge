import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export const runtime = "nodejs";

const metricsSchema = z.object({
  quality: z.number(),
  balance: z.number(),
  coverage: z.number(),
  consistency: z.number(),
});

const requestSchema = z.object({
  trainingIntent: z.string().min(10),
  classDistribution: z.record(z.string(), z.number().int().nonnegative()),
  baselineMetrics: metricsSchema,
  scenarioGaps: z.array(z.string()).default([]),
});

const gapJobSchema = z.object({
  className: z.string().min(2).max(48),
  currentCount: z.number().int().nonnegative(),
  targetCount: z.number().int().positive(),
  // Raised to 500 — client-side balancing flow may override syntheticCount
  // to the full deficit between a class and the dataset's max class count.
  syntheticCount: z.number().int().nonnegative().max(500),
  severity: z.enum(["low", "medium", "high"]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  prompt: z.string().min(30).max(260),
});

const qualityReportSchema = z.object({
  measuredFindings: z.array(z.string().min(20).max(180)).min(3).max(5),
  repairPlan: z.array(z.string().min(20).max(190)).min(3).max(5),
  completionSummary: z.array(z.string().min(20).max(190)).min(3).max(5),
  nextSteps: z.array(z.string().min(20).max(190)).min(3).max(5),
  gapJobs: z.array(gapJobSchema).min(1).max(5),
});

type QualityReportRequest = z.infer<typeof requestSchema>;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid quality-report request payload.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  // Default to a real, currently-available OpenAI model. The previous default
  // ("gpt-5.5") is not a valid model ID and made every analyze run fail at
  // the OpenAI call. Override with OPENAI_MODEL in .env.local.
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  if (!apiKey) {
    // No fallback. The cockpit needs to surface this so the user can fix it.
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured.",
        hint:
          "Set OPENAI_API_KEY in .env.local and restart the dev server. The analyze stage requires a real GPT call — there is no demo fallback.",
      },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey, timeout: 30000 });
    const response = await client.responses.parse({
      model,
      instructions: [
        "You are DataForge's dataset quality analyst.",
        "Generate a concise structured repair report for an image-classification dataset.",
        "Use only the supplied metrics as measured facts. Do not fabricate new objective scores.",
        "Tie every synthetic generation job to a measured class, count, or scenario gap.",
        "Synthetic prompts must produce a SINGLE photorealistic photograph of ONE subject in ONE scene.",
        "Each prompt MUST avoid words that imply multiple framings or grid output: do NOT use 'collection', 'set of', 'series', 'multiple', 'various', 'examples of', 'grid', 'panels', 'composite', 'collage', 'mosaic', 'side by side', 'multiple poses', 'different angles'.",
        "Each prompt MUST specify ONE concrete pose, ONE camera angle, and ONE lighting condition (e.g. 'standing in profile, side view, golden-hour daylight').",
        "Each prompt MUST end with the literal string ', single photo, no text, no watermark'.",
        "Return only the structured output requested by the schema.",
      ].join("\n"),
      input: JSON.stringify(buildModelInput(parsedRequest.data), null, 2),
      text: {
        format: zodTextFormat(qualityReportSchema, "dataforge_quality_report"),
        // verbosity intentionally omitted — gpt-4o only supports "medium",
        // older models accept "low". Letting it default works across both.
      },
    });

    const report = qualityReportSchema.parse(response.output_parsed);

    return NextResponse.json({
      ...report,
      provider: "openai",
      model,
      responseId: response.id,
    });
  } catch (error) {
    console.error("OpenAI quality report failed", error);
    const message =
      error instanceof Error ? error.message : "OpenAI request failed.";
    return NextResponse.json(
      {
        error: `OpenAI quality report failed: ${message}`,
        message,
        hint:
          "Check that OPENAI_API_KEY is valid and that OPENAI_MODEL (defaulted to gpt-4o) supports the Responses API with structured output.",
      },
      { status: 502 },
    );
  }
}

function buildModelInput(input: QualityReportRequest) {
  return {
    product: "DataForge",
    task: "Image classification dataset repair planning",
    trainingIntent: input.trainingIntent,
    classDistribution: input.classDistribution,
    baselineMetrics: input.baselineMetrics,
    scenarioGaps: input.scenarioGaps,
    rules: [
      "The report should distinguish measured evidence from GPT interpretation.",
      "Recommend synthetic samples only for weak classes or missing scenarios.",
      "Use existing class names exactly when possible.",
      "Keep the demo credible: no accuracy claims, no model-training claims.",
    ],
  };
}
