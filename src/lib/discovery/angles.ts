export type AngleType =
  "shared_school" | "past_company" | "location" | "skills";

export interface ConnectionAngle {
  type: AngleType;
  detail: string;
}

export interface UserFacts {
  schools: string[];
  companies: string[];
  location: string | null;
  skills: string[];
}

export interface CandidateFacts {
  schools: string[];
  pastCompanies: string[];
  location: string | null;
  title: string | null;
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(university|college|institute|inc|ltd|llc|pvt|the|of)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameThing(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  return (
    left.length > 1 &&
    right.length > 1 &&
    (left === right || left.includes(right) || right.includes(left))
  );
}

function city(location: string | null): string | null {
  const first = location?.split(/[,(]/)[0]?.trim();
  return first && !/remote/i.test(first) ? first : null;
}

/** Shared background found by plain comparison, before any AI is involved. */
export function detectAngles(
  user: UserFacts,
  candidate: CandidateFacts,
): ConnectionAngle[] {
  const angles: ConnectionAngle[] = [];

  const school = candidate.schools.find((theirs) =>
    user.schools.some((mine) => sameThing(mine, theirs)),
  );
  if (school)
    angles.push({
      type: "shared_school",
      detail: `You both studied at ${school}`,
    });

  const company = candidate.pastCompanies.find((theirs) =>
    user.companies.some((mine) => sameThing(mine, theirs)),
  );
  if (company)
    angles.push({
      type: "past_company",
      detail: `You both worked at ${company}`,
    });

  const mine = city(user.location);
  const theirs = city(candidate.location);
  if (mine && theirs && sameThing(mine, theirs))
    angles.push({ type: "location", detail: `You are both in ${theirs}` });

  const skill = user.skills.find(
    (entry) =>
      entry.length > 1 &&
      new RegExp(
        `\\b${entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      ).test(candidate.title ?? ""),
  );
  if (skill)
    angles.push({
      type: "skills",
      detail: `Their role uses ${skill}, which you know`,
    });

  return angles;
}

export function mergeAngles(...lists: ConnectionAngle[][]): ConnectionAngle[] {
  const seen = new Set<string>();
  const merged: ConnectionAngle[] = [];
  for (const angle of lists.flat()) {
    const key = `${angle.type}:${angle.detail.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(angle);
    }
  }
  return merged.slice(0, 4);
}
