import { describe, expect, it } from "vitest";

import { isProtectedPath, safeNextPath } from "@/lib/routes";

describe("isProtectedPath", () => {
  it("protects the signed-in screens and everything under them", () => {
    for (const path of [
      "/today",
      "/targets",
      "/targets/abc",
      "/inbox",
      "/pipeline",
      "/insights",
      "/settings/profile",
      "/onboarding",
    ]) {
      expect(isProtectedPath(path), path).toBe(true);
    }
  });

  it("leaves public pages alone", () => {
    for (const path of [
      "/",
      "/login",
      "/setup",
      "/auth/callback",
      "/todayish",
      "/api/inngest",
    ]) {
      expect(isProtectedPath(path), path).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps paths inside the app, including query strings", () => {
    expect(safeNextPath("/targets")).toBe("/targets");
    expect(safeNextPath("/targets/123?tab=people")).toBe(
      "/targets/123?tab=people",
    );
  });

  it("falls back for anything that could leave the app", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "evil.example",
      "/\tevil",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(safeNextPath(value), String(value)).toBe("/today");
    }
  });

  it("normalises dot segments instead of trusting them", () => {
    expect(safeNextPath("/targets/../../login")).toBe("/login");
  });
});
