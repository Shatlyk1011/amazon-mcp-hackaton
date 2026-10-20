import type { RelocationInput } from "@/lib/relocation";
import type { generatePlan } from "./generate";

export type PlanResult = Awaited<ReturnType<typeof generatePlan>>;
export type SavedPlan = {
  id: string;
  input: RelocationInput;
  result: PlanResult | null;
  status: "pending" | "ready" | "failed";
  error: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type PlanRequest = {
  id: string;
  message: string;
  reply: string | null;
  status: "running" | "completed" | "failed";
  tools: { tool: string; status: string; duration: number; output: unknown }[];
  createdAt: string;
};
