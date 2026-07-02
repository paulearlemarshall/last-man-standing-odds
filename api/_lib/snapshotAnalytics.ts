import { getSqlClient } from './snapshotDb.js';
import { average, buildConfidenceScore, round4, standardDeviation } from './analyticsMath.js';
import { insertNormalizedMarketPoints } from './snapshotIngest.js';

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
  commence_time: string;
  home_team: string;
  away_team: string;
  implied_prob_novig: number;
  decimal_odds: number;
};

type TeamMarketPoint = {
  snapshotId: number;
  createdAt: string;
  matchId: string;
  commenceTime: string;
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

export interface TeamMatchMovement {
  matchId: string;
  opponent: string;
  commenceTime: string;
  snapshotsObserved: number;
  openingImpliedProb: number | null;
  currentImpliedProb: number | null;
  impliedProbDelta: number | null;
  movementPerDay: number | null;
}

export interface TeamMovementSummary {
  trackedMatches: number;
  movedUpMatches: number;
  movedDownMatches: number;
  flatMatches: number;
  avgImpliedProbDelta: number | null;
  avgMovementPerDay: number | null;
}

export interface TeamFormAnalytics {
  team: string;
  lookbackSnapshots: number;
  bucketMinutes: number;
  minDelta: number;
  effectiveSampleBuckets: number;
  timeSpanHours: number | null;
  sampleQuotes: number;
  totalMatches: number;
  avgImpliedProb: number | null;
  currentImpliedProb: number | null;
  impliedProbDelta: number | null;
  momentumPerSnapshot: number | null;
  volatility: number | null;
  confidenceScore: number;
  openingVsCurrentAvgDelta: number | null;
  movementVelocityPerDay: number | null;
  movementSummary: TeamMovementSummary;
  timeline: TeamFormTimelinePoint[];
  opponents: TeamOpponentEdge[];
  matchMovements: TeamMatchMovement[];
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
  bucketMinutes: number;
  minDelta: number;
  effectiveSampleBuckets: number;
  timeSpanHours: number | null;
  sampleQuotes: number;
  totalMatches: number;
  currentEdgeA: number | null;
  edgeDeltaA: number | null;
  avgImpliedProbA: number | null;
  avgImpliedProbB: number | null;
  confidenceScore: number;
  timeline: HeadToHeadTimelinePoint[];
}

const ADAPTIVE_BUCKET_CANDIDATES = [15, 30, 60, 180, 360, 720, 1440] as const;
const MIN_EFFECTIVE_BUCKETS = 4;
const MIN_H2H_OVERLAP_BUCKETS = 3;

const toBucketMs = (isoDateTime: string, bucketMinutes: number): number => {
  const timestamp = new Date(isoDateTime).getTime();
  const bucketMs = Math.max(1, bucketMinutes) * 60 * 1000;
  return Math.floor(timestamp / bucketMs) * bucketMs;
};

const computeTimeSpanHours = (values: string[]): number | null => {
  if (values.length < 2) return null;
  const sorted = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  return (sorted[sorted.length - 1] - sorted[0]) / (1000 * 60 * 60);
};

const getContextSnapshots = async (snapshotId: number, lookbackSnapshots: number): Promise<ContextSnapshotRow[]> => {
  const sql = getSqlClient();
  const safeLookback = Math.max(2, Math.min(lookbackSnapshots, 80));

  const rows = (await sql`
    WITH anchor AS (
      SELECT sport_key, regions_csv, markets FROM odds_api_snapshots WHERE id = ${snapshotId}
    )
    SELECT snapshots.id, snapshots.created_at
    FROM odds_api_snapshots snapshots
    JOIN anchor USING (sport_key, regions_csv, markets)
    ORDER BY created_at DESC
    LIMIT ${safeLookback}
  `) as ContextSnapshotRow[];

  return rows;
};

const ensureContextSnapshotsNormalized = async (snapshotIds: number[]): Promise<void> => {
  if (!snapshotIds.length) return;

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

  await Promise.all(
    missingSnapshots.map((snapshot) =>
      insertNormalizedMarketPoints({
        snapshotId: Number(snapshot.id),
        createdAt: snapshot.created_at,
        sportKey: snapshot.sport_key,
        regions: snapshot.regions_csv,
        markets: snapshot.markets,
        payload: snapshot.payload,
      })
    )
  );
};

const bucketAndFilterTeamPoints = (
  points: TeamMarketPoint[],
  bucketMinutes: number,
  minDelta: number
): TeamMarketPoint[] => {
  const snapshotMatchAggregate = new Map<
    string,
    {
      snapshotId: number;
      createdAt: string;
      matchId: string;
      commenceTime: string;
      homeTeam: string;
      awayTeam: string;
      impliedProbSum: number;
      decimalOddsSum: number;
      count: number;
    }
  >();

  points.forEach((point) => {
    const key = `${point.snapshotId}::${point.matchId}`;
    const current = snapshotMatchAggregate.get(key) || {
      snapshotId: point.snapshotId,
      createdAt: point.createdAt,
      matchId: point.matchId,
      commenceTime: point.commenceTime,
      homeTeam: point.homeTeam,
      awayTeam: point.awayTeam,
      impliedProbSum: 0,
      decimalOddsSum: 0,
      count: 0,
    };

    current.impliedProbSum += point.impliedProbNoVig;
    current.decimalOddsSum += point.decimalOdds;
    current.count += 1;
    snapshotMatchAggregate.set(key, current);
  });

  const snapshotMatchPoints: TeamMarketPoint[] = Array.from(snapshotMatchAggregate.values()).map((item) => ({
    snapshotId: item.snapshotId,
    createdAt: item.createdAt,
    matchId: item.matchId,
    commenceTime: item.commenceTime,
    homeTeam: item.homeTeam,
    awayTeam: item.awayTeam,
    impliedProbNoVig: item.count > 0 ? item.impliedProbSum / item.count : 0,
    decimalOdds: item.count > 0 ? item.decimalOddsSum / item.count : 0,
  }));

  const latestByMatchBucket = new Map<string, TeamMarketPoint>();
  snapshotMatchPoints.forEach((point) => {
    const bucketMs = toBucketMs(point.createdAt, bucketMinutes);
    const key = `${point.matchId}::${bucketMs}`;
    const existing = latestByMatchBucket.get(key);
    if (!existing || new Date(point.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestByMatchBucket.set(key, point);
    }
  });

  const byMatch = new Map<string, TeamMarketPoint[]>();
  Array.from(latestByMatchBucket.values()).forEach((point) => {
    const matchBucket = byMatch.get(point.matchId) || [];
    matchBucket.push(point);
    byMatch.set(point.matchId, matchBucket);
  });

  const filtered: TeamMarketPoint[] = [];
  byMatch.forEach((matchPoints) => {
    const sorted = matchPoints
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let lastKept: TeamMarketPoint | null = null;
    sorted.forEach((point, index) => {
      if (index === 0) {
        filtered.push(point);
        lastKept = point;
        return;
      }

      if (!lastKept) {
        filtered.push(point);
        lastKept = point;
        return;
      }

      const delta = Math.abs(point.impliedProbNoVig - lastKept.impliedProbNoVig);
      if (delta >= minDelta) {
        filtered.push(point);
        lastKept = point;
      }
    });
  });

  return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const buildBucketTimelineStats = (points: TeamMarketPoint[], bucketMinutes: number): SnapshotStats[] => {
  const buckets = new Map<
    number,
    {
      latestSnapshotId: number;
      latestCreatedAt: string;
      points: TeamMarketPoint[];
    }
  >();

  points.forEach((point) => {
    const bucketMs = toBucketMs(point.createdAt, bucketMinutes);
    const bucket = buckets.get(bucketMs) || {
      latestSnapshotId: point.snapshotId,
      latestCreatedAt: point.createdAt,
      points: [],
    };
    bucket.points.push(point);
    if (new Date(point.createdAt).getTime() > new Date(bucket.latestCreatedAt).getTime()) {
      bucket.latestSnapshotId = point.snapshotId;
      bucket.latestCreatedAt = point.createdAt;
    }
    buckets.set(bucketMs, bucket);
  });

  return Array.from(buckets.entries())
    .map(([bucketMs, bucket]) => {
      const matchCount = new Set(bucket.points.map((point) => point.matchId)).size;
      const sampleQuotes = bucket.points.length;
      return {
        snapshotId: bucket.latestSnapshotId,
        createdAt: new Date(bucketMs).toISOString(),
        sampleQuotes,
        matchCount,
        avgImpliedProb: average(bucket.points.map((point) => point.impliedProbNoVig)),
        avgOdds: average(bucket.points.map((point) => point.decimalOdds)),
        avgBookmakersPerMatch: matchCount > 0 ? sampleQuotes / matchCount : null,
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const getAdaptiveBucketCandidates = (preferred: number): number[] => {
  const normalizedPreferred = Math.max(1, Math.round(preferred));
  const candidates = new Set<number>([normalizedPreferred, ...ADAPTIVE_BUCKET_CANDIDATES]);
  return Array.from(candidates).sort((a, b) => a - b);
};

const pickAdaptiveTimeline = (
  rawPoints: TeamMarketPoint[],
  preferredBucketMinutes: number,
  minDelta: number,
  minEffectiveBuckets: number = MIN_EFFECTIVE_BUCKETS
): { bucketMinutes: number; points: TeamMarketPoint[]; timeline: SnapshotStats[] } => {
  const candidates = getAdaptiveBucketCandidates(preferredBucketMinutes);

  let best: { bucketMinutes: number; points: TeamMarketPoint[]; timeline: SnapshotStats[] } = {
    bucketMinutes: preferredBucketMinutes,
    points: [],
    timeline: [],
  };

  candidates.forEach((bucketMinutes) => {
    const points = bucketAndFilterTeamPoints(rawPoints, bucketMinutes, minDelta);
    const timeline = buildBucketTimelineStats(points, bucketMinutes);
    const candidate = { bucketMinutes, points, timeline };

    if (timeline.length > best.timeline.length) {
      best = candidate;
    }

    if (timeline.length >= minEffectiveBuckets && best.timeline.length < minEffectiveBuckets) {
      best = candidate;
    }
  });

  return best;
};

const toTeamMarketPoint = (row: TeamMarketPointRow): TeamMarketPoint => ({
  snapshotId: Number(row.snapshot_id),
  createdAt: row.created_at,
  matchId: row.match_id,
  commenceTime: row.commence_time,
  homeTeam: row.home_team,
  awayTeam: row.away_team,
  impliedProbNoVig: Number(row.implied_prob_novig),
  decimalOdds: Number(row.decimal_odds),
});

export const listTrackedTeamsForSnapshot = async (snapshotId: number): Promise<string[]> => {
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

  return rows.map((row) => row.outcome_name).filter((name) => typeof name === 'string' && name.length > 0);
};

export const getTeamFormAnalytics = async (
  snapshotId: number,
  team: string,
  lookbackSnapshots = 30,
  bucketMinutes = 15,
  minDelta = 0.002
): Promise<TeamFormAnalytics | null> => {
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
    SELECT snapshot_id, captured_at AS created_at, match_id, commence_time, home_team, away_team, implied_prob_novig, decimal_odds
    FROM odds_market_points
    WHERE snapshot_id = ANY(${snapshotIds}::bigint[])
      AND outcome_name = ${normalizedTeam}
      AND outcome_side IN ('home', 'away')
    ORDER BY captured_at ASC
  `) as TeamMarketPointRow[];

  if (!rows.length) {
    return null;
  }

  const rawPoints = rows.map(toTeamMarketPoint);
  const adaptiveTeam = pickAdaptiveTimeline(rawPoints, bucketMinutes, minDelta);
  const points = adaptiveTeam.points;
  const timelineStats = adaptiveTeam.timeline;
  if (!points.length || !timelineStats.length) {
    return null;
  }

  const matchSnapshotMap = new Map<
    string,
    {
      matchId: string;
      opponent: string;
      commenceTime: string;
      snapshots: Map<number, { createdAt: string; impliedProbSum: number; impliedProbCount: number }>;
    }
  >();

  points.forEach((point) => {
    const opponent = point.homeTeam === normalizedTeam ? point.awayTeam : point.homeTeam;
    const matchBucket = matchSnapshotMap.get(point.matchId) || {
      matchId: point.matchId,
      opponent,
      commenceTime: point.commenceTime,
      snapshots: new Map<number, { createdAt: string; impliedProbSum: number; impliedProbCount: number }>(),
    };

    const snapshotBucket = matchBucket.snapshots.get(point.snapshotId) || {
      createdAt: point.createdAt,
      impliedProbSum: 0,
      impliedProbCount: 0,
    };

    snapshotBucket.impliedProbSum += point.impliedProbNoVig;
    snapshotBucket.impliedProbCount += 1;
    matchBucket.snapshots.set(point.snapshotId, snapshotBucket);
    matchSnapshotMap.set(point.matchId, matchBucket);
  });

  const matchMovements = Array.from(matchSnapshotMap.values())
    .map((match) => {
      const snapshotValues = Array.from(match.snapshots.values())
        .map((snapshot) => ({
          createdAt: snapshot.createdAt,
          avgImpliedProb: snapshot.impliedProbCount > 0 ? snapshot.impliedProbSum / snapshot.impliedProbCount : null,
        }))
        .filter(
          (snapshot): snapshot is { createdAt: string; avgImpliedProb: number } => snapshot.avgImpliedProb !== null
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (!snapshotValues.length) {
        return null;
      }

      const opening = snapshotValues[0];
      const current = snapshotValues[snapshotValues.length - 1];
      const impliedProbDelta = current.avgImpliedProb - opening.avgImpliedProb;
      const hoursSpan =
        (new Date(current.createdAt).getTime() - new Date(opening.createdAt).getTime()) / (1000 * 60 * 60);
      const movementPerDay = hoursSpan > 0 ? impliedProbDelta / (hoursSpan / 24) : null;

      return {
        matchId: match.matchId,
        opponent: match.opponent,
        commenceTime: match.commenceTime,
        snapshotsObserved: snapshotValues.length,
        openingImpliedProb: opening.avgImpliedProb,
        currentImpliedProb: current.avgImpliedProb,
        impliedProbDelta,
        movementPerDay,
      };
    })
    .filter(
      (
        movement
      ): movement is {
        matchId: string;
        opponent: string;
        commenceTime: string;
        snapshotsObserved: number;
        openingImpliedProb: number;
        currentImpliedProb: number;
        impliedProbDelta: number;
        movementPerDay: number | null;
      } => Boolean(movement)
    )
    .sort((a, b) => Math.abs(b.impliedProbDelta) - Math.abs(a.impliedProbDelta));

  const first = timelineStats[0];
  const last = timelineStats[timelineStats.length - 1];

  const avgImpliedProb = average(points.map((point) => point.impliedProbNoVig));
  const volatility = standardDeviation(
    timelineStats.map((point) => point.avgImpliedProb).filter((value): value is number => value !== null)
  );

  const impliedProbDelta =
    first && last && first.avgImpliedProb !== null && last.avgImpliedProb !== null
      ? last.avgImpliedProb - first.avgImpliedProb
      : null;
  const momentumPerSnapshot =
    impliedProbDelta !== null && timelineStats.length > 1 ? impliedProbDelta / (timelineStats.length - 1) : null;

  const opponentMap = new Map<string, TeamMarketPoint[]>();
  points.forEach((point) => {
    const opponent = point.homeTeam === normalizedTeam ? point.awayTeam : point.homeTeam;
    const bucket = opponentMap.get(opponent) || [];
    bucket.push(point);
    opponentMap.set(opponent, bucket);
  });

  const opponents = Array.from(opponentMap.entries())
    .map(([opponent, opponentPoints]) => {
      const stats = buildBucketTimelineStats(opponentPoints, adaptiveTeam.bucketMinutes);
      const firstPoint = stats[0];
      const lastPoint = stats[stats.length - 1];
      const trendDelta =
        firstPoint && lastPoint && firstPoint.avgImpliedProb !== null && lastPoint.avgImpliedProb !== null
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
  const timeSpanHours = computeTimeSpanHours(timelineStats.map((point) => point.createdAt));
  const confidenceScore = buildConfidenceScore({
    sampleQuotes: points.length,
    snapshotCount: timelineStats.length,
    volatility,
    timeSpanHours,
    overlapCoverage: contextSnapshots.length > 0 ? timelineStats.length / contextSnapshots.length : 0,
  });

  const movementThreshold = 0.0005;
  const movedUpMatches = matchMovements.filter((movement) => movement.impliedProbDelta > movementThreshold).length;
  const movedDownMatches = matchMovements.filter((movement) => movement.impliedProbDelta < -movementThreshold).length;
  const flatMatches = matchMovements.length - movedUpMatches - movedDownMatches;
  const openingVsCurrentAvgDelta = average(matchMovements.map((movement) => movement.impliedProbDelta));
  const movementVelocityPerDay = average(
    matchMovements.map((movement) => movement.movementPerDay).filter((value): value is number => value !== null)
  );

  return {
    team: normalizedTeam,
    lookbackSnapshots: contextSnapshots.length,
    bucketMinutes: adaptiveTeam.bucketMinutes,
    minDelta,
    effectiveSampleBuckets: timelineStats.length,
    timeSpanHours: round4(timeSpanHours),
    sampleQuotes: points.length,
    totalMatches,
    avgImpliedProb: round4(avgImpliedProb),
    currentImpliedProb: round4(last?.avgImpliedProb ?? null),
    impliedProbDelta: round4(impliedProbDelta),
    momentumPerSnapshot: round4(momentumPerSnapshot),
    volatility: round4(volatility),
    confidenceScore,
    openingVsCurrentAvgDelta: round4(openingVsCurrentAvgDelta),
    movementVelocityPerDay: round4(movementVelocityPerDay),
    movementSummary: {
      trackedMatches: matchMovements.length,
      movedUpMatches,
      movedDownMatches,
      flatMatches,
      avgImpliedProbDelta: round4(openingVsCurrentAvgDelta),
      avgMovementPerDay: round4(movementVelocityPerDay),
    },
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
    matchMovements: matchMovements.slice(0, 50).map((movement) => ({
      matchId: movement.matchId,
      opponent: movement.opponent,
      commenceTime: movement.commenceTime,
      snapshotsObserved: movement.snapshotsObserved,
      openingImpliedProb: round4(movement.openingImpliedProb),
      currentImpliedProb: round4(movement.currentImpliedProb),
      impliedProbDelta: round4(movement.impliedProbDelta),
      movementPerDay: round4(movement.movementPerDay),
    })),
  };
};

export const getHeadToHeadAnalytics = async (
  snapshotId: number,
  teamA: string,
  teamB: string,
  lookbackSnapshots = 30,
  bucketMinutes = 15,
  minDelta = 0.002
): Promise<HeadToHeadAnalytics | null> => {
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
      AND outcome_side IN ('home', 'away')
    ORDER BY captured_at ASC
  `) as (TeamMarketPointRow & { outcome_name: string })[];

  if (!rows.length) {
    return null;
  }

  const rawPointsA = rows.filter((row) => row.outcome_name === normalizedTeamA).map((row) => toTeamMarketPoint(row));
  const rawPointsB = rows.filter((row) => row.outcome_name === normalizedTeamB).map((row) => toTeamMarketPoint(row));

  const candidates = getAdaptiveBucketCandidates(bucketMinutes);

  let selectedBucketMinutes = bucketMinutes;
  let selectedPointsA: TeamMarketPoint[] = [];
  let selectedPointsB: TeamMarketPoint[] = [];
  let selectedTimelineA: SnapshotStats[] = [];
  let selectedTimelineB: SnapshotStats[] = [];
  let selectedTimeline: HeadToHeadTimelinePoint[] = [];
  let bestOverlapCount = 0;

  candidates.forEach((candidateBucket) => {
    const pointsA = bucketAndFilterTeamPoints(rawPointsA, candidateBucket, minDelta);
    const pointsB = bucketAndFilterTeamPoints(rawPointsB, candidateBucket, minDelta);
    if (!pointsA.length || !pointsB.length) {
      return;
    }

    const timelineA = buildBucketTimelineStats(pointsA, candidateBucket);
    const timelineB = buildBucketTimelineStats(pointsB, candidateBucket);
    if (!timelineA.length || !timelineB.length) {
      return;
    }

    const byBucketA = new Map(timelineA.map((point) => [point.createdAt, point]));
    const byBucketB = new Map(timelineB.map((point) => [point.createdAt, point]));
    const overlapKeys = Array.from(byBucketA.keys())
      .filter((key) => byBucketB.has(key))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const overlapTimeline: HeadToHeadTimelinePoint[] = overlapKeys
      .map((bucketCreatedAt) => {
        const pointA = byBucketA.get(bucketCreatedAt);
        const pointB = byBucketB.get(bucketCreatedAt);
        if (!pointA || !pointB || pointA.avgImpliedProb === null || pointB.avgImpliedProb === null) {
          return null;
        }

        return {
          snapshotId: Math.max(pointA.snapshotId, pointB.snapshotId),
          createdAt: bucketCreatedAt,
          avgImpliedProbA: round4(pointA.avgImpliedProb),
          avgImpliedProbB: round4(pointB.avgImpliedProb),
          edgeA: round4(pointA.avgImpliedProb - pointB.avgImpliedProb),
          sampleQuotes: pointA.sampleQuotes + pointB.sampleQuotes,
          matchCount: Math.max(pointA.matchCount, pointB.matchCount),
        };
      })
      .filter((point): point is HeadToHeadTimelinePoint => Boolean(point));

    if (overlapTimeline.length > bestOverlapCount) {
      bestOverlapCount = overlapTimeline.length;
      selectedBucketMinutes = candidateBucket;
      selectedPointsA = pointsA;
      selectedPointsB = pointsB;
      selectedTimelineA = timelineA;
      selectedTimelineB = timelineB;
      selectedTimeline = overlapTimeline;
    }

    if (overlapTimeline.length >= MIN_H2H_OVERLAP_BUCKETS && bestOverlapCount < MIN_H2H_OVERLAP_BUCKETS) {
      bestOverlapCount = overlapTimeline.length;
      selectedBucketMinutes = candidateBucket;
      selectedPointsA = pointsA;
      selectedPointsB = pointsB;
      selectedTimelineA = timelineA;
      selectedTimelineB = timelineB;
      selectedTimeline = overlapTimeline;
    }
  });

  if (!selectedTimeline.length || !selectedPointsA.length || !selectedPointsB.length) {
    return null;
  }

  const pointsA = selectedPointsA;
  const pointsB = selectedPointsB;
  const timelineA = selectedTimelineA;
  const timelineB = selectedTimelineB;
  const timeline = selectedTimeline;

  const directRows = rows.filter(
    (row) =>
      (row.home_team === normalizedTeamA && row.away_team === normalizedTeamB) ||
      (row.home_team === normalizedTeamB && row.away_team === normalizedTeamA)
  );

  if (!timeline.length) {
    return null;
  }

  const firstEdgePoint = timeline[0] ?? null;
  const lastEdgePoint = timeline[timeline.length - 1] ?? null;
  const avgImpliedProbA = average(pointsA.map((point) => point.impliedProbNoVig));
  const avgImpliedProbB = average(pointsB.map((point) => point.impliedProbNoVig));
  const edgeDeltaA = firstEdgePoint && lastEdgePoint ? lastEdgePoint.edgeA - firstEdgePoint.edgeA : null;

  const totalQuotes = pointsA.length + pointsB.length;
  const totalMatches = new Set(directRows.map((row) => row.match_id)).size;
  const volatility = standardDeviation(
    timeline.map((point) => point.edgeA).filter((edge): edge is number => edge !== null)
  );
  const timeSpanHours = computeTimeSpanHours(timeline.map((point) => point.createdAt));
  const overlapCoverage =
    Math.max(timelineA.length, timelineB.length) > 0
      ? timeline.length / Math.max(timelineA.length, timelineB.length)
      : 0;
  const confidenceScore = buildConfidenceScore({
    sampleQuotes: totalQuotes,
    snapshotCount: timeline.length,
    volatility,
    timeSpanHours,
    overlapCoverage,
  });

  return {
    teamA: normalizedTeamA,
    teamB: normalizedTeamB,
    lookbackSnapshots: contextSnapshots.length,
    bucketMinutes: selectedBucketMinutes,
    minDelta,
    effectiveSampleBuckets: timeline.length,
    timeSpanHours: round4(timeSpanHours),
    sampleQuotes: totalQuotes,
    totalMatches,
    currentEdgeA: round4(lastEdgePoint?.edgeA ?? null),
    edgeDeltaA: round4(edgeDeltaA),
    avgImpliedProbA: round4(avgImpliedProbA),
    avgImpliedProbB: round4(avgImpliedProbB),
    confidenceScore,
    timeline,
  };
};
