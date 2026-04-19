import type { IncomingMessage, ServerResponse } from 'http';
import { getOddsSnapshotById, listOddsSnapshots } from './_lib/oddsSnapshotsStore.js';

function normalizeQueryValue(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const snapshotIdRaw = normalizeQueryValue(req.query?.id);
  const limitRaw = normalizeQueryValue(req.query?.limit);
  const limit = Number.parseInt(limitRaw || '30', 10);

  try {
    if (snapshotIdRaw) {
      const snapshotId = Number.parseInt(snapshotIdRaw, 10);
      if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
        return sendJson(res, 400, { error: 'Invalid snapshot id' });
      }

      const snapshot = await getOddsSnapshotById(snapshotId);
      if (!snapshot) {
        return sendJson(res, 404, { error: 'Snapshot not found' });
      }

      return sendJson(res, 200, snapshot);
    }

    const snapshots = await listOddsSnapshots(Number.isFinite(limit) ? limit : 30);
    return sendJson(res, 200, { snapshots });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return sendJson(res, 500, {
      error: 'Failed to read odds snapshot history',
      details: message,
    });
  }
}
