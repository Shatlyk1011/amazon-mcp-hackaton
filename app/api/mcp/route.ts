import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import {
  calculateBudget,
  calculateRoute,
  recommendations,
  relocationInputSchema,
} from "@/lib/relocation";
import { DEMO_HOUSES as demoHousing } from "@/data";
import { searchHousing } from "@/lib/providers/rentcast";
import { searchMovingServices } from "@/lib/providers/tomtom-search";

const handler = createMcpHandler((server) => {
  server.registerTool(
    "create_relocation_plan",
    {
      description:
        "Create a typed MoveFlow relocation plan from onboarding inputs.",
      inputSchema: relocationInputSchema,
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            planId: `plan_${Date.now()}`,
            input,
            createdAt: new Date().toISOString(),
          }),
        },
      ],
    }),
  );
  server.registerTool(
    "calculate_route",
    {
      description: "Calculate route distance and duration between two cities.",
      inputSchema: z.object({ origin: z.string(), destination: z.string() }),
    },
    async (input) => ({
      content: [
        { type: "text", text: JSON.stringify(await calculateRoute(input)) },
      ],
    }),
  );
  server.registerTool(
    "search_housing",
    {
      description:
        "Search rental listings near a destination using RentCast, with the bundled development response as a local fallback.",
      inputSchema: z.object({
        destination: z.string(),
        maxRent: z.number().optional(),
        bedrooms: z.number().optional(),
        petFriendly: z.boolean().optional(),
      }),
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await searchHousing(input)),
        },
      ],
    }),
  );
  server.registerTool(
    "search_moving_services",
    {
      description:
        "Find real moving and relocation services near the origin using TomTom Search API. Results do not include quotes or destination-service guarantees.",
      inputSchema: z.object({
        origin: z.string(),
        destination: z.string(),
        furniture: z.boolean(),
      }),
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await searchMovingServices(input)),
        },
      ],
    }),
  );
  server.registerTool(
    "recommend_moving_strategy",
    {
      description:
        "Generate cheapest, recommended, and comfortable strategies based on the relocation.",
      inputSchema: relocationInputSchema,
    },
    async (input) => ({
      content: [{ type: "text", text: JSON.stringify(recommendations(input)) }],
    }),
  );
  server.registerTool(
    "calculate_budget",
    {
      description:
        "Calculate deterministic relocation costs and budget scenarios.",
      inputSchema: relocationInputSchema.extend({
        housingId: z.string().optional(),
        moverId: z.string().optional(),
      }),
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            calculateBudget(
              input,
              demoHousing.find((h) => h.id === input.housingId),
            ),
          ),
        },
      ],
    }),
  );
  server.registerTool(
    "update_relocation_selection",
    {
      description:
        "Update selected housing or moving service and recalculate costs.",
      inputSchema: relocationInputSchema.extend({
        housingId: z.string().optional(),
        moverId: z.string().optional(),
      }),
    },
    async (input) => {
      const selectedHousing = demoHousing.find((h) => h.id === input.housingId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              selection: { housingId: input.housingId, moverId: input.moverId },
              budget: calculateBudget(input, selectedHousing),
            }),
          },
        ],
      };
    },
  );
});
const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => ({
  token: bearerToken ?? "demo",
  scopes: ["read:relocation"],
  clientId: "moveflow-demo",
});
const authHandler = withMcpAuth(handler, verifyToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});
export { authHandler as GET, authHandler as POST };
