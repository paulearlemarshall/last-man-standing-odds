import React from 'react';
import type { HeadToHeadAnalytics, HeadToHeadTimelinePoint } from '../../types';
import { MetricLabel, formatMetric, formatTimelineDate, renderDelta } from './HistoryPrimitives';

export const HeadToHeadView: React.FC<{
  teams: string[];
  teamA: string;
  teamB: string;
  onTeamAChange: (team: string) => void;
  onTeamBChange: (team: string) => void;
  model: HeadToHeadAnalytics | null;
  loading: boolean;
  error: string | null;
}> = ({
  teams,
  teamA,
  teamB,
  onTeamAChange,
  onTeamBChange,
  model: headToHead,
  loading: loadingAnalytics,
  error: analyticsError,
}) => (
  <div className="space-y-4 bg-gray-900/70 border border-fuchsia-700/50 rounded-md p-4">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label htmlFor="team-a-select" className="text-xs text-gray-300 block mb-1">
          Team A
        </label>
        <select
          id="team-a-select"
          value={teamA}
          onChange={(event) => onTeamAChange(event.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="team-b-select" className="text-xs text-gray-300 block mb-1">
          Team B
        </label>
        <select
          id="team-b-select"
          value={teamB}
          onChange={(event) => onTeamBChange(event.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>
    </div>

    {teamA === teamB && (
      <p className="text-sm text-yellow-300">Choose two different teams to model head-to-head edges.</p>
    )}

    {headToHead && (
      <p className="text-xs text-gray-400">
        Time-series controls: {headToHead.bucketMinutes}-minute buckets, min delta {headToHead.minDelta}. Effective
        buckets: {headToHead.effectiveSampleBuckets}
        {headToHead.timeSpanHours !== null ? ` over ${headToHead.timeSpanHours.toFixed(1)}h` : ''}.
      </p>
    )}

    {loadingAnalytics && <p className="text-sm text-gray-300">Loading head-to-head model...</p>}
    {analyticsError && <p className="text-sm text-red-300">{analyticsError}</p>}

    {headToHead && (
      <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label={`Current edge (${headToHead.teamA})`}
              help="Latest implied probability edge: Team A implied probability minus Team B implied probability. Positive favors Team A."
            />
            <p className="text-lg text-white">{renderDelta(headToHead.currentEdgeA)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Edge trend"
              help="Change in the Team A edge from earliest to latest snapshot in the selected lookback window."
            />
            <p className="text-lg text-white">{renderDelta(headToHead.edgeDeltaA)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label={`Avg prob (${headToHead.teamA})`}
              help="Average no-vig implied probability for Team A across the modeled snapshots."
            />
            <p className="text-lg text-white">{formatMetric(headToHead.avgImpliedProbA)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Confidence"
              help="Composite reliability score for this Team A vs Team B model, combining sample volume, timeline depth, and volatility."
            />
            <p className="text-lg text-white">{(headToHead.confidenceScore * 100).toFixed(0)}%</p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-gray-300 border-b border-gray-700">
                <th className="py-2 pr-2">Snapshot</th>
                <th className="py-2 pr-2">Captured (UK)</th>
                <th className="py-2 pr-2">Matches</th>
                <th className="py-2 pr-2">Quotes</th>
                <th className="py-2 pr-2">{headToHead.teamA} Implied Prob</th>
                <th className="py-2 pr-2">{headToHead.teamB} Implied Prob</th>
                <th className="py-2 pr-2">Edge ({headToHead.teamA})</th>
              </tr>
            </thead>
            <tbody>
              {headToHead.timeline.map((point: HeadToHeadTimelinePoint) => (
                <tr key={point.snapshotId} className="border-b border-gray-800 text-slate-200">
                  <td className="py-2 pr-2">{point.snapshotId}</td>
                  <td className="py-2 pr-2">{formatTimelineDate(point.createdAt)}</td>
                  <td className="py-2 pr-2">{point.matchCount}</td>
                  <td className="py-2 pr-2">{point.sampleQuotes}</td>
                  <td className="py-2 pr-2">{formatMetric(point.avgImpliedProbA)}</td>
                  <td className="py-2 pr-2">{formatMetric(point.avgImpliedProbB)}</td>
                  <td className="py-2 pr-2">{renderDelta(point.edgeA)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>
);
