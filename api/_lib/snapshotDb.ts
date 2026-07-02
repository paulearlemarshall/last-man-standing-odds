import { neon } from '@neondatabase/serverless';

let schemaReady: Promise<void> | null = null;

export function getSqlClient() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('DATABASE_URL or POSTGRES_URL is not configured');
  return neon(connectionString);
}

export async function ensureSnapshotsSchema(): Promise<void> {
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
      await sql`ALTER TABLE odds_api_snapshots ADD COLUMN IF NOT EXISTS payload_hash TEXT`;
      await sql`CREATE INDEX IF NOT EXISTS odds_api_snapshots_created_at_idx ON odds_api_snapshots (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS odds_api_snapshots_sport_key_idx ON odds_api_snapshots (sport_key)`;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_api_snapshots_context_hash_idx
          ON odds_api_snapshots (sport_key, regions_csv, markets, payload_hash, created_at DESC)
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
      await sql`CREATE INDEX IF NOT EXISTS odds_market_points_snapshot_idx ON odds_market_points (snapshot_id)`;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_market_points_team_idx
          ON odds_market_points (outcome_name, captured_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_market_points_outcome_snapshot_idx
          ON odds_market_points (outcome_name, snapshot_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS odds_market_points_match_idx
          ON odds_market_points (match_id, captured_at DESC)
      `;
    })();
  }

  await schemaReady;
}
