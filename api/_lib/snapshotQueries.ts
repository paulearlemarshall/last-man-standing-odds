import type { OddsSnapshotDetail, OddsSnapshotInsights, OddsSnapshotSummary } from '../../types.js';
import { average, round4 } from './analyticsMath.js';
import { getSqlClient } from './snapshotDb.js';

type SnapshotRow = {
  id: number;
  created_at: string;
  sport_key: string;
  regions_csv: string;
  markets: string;
  match_count: number;
  source_url: string;
  payload: unknown;
};
type MatchInsight = { id: string; homeOdds: number | null; awayOdds: number | null; bookmakerCount: number };

const summary = (row: SnapshotRow): OddsSnapshotSummary => ({
  id: Number(row.id),
  createdAt: row.created_at,
  sportKey: row.sport_key,
  regions: row.regions_csv,
  markets: row.markets,
  matchCount: Number(row.match_count),
});

function parseMatches(payload: unknown): MatchInsight[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const match = value as { id?: unknown; home_team?: unknown; away_team?: unknown; bookmakers?: unknown };
    if (
      typeof match.id !== 'string' ||
      typeof match.home_team !== 'string' ||
      typeof match.away_team !== 'string' ||
      !Array.isArray(match.bookmakers)
    )
      return [];
    let homeOdds: number | null = null;
    let awayOdds: number | null = null;
    match.bookmakers.forEach((bookmakerValue) => {
      if (!bookmakerValue || typeof bookmakerValue !== 'object') return;
      const bookmaker = bookmakerValue as { markets?: unknown };
      if (!Array.isArray(bookmaker.markets)) return;
      const market = bookmaker.markets.find(
        (item) => item && typeof item === 'object' && (item as { key?: unknown }).key === 'h2h'
      ) as { outcomes?: unknown } | undefined;
      if (!market || !Array.isArray(market.outcomes)) return;
      market.outcomes.forEach((outcomeValue) => {
        if (!outcomeValue || typeof outcomeValue !== 'object') return;
        const outcome = outcomeValue as { name?: unknown; price?: unknown };
        if (typeof outcome.name !== 'string' || typeof outcome.price !== 'number' || !Number.isFinite(outcome.price))
          return;
        if (outcome.name === match.home_team && (homeOdds === null || outcome.price > homeOdds))
          homeOdds = outcome.price;
        if (outcome.name === match.away_team && (awayOdds === null || outcome.price > awayOdds))
          awayOdds = outcome.price;
      });
    });
    return [{ id: match.id, homeOdds, awayOdds, bookmakerCount: match.bookmakers.length }];
  });
}

export async function listOddsSnapshots(limit: number): Promise<OddsSnapshotSummary[]> {
  const sql = getSqlClient();
  const rows =
    (await sql`SELECT id, created_at, sport_key, regions_csv, markets, match_count, source_url, payload FROM odds_api_snapshots ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(limit, 200))}`) as SnapshotRow[];
  return rows.map(summary);
}

export async function getOddsSnapshotById(id: number): Promise<OddsSnapshotDetail | null> {
  const sql = getSqlClient();
  const rows =
    (await sql`SELECT id, created_at, sport_key, regions_csv, markets, match_count, source_url, payload FROM odds_api_snapshots WHERE id=${id} LIMIT 1`) as SnapshotRow[];
  return rows[0] ? { ...summary(rows[0]), sourceUrl: rows[0].source_url, payload: rows[0].payload } : null;
}

export async function getOddsSnapshotInsights(id: number, lookbackCount = 10): Promise<OddsSnapshotInsights | null> {
  const sql = getSqlClient();
  const lookback = Math.max(2, Math.min(lookbackCount, 50));
  const rows = (await sql`
    WITH anchor AS (SELECT sport_key, regions_csv, markets FROM odds_api_snapshots WHERE id=${id})
    SELECT s.id, s.created_at, s.sport_key, s.regions_csv, s.markets, s.match_count, s.source_url, s.payload
    FROM odds_api_snapshots s JOIN anchor USING (sport_key, regions_csv, markets)
    ORDER BY created_at DESC LIMIT ${lookback}
  `) as SnapshotRow[];
  const current = rows.find((row) => Number(row.id) === id);
  if (!current) return null;
  const tracked = new Set(parseMatches(current.payload).map((match) => match.id));
  const timeline = rows
    .slice()
    .reverse()
    .map((row) => {
      const matches = parseMatches(row.payload).filter((match) => tracked.has(match.id));
      return {
        snapshotId: Number(row.id),
        createdAt: row.created_at,
        avgHomeOdds: round4(average(matches.flatMap((match) => (match.homeOdds === null ? [] : [match.homeOdds])))),
        avgAwayOdds: round4(average(matches.flatMap((match) => (match.awayOdds === null ? [] : [match.awayOdds])))),
        avgBookmakersPerMatch: round4(average(matches.map((match) => match.bookmakerCount))),
        trackedMatchCount: matches.length,
      };
    });
  if (!timeline.length) return null;
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  return {
    lookbackCount: lookback,
    currentSnapshotId: Number(current.id),
    currentCreatedAt: current.created_at,
    currentMatchCount: Number(current.match_count),
    trackedMatchCount: tracked.size,
    avgHomeOddsDelta:
      first.avgHomeOdds !== null && last.avgHomeOdds !== null ? round4(last.avgHomeOdds - first.avgHomeOdds) : null,
    avgAwayOddsDelta:
      first.avgAwayOdds !== null && last.avgAwayOdds !== null ? round4(last.avgAwayOdds - first.avgAwayOdds) : null,
    avgBookmakersPerMatchDelta:
      first.avgBookmakersPerMatch !== null && last.avgBookmakersPerMatch !== null
        ? round4(last.avgBookmakersPerMatch - first.avgBookmakersPerMatch)
        : null,
    timeline,
  };
}
