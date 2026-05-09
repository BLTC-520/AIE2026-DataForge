// Fal synthetic generation — server-side only.
//
// Calls Fal (default model: fal-ai/flux/schnell) once per gap job, asking
// for `num_images` per call so the round-trip count stays small. There is
// NO demo fallback: if FAL_KEY is missing or Fal returns an error, the
// route surfaces it and the cockpit's generate stage shows the error.
//
// To keep the demo within `maxDuration` (180 s), each job is capped at
// `FAL_MAX_PER_JOB` images (default 4). Override via env if needed.

import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { z } from "zod";

export const runtime = "nodejs";
// Up from 180s — class-balancing runs can request hundreds of images per
// class; flux/schnell processes ~4 images / 2-3s, so 200 images ≈ 100-150s
// and we want headroom for retries / network jitter.
export const maxDuration = 300;

const gapJobSchema = z.object({
  className: z.string().min(2).max(48),
  currentCount: z.number().int().nonnegative(),
  targetCount: z.number().int().positive(),
  // Up from 80 — balancing flow may request the full deficit between a
  // class's current count and the dataset's max class count.
  syntheticCount: z.number().int().nonnegative().max(500),
  severity: z.enum(["low", "medium", "high"]),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  prompt: z.string().min(30).max(260),
});

const requestSchema = z.object({
  datasetName: z.string().min(1),
  gapJobs: z.array(gapJobSchema).min(1).max(16),
});

type GapJob = z.infer<typeof gapJobSchema>;

type FalImage = { url: string; width?: number; height?: number; content_type?: string };
type FalResult = { images?: FalImage[] };

type GeneratedJob = {
  className: string;
  prompt: string;
  requestedCount: number;
  generatedCount: number;
  images: Array<{ url: string; width?: number; height?: number; contentType?: string }>;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "FAL_KEY is not configured.",
        hint:
          "Set FAL_KEY in .env.local and restart the dev server. The generate stage requires a real Fal call — there is no demo fallback.",
      },
      { status: 500 },
    );
  }

  const model = process.env.FAL_MODEL || "fal-ai/flux/schnell";
  // Logical per-job cap (how many images the user wants per gap job).
  // Raised to 500 so balancing runs can request the full deficit.
  // Settable via FAL_MAX_PER_JOB.
  const perJobCap = clampInt(process.env.FAL_MAX_PER_JOB, 500, 1, 500);
  // Floor: even if GPT requested syntheticCount=1, generate at least this
  // many images so the user can see the variation Fal produces.
  const perJobFloor = clampInt(process.env.FAL_MIN_PER_JOB, 3, 1, perJobCap);
  // Hard per-CALL limit imposed by Fal. flux/schnell caps num_images at 4
  // (Unprocessable Entity 422 if exceeded). If perJobCap > PER_CALL_MAX,
  // we do multiple sequential calls until the per-job target is reached.
  const PER_CALL_MAX = 4;
  // Safety counter on the multi-call loop. perJobCap (500) / PER_CALL_MAX (4)
  // = 125 max iterations; bump to 150 for headroom against transient errors.
  const MAX_ITERATIONS = 150;

  fal.config({ credentials: apiKey });

  const generated: GeneratedJob[] = [];
  try {
    for (const job of parsed.data.gapJobs) {
      // Per-job target: at least floor, at most cap, biased toward GPT's recommendation.
      const target = Math.max(
        perJobFloor,
        Math.min(job.syntheticCount, perJobCap),
      );
      // Defensive prompt suffix — even if GPT's prompt sneaks in a
      // grid-implying word, append explicit single-photo instructions so
      // FLUX/schnell renders one subject per image instead of a collage.
      const safeSuffix =
        ", single photo, one subject, photorealistic, 4k, no grid, no collage, no panels, no text, no watermark";
      const prompt = job.prompt.includes("single photo")
        ? job.prompt
        : `${job.prompt.replace(/[.!?\s]+$/, "")}${safeSuffix}`;

      // Sequential Fal calls, each ≤ PER_CALL_MAX images, until target reached.
      const collected: FalImage[] = [];
      let remaining = target;
      let safetyCounter = 0;
      while (remaining > 0 && safetyCounter < MAX_ITERATIONS) {
        const numImages = Math.min(remaining, PER_CALL_MAX);
        const result = await fal.subscribe(model, {
          input: {
            prompt,
            num_images: numImages,
            image_size: "square_hd",
            enable_safety_checker: true,
          },
          logs: false,
        });
        const data = (result as { data?: FalResult }).data ?? (result as FalResult);
        const got = data.images ?? [];
        if (got.length === 0) break; // Fal returned nothing — bail to avoid infinite loop
        for (const img of got) collected.push(img);
        remaining -= got.length;
        safetyCounter++;
      }

      generated.push({
        className: job.className,
        prompt: job.prompt,
        requestedCount: job.syntheticCount,
        generatedCount: collected.length,
        images: collected.map((image) => ({
          url: image.url,
          width: image.width,
          height: image.height,
          contentType: image.content_type,
        })),
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fal request failed.";
    // Fal's SDK sometimes wraps validation errors in a `body` field. Pull
    // anything informative out of the error so the cockpit banner shows
    // the real cause (model unavailable, validation, rate limit, etc.).
    const body = (error as { body?: unknown })?.body;
    const detail =
      body && typeof body === "object"
        ? JSON.stringify(body)
        : typeof body === "string"
          ? body
          : null;
    console.error("Fal generation failed", error);
    return NextResponse.json(
      {
        error: `Fal generation failed: ${message}${detail ? ` — ${detail}` : ""}`,
        message,
        detail,
        hint:
          "Check that FAL_KEY is valid and that FAL_MODEL (default fal-ai/flux/schnell) is available. If the failure mentions safety or content policy, the GPT-authored prompt may need adjustment. Restart the dev server if the key just changed.",
        partialJobs: generated.map((job) => ({
          className: job.className,
          generatedCount: job.generatedCount,
        })),
      },
      { status: 502 },
    );
  }

  const totalImages = generated.reduce((sum, job) => sum + job.generatedCount, 0);
  return NextResponse.json({
    provider: "fal",
    model,
    datasetName: parsed.data.datasetName,
    perJobCap,
    totalImages,
    jobs: generated,
  });
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
