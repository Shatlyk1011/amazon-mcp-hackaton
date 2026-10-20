import { ZodError } from "zod";

export class PlanError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: "Please check the submitted values.", details: error.flatten() },
      { status: 400 },
    );
  if (error instanceof PlanError)
    return Response.json({ error: error.message }, { status: error.status });
  // Never expose provider errors, SQL, connection strings, or credentials.
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
