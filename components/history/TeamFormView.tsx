import React from 'react';
import type { TeamFormAnalytics, TeamFormTimelinePoint, TeamMatchMovement } from '../../types';
import { MetricLabel, formatMetric, formatTimelineDate, renderDelta } from './HistoryPrimitives';

export const TeamFormView: React.FC<{
  teams: string[];
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  teamForm: TeamFormAnalytics | null;
  loading: boolean;
  error: string | null;
}> = ({ teams, selectedTeam, onTeamChange, teamForm, loading: loadingAnalytics, error: analyticsError }) => (
  <div className="space-y-4 bg-gray-900/70 border border-emerald-700/50 rounded-md p-4">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1">
        <label htmlFor="team-select" className="text-xs text-gray-300 block mb-1">
          Team
        </label>
        <select
          id="team-select"
          value={selectedTeam}
          onChange={(event) => onTeamChange(event.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
        >
          {teams.map((team) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-gray-400">Model view: team vs whole field + per-opponent edges.</p>
    </div>

    {teamForm && (
      <p className="text-xs text-gray-400">
        Time-series controls: {teamForm.bucketMinutes}-minute buckets, min delta {teamForm.minDelta}. Effective buckets:{' '}
        {teamForm.effectiveSampleBuckets}
        {teamForm.timeSpanHours !== null ? ` over ${teamForm.timeSpanHours.toFixed(1)}h` : ''}.
      </p>
    )}

    {loadingAnalytics && <p className="text-sm text-gray-300">Loading team-form model...</p>}
    {analyticsError && <p className="text-sm text-red-300">{analyticsError}</p>}

    {teamForm && (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Current implied prob"
              help="Latest no-vig implied win probability for the selected team, averaged from available bookmaker prices."
            />
            <p className="text-lg text-white">{formatMetric(teamForm.currentImpliedProb)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Trend delta"
              help="Difference between first and latest implied probability in the timeline. Positive suggests improving market view for the team."
            />
            <p className="text-lg text-white">{renderDelta(teamForm.impliedProbDelta)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Volatility"
              help="Standard deviation of the team's timeline implied probabilities. Higher volatility means less stable market sentiment."
            />
            <p className="text-lg text-white">{formatMetric(teamForm.volatility)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Confidence"
              help="Composite confidence score based on sample size, number of snapshots, and volatility. Higher is generally more reliable."
            />
            <p className="text-lg text-white">{(teamForm.confidenceScore * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Opening vs current delta"
              help="Per-match average change from the first captured implied probability to the latest captured implied probability across the lookback window."
            />
            <p className="text-lg text-white">{renderDelta(teamForm.openingVsCurrentAvgDelta)}</p>
          </div>
          <div className="bg-black/30 border border-gray-700 rounded-md p-3">
            <MetricLabel
              label="Movement velocity/day"
              help="Average daily rate of implied probability movement across tracked matches. Positive means the team trend is strengthening over time."
            />
            <p className="text-lg text-white">{renderDelta(teamForm.movementVelocityPerDay)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-black/20 border border-gray-800 rounded-md p-2 text-xs text-slate-300">
            Tracked matches: <span className="font-semibold text-white">{teamForm.movementSummary.trackedMatches}</span>
          </div>
          <div className="bg-black/20 border border-gray-800 rounded-md p-2 text-xs text-slate-300">
            Moved up: <span className="font-semibold text-emerald-300">{teamForm.movementSummary.movedUpMatches}</span>
          </div>
          <div className="bg-black/20 border border-gray-800 rounded-md p-2 text-xs text-slate-300">
            Moved down: <span className="font-semibold text-red-300">{teamForm.movementSummary.movedDownMatches}</span>
          </div>
          <div className="bg-black/20 border border-gray-800 rounded-md p-2 text-xs text-slate-300">
            Flat: <span className="font-semibold text-white">{teamForm.movementSummary.flatMatches}</span>
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
                <th className="py-2 pr-2">Avg Implied Prob</th>
                <th className="py-2 pr-2">Avg Odds</th>
                <th className="py-2 pr-2">Avg Bookmakers/Match</th>
              </tr>
            </thead>
            <tbody>
              {teamForm.timeline.map((point: TeamFormTimelinePoint) => (
                <tr key={point.snapshotId} className="border-b border-gray-800 text-slate-200">
                  <td className="py-2 pr-2">{point.snapshotId}</td>
                  <td className="py-2 pr-2">{formatTimelineDate(point.createdAt)}</td>
                  <td className="py-2 pr-2">{point.matchCount}</td>
                  <td className="py-2 pr-2">{point.sampleQuotes}</td>
                  <td className="py-2 pr-2">{formatMetric(point.avgImpliedProb)}</td>
                  <td className="py-2 pr-2">{formatMetric(point.avgOdds)}</td>
                  <td className="py-2 pr-2">{formatMetric(point.avgBookmakersPerMatch)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-auto">
          <h5 className="text-sm text-cyan-200 font-semibold mb-2">Opening vs current movement by fixture</h5>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-gray-300 border-b border-gray-700">
                <th className="py-2 pr-2">Opponent</th>
                <th className="py-2 pr-2">Kickoff (UK)</th>
                <th className="py-2 pr-2">Snapshots</th>
                <th className="py-2 pr-2">Opening Implied</th>
                <th className="py-2 pr-2">Current Implied</th>
                <th className="py-2 pr-2">Delta</th>
                <th className="py-2 pr-2">Velocity/Day</th>
              </tr>
            </thead>
            <tbody>
              {teamForm.matchMovements.map((movement: TeamMatchMovement) => (
                <tr key={movement.matchId} className="border-b border-gray-800 text-slate-200">
                  <td className="py-2 pr-2">{movement.opponent}</td>
                  <td className="py-2 pr-2">{formatTimelineDate(movement.commenceTime)}</td>
                  <td className="py-2 pr-2">{movement.snapshotsObserved}</td>
                  <td className="py-2 pr-2">{formatMetric(movement.openingImpliedProb)}</td>
                  <td className="py-2 pr-2">{formatMetric(movement.currentImpliedProb)}</td>
                  <td className="py-2 pr-2">{renderDelta(movement.impliedProbDelta)}</td>
                  <td className="py-2 pr-2">{renderDelta(movement.movementPerDay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-auto">
          <h5 className="text-sm text-emerald-200 font-semibold mb-2">Opponent model (team vs team)</h5>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-gray-300 border-b border-gray-700">
                <th className="py-2 pr-2">Opponent</th>
                <th className="py-2 pr-2">Matches</th>
                <th className="py-2 pr-2">Quotes</th>
                <th className="py-2 pr-2">Avg Implied Prob</th>
                <th className="py-2 pr-2">Trend Delta</th>
              </tr>
            </thead>
            <tbody>
              {teamForm.opponents.map((opponent) => (
                <tr key={opponent.opponent} className="border-b border-gray-800 text-slate-200">
                  <td className="py-2 pr-2">{opponent.opponent}</td>
                  <td className="py-2 pr-2">{opponent.matchCount}</td>
                  <td className="py-2 pr-2">{opponent.sampleQuotes}</td>
                  <td className="py-2 pr-2">{formatMetric(opponent.avgImpliedProb)}</td>
                  <td className="py-2 pr-2">{renderDelta(opponent.trendDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>
);
