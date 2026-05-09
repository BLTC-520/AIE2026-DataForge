---
name: ai-sdk-6
description: >
  Vercel AI SDK 6 implementation patterns.
  Trigger: When building AI applications, generating structured output, configuring tools, utilizing MCP, or creating agents with the Vercel AI SDK (v6+).
license: Apache-2.0
metadata:
  version: "6.x"
  auto_invoke: "Using Vercel AI SDK, generating AI text/objects, tool calling, or building AI agents"
---

# Vercel AI SDK 6 Skill Reference

## Breaking Changes & Migration from v5

**Crucial:** Do not use `generateObject`, `streamObject`, `CoreMessage`, or `Experimental_Agent`. They are deprecated or removed in v6.

```typescript
// ❌ AI SDK 5 (OLD)
import { generateObject, convertToCoreMessages, Experimental_Agent, textEmbeddingModel } from "ai";

const messages = convertToCoreMessages(uiMessages); // Sync
const model = openai.textEmbeddingModel('text-embedding-3-small');
const agent = new Experimental_Agent({ system: "..." });
const result = await generateObject({ schema: z.object(...) });

// ✅ AI SDK 6 (NEW)
import { generateText, streamText, Output, convertToModelMessages, ToolLoopAgent } from "ai";

const messages = await convertToModelMessages(uiMessages); // MUST BE ASYNC
const model = openai.embeddingModel('text-embedding-3-small'); // Renamed
const agent = new ToolLoopAgent({ instructions: "..." }); // 'system' -> 'instructions'
const result = await generateText({ output: Output.object({ schema: z.object(...) }) });
```

## 1. Structured Outputs (Replaces `generateObject`)

AI SDK 6 unifies text and object generation under `generateText` and `streamText` using the `Output` utility.

```typescript
import { generateText, streamText, Output } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

// Generating an Object
const { output } = await generateText({
  model: openai("gpt-4o"),
  prompt: "Generate a lasagna recipe.",
  output: Output.object({
    schema: z.object({
      name: z.string(),
      ingredients: z.array(z.object({ name: z.string(), amount: z.string() })),
    }),
  }),
});

// Output types available:
// Output.object() - Structured objects
// Output.array() - Arrays of structured objects
// Output.choice() - Select from specific options
// Output.json() - Unstructured JSON
// Output.text() - Plain text (default)
```

## 2. Agents (`ToolLoopAgent`)

`ToolLoopAgent` provides a production-ready loop that handles prompt execution, tool calls, and results (up to 20 steps by default).

```typescript
import { ToolLoopAgent } from "ai";
import { z } from "zod";
import { weatherTool } from "@/tools/weather";

const supportAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: "You are a helpful customer support agent.", // Use 'instructions', NOT 'system'
  tools: { weather: weatherTool },
  
  // Optional: Type-safe runtime arguments injected per-call
  callOptionsSchema: z.object({ userId: z.string() }),
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: `${settings.instructions}\nUser ID: ${options.userId}`,
  }),
});

// Calling the agent
const result = await supportAgent.generate({
  prompt: "What is the weather like?",
  options: { userId: "user_123" } // Enforced by callOptionsSchema
});
```

## 3. Tool Definition Improvements

Tools in AI SDK 6 feature granular strict mode, human-in-the-loop approval, input examples, and separated model output.

```typescript
import { tool } from "ai";
import { z } from "zod";

export const executeCommand = tool({
  description: "Run a shell command",
  inputSchema: z.object({ command: z.string() }),
  
  // 1. Strict Mode (Opt-in per tool)
  strict: true, 
  
  // 2. Input Examples (Guides the LLM)
  inputExamples:[{ input: { command: "ls -la" } }],
  
  // 3. Human Approval (Returns 'approval-requested' state to UI)
  // Can be a boolean or an async function evaluating the input
  needsApproval: async ({ command }) => command.includes("rm -rf"),
  
  execute: async ({ command }) => {
    return { status: "success", rawOutput: "..." };
  },
  
  // 4. toModelOutput: Control exactly what tokens go back to the model
  // Note: Param is destructured { input, output, toolCallId } in v6
  toModelOutput: async ({ input, output }) => {
    return {
      type: "text",
      value: `Command ${input.command} executed. Status: ${output.status}`
    };
  },
});
```

## 4. Reranking (New API)

AI SDK 6 introduces native `rerank` for reordering search results to pass highly relevant context to models.

```typescript
import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

const { rerankedDocuments } = await rerank({
  model: cohere.reranking("rerank-v3.5"),
  documents:[
    { id: 1, text: "Oracle pricing: $5000/month" },
    { id: 2, text: "Unrelated document" }
  ],
  query: "Which pricing did we get from Oracle?",
  topN: 1,
});
```

## 5. Model Context Protocol (MCP)

Stable integration for consuming MCP servers using `@ai-sdk/mcp`.

```typescript
import { createMCPClient, auth } from "@ai-sdk/mcp";

// HTTP Transport with Auth
const mcpClient = await createMCPClient({
  transport: {
    type: "http",
    url: "https://your-server.com/mcp",
    headers: { Authorization: "Bearer token" },
  },
});

// Fetching capabilities
const tools = await mcpClient.tools();
const resources = await mcpClient.listResources();
const prompt = await mcpClient.experimental_getPrompt({ name: "review" });
```

## 6. Provider-Specific Features

*   **Anthropic:**
    *   Structured Output Mode configuration: `providerOptions: { anthropic: { structuredOutputMode: 'outputFormat' } }`.
    *   Native Provider Tools: `anthropic.tools.memory_20250818()`, `anthropic.tools.codeExecution_20250825()`.
    *   Pass `prepareStep: forwardAnthropicContainerIdFromLastStep` in `generateText` for stateful code execution.
*   **OpenAI:**
    *   `strictJsonSchema` is now **`true` by default**. Ensure Zod schemas avoid `undefined` (use `.nullable()` instead).
    *   Native Provider Tools: `openai.tools.shell()`, `openai.tools.applyPatch()`, `openai.tools.mcp()`.
*   **Azure:** Uses the **Responses API** by default when calling `azure()`. Use `azure.chat()` for older Chat Completions API. The provider metadata key is now `azure` instead of `openai`.
*   **Google Vertex:** Provider options and metadata now use the `vertex` key (instead of `google`).
*   **Image Editing:** `generateImage` (now stable) supports image-to-image editing: `prompt: { text: "...", images: ["url/base64"] }`.

## Common Gotchas & Best Practices

1.  **Async Message Conversion:** `convertToModelMessages(messages)` is now `await`able. If you don't `await` it, your UI API routes will crash.
2.  **`system` vs `instructions`:** `ToolLoopAgent` requires `instructions`, not `system`.
3.  **UI Tool Helpers:** `isToolUIPart` -> `isStaticToolUIPart` and `getToolName` -> `getStaticToolName`.
4.  **Finish Reasons:** The `unknown` finish reason is removed (now falls under `other`). Use `rawFinishReason` to view the exact provider string.
5.  **Logging:** AI SDK 6 introduces a warning logger. Disable it in production with `AI_SDK_LOG_WARNINGS=false` if it becomes noisy.
6.  **DevTools:** For debugging multi-step agents, wrap models with `devToolsMiddleware()` and run `npx @ai-sdk/devtools`.