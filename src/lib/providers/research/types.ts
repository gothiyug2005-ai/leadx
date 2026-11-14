export interface ResearchSearchInput {
  query: string;
  maxResults?: number;
  /** Restrict to recent results, in days. */
  recencyDays?: number;
}

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface ResearchProvider {
  readonly name: string;
  search(input: ResearchSearchInput): Promise<ResearchResult[]>;
}
