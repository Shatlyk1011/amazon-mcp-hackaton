# MoveFlow

A relocation MCP service with an adaptive move interview and persistent dashboard. A voice or typed request starts move setup, asks for missing requirements, then generates `/dashboard/[id]` after review. The browser and standalone MCP tools share the same interview and completion rules. OpenAI also interprets follow-up requests and calls the plan-scoped MCP server to read or update the saved move.

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
APP_URL=http://localhost:3000
```

`DATABASE_URL` is required for saved plans. `OPENAI_API_KEY` is required to generate missing relocation estimates and for text requests. Complete saved estimates can be reused for selections and edits. `OPENAI_MODEL` is configurable. These keys are server-only and must not use the `NEXT_PUBLIC_` prefix.

Configure Mapbox, RentCast and TomTom for provider results. Flight searches return clearly labeled fictional examples and require no flight API key; these are not real airlines, routes or flights and should not be used for travel decisions. No provider credentials are passed to OpenAI.

For deployment, set `APP_URL` to the exact HTTPS application origin. The server-side MCP client uses this configured origin, never a model-provided URL or untrusted Host header. It must be reachable by the application's server. If the development server chooses a different port, update `APP_URL`. Set the hosting request timeout to support the messages route's 180-second maximum.

## Saved plan workflow

- The homepage submits a prompt or partial structured facts to `POST /api/intake`. Missing details stay unknown instead of inheriting demo-family defaults. A state-only destination (e.g. Texas) requires a city selection.
- `GET /api/intake` offers the latest unfinished setup. `PATCH /api/intake/[id]` accepts `answer`, `back`, and `complete`, with revision checks. Choice IDs, typed answers, and optional income-based rent guidance use the same server rules as MCP. Completing an unfinished interview returns an error before any plan is created.
- `GET/PUT /api/profile` stores optional household, pet, work, accessibility, and housing facts for the browser owner. The homepage's unchecked-by-default “Include my move context” control explicitly includes a snapshot. A new request overrides saved facts. Income entered in the dedicated guidance field is not retained; the derived rent ceiling is.
- Local rent suggestions use matching live RentCast listing samples with at least three listings. Development listings are excluded. Source, sample size, retrieval time, and limitations accompany the range. Missing live data falls back to custom rent or optional income guidance, not invented city averages.
- Completion atomically creates and links one plan to the intake, then generates provider results. Duplicate completion reuses the same plan. A failed provider generation retains the record for retry. Complete structured clients can still use `POST /api/plans` directly.
- `POST /api/plans/from-prompt` uses the same interview: incomplete requests return HTTP 202 with `status: "needs_input"` and an intake; complete requests return a saved plan.
- `/dashboard/[id]` reads the saved record on the server. Reloading does not repeat provider searches.
- Direct edits and housing/mover selections persist through `PATCH /api/plans/[id]`.
- Text requests go to `POST /api/plans/[id]/messages`. Request text, replies, and tool traces are saved with the plan.
- OpenAI's Responses API receives relevant saved state and recent request history. Its function calls are dispatched through an MCP client using Streamable HTTP at `/api/plans/[id]/mcp`.
- The MCP client initializes, discovers tools, and executes real `tools/call` requests. Tool names are allowlisted, inputs are validated, and plan IDs are bound by the server.
- Each successful write atomically updates the current plan and adds a revision. Initial results remain in revision 1. There is no revision restore UI yet.
- A short-lived database lock serializes changes; version checks reject stale saves. Provider failures preserve the prior successful plan. Successful individual tool writes remain saved if a later model response fails.

Examples:

- “Lower my monthly rent limit to $1,800 and find new options.”
- “Explain what is included in my moving budget.”
- “Compare the first two apartments without changing my plan.”
- “Select the first apartment.”

The homepage records voice through MediaRecorder and sends it to OpenAI for speech-to-text; the reviewed transcript starts intake. The dashboard leads with maps, housing, budget, and services, includes a checklist and context summary, and keeps follow-up chat in “Refine this plan.” The app does not book services, make payments, or contact providers.

## Ownership and data

This version uses a random HttpOnly browser session cookie, with only its hash stored as the database owner. Every saved-plan read and write checks that owner. The UUID alone does not grant access. Reopen links in the browser where the plan was created; clearing its cookie loses access. Account login and cross-device access are future work.

Database tables:

- `relocation_plans`: current requirements, provider results, selections, state and version.
- `relocation_plan_revisions`: saved snapshots of successful changes.
- `relocation_requests`: text requests, responses and actual MCP traces.
- `relocation_profiles`: optional saved facts scoped to the browser owner.
- `relocation_intakes`: owner-scoped interview snapshots, prior answers for Back, revision and final plan link. Run migration `002_move_intake.sql` with `pnpm db:migrate` before using the new flow.

The model uses `store: false`; conversation continuity comes from Neon. Requests and relevant plan data are still sent to OpenAI for inference. The UI displays the six most recent requests; the API returns up to 30 and the model receives up to 12 completed/failed requests. All requests remain in Neon.

The agent bounds tool calls and time, disables automatic OpenAI retries, and applies a 30-request hourly allowance per browser owner. This anonymous-session allowance is a basic demo guard; add account-based quotas before public production use.

The existing `/api/mcp` remains the public, stateless relocation tool endpoint. Every public tool accepts all of the state it needs and is tested with a fresh MCP client. Draft and preview tools do not imply persistence. `/api/agent` remains a stateless compatibility endpoint. Neither accesses private saved plans. The saved-plan MCP endpoint currently uses browser-session authentication; third-party account linking/OAuth is separate work.

Additional planning tools are available on both MCP surfaces:

- `build_move_timeline`: creates a dated, deterministic moving checklist.
- `assess_move_readiness`: scores the plan, reports blockers and identifies the next action.
- `compare_housing_options`: ranks two to five options with explicit strengths and tradeoffs.
- `find_destination_essentials`: searches for settling-in services through TomTom and labels live, fallback or unavailable data.
- `create_move_briefing`: returns a concise countdown, readiness, budget and next-action summary.

The public endpoint also exposes `draft_relocation_plan` and `preview_relocation_selection`; these names intentionally distinguish stateless calculations from the persistent writes available under `/api/plans/[id]/mcp`.

## Adaptive interview through MCP

Public `/api/mcp` exposes five additional standalone tools:

- `prepare_move_intake({ prompt?, known?, savedContext?, includeContext? })`: extract known facts and return `state`, `ready`, `nextQuestion`, selectable `options`, and remaining questions. Structured `known` values work without OpenAI. Saved context is ignored unless explicitly enabled.
- `answer_move_intake({ state, answer: { questionId, choice? , text?, monthlyIncome? } })`: validate an answer and return the next interview state. Selected options and numeric/date answers do not need OpenAI; descriptive custom answers do. Only fields relevant to the current question may change.
- `get_relocation_rent_guidance({ cities, bedrooms })`: compare sourced asking-rent samples for one to three cities, or report unavailable data.
- `generate_move_plan({ state, estimates? })`: recompute completeness on the server, returning `needs_input` and the next question if necessary. A complete state produces the final editable MoveFlow plan with maps delivered separately to the app. The calling GPT can supply initial cost allowances with `estimates.source: "model"`. Otherwise, when no estimates have been retained, the server makes one bounded structured-output call using `OPENAI_API_KEY` and `OPENAI_MODEL` to suggest typical relocation costs. Missing configuration, refusals, invalid output, or API failures prevent generation until estimates are available. GPT figures are rough planning assumptions, not verified current market averages or quotes.
- `update_move_plan({ state, changes?, estimates? })`: apply explicit preference and expense edits, then rerun the provider pipeline, budget, readiness, briefing and timeline. `changes` supports the move date, household, pets, luggage, furniture, travel preference, housing needs, rent ceiling, minimum bedrooms, available budget and additional preferences. Applied estimates are marked `source: "user"` and survive subsequent generation calls. No persistence or booking occurs.

`prepare_move_intake` advertises the versioned MCP Apps resource `ui://moveflow/quiz-v4.html`. Compatible hosts render a single-question quiz with radio choices and a custom answer field. The widget advances by calling `answer_move_intake`; its **Build my moving plan** button calls `generate_move_plan` directly and renders the final result in the same app. The resulting app has editable expense sliders and exact amounts, an optional security deposit, a live cash-needed preview, and move preference controls. **Reset edits** restores the last applied result locally. **Update plan** calls `update_move_plan` directly, retains edits on failure, and refreshes the app on success. It updates the embedded plan in place and sends the latest amounts through `ui/update-model-context` for future conversation context. It does not post a user message, JSON dump, or request a new chat turn. Unsupported context sync does not block the app update. Direct calls to `generate_move_plan` advertise `ui://moveflow/plan-v3.html` and render the same result view. The app includes driving and numbered rental maps, housing and mover comparisons, budget allowances, timeline, readiness, assumptions, and provider status. Hosts still control their own surrounding narration; the iframe is the authoritative MoveFlow presentation. Clients without MCP Apps support receive the deterministic text fallback and structured plan.

The successful `generate_move_plan` response contract has changed: `structuredContent` is now the presentation itself (`status`, `state`, `move`, `route`, `housing`, `movers`, `flights`, `budget`, `strategies`, `timeline`, `readiness`, `briefing`, and `assumptions`). Consumers must migrate from `structuredContent.result`; raw provider traces, full route geometry, and duplicate budgets are no longer included. `content[0].text` is readable plan text, not a JSON copy of `structuredContent`. Incomplete intake responses retain the `needs_input` state/question shape. Tool-result `_meta.moveflow.map` and `_meta.moveflow.housingMap` contain bounded rendering data delivered only to the widget, outside the model context. The returned `state` is the complete caller-owned snapshot for subsequent updates, including `expenseEstimates`. The shared budget calculation adds `securityDeposit`, `includeSecurityDeposit`, `housingFees`, `temporaryAccommodation` and `estimateSource`; existing amounts retain their prior behavior when no estimates are supplied. Assumed monthly rent is separate from `maxRent`, which continues to control rental searches. Saved-plan persistence is unchanged.

Live rentals meeting the supplied rent ceiling and bedroom minimum appear in the comparison, capped at eight visible options. When the rental API is not configured, the app separately shows up to eight saved rental examples with their actual city, recorded date, and unknown availability. These examples do not count as destination matches, market evidence, or housing readiness. A configured RentCast key is used in both development and production; full state names are normalized to postal codes, and price/bedroom filters use documented numeric ranges. Unknown bedroom and pet details remain explicitly labeled assumptions. Pet policies and listing availability require confirmation. Development mover fixtures are excluded from live results, and fictional flight examples are labeled as demo schedules and are not bookable travel. Map images are fetched on the server from the configured Mapbox provider, with no token exposed to the iframe. A missing token or map error produces a labeled route diagram or unavailable-map message; the app requires no external scripts or direct provider connections.

MCP callers pass the latest returned state and present the next question as choices plus a free-text alternative (or read it aloud). These public tools do not depend on a UI or read private browser profiles. Their state and generated results are non-persistent; the caller retains the snapshot. The browser HTTP adapter persists the same state in Neon and links completion to a saved dashboard. Third-party persistence under a user's account still requires account linking/authentication.

Example: `prepare_move_intake` with `known: { origin: "New York, NY", destination: "Texas" }` returns a Texas city question. Passing the returned state and `answer: { questionId: "destination", choice: "Austin, TX" }` advances to the next missing requirement. The caller repeats until `ready` is true, then calls `generate_move_plan`. Calling generation early returns questions rather than a fabricated complete plan.

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
