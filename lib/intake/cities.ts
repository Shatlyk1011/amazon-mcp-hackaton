import { groupCitiesByState } from "@mardillu/us-cities-utils";

const citiesByState = groupCitiesByState();
export const states = Object.entries(citiesByState).map(
  ([abbreviation, cities]) => ({
    name: cities[0]?.state ?? abbreviation,
    abbreviation,
    cities,
  }),
);

export function stateOnly(value?: string) {
  const text = value
    ?.trim()
    .toLowerCase()
    .replace(/^state of /, "");
  return states.find(
    (state) =>
      state.name.toLowerCase() === text ||
      state.abbreviation.toLowerCase() === text,
  );
}

// Correct only a single-character typo in a full state name, and only when
// there is one unambiguous match. Abbreviations must match exactly.
export function resolveState(value?: string) {
  const exact = stateOnly(value);
  if (exact || !value) return exact;
  const text = value.trim().toLowerCase();
  if (text.length < 5 || !/^[a-z ]+$/.test(text)) return undefined;
  const oneEdit = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0,
      j = 0,
      edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      if (++edits > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
    return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
  };
  const matches = states.filter((state) =>
    oneEdit(text, state.name.toLowerCase()),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function statesFromMovePrompt(prompt: string) {
  const match =
    /\bfrom\s+([a-z ]+?)\s+to\s+([a-z ]+?)(?=$|[,.!?]|\s+(?:on|in|with|for|and)\b)/i.exec(
      prompt.trim(),
    );
  if (!match) return {};
  const origin = resolveState(match[1]);
  const destination = resolveState(match[2]);
  return {
    ...(origin ? { origin: origin.name } : {}),
    ...(destination ? { destination: destination.name } : {}),
  };
}
