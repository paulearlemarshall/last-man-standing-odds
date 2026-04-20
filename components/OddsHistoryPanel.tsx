/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useEffect, useMemo, useState } from 'react';
import type { OddsSnapshotDetail, OddsSnapshotInsightPoint, OddsSnapshotSummary } from '../types';
import CollapsibleSection from './CollapsibleSection';

const formatSnapshotLabel = (snapshot: OddsSnapshotSummary) => {
  const createdAt = new Date(snapshot.createdAt).toLocaleString('en-GB', {
    hour12: false,
    timeZone: 'Europe/London',
  });

  return `${snapshot.id} | ${createdAt} | ${snapshot.sportKey} | ${snapshot.regions} | ${snapshot.matchCount} matches`;
};

const OddsHistoryPanel: React.FC = () => {
  const [snapshots, setSnapshots] = useState<OddsSnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<OddsSnapshotDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const response = await fetch('/api/odds-history?limit=40');
      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Failed to load snapshot list (${response.status}): ${details}`);
      }

      const payload = (await response.json()) as { snapshots?: OddsSnapshotSummary[] };
      const nextSnapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
      setSnapshots(nextSnapshots);

      if (nextSnapshots.length === 0) {
        setSelectedSnapshotId(null);
        setSelectedSnapshot(null);
        return;
      }

      setSelectedSnapshotId((current) => {
        if (current && nextSnapshots.some((snapshot) => snapshot.id === current)) {
          return current;
        }
        return nextSnapshots[0].id;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load snapshot list');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadSnapshots();
  }, []);

  useEffect(() => {
    if (!selectedSnapshotId) {
      setSelectedSnapshot(null);
      return;
    }

    const abortController = new AbortController();

    const loadSnapshotDetail = async () => {
      setLoadingSnapshot(true);
      setError(null);
      try {
        const response = await fetch(`/api/odds-history?id=${selectedSnapshotId}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          const details = await response.text();
          throw new Error(`Failed to load snapshot ${selectedSnapshotId} (${response.status}): ${details}`);
        }

        const payload = (await response.json()) as OddsSnapshotDetail;
        setSelectedSnapshot(payload);
      } catch (loadError) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load snapshot detail');
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingSnapshot(false);
        }
      }
    };

    void loadSnapshotDetail();

    return () => abortController.abort();
  }, [selectedSnapshotId]);

  const snapshotPayload = useMemo(() => {
    if (!selectedSnapshot) {
      return '';
    }
    return JSON.stringify(selectedSnapshot.payload, null, 2);
  }, [selectedSnapshot]);

  const formatMetric = (value: number | null): string => {
    if (value === null) return 'n/a';
    return value.toFixed(2);
  };

  const renderDelta = (value: number | null): string => {
    if (value === null) return 'n/a';
    if (value > 0) return `+${value.toFixed(2)}`;
    return value.toFixed(2);
  };

  const formatTimelineDate = (createdAt: string): string =>
    new Date(createdAt).toLocaleString('en-GB', {
      hour12: false,
      timeZone: 'Europe/London',
    });

  const insightsTimeline = selectedSnapshot?.insights?.timeline ?? [];

  return (
    <CollapsibleSection title="Stored Odds Snapshots" defaultOpen={false}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void loadSnapshots();
            }}
            disabled={loadingList}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md disabled:opacity-60 transition-colors"
          >
            {loadingList ? 'Refreshing...' : 'Refresh Snapshot List'}
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
              value={selectedSnapshotId ?? ''}
              onChange={(event) => setSelectedSnapshotId(Number.parseInt(event.target.value, 10))}
              className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {formatSnapshotLabel(snapshot)}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-300">{error}</p>}

        {selectedSnapshot && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-900/60 border border-gray-700 rounded-md p-3">
                <p className="text-xs text-gray-400">Captured (UK)</p>
                <p className="text-sm text-white">{new Date(selectedSnapshot.createdAt).toLocaleString('en-GB', { hour12: false, timeZone: 'Europe/London' })}</p>
              </div>
              <div className="bg-gray-900/60 border border-gray-700 rounded-md p-3">
                <p className="text-xs text-gray-400">Request</p>
                <p className="text-sm text-white">{selectedSnapshot.sportKey} | {selectedSnapshot.regions} | {selectedSnapshot.markets}</p>
              </div>
            </div>
            <div className="bg-gray-900/60 border border-gray-700 rounded-md p-3">
              <p className="text-xs text-gray-400 mb-1">Source URL</p>
              <p className="text-xs text-slate-300 break-all">{selectedSnapshot.sourceUrl}</p>
            </div>
            <div className="bg-black/40 border border-gray-700 rounded-md p-3 overflow-auto max-h-[32rem]">
              {loadingSnapshot ? (
                <p className="text-sm text-gray-400">Loading snapshot payload...</p>
              ) : (
                <pre className="text-xs text-green-200 whitespace-pre-wrap">{snapshotPayload}</pre>
              )}
            </div>

            {selectedSnapshot.insights && (
              <div className="bg-gray-900/70 border border-blue-700/60 rounded-md p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-blue-200">Odds analytics over time (roll-up)</h4>
                  <p className="text-xs text-gray-400">
                    Lookback snapshots: {selectedSnapshot.insights.lookbackCount} | Tracked fixtures:{' '}
                    {selectedSnapshot.insights.trackedMatchCount}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-black/30 border border-gray-700 rounded-md p-3">
                    <p className="text-xs text-gray-400">Avg home-odds delta</p>
                    <p className="text-lg text-white">{renderDelta(selectedSnapshot.insights.avgHomeOddsDelta)}</p>
                  </div>
                  <div className="bg-black/30 border border-gray-700 rounded-md p-3">
                    <p className="text-xs text-gray-400">Avg away-odds delta</p>
                    <p className="text-lg text-white">{renderDelta(selectedSnapshot.insights.avgAwayOddsDelta)}</p>
                  </div>
                  <div className="bg-black/30 border border-gray-700 rounded-md p-3">
                    <p className="text-xs text-gray-400">Avg bookmakers/match delta</p>
                    <p className="text-lg text-white">{renderDelta(selectedSnapshot.insights.avgBookmakersPerMatchDelta)}</p>
                  </div>
                </div>

                <div className="overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left text-gray-300 border-b border-gray-700">
                        <th className="py-2 pr-2">Snapshot</th>
                        <th className="py-2 pr-2">Captured (UK)</th>
                        <th className="py-2 pr-2">Tracked Fixtures</th>
                        <th className="py-2 pr-2">Avg Home Odds</th>
                        <th className="py-2 pr-2">Avg Away Odds</th>
                        <th className="py-2 pr-2">Avg Bookmakers/Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insightsTimeline.map((point: OddsSnapshotInsightPoint) => (
                        <tr key={point.snapshotId} className="border-b border-gray-800 text-slate-200">
                          <td className="py-2 pr-2">{point.snapshotId}</td>
                          <td className="py-2 pr-2">{formatTimelineDate(point.createdAt)}</td>
                          <td className="py-2 pr-2">{point.trackedMatchCount}</td>
                          <td className="py-2 pr-2">{formatMetric(point.avgHomeOdds)}</td>
                          <td className="py-2 pr-2">{formatMetric(point.avgAwayOdds)}</td>
                          <td className="py-2 pr-2">{formatMetric(point.avgBookmakersPerMatch)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {!loadingList && snapshots.length === 0 && !error && (
          <p className="text-sm text-gray-400">No stored snapshots yet. Refresh odds once and this panel will populate.</p>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default OddsHistoryPanel;
