/** Rules shared by every LeadX prompt. */
export const HONESTY_RULES = `Never invent facts. Use only what the user's materials say. If something is unknown, leave it out (or use null where the format asks for a value).`;

/** Wrap user-provided text so the model treats it as data, not instructions. */
export function asData(label: string, value: string): string {
  return `<${label}>\n${value.trim()}\n</${label}>`;
}
