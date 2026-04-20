import type { IncomingMessage, ServerResponse } from 'http';
import {
  getHeadToHeadAnalytics,
  getTeamFormAnalytics,
  listTrackedTeamsForSnapshot,
} from './_lib/oddsSnapshotsStore.js';

function normalizeQueryValue(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const snapshotIdRaw = normalizeQueryValue(req.query?.snapshotId);
  const team = normalizeQueryValue(req.query?.team);
  const teamA = normalizeQueryValue(req.query?.teamA);
  const teamB = normalizeQueryValue(req.query?.teamB);
  const lookbackRaw = normalizeQueryValue(req.query?.lookback);
  const lookback = Number.parseInt(lookbackRaw || '30', 10);

  const snapshotId = Number.parseInt(snapshotIdRaw, 10);
  if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
    return sendJson(res, 400, { error: 'snapshotId query param is required' });
  }

  try {
    if (teamA && teamB) {
      const headToHead = await getHeadToHeadAnalytics(
        snapshotId,
        teamA,
        teamB,
        Number.isFinite(lookback) ? lookback : 30
      );

      if (!headToHead) {
        return sendJson(res, 404, { error: 'No head-to-head analytics found for this selection' });
      }

      return sendJson(res, 200, { headToHead });
    }

    if (team) {
      const teamForm = await getTeamFormAnalytics(
        snapshotId,
        team,
        Number.isFinite(lookback) ? lookback : 30
      );

      if (!teamForm) {
        return sendJson(res, 404, { error: 'No team analytics found for this selection' });
      }

      return sendJson(res, 200, { teamForm });
    }

    const teams = await listTrackedTeamsForSnapshot(snapshotId);
    return sendJson(res, 200, { teams });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return sendJson(res, 500, {
      error: 'Failed to calculate odds analytics',
      details: message,
    });
  }
}
