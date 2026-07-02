import type { IncomingMessage, ServerResponse } from 'http';
import { cleanupOldOddsSnapshots } from './_lib/oddsSnapshotsStore.js';
import { sendJson, timed } from './_lib/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  try {
    const deleted = await timed('cleanup.snapshots', () => cleanupOldOddsSnapshots(30));
    return sendJson(res, 200, { deleted, retentionDays: 30 });
  } catch (error) {
    return sendJson(res, 500, {
      error: 'Failed to clean up odds snapshots',
      details: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
}
