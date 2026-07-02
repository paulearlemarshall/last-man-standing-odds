import { createHash } from 'node:crypto';
import { getSqlClient } from './snapshotDb.js';

type ApiOddsOutcome = { name?: unknown; price?: unknown };
type ApiOddsMarket = { key?: unknown; outcomes?: unknown };
type ApiOddsBookmaker = { key?: unknown; title?: unknown; markets?: unknown };
type ApiOddsMatch = {
  id?: unknown;
  commence_time?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  bookmakers?: unknown;
};

type NormalizedMarketPoint = {
  match_id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmaker_key: string;
  bookmaker_title: string;
  outcome_name: string;
  outcome_side: 'home' | 'away' | 'draw';
  decimal_odds: number;
  implied_prob_raw: number;
  implied_prob_novig: number;
};

const asFinite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseSnapshotPayloadForMarketPoints(payload: unknown): NormalizedMarketPoint[] {
  if (!Array.isArray(payload)) return [];
  const points: NormalizedMarketPoint[] = [];

  payload.forEach((rawMatch) => {
    if (!rawMatch || typeof rawMatch !== 'object') return;
    const match = rawMatch as ApiOddsMatch;
    if (
      typeof match.id !== 'string' ||
      typeof match.commence_time !== 'string' ||
      typeof match.home_team !== 'string' ||
      typeof match.away_team !== 'string' ||
      !Array.isArray(match.bookmakers)
    )
      return;

    match.bookmakers.forEach((rawBookmaker) => {
      if (!rawBookmaker || typeof rawBookmaker !== 'object') return;
      const bookmaker = rawBookmaker as ApiOddsBookmaker;
      if (typeof bookmaker.key !== 'string' || typeof bookmaker.title !== 'string' || !Array.isArray(bookmaker.markets))
        return;
      const h2h = bookmaker.markets.find(
        (rawMarket) => rawMarket && typeof rawMarket === 'object' && (rawMarket as ApiOddsMarket).key === 'h2h'
      ) as ApiOddsMarket | undefined;
      if (!h2h || !Array.isArray(h2h.outcomes)) return;

      const outcomes = h2h.outcomes
        .map((rawOutcome) => {
          if (!rawOutcome || typeof rawOutcome !== 'object') return null;
          const outcome = rawOutcome as ApiOddsOutcome;
          if (typeof outcome.name !== 'string') return null;
          const price = asFinite(outcome.price);
          if (price === null || price <= 1) return null;
          const side =
            outcome.name === match.home_team
              ? 'home'
              : outcome.name === match.away_team
                ? 'away'
                : /^(draw|tie)$/i.test(outcome.name)
                  ? 'draw'
                  : null;
          return side ? { name: outcome.name, side, price, implied: 1 / price } : null;
        })
        .filter((value): value is { name: string; side: 'home' | 'away' | 'draw'; price: number; implied: number } =>
          Boolean(value)
        );
      const overround = outcomes.reduce((sum, outcome) => sum + outcome.implied, 0);
      if (overround <= 0) return;

      outcomes.forEach((outcome) =>
        points.push({
          match_id: match.id as string,
          commence_time: match.commence_time as string,
          home_team: match.home_team as string,
          away_team: match.away_team as string,
          bookmaker_key: bookmaker.key as string,
          bookmaker_title: bookmaker.title as string,
          outcome_name: outcome.name,
          outcome_side: outcome.side,
          decimal_odds: outcome.price,
          implied_prob_raw: outcome.implied,
          implied_prob_novig: outcome.implied / overround,
        })
      );
    });
  });
  return points;
}

export async function insertNormalizedMarketPoints(input: {
  snapshotId: number;
  createdAt: string;
  sportKey: string;
  regions: string;
  markets: string;
  payload: unknown;
}): Promise<number> {
  const sql = getSqlClient();
  const points = parseSnapshotPayloadForMarketPoints(input.payload);
  if (!points.length) return 0;
  await sql`
    INSERT INTO odds_market_points (
      snapshot_id, captured_at, sport_key, regions_csv, markets, match_id, commence_time,
      home_team, away_team, bookmaker_key, bookmaker_title, outcome_name, outcome_side,
      decimal_odds, implied_prob_raw, implied_prob_novig
    )
    SELECT ${input.snapshotId}, ${input.createdAt}::timestamptz, ${input.sportKey}, ${input.regions}, ${input.markets},
      p.match_id, p.commence_time::timestamptz, p.home_team, p.away_team, p.bookmaker_key,
      p.bookmaker_title, p.outcome_name, p.outcome_side, p.decimal_odds, p.implied_prob_raw, p.implied_prob_novig
    FROM jsonb_to_recordset(${JSON.stringify(points)}::jsonb) AS p(
      match_id text, commence_time text, home_team text, away_team text, bookmaker_key text,
      bookmaker_title text, outcome_name text, outcome_side text, decimal_odds double precision,
      implied_prob_raw double precision, implied_prob_novig double precision
    )
  `;
  return points.length;
}

export async function storeOddsSnapshot(input: {
  sportKey: string;
  regions: string;
  markets: string;
  sourceUrl: string;
  responseText: string;
}): Promise<void> {
  const sql = getSqlClient();
  let payload: unknown;
  try {
    payload = JSON.parse(input.responseText);
  } catch {
    throw new Error('Cannot persist non-JSON odds response payload');
  }
  const payloadJson = JSON.stringify(payload);
  const payloadHash = createHash('sha256').update(payloadJson).digest('hex');
  const latest = (await sql`
    SELECT payload_hash FROM odds_api_snapshots
    WHERE sport_key=${input.sportKey} AND regions_csv=${input.regions} AND markets=${input.markets}
    ORDER BY created_at DESC LIMIT 1
  `) as { payload_hash: string | null }[];
  if (latest[0]?.payload_hash === payloadHash) return;
  const rows = (await sql`
    INSERT INTO odds_api_snapshots (sport_key, regions_csv, markets, source_url, match_count, payload, payload_hash)
    VALUES (${input.sportKey}, ${input.regions}, ${input.markets}, ${input.sourceUrl}, ${Array.isArray(payload) ? payload.length : 0}, ${payloadJson}::jsonb, ${payloadHash})
    RETURNING id, created_at
  `) as { id: number; created_at: string }[];
  if (!rows[0]) return;
  await insertNormalizedMarketPoints({
    snapshotId: Number(rows[0].id),
    createdAt: rows[0].created_at,
    sportKey: input.sportKey,
    regions: input.regions,
    markets: input.markets,
    payload,
  });
}

export async function cleanupOldOddsSnapshots(retentionDays = 30): Promise<number> {
  const sql = getSqlClient();
  const safeDays = Math.max(1, Math.min(Math.floor(retentionDays), 3650));
  const rows =
    await sql`DELETE FROM odds_api_snapshots WHERE created_at < NOW() - (${safeDays} * INTERVAL '1 day') RETURNING id`;
  return rows.length;
}
