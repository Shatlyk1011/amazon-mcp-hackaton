import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { registerIntakeTools } from "@/lib/intake/mcp";
import {
  calculateBudget,
  calculateRoute,
  relocationInputSchema,
} from "@/lib/relocation";
import {
  assessMoveReadiness,
  buildMoveTimeline,
  compareHousingOptions,
  createMoveBriefing,
  housingComparisonSchema,
  readinessSnapshotSchema,
} from "@/lib/relocation-insights";
import { searchHousing } from "@/lib/providers/rentcast";
import { searchFlightConnections } from "@/lib/providers/demo-flights";
import {
  essentialCategorySchema,
  searchDestinationEssentials,
  searchMovingServices,
} from "@/lib/providers/tomtom-search";

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const providerAnnotations = { ...readOnlyAnnotations, openWorldHint: true };
const previewSelectionSchema = z
  .object({
    housing: z
      .object({ id: z.string(), monthlyRent: z.number().nonnegative() })
      .strict()
      .optional(),
    moverId: z.string().optional(),
  })
  .strict();

const publicMcpHandler = createMcpHandler((server) => {
  registerIntakeTools(server);
  server.registerTool(
    "draft_relocation_plan",
    {
      description:
        "Create a non-persistent typed relocation-plan draft from complete onboarding inputs. This tool does not save a plan or reserve anything.",
      inputSchema: relocationInputSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            input,
            status: "draft",
            persisted: false,
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
      annotations: providerAnnotations,
    },
    async (input) => ({
      content: [
        { type: "text", text: JSON.stringify(await calculateRoute(input)) },
      ],
    }),
  );
  server.registerTool(
    "suggest_flight_connections",
    {
      description:
        "Return fictional direct and one-stop flight examples for demonstration only. These are not real airlines, flights, routes, schedules, fares, or booking availability; never present them as actual travel options.",
      inputSchema: z
        .object({
          origin: z.string().trim().min(2).max(200),
          destination: z.string().trim().min(2).max(200),
          departureDate: z.iso.date(),
          maxStops: z.union([z.literal(0), z.literal(1)]).default(1),
        })
        .strict(),
      annotations: providerAnnotations,
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await searchFlightConnections(input)),
        },
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
      annotations: providerAnnotations,
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
      annotations: providerAnnotations,
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
    "calculate_budget",
    {
      description:
        "Calculate deterministic relocation costs and budget scenarios. An optional explicit housing selection can be supplied from any listing source.",
      inputSchema: relocationInputSchema.extend({
        selection: previewSelectionSchema.optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            calculateBudget(input, input.selection?.housing),
          ),
        },
      ],
    }),
  );
  server.registerTool(
    "preview_relocation_selection",
    {
      description:
        "Preview an explicit housing or moving-service selection and recalculate costs. This public tool accepts selections from any provider and does not persist them.",
      inputSchema: relocationInputSchema.extend({
        selection: previewSelectionSchema,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              selection: {
                housingId: input.selection.housing?.id,
                moverId: input.selection.moverId,
              },
              budget: calculateBudget(input, input.selection.housing),
              persisted: false,
            }),
          },
        ],
      };
    },
  );
  server.registerTool(
    "build_move_timeline",
    {
      description:
        "Build a deterministic dated moving checklist. Accepts all required relocation inputs and does not read or write saved state.",
      inputSchema: relocationInputSchema.extend({
        referenceDate: z.iso.date().optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ referenceDate, ...input }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(buildMoveTimeline(input, referenceDate)),
        },
      ],
    }),
  );
  server.registerTool(
    "assess_move_readiness",
    {
      description:
        "Score relocation readiness from an explicit snapshot and return blockers and the next best action. Does not read or write saved state.",
      inputSchema: readinessSnapshotSchema,
      annotations: readOnlyAnnotations,
    },
    async (input) => ({
      content: [
        { type: "text", text: JSON.stringify(assessMoveReadiness(input)) },
      ],
    }),
  );
  server.registerTool(
    "compare_housing_options",
    {
      description:
        "Rank two to five supplied housing options against supplied relocation requirements with transparent strengths and tradeoffs. Does not fetch or save listings.",
      inputSchema: housingComparisonSchema,
      annotations: readOnlyAnnotations,
    },
    async ({ input, options }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(compareHousingOptions(input, options)),
        },
      ],
    }),
  );
  server.registerTool(
    "find_destination_essentials",
    {
      description:
        "Find nearby settling-in essentials at a destination using TomTom Search. Results may be labeled development data or unavailable when the provider is not configured.",
      inputSchema: z
        .object({
          destination: z.string().trim().min(2).max(200),
          categories: z.array(essentialCategorySchema).min(1).max(6),
        })
        .strict(),
      annotations: providerAnnotations,
    },
    async (input) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await searchDestinationEssentials(input)),
        },
      ],
    }),
  );
  server.registerTool(
    "create_move_briefing",
    {
      description:
        "Create a concise, deterministic move briefing from an explicit readiness snapshot. Does not call a language model or read saved state.",
      inputSchema: readinessSnapshotSchema.extend({
        referenceDate: z.iso.date().optional(),
      }),
      annotations: readOnlyAnnotations,
    },
    async ({ referenceDate, ...snapshot }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(createMoveBriefing(snapshot, referenceDate)),
        },
      ],
    }),
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
const authHandler = withMcpAuth(publicMcpHandler, verifyToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});
export { authHandler as GET, authHandler as POST };
