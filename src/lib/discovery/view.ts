import type { ConnectionAngle } from "./angles";

const ANGLE_TYPES = new Set([
  "shared_school",
  "past_company",
  "location",
  "skills",
]);

/** Read connection angles from the database's JSON safely. */
export function readAngles(value: unknown): ConnectionAngle[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ConnectionAngle =>
      typeof entry === "object" &&
      entry !== null &&
      ANGLE_TYPES.has((entry as ConnectionAngle).type) &&
      typeof (entry as ConnectionAngle).detail === "string",
  );
}

/** Best people first: recommended, then by score, then newest manual additions. */
export function sortPeople<
  T extends {
    is_recommended: boolean;
    relevance_score: number | null;
    do_not_contact: boolean;
  },
>(people: T[]): T[] {
  return [...people].sort(
    (a, b) =>
      Number(a.do_not_contact) - Number(b.do_not_contact) ||
      Number(b.is_recommended) - Number(a.is_recommended) ||
      (b.relevance_score ?? -1) - (a.relevance_score ?? -1),
  );
}
