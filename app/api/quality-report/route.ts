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
  syntheticCount: z.number().int().nonnegative().max(100),
  severity: z.enum(["low", "medium", "high"]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  prompt: z.string().min(30).max(260),
});

const qualityReportSchema = z.object({
  measuredFindings: z.array(z.string().min(20).max(180)).min(3).max(5),
  repairPlan: z.array(z.string().min(20).max(190)).min(3).max(5),
  completionSummary: z.array(z.string().min(20).max(190)).min(3).max(5),
  nextSteps: z.array(z.string().min(20).max(190)).min(3).max(5),
  gapJobs: z.array(gapJobSchema).min(1).max(10),
});

type QualityReport = z.infer<typeof qualityReportSchema>;
type QualityReportRequest = z.infer<typeof requestSchema>;

const fallbackReport: QualityReport = {
  measuredFindings: [
    "Class distribution is skewed: cane 100, cavallo 90, elefante 80, farfalla 70, gallina 60, gatto 50, mucca 40, pecora 30, ragno 25, scoiattolo 20.",
    "Completeness score is 74 because 22 records are unlabeled and minority animal classes are sparse.",
    "Consistency is 82 after seeded cross-class mislabels and duplicate bursts are counted.",
  ],
  repairPlan: [
    "Recover cached Fal AI samples only until each class reaches the 100-image majority cap.",
    "Apply reviewer-approved missing labels and relabels before balancing metrics are recomputed.",
    "Remove duplicate export entries while preserving duplicate provenance in the manifest.",
  ],
  completionSummary: [
    "Post-repair quality increased to 84 after label fixes, dedupe, and bounded Fal AI recovery.",
    "Balance improved to 78 with each animal capped at exactly 100 total images.",
    "Completeness improved to 96 after missing labels were added and minority class gaps were filled.",
  ],
  nextSteps: [
    "Keep synthetic records flagged in the manifest for downstream filtering.",
    "Review remaining pet-to-wildlife imbalance before a larger training run.",
    "Export the augmented dataset with both evaluation snapshots as proof of improvement.",
  ],
  gapJobs: [
    {
      className: "cavallo",
      currentCount: 90,
      targetCount: 100,
      syntheticCount: 10,
      severity: "medium",
      accent: "#ffbc42",
      prompt:
        "Photorealistic cavallo records for bounded class balancing, varied pasture poses, no text, no watermark.",
    },
    {
      className: "elefante",
      currentCount: 80,
      targetCount: 100,
      syntheticCount: 20,
      severity: "high",
      accent: "#52d6ff",
      prompt:
        "Photorealistic elefante records across herd, savanna, and portrait contexts, no text, no watermark.",
    },
    {
      className: "farfalla",
      currentCount: 70,
      targetCount: 100,
      syntheticCount: 30,
      severity: "high",
      accent: "#ff5d7d",
      prompt:
        "Photorealistic farfalla records with varied wing poses, flowers, and macro detail, no text, no watermark.",
    },
    {
      className: "gallina",
      currentCount: 60,
      targetCount: 100,
      syntheticCount: 40,
      severity: "high",
      accent: "#f2f0dc",
      prompt:
        "Photorealistic gallina records in farmyard and coop scenes, varied side and frontal angles, no overlays.",
    },
    {
      className: "gatto",
      currentCount: 50,
      targetCount: 100,
      syntheticCount: 50,
      severity: "high",
      accent: "#af8cff",
      prompt:
        "Photorealistic gatto records across indoor and outdoor contexts, clean class framing, no text, no watermark.",
    },
    {
      className: "mucca",
      currentCount: 40,
      targetCount: 100,
      syntheticCount: 60,
      severity: "high",
      accent: "#8fd17f",
      prompt:
        "Photorealistic mucca records in pasture and dairy contexts, varied poses, no text, no watermark.",
    },
    {
      className: "pecora",
      currentCount: 30,
      targetCount: 100,
      syntheticCount: 70,
      severity: "high",
      accent: "#ffe2a8",
      prompt:
        "Photorealistic pecora records with flock, wool, and pasture variety, clean labels, no text, no watermark.",
    },
    {
      className: "ragno",
      currentCount: 25,
      targetCount: 100,
      syntheticCount: 75,
      severity: "high",
      accent: "#f06c9b",
      prompt:
        "Photorealistic ragno macro records with web detail and varied backgrounds, no text, no watermark.",
    },
    {
      className: "scoiattolo",
      currentCount: 20,
      targetCount: 100,
      syntheticCount: 80,
      severity: "high",
      accent: "#d99a52",
      prompt:
        "Photorealistic scoiattolo records across tree, forest floor, and foraging contexts, no text, no watermark.",
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
      ...boundReportToMajorityCap(fallbackReport, parsedRequest.data),
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

    const report = boundReportToMajorityCap(
      qualityReportSchema.parse(response.output_parsed),
      parsedRequest.data,
    );

    return NextResponse.json({
      ...report,
      provider: "openai",
      model,
      responseId: response.id,
    });
  } catch (error) {
    console.error("OpenAI quality report failed", error);

    return NextResponse.json({
      ...boundReportToMajorityCap(fallbackReport, parsedRequest.data),
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
      "No synthetic generation job may set a target count above the current majority-class count.",
      "Keep the demo credible: no accuracy claims, no model-training claims.",
    ],
  };
}

function boundReportToMajorityCap(
  report: QualityReport,
  input: QualityReportRequest,
): QualityReport {
  const majorityClassCap = getMajorityClassCap(input.classDistribution);

  if (majorityClassCap <= 0) {
    return report;
  }

  const boundedGapJobs = report.gapJobs.map((job) => {
    const currentCount = input.classDistribution[job.className] ?? job.currentCount;
    const targetCount = Math.min(majorityClassCap, Math.max(currentCount, job.targetCount));
    const syntheticCount = Math.min(job.syntheticCount, Math.max(0, targetCount - currentCount));

    return {
      ...job,
      currentCount,
      targetCount,
      syntheticCount,
    };
  });

  return {
    ...report,
    gapJobs: boundedGapJobs,
  };
}

function getMajorityClassCap(distribution: Record<string, number>) {
  const counts = Object.entries(distribution)
    .filter(([className]) => className !== "Unlabeled")
    .map(([, count]) => count);

  return counts.length ? Math.max(...counts) : 0;
}
