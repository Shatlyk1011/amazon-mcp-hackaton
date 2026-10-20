const KEY = "moveflow-plan-history";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readPlanHistory(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value.filter(
          (id): id is string => typeof id === "string" && UUID.test(id),
        ),
      ),
    ].slice(0, 50);
  } catch {
    return [];
  }
}

export function rememberPlan(id: string) {
  if (!UUID.test(id)) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(
        [id, ...readPlanHistory().filter((item) => item !== id)].slice(0, 50),
      ),
    );
  } catch {
    // Storage may be unavailable; opening a plan should still work.
  }
}
