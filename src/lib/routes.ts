/** Paths that require a signed-in user. Everything under these prefixes is protected. */
export const PROTECTED_PREFIXES = [
  "/today",
  "/targets",
  "/inbox",
  "/pipeline",
  "/insights",
  "/settings",
  "/onboarding",
  "/people",
] as const;

export const DEFAULT_SIGNED_IN_PATH = "/today";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Sanitise a "where to go after sign-in" value so it can only ever be a path
 * inside this app. Anything else (absolute URLs, protocol-relative URLs,
 * backslash tricks) falls back to the default.
 */
export function safeNextPath(
  value: unknown,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();

  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;
  // Control characters can be used to smuggle a different URL past naive checks.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return fallback;

  try {
    const resolved = new URL(candidate, "http://app.invalid");
    if (resolved.origin !== "http://app.invalid") return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
