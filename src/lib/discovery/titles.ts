/**
 * Which job titles to search for at a company, given the role the user wants.
 * The mix covers the people who can actually help: the likely hiring manager,
 * recruiters, peers on the team, and leadership as a fallback.
 */
interface RoleFamily {
  match: RegExp;
  managers: string[];
  peers: string[];
  recruiters: string[];
  leaders: string[];
}

const FAMILIES: RoleFamily[] = [
  {
    match:
      /engineer|developer|devops|sre|programmer|architect|frontend|backend|full[- ]?stack|mobile|ios|android|qa|test/i,
    managers: ["Engineering Manager", "Head of Engineering", "Tech Lead"],
    peers: ["Software Engineer", "Senior Software Engineer"],
    recruiters: ["Technical Recruiter", "Talent Acquisition"],
    leaders: ["VP Engineering", "CTO"],
  },
  {
    match: /data|analyst|analytics|machine learning|\bml\b|\bai\b|scientist/i,
    managers: ["Data Science Manager", "Head of Data", "Analytics Manager"],
    peers: ["Data Scientist", "Data Analyst", "Data Engineer"],
    recruiters: ["Technical Recruiter", "Talent Acquisition"],
    leaders: ["VP Data", "Chief Data Officer"],
  },
  {
    match: /design|ux|ui\b|product designer|researcher/i,
    managers: ["Design Manager", "Head of Design"],
    peers: ["Product Designer", "UX Designer"],
    recruiters: ["Recruiter", "Talent Acquisition"],
    leaders: ["VP Design"],
  },
  {
    match: /product manager|product owner|\bpm\b|product lead/i,
    managers: [
      "Group Product Manager",
      "Head of Product",
      "Director of Product",
    ],
    peers: ["Product Manager", "Senior Product Manager"],
    recruiters: ["Recruiter", "Talent Acquisition"],
    leaders: ["VP Product", "Chief Product Officer"],
  },
  {
    match:
      /sales|account executive|business development|\bsdr\b|\bbdr\b|customer success/i,
    managers: ["Sales Manager", "Head of Sales", "Customer Success Manager"],
    peers: ["Account Executive", "Sales Development Representative"],
    recruiters: ["Recruiter", "Talent Acquisition"],
    leaders: ["VP Sales", "Chief Revenue Officer"],
  },
  {
    match: /marketing|growth|content|seo|brand|communications/i,
    managers: ["Marketing Manager", "Head of Marketing", "Growth Lead"],
    peers: ["Marketing Specialist", "Content Marketing Manager"],
    recruiters: ["Recruiter", "Talent Acquisition"],
    leaders: ["VP Marketing", "Chief Marketing Officer"],
  },
];

const GENERIC: Omit<RoleFamily, "match"> = {
  managers: ["Hiring Manager", "Team Lead", "Head of Department"],
  peers: [],
  recruiters: ["Recruiter", "Talent Acquisition", "HR Business Partner"],
  leaders: ["Director", "VP"],
};

export function searchTitlesFor(target: {
  role_title: string | null;
  team: string | null;
}): string[] {
  const text = [target.role_title, target.team].filter(Boolean).join(" ");
  const family =
    FAMILIES.find((candidate) => candidate.match.test(text)) ?? GENERIC;
  const titles = [
    ...family.managers,
    ...(target.role_title ? [target.role_title] : []),
    ...family.peers,
    ...family.recruiters,
    ...family.leaders,
  ];
  return Array.from(new Set(titles)).slice(0, 12);
}
