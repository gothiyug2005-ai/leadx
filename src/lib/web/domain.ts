/**
 * Turn whatever the user typed ("https://www.Acme.com/careers", "acme.com")
 * into a bare lowercase domain ("acme.com"), or null if it is not one.
 */
export function normalizeDomain(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;

  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/\.$/, "");

  const labels = host.split(".");
  if (labels.length < 2) return null;
  const valid = labels.every((label) =>
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  );
  if (!valid) return null;
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1] ?? "")) return null;
  return host;
}

/** Job boards host many companies, so their domain says nothing about the employer. */
const JOB_BOARD_DOMAINS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "greenhouse.io",
  "lever.co",
  "workday.com",
  "myworkdayjobs.com",
  "ashbyhq.com",
  "smartrecruiters.com",
  "wellfound.com",
  "naukri.com",
  "instahyre.com",
  "monster.com",
  "ziprecruiter.com",
  "workable.com",
  "bamboohr.com",
  "jobvite.com",
  "icims.com",
];

export function isJobBoardDomain(domain: string): boolean {
  return JOB_BOARD_DOMAINS.some(
    (board) => domain === board || domain.endsWith(`.${board}`),
  );
}

/** The employer's domain from a posting URL, unless the URL is on a job board. */
export function employerDomainFromUrl(
  url: string | null | undefined,
): string | null {
  const domain = normalizeDomain(url);
  if (!domain || isJobBoardDomain(domain)) return null;
  // careers.acme.com and jobs.acme.com belong to acme.com.
  return domain.replace(/^(careers|jobs|apply|boards|hiring)\./, "");
}
