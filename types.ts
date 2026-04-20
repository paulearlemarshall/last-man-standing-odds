
// Raw types from The Odds API
export interface ApiOutcome {
  name: string;
  price: number;
}

export interface ApiMarket {
  key: 'h2h';
  last_update: string;
  outcomes: ApiOutcome[];
}

export interface ApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: ApiMarket[];
}

export interface ApiMatch {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: ApiBookmaker[];
}

// Processed types for internal application use
export interface Outcome {
  name: string;
  price: number;
}

export interface Market {
  key: 'h2h';
  outcomes: Outcome[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface MatchOdds {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface MatchWeekend {
  id: string;
  title: string;
  dateRange: string;
  matches: MatchOdds[];
}

export interface Suggestion {
  teamName: string;
  vsTeam: string;
  odds: number;
  type: 'homeWin' | 'awayWin';
  reasoning?: string;
}

export interface Player {
  id: number;
  name: string;
  previousPicks: string[];
  suggestion: Suggestion | null;
}

export interface ArbitrageOpportunity {
    matchId: string;
    matchTitle: string;
    commenceTime: string;
    profitPercentage: number;
    outcomes: {
        name: string;
        price: number;
        bookmaker: string;
        stakePercentage: number;
    }[];
}

export interface PotentialPick extends Suggestion {}

export interface DecisionLogEntry {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error' | 'process';
    timestamp: number;
    details?: string;
}

export type Region = 'uk' | 'us' | 'eu' | 'au';

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface OddsSnapshotSummary {
    id: number;
    createdAt: string;
    sportKey: string;
    regions: string;
    markets: string;
    matchCount: number;
}

export interface OddsSnapshotDetail extends OddsSnapshotSummary {
    sourceUrl: string;
    payload: unknown;
    insights?: OddsSnapshotInsights | null;
}

export interface OddsSnapshotInsightPoint {
    snapshotId: number;
    createdAt: string;
    avgHomeOdds: number | null;
    avgAwayOdds: number | null;
    avgBookmakersPerMatch: number | null;
    trackedMatchCount: number;
}

export interface OddsSnapshotInsights {
    lookbackCount: number;
    currentSnapshotId: number;
    currentCreatedAt: string;
    currentMatchCount: number;
    trackedMatchCount: number;
    avgHomeOddsDelta: number | null;
    avgAwayOddsDelta: number | null;
    avgBookmakersPerMatchDelta: number | null;
    timeline: OddsSnapshotInsightPoint[];
}

export interface TeamFormTimelinePoint {
    snapshotId: number;
    createdAt: string;
    sampleQuotes: number;
    matchCount: number;
    avgImpliedProb: number | null;
    avgOdds: number | null;
    avgBookmakersPerMatch: number | null;
}

export interface TeamOpponentEdge {
    opponent: string;
    sampleQuotes: number;
    matchCount: number;
    avgImpliedProb: number | null;
    trendDelta: number | null;
}

export interface TeamFormAnalytics {
    team: string;
    lookbackSnapshots: number;
    sampleQuotes: number;
    totalMatches: number;
    avgImpliedProb: number | null;
    currentImpliedProb: number | null;
    impliedProbDelta: number | null;
    momentumPerSnapshot: number | null;
    volatility: number | null;
    confidenceScore: number;
    timeline: TeamFormTimelinePoint[];
    opponents: TeamOpponentEdge[];
}

export interface HeadToHeadTimelinePoint {
    snapshotId: number;
    createdAt: string;
    avgImpliedProbA: number | null;
    avgImpliedProbB: number | null;
    edgeA: number | null;
    sampleQuotes: number;
    matchCount: number;
}

export interface HeadToHeadAnalytics {
    teamA: string;
    teamB: string;
    lookbackSnapshots: number;
    sampleQuotes: number;
    totalMatches: number;
    currentEdgeA: number | null;
    edgeDeltaA: number | null;
    avgImpliedProbA: number | null;
    avgImpliedProbB: number | null;
    confidenceScore: number;
    timeline: HeadToHeadTimelinePoint[];
}
