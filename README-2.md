## What was done

- Built MoveFlow landing page and onboarding flow.
- Added solo and family demo scenarios.
- Added relocation dashboard with:
  - Route visualization
  - Moving recommendations
  - Housing listings
  - Moving-service listings
  - Budget calculations
  - Selection-based budget updates
  - MCP execution explorer
- Added seven real MCP tools at `/api/mcp`.
- Added `/api/agent` orchestration endpoint.
- Added deterministic demo data and labeled assumptions.

### Manual testing

Start the app:

```
pnpm dev
```

Open:

```
http://localhost:3000
```

Test:

1. Click **Try family demo**.
2. Confirm the dashboard loads.
3. Select a housing listing and mover.
4. Verify the budget updates.
5. Click **Try solo demo** or switch scenarios.
6. Inspect the **MCP execution explorer**.
7. Test onboarding with **Create my plan**.

Check MCP discovery:

```
curl -X POST http://localhost:3000/api/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "mcp-protocol-version: 2025-11-25" \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### How MCP works

MoveFlow exposes a real Streamable HTTP MCP endpoint:

```
/api/mcp
```

The MCP server registers these tools:

- `create_relocation_plan`
- `calculate_route`
- `search_housing`
- `search_moving_services`
- `recommend_moving_strategy`
- `calculate_budget`
- `update_relocation_selection`

An MCP client initializes a session, discovers tools with `tools/list`, then executes tools with `tools/call`. Each tool validates input with Zod and returns structured JSON-compatible output.

### Connecting MCP to another app

Configure the other MCP-compatible app with:

```
http://your-domain.com/api/mcp
```

For local development:

```
http://localhost:3000/api/mcp
```

The client must support Streamable HTTP and send:

```
Accept: application/json, text/event-stream
Content-Type: application/json
MCP-Protocol-Version: 2025-11-25
```

You can also connect using MCP Inspector by pointing it at the same `/api/mcp` URL
