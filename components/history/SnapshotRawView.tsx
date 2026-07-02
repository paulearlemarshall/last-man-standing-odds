import React from 'react';
import type { OddsSnapshotDetail, OddsSnapshotInsightPoint } from '../../types';
import { MetricLabel, formatMetric, formatTimelineDate, renderDelta } from './HistoryPrimitives';

export const SnapshotRawView: React.FC<{
  snapshot: OddsSnapshotDetail;
  payload: string;
  loading: boolean;
}> = ({ snapshot, payload, loading }) => {
  const timeline = snapshot.insights?.timeline ?? [];
  return (
    <>
      <div className="bg-black/40 border border-gray-700 rounded-md p-3 overflow-auto max-h-[32rem]">
        {loading ? (
          <p className="text-sm text-gray-400">Loading snapshot payload...</p>
        ) : (
          <pre className="text-xs text-green-200 whitespace-pre-wrap">{payload}</pre>
        )}
      </div>
      {snapshot.insights && (
        <div className="bg-gray-900/70 border border-blue-700/60 rounded-md p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-blue-200">Odds analytics over time (roll-up)</h4>
            <p className="text-xs text-gray-400">
              Lookback snapshots: {snapshot.insights.lookbackCount} | Tracked fixtures:{' '}
              {snapshot.insights.trackedMatchCount}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-black/30 border border-gray-700 rounded-md p-3">
              <MetricLabel
                label="Avg home-odds delta"
                help="Change in average best available home-team decimal odds across the selected lookback window."
              />
              <p className="text-lg text-white">{renderDelta(snapshot.insights.avgHomeOddsDelta)}</p>
            </div>
            <div className="bg-black/30 border border-gray-700 rounded-md p-3">
              <MetricLabel
                label="Avg away-odds delta"
                help="Change in average best available away-team decimal odds across the selected lookback window."
              />
              <p className="text-lg text-white">{renderDelta(snapshot.insights.avgAwayOddsDelta)}</p>
            </div>
            <div className="bg-black/30 border border-gray-700 rounded-md p-3">
              <MetricLabel
                label="Avg bookmakers/match delta"
                help="Change in market depth across the selected lookback window."
              />
              <p className="text-lg text-white">{renderDelta(snapshot.insights.avgBookmakersPerMatchDelta)}</p>
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
                {timeline.map((point: OddsSnapshotInsightPoint) => (
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
    </>
  );
};
