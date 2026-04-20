import { neon } from '@neondatabase/serverless';

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

let schemaReady: Promise<void> | null = null;

const getSqlClient = () => {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_URL is not configured');
  }
  return neon(connectionString);
};

const toSummary = (row: SnapshotRow): OddsSnapshotSummary => ({
  id: Number(row.id),
  createdAt: row.created_at,
  sportKey: row.sport_key,
  regions: row.regions_csv,
  markets: row.markets,
  matchCount: Number(row.match_count),
});

export const ensureSnapshotsSchema = async (): Promise<void> => {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSqlClient();
      await sql`
        CREATE TABLE IF NOT EXISTS odds_api_snapshots (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          sport_key TEXT NOT NULL,
          regions_csv TEXT NOT NULL,
          markets TEXT NOT NULL,
          source_url TEXT NOT NULL,
          match_count INTEGER NOT NULL,
          payload JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_api_snapshots_created_at_idx
          ON odds_api_snapshots (created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_api_snapshots_sport_key_idx
          ON odds_api_snapshots (sport_key)
      `;
    })();
  }

  await schemaReady;
};

export const storeOddsSnapshot = async (input: {
  sportKey: string;
  regions: string;
  markets: string;
  sourceUrl: string;
  responseText: string;
}): Promise<void> => {
  await ensureSnapshotsSchema();
  const sql = getSqlClient();

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(input.responseText);
  } catch {
    throw new Error('Cannot persist non-JSON odds response payload');
  }

  const matchCount = Array.isArray(parsedPayload) ? parsedPayload.length : 0;

  await sql`
    INSERT INTO odds_api_snapshots (sport_key, regions_csv, markets, source_url, match_count, payload)
    VALUES (
      ${input.sportKey},
      ${input.regions},
      ${input.markets},
      ${input.sourceUrl},
      ${matchCount},
      ${JSON.stringify(parsedPayload)}::jsonb
    )
  `;
};

export const listOddsSnapshots = async (limit: number): Promise<OddsSnapshotSummary[]> => {
  await ensureSnapshotsSchema();
  const sql = getSqlClient();

  const safeLimit = Math.max(1, Math.min(limit, 200));
  const rows = (await sql`
    SELECT id, created_at, sport_key, regions_csv, markets, match_count, source_url, payload
    FROM odds_api_snapshots
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `) as SnapshotRow[];

  return rows.map(toSummary);
};

export const getOddsSnapshotById = async (id: number): Promise<OddsSnapshotDetail | null> => {
  await ensureSnapshotsSchema();
  const sql = getSqlClient();

  const rows = (await sql`
    SELECT id, created_at, sport_key, regions_csv, markets, match_count, source_url, payload
    FROM odds_api_snapshots
    WHERE id = ${id}
    LIMIT 1
  `) as SnapshotRow[];

  if (!rows[0]) {
    return null;
  }

  return {
    ...toSummary(rows[0]),
    sourceUrl: rows[0].source_url,
    payload: rows[0].payload,
  };
};

type MatchForInsight = {
  id: string;
  homeOdds: number | null;
  awayOdds: number | null;
  bookmakerCount: number;
};

const asFinite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const parseMatchesForInsight = (payload: unknown): MatchForInsight[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((rawMatch) => {
      if (!rawMatch || typeof rawMatch !== 'object') return null;

      const match = rawMatch as {
        id?: unknown;
        home_team?: unknown;
        away_team?: unknown;
        bookmakers?: unknown;
      };

      if (typeof match.id !== 'string') return null;
      if (!Array.isArray(match.bookmakers)) return null;

      let homeBest: number | null = null;
      let awayBest: number | null = null;

      match.bookmakers.forEach((rawBookmaker) => {
        if (!rawBookmaker || typeof rawBookmaker !== 'object') return;
        const bookmaker = rawBookmaker as { markets?: unknown };
        if (!Array.isArray(bookmaker.markets)) return;

        const h2h = bookmaker.markets.find(
          (rawMarket) =>
            rawMarket &&
            typeof rawMarket === 'object' &&
            (rawMarket as { key?: unknown }).key === 'h2h'
        ) as { outcomes?: unknown } | undefined;

        if (!h2h || !Array.isArray(h2h.outcomes)) return;

        h2h.outcomes.forEach((rawOutcome) => {
          if (!rawOutcome || typeof rawOutcome !== 'object') return;
          const outcome = rawOutcome as { name?: unknown; price?: unknown };
          if (typeof outcome.name !== 'string') return;
          const price = asFinite(outcome.price);
          if (!price) return;

          if (outcome.name === match.home_team && (homeBest === null || price > homeBest)) {
            homeBest = price;
          }
          if (outcome.name === match.away_team && (awayBest === null || price > awayBest)) {
            awayBest = price;
          }
        });
      });

      return {
        id: match.id,
        homeOdds: homeBest,
        awayOdds: awayBest,
        bookmakerCount: match.bookmakers.length,
      };
    })
    .filter((item): item is MatchForInsight => Boolean(item));
};

const average = (values: number[]): number | null => {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const round2 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100;

export const getOddsSnapshotInsights = async (
  id: number,
  lookbackCount = 10
): Promise<OddsSnapshotInsights | null> => {
  await ensureSnapshotsSchema();
  const sql = getSqlClient();

  const safeLookback = Math.max(2, Math.min(lookbackCount, 50));
  const rows = (await sql`
    SELECT id, created_at, sport_key, regions_csv, markets, match_count, source_url, payload
    FROM odds_api_snapshots
    WHERE sport_key = (
      SELECT sport_key FROM odds_api_snapshots WHERE id = ${id}
    )
      AND regions_csv = (
        SELECT regions_csv FROM odds_api_snapshots WHERE id = ${id}
      )
      AND markets = (
        SELECT markets FROM odds_api_snapshots WHERE id = ${id}
      )
    ORDER BY created_at DESC
    LIMIT ${safeLookback}
  `) as SnapshotRow[];

  if (!rows.length) {
    return null;
  }

  const currentRow = rows.find((row) => Number(row.id) === id);
  if (!currentRow) {
    return null;
  }

  const currentMatches = parseMatchesForInsight(currentRow.payload);
  const trackedMatchIds = new Set(currentMatches.map((match) => match.id));

  const timeline = rows
    .slice()
    .reverse()
    .map((row) => {
      const matches = parseMatchesForInsight(row.payload).filter((match) => trackedMatchIds.has(match.id));
      const avgHomeOdds = round2(
        average(matches.map((match) => match.homeOdds).filter((odd): odd is number => odd !== null))
      );
      const avgAwayOdds = round2(
        average(matches.map((match) => match.awayOdds).filter((odd): odd is number => odd !== null))
      );
      const avgBookmakersPerMatch = round2(
        average(matches.map((match) => match.bookmakerCount).filter((count) => Number.isFinite(count)))
      );

      return {
        snapshotId: Number(row.id),
        createdAt: row.created_at,
        avgHomeOdds,
        avgAwayOdds,
        avgBookmakersPerMatch,
        trackedMatchCount: matches.length,
      };
    });

  if (!timeline.length) {
    return null;
  }

  const first = timeline[0];
  const last = timeline[timeline.length - 1];

  return {
    lookbackCount: safeLookback,
    currentSnapshotId: Number(currentRow.id),
    currentCreatedAt: currentRow.created_at,
    currentMatchCount: Number(currentRow.match_count),
    trackedMatchCount: trackedMatchIds.size,
    avgHomeOddsDelta:
      first.avgHomeOdds !== null && last.avgHomeOdds !== null ? round2(last.avgHomeOdds - first.avgHomeOdds) : null,
    avgAwayOddsDelta:
      first.avgAwayOdds !== null && last.avgAwayOdds !== null ? round2(last.avgAwayOdds - first.avgAwayOdds) : null,
    avgBookmakersPerMatchDelta:
      first.avgBookmakersPerMatch !== null && last.avgBookmakersPerMatch !== null
        ? round2(last.avgBookmakersPerMatch - first.avgBookmakersPerMatch)
        : null,
    timeline,
  };
};
