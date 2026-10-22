# MoveFlow

MoveFlow is a relocation planning app with a stateless public MCP server and a persistent, browser-session-scoped dashboard. It uses an adaptive interview to collect move requirements, generates plans from provider data and estimates, and uses OpenAI tool calls to update saved plans.

- App: https://amazon-mcp-hackaton.vercel.app/
- Public MCP endpoint: https://amazon-mcp-hackaton.vercel.app/api/mcp
- Transport: Streamable HTTP; no client credentials required

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

## MCP tools and response contract

- `prepare_move_intake`: extract known facts and return the interview state and next question. Structured `known` values work without OpenAI; saved context is used only when explicitly enabled.
- `answer_move_intake`: validate an answer and return the next state. Choice, numeric, and date answers work without OpenAI; descriptive custom answers require it.
- `get_relocation_rent_guidance`: return sourced rental samples or report unavailable data.
- `generate_move_plan`: check completeness and return `needs_input` or a plan. Supply estimates or configure OpenAI to generate rough allowances.
- `update_move_plan`: apply preferences and expense edits to caller-owned state and regenerate the plan. User-supplied estimates persist in that state.
- Other tools provide route, housing, mover and budget calculations, comparisons, readiness, timeline, destination essentials, and briefings. `draft_relocation_plan` and `preview_relocation_selection` are non-persistent. Use `tools/list` for the full schemas.

`prepare_move_intake` advertises `ui://moveflow/quiz-v4.html`; `generate_move_plan` advertises `ui://moveflow/plan-v3.html`. The quiz calls the intake and plan tools directly. The plan widget calls `update_move_plan` and synchronizes context when supported.

A successful `generate_move_plan` puts the presentation directly in `structuredContent` (`status`, `state`, `move`, `route`, `housing`, `movers`, `budget`, `strategies`, `timeline`, `readiness`, `briefing`, and `assumptions`), not in `structuredContent.result`. `content[0].text` is readable text. Map rendering data is delivered in `_meta.moveflow.map` and `_meta.moveflow.housingMap`. Retain the returned `state`, including `expenseEstimates`, for subsequent updates. `maxRent` filters rentals independently of assumed monthly rent.

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
