import type { IncomingMessage, ServerResponse } from 'http';
import { normalizeQueryValue, sendJson, timed } from './_lib/http.js';
import { getOddsSnapshotById, getOddsSnapshotInsights, listOddsSnapshots } from './_lib/oddsSnapshotsStore.js';

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse
) {
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

      const snapshot = await timed('history.getSnapshot', () => getOddsSnapshotById(snapshotId));
      if (!snapshot) {
        return sendJson(res, 404, { error: 'Snapshot not found' });
      }

      const insights = await timed('history.getInsights', () => getOddsSnapshotInsights(snapshotId));
      return sendJson(res, 200, { ...snapshot, insights });
    }

    const snapshots = await timed('history.listSnapshots', () =>
      listOddsSnapshots(Number.isFinite(limit) ? limit : 30)
    );
    return sendJson(res, 200, { snapshots });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return sendJson(res, 500, {
      error: 'Failed to read odds snapshot history',
      details: message,
    });
  }
}
