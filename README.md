# MoveFlow

MoveFlow is a relocation planning app with a stateless public MCP server and a persistent, browser-session-scoped dashboard. It uses an adaptive interview to collect move requirements, generates plans from provider data and estimates, and uses OpenAI tool calls to update saved plans.

- App: https://amazon-mcp-hackaton.vercel.app/
- Public MCP endpoint: https://amazon-mcp-hackaton.vercel.app/api/mcp
- Transport: Streamable HTTP; no client credentials required

## Connect the MCP server

Connect an MCP-compatible assistant on any device to `https://amazon-mcp-hackaton.vercel.app/api/mcp` using Streamable HTTP. No local installation of MoveFlow or client credentials are needed. The deployed server must be reachable from the client.

### Codex CLI and IDE extension

Run on each device:

```bash
codex mcp add moveflow --url https://amazon-mcp-hackaton.vercel.app/api/mcp
codex mcp list
```

Alternatively, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.moveflow]
url = "https://amazon-mcp-hackaton.vercel.app/api/mcp"
```

The CLI and IDE extension share this configuration on the same machine. Start a new session and ask, for example, “Use MoveFlow to help me plan a move from Boston to Austin.” See the [Codex MCP setup guide](https://developers.openai.com/learn/docs-mcp).

### Claude Code

Run the following to make MoveFlow available across projects on the device. Omit `--scope user` to configure only the current project.

```bash
claude mcp add --transport http --scope user moveflow https://amazon-mcp-hackaton.vercel.app/api/mcp
claude mcp list
```

Use `/mcp` in Claude Code to check the connection.

### VS Code with GitHub Copilot

Add the server to `.vscode/mcp.json` in the project:

```json
{
  "servers": {
    "moveflow": {
      "type": "http",
      "url": "https://amazon-mcp-hackaton.vercel.app/api/mcp"
    }
  }
}
```

Open Copilot Chat in Agent mode and enable MoveFlow in the tools picker. See the [VS Code MCP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration) for user-profile configuration.

### Cursor

Add the server to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "moveflow": {
      "url": "https://amazon-mcp-hackaton.vercel.app/api/mcp"
    }
  }
}
```

Restart Cursor and ask its agent to use MoveFlow.

### ChatGPT and cloud agents

In ChatGPT on the web, open **Plugins → + → Add custom MCP server**, name it MoveFlow, enter the endpoint, and select the no-authentication option. Install the resulting plugin and select it in a new chat. Availability depends on account and workspace settings; see [Add a custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server).

Cloud environments need their own MCP configuration and network access to the endpoint; local Codex configuration does not automatically transfer. For the OpenAI Agents API, add the following to `agent.tools` as described in the [MCP connections guide](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp):

```json
{
  "type": "mcp",
  "server_label": "moveflow",
  "transport": {
    "type": "http",
    "server_url": "https://amazon-mcp-hackaton.vercel.app/api/mcp"
  },
  "connection_origin": "service",
  "required": true
}
```

Other MCP clients can use the same URL and Streamable HTTP transport; consult the client's documentation for its configuration format. The public server is stateless, so conversations and plan state do not automatically sync between clients. Dashboard plans are scoped to a browser session, and cross-device login is not currently available. Interactive widgets require a host that supports MCP Apps; other hosts can use the tools' text and structured results.

## Setup

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

## Sample prompts

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

- `prepare_move_intake`: extract known facts and return the interview state and next question. Structured `known` values work without OpenAI; saved context is used only when explicitly enabled.
- `answer_move_intake`: validate an answer and return the next state. Choice, numeric, and date answers work without OpenAI; descriptive custom answers require it.
- `get_relocation_rent_guidance`: return sourced rental samples or report unavailable data.
- `generate_move_plan`: check completeness and return `needs_input` or a plan. Supply estimates or configure OpenAI to generate rough allowances.
- `update_move_plan`: apply preferences and expense edits to caller-owned state and regenerate the plan. User-supplied estimates persist in that state.
- Other tools provide route, housing, mover and budget calculations, comparisons, readiness, timeline, destination essentials, and briefings. `draft_relocation_plan` and `preview_relocation_selection` are non-persistent. Use `tools/list` for the full schemas.

MCP hosts can pass relevant facts the user previously shared (for example, adult, child and pet counts) as `savedContext` with `includeContext: true` when calling `prepare_move_intake`. Put facts from the current request in `known`; they take precedence. The intake tracks the source of each fact, asks for missing details, and carries the resulting state into plan generation. The public server cannot access a host's conversation, memory or browser profile on its own: the host must select and send applicable facts, and host behavior may vary. In the browser app, users can opt in to **Include my move context** to use their saved profile for an intake; the current request takes precedence.

`prepare_move_intake` advertises `ui://moveflow/quiz-v4.html`; `generate_move_plan` advertises `ui://moveflow/plan-v3.html`. The quiz calls the intake and plan tools directly. The plan widget calls `update_move_plan` and synchronizes context when supported.

A successful `generate_move_plan` puts the presentation directly in `structuredContent` (`status`, `state`, `move`, `route`, `housing`, `movers`, `flights`, `budget`, `strategies`, `timeline`, `readiness`, `briefing`, and `assumptions`), not in `structuredContent.result`. `content[0].text` is readable text. Map rendering data is delivered in `_meta.moveflow.map` and `_meta.moveflow.housingMap`. Retain the returned `state`, including `expenseEstimates`, for subsequent updates. `maxRent` filters rentals independently of assumed monthly rent.

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
