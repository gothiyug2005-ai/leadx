import { describe, expect, it } from "vitest";

import {
  employerDomainFromUrl,
  isJobBoardDomain,
  normalizeDomain,
} from "@/lib/web/domain";
import { assertPublicUrl, isPrivateAddress } from "@/lib/web/fetch-page";
import { htmlToText } from "@/lib/web/html-to-text";

describe("normalizeDomain", () => {
  it("reduces links and messy input to a bare domain", () => {
    expect(normalizeDomain("https://www.Acme.com/careers?x=1")).toBe(
      "acme.com",
    );
    expect(normalizeDomain("acme.co.in")).toBe("acme.co.in");
    expect(normalizeDomain("  WWW.acme.io.  ")).toBe("acme.io");
  });

  it("rejects things that are not domains", () => {
    for (const value of [
      "",
      "acme",
      "localhost",
      "http://",
      "acme..com",
      "-acme.com",
      "acme.123",
      null,
    ]) {
      expect(normalizeDomain(value), String(value)).toBeNull();
    }
  });
});

describe("employer domain from a posting link", () => {
  it("uses the company's own careers site", () => {
    expect(employerDomainFromUrl("https://careers.acme.com/jobs/1")).toBe(
      "acme.com",
    );
    expect(employerDomainFromUrl("https://acme.com/jobs/1")).toBe("acme.com");
  });

  it("ignores job boards, which host many employers", () => {
    expect(isJobBoardDomain("boards.greenhouse.io")).toBe(true);
    expect(
      employerDomainFromUrl("https://www.linkedin.com/jobs/view/123"),
    ).toBeNull();
    expect(employerDomainFromUrl("https://jobs.lever.co/acme/123")).toBeNull();
  });
});

describe("private address protection", () => {
  it("flags internal and special addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "not-an-ip",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of [
      "8.8.8.8",
      "172.32.0.1",
      "1.1.1.1",
      "2606:4700:4700::1111",
    ]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("refuses links that point inside the network", async () => {
    for (const url of [
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://localhost:3000/",
      "http://db.internal/",
      "https://8.8.8.8:8443/",
      "https://user:pass@8.8.8.8/",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "not a url",
    ]) {
      await expect(assertPublicUrl(url), url).rejects.toMatchObject({
        name: "FetchPageError",
      });
    }
  });

  it("accepts a public address", async () => {
    await expect(
      assertPublicUrl("https://8.8.8.8/jobs"),
    ).resolves.toBeInstanceOf(URL);
  });
});

describe("htmlToText", () => {
  it("keeps readable text and drops scripts, styles and navigation", () => {
    const page = htmlToText(`
      <html><head><title>Frontend Engineer | Acme</title><style>.x{}</style></head>
      <body><nav>Home Jobs</nav><h1>Frontend Engineer</h1><p>Build &amp; ship UI.</p>
      <ul><li>React</li><li>TypeScript</li></ul><script>track()</script></body></html>`);
    expect(page.title).toBe("Frontend Engineer | Acme");
    expect(page.text).toContain("Frontend Engineer");
    expect(page.text).toContain("Build & ship UI.");
    expect(page.text).toContain("• React");
    expect(page.text).not.toContain("track()");
    expect(page.text).not.toContain("Home Jobs");
  });

  it("reads the structured job posting many sites embed", () => {
    const page = htmlToText(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "JobPosting",
        title: "Data Analyst",
        hiringOrganization: { name: "Northwind" },
        description: "<p>Own our dashboards.</p>",
      })}</script><div>Apply now</div>`,
    );
    expect(page.text).toContain("Title: Data Analyst");
    expect(page.text).toContain("Company: Northwind");
    expect(page.text).toContain("Own our dashboards.");
  });
});
