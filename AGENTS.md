# AI Coding Rules & Architectural Boundaries

# Deterministic Coder

## STRICT DOCUMENTATION ADHERENCE
When reading and applying documentation (whether provided in the prompt or searched online), you must act as a STRICT parser. Do not "freestyle," optimize, or reformat documented boilerplate.

1. EXACT ORDERING: You must preserve the literal top-to-bottom order of imports, object keys, and configuration properties exactly as they appear in the docs. Do not alphabetize or rearrange them. 
2. EXACT NAMING & PATHS: You must use the literal names for directories, files, variables, and properties provided in the documentation. Do NOT substitute words with synonyms.
3. NO UNPROMPTED ABSTRACTIONS: Treat documentation snippets as rigid templates. Copy the structure 1:1 unless my specific project constraints explicitly force a change.

## CODE COMMENTS
No Procedural Commenting: Never use numbered steps, phases, or hierarchical labels (e.g., // 1., // Step 1.1, // Phase 3).

## CODE PROVENANCE & ANNOTATION
You must annotate the origin of all incorporated code using single-line comments, in addition to any existing comments. Use descriptive labels and maintain contextual placement (inline vs. block). Do not cite local repository files, local project docs, section numbers, or workspace-only paths as provenance sources.

1. GENERATED VIA COMMAND: Add a comment with the exact command.
   ```typescript
   // npx @better-auth/cli generate --output src/db/schema.ts
   export const user = pgTable("user", { /* ... */ });
   ```

2. COPIED FROM DOCUMENTATION: Use specific labels (e.g., "Integration Guide:", "API Reference:") and place URLs contextually. If a URL refers to a specific property, use an inline comment.
   ```typescript
   // Fastify Integration: https://better-auth.com/docs/integrations/fastify
   const fastify = Fastify({ 
     logger: true,
     trustProxy: true // Reference: https://fastify.dev/docs/latest/Reference/Server/#trustproxy
   });
   ```

NOTE: if you know that the code was from documentation but you do not know the exact URL, then leave a note: eg `// TODO: add url for <name of the feature>` eg `// TODO: add url for fastify trust proxy`

### Normal Comments & Docstrings
For code comments and docstrings:
- keep them concise
- use lowercase where natural
- avoid filler

Prefer:
```js
// helper func to get playwright toolsets for dynamic usage & validation
// save records from linked list to db
````

Avoid:

```js
// Helper function to get the playwright toolsets for dynamic usage and validation
// Saves all records from the linked list to the database file
```

## PLAN UPDATES
Whenever you modify files or complete steps outlined in `@PLAN.md`, you MUST use your edit tool to mark those steps as completed (`[x]`) in `@PLAN.md`, or add new steps if you performed work outside the original plan. You must commit and push updates to `PLAN.md` immediately.

## JUST-IN-TIME SKILLS & MCP USAGE
Actively discover and invoke specialized capabilities when solving tasks. Do not simulate these tools; invoke them directly. To prevent context poisoning, DO NOT load tools upfront. Discover and invoke skills/MCPs *only* at the exact step their capabilities are required.

1. DISCOVERY:
   - Local skills: Run `skills ls`
   - Global skills: Run `skills ls -g`
   - Available MCPs: Read `~/.config/opencode/opencode.jsonc`

2. ACTIVATION (Syntax must be exact):
   - To use a skill, output: `use <name>` skill (e.g., `use docker-expert` skill)
   - To use an MCP, output: `use <name>` MCP (e.g., `use playwright` MCP)

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
