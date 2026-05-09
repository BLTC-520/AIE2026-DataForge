# AI Engineer Hackathon Sponsor Capability Guide

Updated: 2026-05-08

Event source: https://luma.com/aie-hack?tk=EmDA1q

Research note: the Luma event page lists the prize and credit sponsors. Web search snippets for the same event also mention Mastra and Smithery as sponsors, so they are included to avoid missing likely event sponsors. 65labs and AI Engineer are included as event organizers/ecosystem partners, not as build-platform sponsors. Luma is the event platform, not a sponsor in the prize text.

## Sponsor Inventory

| Sponsor or platform | Event evidence | What they can do | Best hackathon use |
| --- | --- | --- | --- |
| OpenAI / GPT / Codex | Overall OpenAI API credits, OpenAI/Codex participant coupons, GPT-5.5 and GPT Image 2 track prizes | GPT-5.5 text/reasoning, structured output, tool calling, vision input, GPT Image 2 image generation/editing, realtime/audio APIs, Codex coding agent, Codex CLI/IDE/web, Codex SDK | Core intelligence, agent planning, code generation, image assets, evals, structured workflow orchestration |
| Cloudflare | Overall prize credits from $25k to $100k | Workers, Workers AI, AI Gateway, Agents SDK, Durable Objects, Vectorize, D1, KV, R2, Workflows, Browser Rendering, Sandbox SDK | Globally deployed agent backend, durable agent memory, AI Gateway observability/routing, RAG/vector search, realtime WebSocket agents |
| Google Gemini | Gemini credits for participants, Gen Media track, Voice Agent track | Gemini API, multimodal text/image/audio reasoning, Live API for voice/audio interaction, Veo video generation, Lyria music generation | Voice agents, multimodal assistants, generated videos/music, live conversational demos |
| Adaption Labs | Cash and credits track, participant credits | Public info describes adaptive AI systems that learn during use, adapt at inference time, use adaptive data/intelligence/interfaces, and aim to reduce prompt/fine-tuning overhead | If they provide hackathon access, build something that visibly improves with user interactions during the demo |
| Convex | Best use of Convex track | Reactive TypeScript backend, realtime database, queries/mutations/actions, file storage, auth, scheduled functions, vector search, AI Agent component | Realtime app state, collaborative dashboards, chat/agent logs, hackathon-safe backend without managing infra |
| Cursor | Best use of Cursor SDK track, Cursor Ultra prize | Cursor SDK public beta for programmatic coding agents in TypeScript, local/cloud agents, dedicated VMs, PR creation, model routing, MCP, skills, hooks, subagents, IDE/CLI/cloud agents | Agent that edits code, opens PRs, fixes tests, manages CI, or turns cards into working changes |
| Fal | Best use of Fal track, participant credits | Generative media platform with 1,000+ optimized models for image, video, audio, music, speech, 3D, streaming, plus serverless GPU endpoints | Fast visual/audio/video generation, model comparison, custom media workflows, wow-factor demos |
| Vercel | Participant credits with redemption code | AI Cloud for deploying apps, Next.js/functions, AI SDK, AI Gateway, agents, MCP servers, sandboxes, observability, preview deployments | Ship a polished web app fast, stream model output, create preview deployments for the judges |
| Daytona | Participant credits | Secure isolated sandboxes for AI-generated code, SDKs for Python/TypeScript/Ruby/Go/Java, process/code execution, filesystem/git tools, snapshots, PTY, VNC/SSH/preview | Run untrusted generated code, test agent-generated changes, provide reproducible workspaces |
| Hyperspell | Participant credits | Memory and context layer for AI agents, connects workspace accounts like Gmail/Slack/Notion, builds a context graph, retrieves structured results or LLM-ready summaries | Give an agent real user/company memory without building ingestion, embeddings, and retrieval yourself |
| ElevenLabs | Participant credits equivalent to Creator plan | Text to speech, speech to text, voice cloning, text to dialogue, conversational agents, sound effects, voice changer, voice isolation, dubbing, music, image/video generation/editing | Human-feeling voice layer, narrated demos, calls, multilingual dubbing, audio-first workflows |
| Mastra | Named by web search snippets for the event | TypeScript framework for AI agents, Studio UI, agent templates, framework integrations, customer assistants, data analysis agents, content automation, DevOps agents | Agent orchestration in TypeScript, tool/workflow structure, fast templates for a reliable agent app |
| Smithery | Named by web search snippets for the event | MCP platform/registry with thousands of tools, auth/credential/session handling, reusable connections, CLI/TypeScript usage, MCP publishing and observability | Add tools to agents quickly: Gmail, GitHub, Notion, Slack, web search, Google Sheets, Browserbase, etc. |
| 65labs / AI Engineer | Event organizer/ecosystem, AIE tickets in prizes | Community, event, AI Engineer Singapore pathway | Mention if relevant, but do not build around it as a technical sponsor |

## Platform Notes

### OpenAI / GPT / Codex

OpenAI is the strongest default model layer for this event because GPT-5.5 is an explicit track. Use it for planning, structured JSON, code reasoning, long-horizon agent steps, and tool selection. GPT Image 2 is a separate track, so do not treat image generation as decoration. If you target that prize, make the image model central to the user value.

Good uses:

- Convert ambiguous user input into a typed plan, tasks, tests, and acceptance criteria.
- Use tool calling to drive a real workflow instead of just returning text.
- Generate or edit images from text and references with GPT Image 2.
- Use Codex/Cursor-style coding agents for real repository work.

Sources:

- https://platform.openai.com/docs/guides/text
- https://platform.openai.com/docs/guides/images-vision
- https://developers.openai.com/codex

### Cloudflare

Cloudflare can be the production substrate: Workers for APIs, Durable Objects for strongly consistent state and WebSockets, Agents SDK for stateful AI agents, Vectorize for embeddings/RAG, AI Gateway for model observability and fallback, R2 for assets, D1 for SQL, and Workflows for durable long-running jobs.

Good uses:

- A stateful agent per user, team, project, incident, or document.
- Realtime dashboards or voice/chat sessions over WebSockets.
- RAG with Vectorize plus R2/KV/D1 as source stores.
- Model gateway with retries, caching, fallback, usage analytics, and rate control.

Sources:

- https://developers.cloudflare.com/ai/
- https://developers.cloudflare.com/agents/
- https://developers.cloudflare.com/workers/
- https://developers.cloudflare.com/durable-objects/
- https://developers.cloudflare.com/vectorize/

### Google Gemini

Gemini is the best fit for the event's voice and generative media tracks. Use the provided event model access and confirm exact model names on site, since the event text mentions a `flash-3.1-live` model and public search did not find exact docs for that string. Public docs/search results show Gemini API, Live API, Veo, and Lyria as the relevant product family.

Good uses:

- Live voice agent with interruption, streaming, and tool calls.
- Video generation with Veo for product demos, storyboards, or generated explainers.
- Music generation with Lyria for adaptive soundtracks, jingles, or interactive media.
- Multimodal reasoning across text, image, audio, and video prompts.

Sources:

- https://ai.google.dev/gemini-api/docs
- https://ai.google.dev/gemini-api/docs/music-generation
- https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation
- https://developers.googleblog.com/en/veo-3-now-available-gemini-api/

### Adaption Labs

Public product docs were not found during research. Public articles describe Adaption Labs as building adaptive AI systems that learn continuously, adapt at inference time, and reduce dependence on static retraining, fine-tuning, and prompt engineering. The event appears to be giving early or first access to their product, so verify the API and constraints with the sponsor table before committing.

Good uses:

- A demo where the system visibly learns from user feedback during the session.
- Personalization that improves across a few examples without manual prompt edits.
- Adaptive interface behavior, such as changing detail level, workflow choices, or routing based on observed user behavior.

Sources:

- https://fortune.com/2026/02/04/adaption-labs-50-million-seed-funding-emergence-captial-sara-hooker-sudip-roy-ai-models-that-learn-on-the-fly/
- https://duckduckgo.com/html/?q=%22Adaption+Labs%22+hackathon+AI

### Convex

Convex is the fastest way to make a hackathon app feel alive. It gives a TypeScript backend, realtime sync, document database, queries, mutations, actions for calling external APIs, auth integrations, file storage, scheduled jobs, text/vector search, and agent components.

Good uses:

- Realtime kanban for agent tasks.
- Live chat transcripts and tool call timelines.
- Collaborative team app with shared state.
- Agent memory, file upload, and vector search without separate infra.

Source:

- https://docs.convex.dev/home

### Cursor

Cursor SDK is a high-leverage sponsor target because it has a specific track and very demoable output. The SDK lets TypeScript programs launch coding agents locally or in Cursor cloud, stream events, use a dedicated VM, open PRs, use MCP/skills/hooks/subagents, and route to supported frontier models.

Good uses:

- Turn a bug report or Linear/GitHub issue into a branch and PR.
- CI failure repair bot.
- Agent-powered kanban where dragging a card starts a coding agent.
- Repository reviewer that creates concrete patches, not just comments.

Sources:

- https://cursor.com/blog/typescript-sdk
- https://cursor.com
- https://cursor.com/changelog

### Fal

Fal is for fast generative media. It has a broad model marketplace and supports image, video, audio, music, speech, 3D, streaming, serverless deployment, dedicated GPU compute, and model endpoints.

Good uses:

- Generate polished visual assets in seconds.
- Compare multiple image/video models for the same creative brief.
- Use streaming/real-time media generation in the app, not just precomputed assets.
- Deploy a custom model endpoint if you already have a model pipeline ready.

Source:

- https://fal.ai/docs

### Vercel

Vercel is the safest web deployment path. It is strong for Next.js, frontend polish, serverless functions, preview deployments, AI SDK, AI Gateway, agents, MCP servers, secure sandboxes, and observability.

Good uses:

- A slick web UI that judges can open immediately.
- Streamed chat or agent status using AI SDK patterns.
- Preview deployments per generated app or PR.
- AI Gateway if you want provider routing and fallback at the app layer.

Source:

- https://vercel.com/docs

### Daytona

Daytona is a strong partner for any code-generating agent. It provides isolated sandboxes with filesystem, network, vCPU/RAM/disk, process/code execution, snapshots, git operations, PTY, logs, previews, and SDKs.

Good uses:

- Run generated code safely.
- Let agents execute tests without touching your local machine.
- Provide each user/task a persistent sandbox.
- Show judges a real terminal/test log as proof the agent did work.

Source:

- https://www.daytona.io/docs/

### Hyperspell

Hyperspell is a memory/context layer for agents. It connects user workspace accounts, continuously indexes data, builds a memory graph, and returns structured context or LLM-ready summaries.

Good uses:

- Agent that knows a user's emails, docs, Slack messages, projects, and contacts.
- Personal/company memory for meeting prep, sales prep, recruiting, support, or operations.
- Grounded answers without building a custom ingestion/RAG pipeline.

Sources:

- https://hyperspell.com
- https://docs.hyperspell.com

### ElevenLabs

ElevenLabs is best for audio polish and voice-first UX. It provides text to speech, speech to text, voice cloning, voice changer, voice isolation, dubbing, sound effects, dialogue, music, image/video generation/editing, and conversational AI agents.

Good uses:

- Voice UI over a serious backend workflow.
- Human-sounding demo narration.
- Multilingual dubbing or call agent.
- Sound effects/music to make media products feel finished.

Source:

- https://elevenlabs.io/docs/overview

### Mastra

Mastra is a TypeScript framework for building AI agents, with quickstarts, Studio, app framework integrations, and templates for assistants, internal copilots, data analysis agents, content automation, DevOps automation, and sales/GTM workflows.

Good uses:

- Make an agent app structured instead of a pile of API calls.
- Use templates to move quickly.
- Combine tools, memory, and workflows in a TypeScript app.

Source:

- https://mastra.ai/docs

### Smithery

Smithery connects agents to MCP servers and handles auth, credentials, sessions, publishing, and observability. Its marketplace includes web search, Gmail, GitHub, Notion, Slack, Google Sheets, Context7, Browserbase, Supabase, Linear, and many more MCPs.

Good uses:

- Give your agent tools without manually integrating every API.
- Connect to a user's accounts safely with OAuth-style flows.
- Publish your own MCP server if your project exposes tools.
- Build an agent that can actually act across apps, not just chat.

Source:

- https://smithery.ai

## Recommended Sponsor Pairings

| Pairing | Why it works | Example |
| --- | --- | --- |
| Cursor SDK + Daytona + Convex | Coding agent, safe execution, realtime status | Bug report to tested PR dashboard |
| GPT-5.5 + Convex + Vercel | Strong reasoning with fast full-stack app | Planning assistant with live collaborative state |
| Gemini Live + ElevenLabs + Convex | Voice agent plus persistent realtime state | Voice coach, call agent, interview simulator |
| GPT Image 2 + Fal + Gemini Veo/Lyria | Strong media pipeline | Product launch studio with images, video, and soundtrack |
| Hyperspell + Smithery + Mastra | Agent memory plus tools plus orchestration | Personal/company operations agent |
| Cloudflare Agents + Vectorize + AI Gateway | Production-grade stateful AI infra | Stateful RAG/agent backend with model routing |

## Sponsor Strategy

Use only enough sponsors to make the demo stronger. A clean project with three deeply integrated sponsors beats a fragile project with ten shallow logos.

Good track targeting:

- Main prize: build something useful, technically credible, and demoable end to end.
- Cursor track: show a Cursor SDK agent doing real work, ideally producing a PR or tested code artifact.
- Convex track: show realtime sync, not just database storage.
- GPT-5.5 track: show structured reasoning, tools, and decision quality.
- GPT Image 2 track: make image generation a core workflow, not a background asset.
- Gemini voice/media track: make voice or generated media central to the product.
- Fal track: use Fal for live media generation or a model workflow users could not easily replicate with a static asset.
- Adaption Labs track: ask for their exact API and build a feedback/adaptation loop around it.

Avoid:

- Generic chatbot over documents.
- Static demos where all AI output is pre-generated.
- Sponsor stuffing with no reason for each platform.
- Long setup requirements before judges can see value.
