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

type ContextSnapshotRow = {
  id: number;
  created_at: string;
};

type TeamMarketPointRow = {
  snapshot_id: number;
  created_at: string;
  match_id: string;
  home_team: string;
  away_team: string;
  implied_prob_novig: number;
  decimal_odds: number;
};

type TeamMarketPoint = {
  snapshotId: number;
  createdAt: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  impliedProbNoVig: number;
  decimalOdds: number;
};

type SnapshotStats = {
  snapshotId: number;
  createdAt: string;
  sampleQuotes: number;
  matchCount: number;
  avgImpliedProb: number | null;
  avgOdds: number | null;
  avgBookmakersPerMatch: number | null;
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

type MatchForInsight = {
  id: string;
  homeOdds: number | null;
  awayOdds: number | null;
  bookmakerCount: number;
};

type ApiOddsOutcome = {
  name?: unknown;
  price?: unknown;
};

type ApiOddsMarket = {
  key?: unknown;
  outcomes?: unknown;
};

type ApiOddsBookmaker = {
  key?: unknown;
  title?: unknown;
  markets?: unknown;
};

type ApiOddsMatch = {
  id?: unknown;
  commence_time?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  bookmakers?: unknown;
};

export interface OddsSnapshotSummary {
  id: number;
  createdAt: string;
  sportKey: string;
  regions: string;
  markets: string;
  matchCount: number;
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

export interface OddsSnapshotDetail extends OddsSnapshotSummary {
  sourceUrl: string;
  payload: unknown;
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

let schemaReady: Promise<void> | null = null;

const getSqlClient = () => {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_URL is not configured');
  }
  return neon(connectionString);
};

const asFinite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const average = (values: number[]): number | null => {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const standardDeviation = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean === null) return null;

  const variance =
    values.reduce((sum, value) => {
      const delta = value - mean;
      return sum + delta * delta;
    }, 0) /
    (values.length - 1);

  return Math.sqrt(variance);
};

const round4 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10000) / 10000;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const toSummary = (row: SnapshotRow): OddsSnapshotSummary => ({
  id: Number(row.id),
  createdAt: row.created_at,
  sportKey: row.sport_key,
  regions: row.regions_csv,
  markets: row.markets,
  matchCount: Number(row.match_count),
});

const parseMatchesForInsight = (payload: unknown): MatchForInsight[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((rawMatch) => {
      if (!rawMatch || typeof rawMatch !== 'object') return null;
      const match = rawMatch as ApiOddsMatch;

      if (typeof match.id !== 'string') return null;
      if (typeof match.home_team !== 'string' || typeof match.away_team !== 'string') return null;
      if (!Array.isArray(match.bookmakers)) return null;

      let homeBest: number | null = null;
      let awayBest: number | null = null;

      match.bookmakers.forEach((rawBookmaker) => {
        if (!rawBookmaker || typeof rawBookmaker !== 'object') return;
        const bookmaker = rawBookmaker as ApiOddsBookmaker;
        if (!Array.isArray(bookmaker.markets)) return;

        const h2h = bookmaker.markets.find(
          (rawMarket) =>
            rawMarket &&
            typeof rawMarket === 'object' &&
            (rawMarket as ApiOddsMarket).key === 'h2h'
        ) as ApiOddsMarket | undefined;

        if (!h2h || !Array.isArray(h2h.outcomes)) return;

        h2h.outcomes.forEach((rawOutcome) => {
          if (!rawOutcome || typeof rawOutcome !== 'object') return;
          const outcome = rawOutcome as ApiOddsOutcome;
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

const parseSnapshotPayloadForMarketPoints = (payload: unknown): NormalizedMarketPoint[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

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
    ) {
      return;
    }

    match.bookmakers.forEach((rawBookmaker) => {
      if (!rawBookmaker || typeof rawBookmaker !== 'object') return;
      const bookmaker = rawBookmaker as ApiOddsBookmaker;

      if (
        typeof bookmaker.key !== 'string' ||
        typeof bookmaker.title !== 'string' ||
        !Array.isArray(bookmaker.markets)
      ) {
        return;
      }

      const h2h = bookmaker.markets.find(
        (rawMarket) => rawMarket && typeof rawMarket === 'object' && (rawMarket as ApiOddsMarket).key === 'h2h'
      ) as ApiOddsMarket | undefined;

      if (!h2h || !Array.isArray(h2h.outcomes)) {
        return;
      }

      const normalizedOutcomes = h2h.outcomes
        .map((rawOutcome) => {
          if (!rawOutcome || typeof rawOutcome !== 'object') return null;
          const outcome = rawOutcome as ApiOddsOutcome;
          if (typeof outcome.name !== 'string') return null;
          const price = asFinite(outcome.price);
          if (price === null || price <= 1) return null;

          let outcomeSide: 'home' | 'away' | 'draw' | null = null;
          if (outcome.name === match.home_team) {
            outcomeSide = 'home';
          } else if (outcome.name === match.away_team) {
            outcomeSide = 'away';
          } else if (/^draw$/i.test(outcome.name) || /^tie$/i.test(outcome.name)) {
            outcomeSide = 'draw';
          }

          if (!outcomeSide) {
            return null;
          }

          const impliedProbRaw = 1 / price;
          return {
            outcomeName: outcome.name,
            outcomeSide,
            decimalOdds: price,
            impliedProbRaw,
          };
        })
        .filter(
          (
            item
          ): item is {
            outcomeName: string;
            outcomeSide: 'home' | 'away' | 'draw';
            decimalOdds: number;
            impliedProbRaw: number;
          } => Boolean(item)
        );

      const overround = normalizedOutcomes.reduce((sum, outcome) => sum + outcome.impliedProbRaw, 0);
      if (overround <= 0) {
        return;
      }

      normalizedOutcomes.forEach((outcome) => {
        points.push({
          match_id: match.id as string,
          commence_time: match.commence_time as string,
          home_team: match.home_team as string,
          away_team: match.away_team as string,
          bookmaker_key: bookmaker.key as string,
          bookmaker_title: bookmaker.title as string,
          outcome_name: outcome.outcomeName,
          outcome_side: outcome.outcomeSide,
          decimal_odds: outcome.decimalOdds,
          implied_prob_raw: outcome.impliedProbRaw,
          implied_prob_novig: outcome.impliedProbRaw / overround,
        });
      });
    });
  });

  return points;
};

const insertNormalizedMarketPoints = async (input: {
  snapshotId: number;
  createdAt: string;
  sportKey: string;
  regions: string;
  markets: string;
  payload: unknown;
}): Promise<number> => {
  const sql = getSqlClient();
  const points = parseSnapshotPayloadForMarketPoints(input.payload);

  if (!points.length) {
    return 0;
  }

  const payloadJson = JSON.stringify(points);
  await sql`
    INSERT INTO odds_market_points (
      snapshot_id,
      captured_at,
      sport_key,
      regions_csv,
      markets,
      match_id,
      commence_time,
      home_team,
      away_team,
      bookmaker_key,
      bookmaker_title,
      outcome_name,
      outcome_side,
      decimal_odds,
      implied_prob_raw,
      implied_prob_novig
    )
    SELECT
      ${input.snapshotId},
      ${input.createdAt}::timestamptz,
      ${input.sportKey},
      ${input.regions},
      ${input.markets},
      p.match_id,
      p.commence_time::timestamptz,
      p.home_team,
      p.away_team,
      p.bookmaker_key,
      p.bookmaker_title,
      p.outcome_name,
      p.outcome_side,
      p.decimal_odds,
      p.implied_prob_raw,
      p.implied_prob_novig
    FROM jsonb_to_recordset(${payloadJson}::jsonb) AS p(
      match_id text,
      commence_time text,
      home_team text,
      away_team text,
      bookmaker_key text,
      bookmaker_title text,
      outcome_name text,
      outcome_side text,
      decimal_odds double precision,
      implied_prob_raw double precision,
      implied_prob_novig double precision
    )
  `;

  return points.length;
};

const getContextSnapshots = async (snapshotId: number, lookbackSnapshots: number): Promise<ContextSnapshotRow[]> => {
  const sql = getSqlClient();
  const safeLookback = Math.max(2, Math.min(lookbackSnapshots, 80));

  const rows = (await sql`
    SELECT id, created_at
    FROM odds_api_snapshots
    WHERE sport_key = (SELECT sport_key FROM odds_api_snapshots WHERE id = ${snapshotId})
      AND regions_csv = (SELECT regions_csv FROM odds_api_snapshots WHERE id = ${snapshotId})
      AND markets = (SELECT markets FROM odds_api_snapshots WHERE id = ${snapshotId})
    ORDER BY created_at DESC
    LIMIT ${safeLookback}
  `) as ContextSnapshotRow[];

  return rows;
};

const ensureContextSnapshotsNormalized = async (snapshotIds: number[]): Promise<void> => {
  if (!snapshotIds.length) return;

  await ensureSnapshotsSchema();
  const sql = getSqlClient();

  const existingRows = (await sql`
    SELECT DISTINCT snapshot_id
    FROM odds_market_points
    WHERE snapshot_id = ANY(${snapshotIds}::bigint[])
  `) as { snapshot_id: number }[];

  const existing = new Set(existingRows.map((row) => Number(row.snapshot_id)));
  const missing = snapshotIds.filter((id) => !existing.has(id));
  if (!missing.length) {
    return;
  }

  const missingSnapshots = (await sql`
    SELECT id, created_at, sport_key, regions_csv, markets, match_count, source_url, payload
    FROM odds_api_snapshots
    WHERE id = ANY(${missing}::bigint[])
  `) as SnapshotRow[];

  for (const snapshot of missingSnapshots) {
    await insertNormalizedMarketPoints({
      snapshotId: Number(snapshot.id),
      createdAt: snapshot.created_at,
      sportKey: snapshot.sport_key,
      regions: snapshot.regions_csv,
      markets: snapshot.markets,
      payload: snapshot.payload,
    });
  }
};

const buildSnapshotStats = (points: TeamMarketPoint[]): SnapshotStats[] => {
  const bySnapshot = new Map<number, TeamMarketPoint[]>();
  points.forEach((point) => {
    const bucket = bySnapshot.get(point.snapshotId) || [];
    bucket.push(point);
    bySnapshot.set(point.snapshotId, bucket);
  });

  return Array.from(bySnapshot.entries())
    .map(([snapshotId, bucket]) => {
      const createdAt = bucket[0]?.createdAt || '';
      const matchCount = new Set(bucket.map((point) => point.matchId)).size;
      const sampleQuotes = bucket.length;
      const avgImpliedProb = average(bucket.map((point) => point.impliedProbNoVig));
      const avgOdds = average(bucket.map((point) => point.decimalOdds));
      const avgBookmakersPerMatch = matchCount > 0 ? sampleQuotes / matchCount : null;

      return {
        snapshotId,
        createdAt,
        sampleQuotes,
        matchCount,
        avgImpliedProb,
        avgOdds,
        avgBookmakersPerMatch,
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const toTeamMarketPoint = (row: TeamMarketPointRow): TeamMarketPoint => ({
  snapshotId: Number(row.snapshot_id),
  createdAt: row.created_at,
  matchId: row.match_id,
  homeTeam: row.home_team,
  awayTeam: row.away_team,
  impliedProbNoVig: Number(row.implied_prob_novig),
  decimalOdds: Number(row.decimal_odds),
});

const buildConfidenceScore = (sampleQuotes: number, snapshotCount: number, volatility: number | null): number => {
  const sampleComponent = clamp(sampleQuotes / 250, 0, 1) * 0.6;
  const snapshotComponent = clamp(snapshotCount / 20, 0, 1) * 0.3;
  const volatilityPenalty = volatility === null ? 0.05 : clamp(volatility / 0.25, 0, 1) * 0.2;
  const confidence = clamp(sampleComponent + snapshotComponent + 0.1 - volatilityPenalty, 0, 1);
  return Math.round(confidence * 100) / 100;
};

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
      await sql`
        CREATE TABLE IF NOT EXISTS odds_market_points (
          id BIGSERIAL PRIMARY KEY,
          snapshot_id BIGINT NOT NULL REFERENCES odds_api_snapshots (id) ON DELETE CASCADE,
          captured_at TIMESTAMPTZ NOT NULL,
          sport_key TEXT NOT NULL,
          regions_csv TEXT NOT NULL,
          markets TEXT NOT NULL,
          match_id TEXT NOT NULL,
          commence_time TIMESTAMPTZ NOT NULL,
          home_team TEXT NOT NULL,
          away_team TEXT NOT NULL,
          bookmaker_key TEXT NOT NULL,
          bookmaker_title TEXT NOT NULL,
          outcome_name TEXT NOT NULL,
          outcome_side TEXT NOT NULL,
          decimal_odds DOUBLE PRECISION NOT NULL,
          implied_prob_raw DOUBLE PRECISION NOT NULL,
          implied_prob_novig DOUBLE PRECISION NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_market_points_snapshot_idx
          ON odds_market_points (snapshot_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_market_points_team_idx
          ON odds_market_points (outcome_name, captured_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_market_points_match_idx
          ON odds_market_points (match_id, captured_at DESC)
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

  const rows = (await sql`
    INSERT INTO odds_api_snapshots (sport_key, regions_csv, markets, source_url, match_count, payload)
    VALUES (
      ${input.sportKey},
      ${input.regions},
      ${input.markets},
      ${input.sourceUrl},
      ${matchCount},
      ${JSON.stringify(parsedPayload)}::jsonb
    )
    RETURNING id, created_at
  `) as { id: number; created_at: string }[];

  const inserted = rows[0];
  if (!inserted) {
    return;
  }

  await insertNormalizedMarketPoints({
    snapshotId: Number(inserted.id),
    createdAt: inserted.created_at,
    sportKey: input.sportKey,
    regions: input.regions,
    markets: input.markets,
    payload: parsedPayload,
  });
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
      const avgHomeOdds = round4(
        average(matches.map((match) => match.homeOdds).filter((odd): odd is number => odd !== null))
      );
      const avgAwayOdds = round4(
        average(matches.map((match) => match.awayOdds).filter((odd): odd is number => odd !== null))
      );
      const avgBookmakersPerMatch = round4(
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
      first.avgHomeOdds !== null && last.avgHomeOdds !== null ? round4(last.avgHomeOdds - first.avgHomeOdds) : null,
    avgAwayOddsDelta:
      first.avgAwayOdds !== null && last.avgAwayOdds !== null ? round4(last.avgAwayOdds - first.avgAwayOdds) : null,
    avgBookmakersPerMatchDelta:
      first.avgBookmakersPerMatch !== null && last.avgBookmakersPerMatch !== null
        ? round4(last.avgBookmakersPerMatch - first.avgBookmakersPerMatch)
        : null,
    timeline,
  };
};

export const listTrackedTeamsForSnapshot = async (snapshotId: number): Promise<string[]> => {
  await ensureSnapshotsSchema();
  const contextSnapshots = await getContextSnapshots(snapshotId, 30);
  const snapshotIds = contextSnapshots.map((row) => Number(row.id));
  if (!snapshotIds.length) {
    return [];
  }

  await ensureContextSnapshotsNormalized(snapshotIds);

  const sql = getSqlClient();
  const rows = (await sql`
    SELECT DISTINCT outcome_name
    FROM odds_market_points
    WHERE snapshot_id = ANY(${snapshotIds}::bigint[])
      AND outcome_side IN ('home', 'away')
    ORDER BY outcome_name ASC
  `) as { outcome_name: string }[];

  return rows
    .map((row) => row.outcome_name)
    .filter((name) => typeof name === 'string' && name.length > 0);
};

export const getTeamFormAnalytics = async (
  snapshotId: number,
  team: string,
  lookbackSnapshots = 30
): Promise<TeamFormAnalytics | null> => {
  await ensureSnapshotsSchema();

  const normalizedTeam = team.trim();
  if (!normalizedTeam) {
    return null;
  }

  const contextSnapshots = await getContextSnapshots(snapshotId, lookbackSnapshots);
  const snapshotIds = contextSnapshots.map((row) => Number(row.id));
  if (!snapshotIds.length) {
    return null;
  }

  await ensureContextSnapshotsNormalized(snapshotIds);

  const sql = getSqlClient();
  const rows = (await sql`
    SELECT snapshot_id, captured_at AS created_at, match_id, home_team, away_team, implied_prob_novig, decimal_odds
    FROM odds_market_points
    WHERE snapshot_id = ANY(${snapshotIds}::bigint[])
      AND outcome_name = ${normalizedTeam}
      AND outcome_side IN ('home', 'away')
    ORDER BY captured_at ASC
  `) as TeamMarketPointRow[];

  if (!rows.length) {
    return null;
  }

  const points = rows.map(toTeamMarketPoint);
  const timelineStats = buildSnapshotStats(points);
  const first = timelineStats[0];
  const last = timelineStats[timelineStats.length - 1];

  const avgImpliedProb = average(points.map((point) => point.impliedProbNoVig));
  const avgOdds = average(points.map((point) => point.decimalOdds));
  const volatility = standardDeviation(
    timelineStats
      .map((point) => point.avgImpliedProb)
      .filter((value): value is number => value !== null)
  );

  const impliedProbDelta =
    first && last && first.avgImpliedProb !== null && last.avgImpliedProb !== null
      ? last.avgImpliedProb - first.avgImpliedProb
      : null;
  const momentumPerSnapshot =
    impliedProbDelta !== null && timelineStats.length > 1
      ? impliedProbDelta / (timelineStats.length - 1)
      : null;

  const opponentMap = new Map<string, TeamMarketPoint[]>();
  points.forEach((point) => {
    const opponent = point.homeTeam === normalizedTeam ? point.awayTeam : point.homeTeam;
    const bucket = opponentMap.get(opponent) || [];
    bucket.push(point);
    opponentMap.set(opponent, bucket);
  });

  const opponents = Array.from(opponentMap.entries())
    .map(([opponent, opponentPoints]) => {
      const stats = buildSnapshotStats(opponentPoints);
      const firstPoint = stats[0];
      const lastPoint = stats[stats.length - 1];
      const trendDelta =
        firstPoint &&
        lastPoint &&
        firstPoint.avgImpliedProb !== null &&
        lastPoint.avgImpliedProb !== null
          ? lastPoint.avgImpliedProb - firstPoint.avgImpliedProb
          : null;

      return {
        opponent,
        sampleQuotes: opponentPoints.length,
        matchCount: new Set(opponentPoints.map((point) => point.matchId)).size,
        avgImpliedProb: average(opponentPoints.map((point) => point.impliedProbNoVig)),
        trendDelta,
      };
    })
    .sort((a, b) => {
      if (b.sampleQuotes !== a.sampleQuotes) return b.sampleQuotes - a.sampleQuotes;
      return (b.avgImpliedProb ?? -1) - (a.avgImpliedProb ?? -1);
    });

  const totalMatches = new Set(points.map((point) => point.matchId)).size;
  const confidenceScore = buildConfidenceScore(points.length, timelineStats.length, volatility);

  return {
    team: normalizedTeam,
    lookbackSnapshots: contextSnapshots.length,
    sampleQuotes: points.length,
    totalMatches,
    avgImpliedProb: round4(avgImpliedProb),
    currentImpliedProb: round4(last?.avgImpliedProb ?? null),
    impliedProbDelta: round4(impliedProbDelta),
    momentumPerSnapshot: round4(momentumPerSnapshot),
    volatility: round4(volatility),
    confidenceScore,
    timeline: timelineStats.map((point) => ({
      snapshotId: point.snapshotId,
      createdAt: point.createdAt,
      sampleQuotes: point.sampleQuotes,
      matchCount: point.matchCount,
      avgImpliedProb: round4(point.avgImpliedProb),
      avgOdds: round4(point.avgOdds),
      avgBookmakersPerMatch: round4(point.avgBookmakersPerMatch),
    })),
    opponents: opponents.slice(0, 30).map((opponent) => ({
      opponent: opponent.opponent,
      sampleQuotes: opponent.sampleQuotes,
      matchCount: opponent.matchCount,
      avgImpliedProb: round4(opponent.avgImpliedProb),
      trendDelta: round4(opponent.trendDelta),
    })),
  };
};

export const getHeadToHeadAnalytics = async (
  snapshotId: number,
  teamA: string,
  teamB: string,
  lookbackSnapshots = 30
): Promise<HeadToHeadAnalytics | null> => {
  await ensureSnapshotsSchema();

  const normalizedTeamA = teamA.trim();
  const normalizedTeamB = teamB.trim();
  if (!normalizedTeamA || !normalizedTeamB || normalizedTeamA === normalizedTeamB) {
    return null;
  }

  const contextSnapshots = await getContextSnapshots(snapshotId, lookbackSnapshots);
  const snapshotIds = contextSnapshots.map((row) => Number(row.id));
  if (!snapshotIds.length) {
    return null;
  }

  await ensureContextSnapshotsNormalized(snapshotIds);
  const sql = getSqlClient();

  const rows = (await sql`
    SELECT snapshot_id, captured_at AS created_at, match_id, home_team, away_team, outcome_name, implied_prob_novig, decimal_odds
    FROM odds_market_points
    WHERE snapshot_id = ANY(${snapshotIds}::bigint[])
      AND outcome_name IN (${normalizedTeamA}, ${normalizedTeamB})
      AND (
        (home_team = ${normalizedTeamA} AND away_team = ${normalizedTeamB})
        OR (home_team = ${normalizedTeamB} AND away_team = ${normalizedTeamA})
      )
      AND outcome_side IN ('home', 'away')
    ORDER BY captured_at ASC
  `) as (TeamMarketPointRow & { outcome_name: string })[];

  if (!rows.length) {
    return null;
  }

  const pointsA = rows
    .filter((row) => row.outcome_name === normalizedTeamA)
    .map((row) => toTeamMarketPoint(row));
  const pointsB = rows
    .filter((row) => row.outcome_name === normalizedTeamB)
    .map((row) => toTeamMarketPoint(row));

  const timelineA = buildSnapshotStats(pointsA);
  const timelineB = buildSnapshotStats(pointsB);
  const bySnapshotA = new Map(timelineA.map((point) => [point.snapshotId, point]));
  const bySnapshotB = new Map(timelineB.map((point) => [point.snapshotId, point]));

  const timeline: HeadToHeadTimelinePoint[] = contextSnapshots
    .slice()
    .reverse()
    .map((snapshot) => {
      const pointA = bySnapshotA.get(Number(snapshot.id));
      const pointB = bySnapshotB.get(Number(snapshot.id));

      const avgImpliedProbA = pointA?.avgImpliedProb ?? null;
      const avgImpliedProbB = pointB?.avgImpliedProb ?? null;
      const edgeA =
        avgImpliedProbA !== null && avgImpliedProbB !== null ? avgImpliedProbA - avgImpliedProbB : null;

      return {
        snapshotId: Number(snapshot.id),
        createdAt: snapshot.created_at,
        avgImpliedProbA: round4(avgImpliedProbA),
        avgImpliedProbB: round4(avgImpliedProbB),
        edgeA: round4(edgeA),
        sampleQuotes: (pointA?.sampleQuotes || 0) + (pointB?.sampleQuotes || 0),
        matchCount: Math.max(pointA?.matchCount || 0, pointB?.matchCount || 0),
      };
    })
    .filter((point) => point.sampleQuotes > 0);

  if (!timeline.length) {
    return null;
  }

  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const avgImpliedProbA = average(pointsA.map((point) => point.impliedProbNoVig));
  const avgImpliedProbB = average(pointsB.map((point) => point.impliedProbNoVig));
  const edgeDeltaA =
    first.edgeA !== null && last.edgeA !== null ? last.edgeA - first.edgeA : null;

  const totalQuotes = pointsA.length + pointsB.length;
  const totalMatches = new Set(rows.map((row) => row.match_id)).size;
  const volatility = standardDeviation(
    timeline.map((point) => point.edgeA).filter((edge): edge is number => edge !== null)
  );
  const confidenceScore = buildConfidenceScore(totalQuotes, timeline.length, volatility);

  return {
    teamA: normalizedTeamA,
    teamB: normalizedTeamB,
    lookbackSnapshots: contextSnapshots.length,
    sampleQuotes: totalQuotes,
    totalMatches,
    currentEdgeA: round4(last.edgeA),
    edgeDeltaA: round4(edgeDeltaA),
    avgImpliedProbA: round4(avgImpliedProbA),
    avgImpliedProbB: round4(avgImpliedProbB),
    confidenceScore,
    timeline,
  };
};
