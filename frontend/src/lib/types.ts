export type CompanySummary = {
  ticker: string;
  name: string;
  tier: number;
  repos: string[];
  caveat: string | null;
  score: number | null;
  trend_30d: number | null;
};

export type SubScores = {
  commit_velocity: number | null;
  contributor_breadth: number | null;
  release_cadence: number | null;
  contributor_retention: number | null;
  star_fork_growth: number | null;
  issue_backlog_change: number | null;
};

export type RepoBreakdown = {
  repo: string;
  composite_score: number | null;
  sub_scores: SubScores;
  metrics_available: string[];
  metrics_pending: string[];
};

export type CompanyDetail = {
  ticker: string;
  name: string;
  tier: number;
  repos: string[];
  caveat: string | null;
  score: number | null;
  repo_breakdown: RepoBreakdown[];
  score_history: unknown[];
};

export const SUB_METRIC_LABELS: Record<keyof SubScores, string> = {
  commit_velocity: "Commit velocity trend",
  contributor_breadth: "Contributor breadth",
  release_cadence: "Release cadence",
  contributor_retention: "Contributor retention",
  star_fork_growth: "Star/fork growth",
  issue_backlog_change: "Issue backlog change",
};

const PENDING_METRIC_REASONS: Record<string, string> = {
  contributor_retention: "needs 2+ ingestion snapshots over time",
  star_fork_growth: "needs 2+ ingestion snapshots over time",
  issue_backlog_change: "needs 2+ ingestion snapshots over time",
  release_cadence: "repo has fewer than 2 GitHub releases on record",
  commit_velocity: "needs 8+ weeks of commit data",
  contributor_breadth: "no contributor data yet",
};

export function pendingReason(metric: string): string {
  return PENDING_METRIC_REASONS[metric] ?? "insufficient data yet";
}
