import { ensureSnapshotsSchema } from '../api/_lib/oddsSnapshotsStore.js';

await ensureSnapshotsSchema();
console.log('Odds snapshot schema is ready.');
