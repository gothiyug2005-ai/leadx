import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_SIGNED_IN_PATH, isProtectedPath } from "@/lib/routes";

import { getSupabaseConfig } from "./config";

/**
 * Runs on every navigation (see src/proxy.ts):
 *   1. refreshes the Supabase session cookie so pages always see a valid token,
 *   2. sends signed-out visitors away from protected pages,
 *   3. sends signed-in visitors away from the login page.
 *
 * This is an optimistic check for a smooth experience. The real authorisation
 * happens again next to the data: in pages, Server Actions and Route Handlers
 * (requireUser) and in the database (Row Level Security).
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const config = getSupabaseConfig();

  if (!config) {
    // Not connected to Supabase yet: explain what is missing instead of crashing.
    if (isProtectedPath(pathname) || pathname === "/login") {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by a CDN.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run any code between creating the client and getClaims(): this call
  // is what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  if (!isSignedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingCookies(url, response);
  }

  if (isSignedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_SIGNED_IN_PATH;
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

/** Redirect while carrying over any refreshed session cookies and cache headers. */
function redirectKeepingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
