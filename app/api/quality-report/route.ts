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
  syntheticCount: z.number().int().nonnegative().max(80),
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

type QualityReport = z.infer<typeof qualityReportSchema>;
type QualityReportRequest = z.infer<typeof requestSchema>;

const fallbackReport: QualityReport = {
  measuredFindings: [
    "Class distribution is skewed: cats 120, dogs 100, foxes 15, owls 10.",
    "Coverage score is 35 because low-light wildlife records are almost absent.",
    "Consistency remains strong at 88, so repair should focus on coverage rather than relabeling.",
  ],
  repairPlan: [
    "Generate 45 fox records across woodland and suburban edge conditions.",
    "Generate 40 owl records with perched, flight, frontal, and side-angle compositions.",
    "Generate 30 low-light wildlife records with infrared glare and plausible motion blur.",
  ],
  completionSummary: [
    "Post-repair quality increased to 84 after targeted synthetic records were added.",
    "Balance improved to 78 with foxes and owls lifted near the minimum target count.",
    "Coverage improved to 81 after adding low-light camera-trap scenarios.",
  ],
  nextSteps: [
    "Keep synthetic records flagged in the manifest for downstream filtering.",
    "Review remaining pet-to-wildlife imbalance before a larger training run.",
    "Export the augmented dataset with both evaluation snapshots as proof of improvement.",
  ],
  gapJobs: [
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
  ],
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        ...fallbackReport,
        provider: "demo-openai",
        model: "fallback",
        fallbackReason: "Invalid quality-report request payload.",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  if (!apiKey) {
    return NextResponse.json({
      ...fallbackReport,
      provider: "demo-openai",
      model: "fallback",
      fallbackReason: "OPENAI_API_KEY is not configured.",
    });
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
        "Synthetic prompts must be practical Fal image prompts: no text overlays, no watermarks, plausible visual diversity.",
        "Return only the structured output requested by the schema.",
      ].join("\n"),
      input: JSON.stringify(buildModelInput(parsedRequest.data), null, 2),
      text: {
        format: zodTextFormat(qualityReportSchema, "dataforge_quality_report"),
        verbosity: "low",
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

    return NextResponse.json({
      ...fallbackReport,
      provider: "demo-openai",
      model: "fallback",
      fallbackReason:
        error instanceof Error ? `OpenAI request failed: ${error.message}` : "OpenAI request failed.",
    });
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
