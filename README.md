# MoveFlow

MoveFlow is a U.S. relocation planner with a public MCP server and a browser dashboard. It collects move requirements through an adaptive interview, generates a plan using provider data and estimates, and lets users refine saved plans with an OpenAI-powered assistant.

- **Live app:** https://amazon-mcp-hackaton.vercel.app/
- **MCP endpoint:** https://amazon-mcp-hackaton.vercel.app/api/mcp
- **Transport:** Streamable HTTP, stateless, no client credentials
- **MCP protocol:** `2025-11-25` supported
- **Hackathon track:** Amazon Developer Hackathon — Alexa+ self-hosted MCP server
- **Stack:** Next.js, TypeScript, MCP TypeScript SDK, Neon PostgreSQL, OpenAI, Mapbox, RentCast, and TomTom

## Connect an MCP client

Configure an MCP-compatible client with the endpoint above and Streamable HTTP. For example, with Codex CLI:

```bash
codex mcp add moveflow --url https://amazon-mcp-hackaton.vercel.app/api/mcp
codex mcp list
```

Alternatively, configure the server manually in `~/.codex/config.toml`:

```toml
[mcp_servers.moveflow]
url = "https://amazon-mcp-hackaton.vercel.app/api/mcp"
```

The Codex CLI and IDE extension share this configuration on the same machine.

Start a new session and ask: “Use MoveFlow to help me plan a move from Boston to Austin.” Other clients can use the same URL; see their MCP configuration documentation.

The public server is stateless. Clients must retain and pass the returned plan state when updating it. Dashboard plans are browser-session-scoped and do not automatically sync with external clients. Interactive widgets require an MCP Apps-compatible host; other clients can use text and structured results.

## Verify the protocol

Send an initialization request to the deployed server:

```bash
curl -sS https://amazon-mcp-hackaton.vercel.app/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "protocol-check", "version": "1.0.0" }
    }
  }'
```

The response should contain `"protocolVersion":"2025-11-25"`. Use an MCP client to complete initialization, discover tools, and call one. The integration tests below exercise discovery and calls through a real Streamable HTTP client against the local handler.

## Run locally

Use Node.js 22+ and pnpm.

1. Install dependencies with `pnpm install`.
2. Add the variables below to `.env.local`. See `.env.example` for the provider settings. Keep existing values when editing this file.
3. Run `pnpm db:migrate` against your Neon database.
4. Run `pnpm dev` and open the URL matching `APP_URL`.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@NEON_HOST/DATABASE?sslmode=require
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-5-mini
OPENAI_TRANSCRIBE_MODEL=gpt-transcribe
MAPBOX_ACCESS_TOKEN=YOUR_MAPBOX_TOKEN
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=YOUR_PUBLIC_MAPBOX_TOKEN
RENTCAST_API_KEY=YOUR_RENTCAST_API_KEY
TOMTOM_API_KEY=YOUR_TOMTOM_API_KEY
APP_URL=http://localhost:3000
```

- `DATABASE_URL`: [Neon](https://neon.tech/) PostgreSQL connection string for saved plans, profiles, and interviews. Required for persistence and migrations.
- `OPENAI_API_KEY`: [OpenAI API key](https://platform.openai.com/api-keys) for text requests, transcription, and generating missing cost estimates. `OPENAI_MODEL` selects the model for text and estimates; `OPENAI_TRANSCRIBE_MODEL` optionally overrides the transcription model.
- `MAPBOX_ACCESS_TOKEN`: [Mapbox token](https://account.mapbox.com/access-tokens/) for server-side route and map results. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is a public token for interactive maps in the browser and MCP app.
- `RENTCAST_API_KEY`: [RentCast API key](https://developers.rentcast.io/) for live rental listings and rent guidance.
- `TOMTOM_API_KEY`: [TomTom developer key](https://developer.tomtom.com/) with Search API enabled, used for moving services and destination essentials.
- `APP_URL`: canonical app origin used by the server-side MCP client; match the local development port or deployed HTTPS origin.

For deployment, set `APP_URL` to the exact HTTPS application origin. The server-side MCP client uses this configured origin, never a model-provided URL or untrusted Host header. It must be reachable by the application's server.

## Try it

Start a move in the app or an MCP-compatible assistant:

- “I’m moving from New York, NY to Texas. Help me plan the move.”
- “Help me relocate from Boston to Austin with my partner and our dog. We need a two-bedroom rental.”
- “I’m moving from Seattle to Denver. My monthly rent limit is $1,800.”

After creating a saved dashboard, use **Refine this plan** for follow-ups:

- “Lower my monthly rent limit to $1,800 and find new options.”
- “Compare the first two apartments without changing my plan.”
- “Explain what is included in my moving budget.”
- “Select the first apartment.”

The interview asks for missing details before generating a plan. Results depend on the configured providers; fictional flight examples are not bookable.

## MCP tools and response contract

- `prepare_move_intake`: extract known facts and open the widget by default. Structured `known` values work without OpenAI; saved context is used only when explicitly enabled. Set `interactionMode: "conversation"` only for an explicitly requested chat fallback or a host without widget support.
- `answer_move_intake`: validate an answer and return the next state. Send either `answer` for the current question or `changes` for explicit edits to confirmed details. Choice, numeric, date, and structured edits work without OpenAI; descriptive custom answers require it.
- `get_relocation_rent_guidance`: return sourced rental samples or report unavailable data.
- `generate_move_plan`: check completeness and return `needs_input` or a plan. Supply estimates or configure OpenAI to generate rough allowances.
- `update_move_plan`: apply preferences and expense edits to caller-owned state and regenerate the plan. User-supplied estimates persist in that state.
- Other tools provide route, housing, mover and budget calculations, comparisons, readiness, timeline, destination essentials, and briefings. `draft_relocation_plan` and `preview_relocation_selection` are non-persistent. Use `tools/list` for the full schemas.

MCP hosts can pass relevant facts the user previously shared (for example, adult, child and pet counts) as `savedContext` with `includeContext: true` when calling `prepare_move_intake`. Put facts from the current request in `known`; they take precedence. The intake tracks the source of each fact, asks for missing details, and carries the resulting state into plan generation. The public server cannot access a host's conversation, memory or browser profile on its own: the host must select and send applicable facts, and host behavior may vary. In the browser app, users can opt in to **Include my move context** to use their saved profile for an intake; the current request takes precedence.

`prepare_move_intake` advertises `ui://moveflow/quiz-v5.html`; `generate_move_plan` advertises `ui://moveflow/plan-v4.html`. The widget sends `interactionMode: "widget"` on its intake, generation, and update calls. It owns the questions, builds the plan automatically, and lets users review confirmed details, edit answers, and adjust the completed plan. ChatGPT should give a short direction such as “Complete your move details in MoveFlow,” without creating a second questionnaire. Conversation mode leaves the interview in chat and prevents the widget from starting a parallel flow.

In widget mode, model-visible `structuredContent` contains progress, confirmed `state`, and, for completed plans, move details, budget, housing, and the next action. The full intake questionnaire or plan presentation is in `_meta.moveflow.view`, delivered only to the widget. Map rendering data remains in `_meta.moveflow.map`, `_meta.moveflow.housingMap`, and `_meta.moveflow.interactive`. The widget also accepts older full `structuredContent` responses. For compatibility with existing callers and mounted widgets, omitting `interactionMode` from `answer_move_intake`, `generate_move_plan`, or `update_move_plan` retains the full response. Explicit conversation mode likewise returns the full interview or plan, with `interaction.owner: "chat"`.

Context synchronization runs when the widget mounts and after accepted answers, plan generation, and updates. Requests are serialized and coalesced so an older acknowledgement cannot overwrite the latest plan. If synchronization fails or is unsupported, the widget keeps the user's progress and shows **Retry chat sync**; it does not post a chat message or restart the quiz. This context affects future model turns and cannot replace chat text already written below an earlier widget.

Retain the returned `state`, including `expenseEstimates`, for subsequent updates. `maxRent` filters rentals independently of assumed monthly rent at the API level. In the widget, editing the monthly rent amount or slider sets both the estimate and rental search limit; users can then override the search limit in **Edit move details** before selecting **Update plan**. Searches, estimates, totals, and readiness calculations use the existing shared planner pipeline.

After deploying these templates, refresh the MCP connection's tools and metadata and start a new chat to load the new widget versions. Verify that ChatGPT gives only a short handoff, that completing the widget does not start another interview, and that a follow-up about the rent limit uses the latest applied amount. Also test explicit conversation fallback and a failed update followed by retry. Host-generated wording still needs evaluation in the actual ChatGPT host; local bridge tests cannot guarantee the model's prose.

## Architecture and data

- `POST /api/intake` and `PATCH /api/intake/[id]` implement the adaptive interview. Completion atomically links a saved plan; duplicate completion reuses it. `POST /api/plans/from-prompt` returns HTTP 202 and an intake when more information is needed.
- `GET/PUT /api/profile` stores optional browser-scoped move context. `PATCH /api/plans/[id]` persists edits and selections. `POST /api/plans/[id]/messages` saves requests, responses, and MCP traces; OpenAI function calls are dispatched through the plan-scoped MCP endpoint.
- Saved plans use an HttpOnly session cookie; the database stores its hash as the owner and checks it on reads and writes. A plan UUID alone does not grant access. Clearing the cookie loses access; cross-device login is not available.
- Neon stores plans, revisions, requests, profiles, and intakes. Successful writes create revisions; locks and version checks guard concurrent changes. Provider failures preserve the last successful plan.
- OpenAI requests use `store: false`; relevant plan and request history are still sent for inference. The agent limits tool calls and applies a 30-request hourly allowance per browser owner.
- RentCast supplies live rentals when configured; otherwise labeled examples may be shown. TomTom provides destination services, and Mapbox provides route and map data. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` enables interactive maps; server credentials remain private. No bookings or payments are made.

## Verification

```bash
pnpm test
pnpm test:mcp
pnpm typecheck
pnpm lint
pnpm build
```

Tests execute the schema and repository SQL in embedded PostgreSQL (PGlite) and use a real MCP client/HTTP transport against the handler. OpenAI responses and provider searches are fixtures, so tests require no API keys and make no paid model calls.

For live verification after configuration: submit a form, note the URL, reload, send a rent-limit change, select an apartment, and reload again. Confirm the same ID, updated data, request history, and saved selection. An incognito browser should not access that plan.

## Hackathon submission

This project enters the Alexa+ track as a self-hosted MCP server. Development began on October 12, 2026; the relocation planner, MCP tools, provider integrations, persistent plans, and assistant were added subsequently.

## License

[MIT](LICENSE).
