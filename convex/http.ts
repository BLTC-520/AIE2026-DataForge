import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
// Convex Document IDs: https://docs.convex.dev/using/document-ids
import type { Id } from "./_generated/dataModel";

// Convex HTTP actions: https://docs.convex.dev/functions/http-actions
// Storage upload URLs: https://docs.convex.dev/api/interfaces/server.StorageWriter#generateuploadurl

const http = httpRouter();

http.route({
  path: "/generateUploadUrl",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return new Response(JSON.stringify({ uploadUrl }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
});

http.route({
  path: "/getImageUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let storageId: string | null = null;

    try {
      const body = await request.json();
      storageId = typeof body?.storageId === "string" ? body.storageId : null;
    } catch {
      storageId = null;
    }

    if (!storageId) {
      return new Response(JSON.stringify({ error: "storageId is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const url = await ctx.storage.getUrl(storageId as Id<"_storage">);
    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
});

export default http;

