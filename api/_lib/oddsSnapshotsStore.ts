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
