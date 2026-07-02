import React from 'react';
import type { OddsSnapshotSummary } from '../../types';

const label = (snapshot: OddsSnapshotSummary) =>
  `${snapshot.id} | ${new Date(snapshot.createdAt).toLocaleString('en-GB', { hour12: false, timeZone: 'Europe/London' })} | ${snapshot.sportKey} | ${snapshot.regions} | ${snapshot.matchCount} matches`;

export const SnapshotSelector: React.FC<{
  snapshots: OddsSnapshotSummary[];
  selectedId: number | null;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (id: number) => void;
}> = ({ snapshots, selectedId, loading, onRefresh, onSelect }) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md disabled:opacity-60 transition-colors"
      >
        {loading ? 'Refreshing...' : 'Refresh Snapshot List'}
      </button>
      <span className="text-sm text-gray-400">Rows stored: {snapshots.length}</span>
    </div>
    {snapshots.length > 0 && (
      <div className="space-y-2">
        <label htmlFor="snapshot-select" className="text-sm font-semibold text-gray-300">
          Roll-up viewer
        </label>
        <select
          id="snapshot-select"
          value={selectedId ?? ''}
          onChange={(event) => onSelect(Number.parseInt(event.target.value, 10))}
          className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          {snapshots.map((snapshot) => (
            <option key={snapshot.id} value={snapshot.id}>
              {label(snapshot)}
            </option>
          ))}
        </select>
      </div>
    )}
  </div>
);
