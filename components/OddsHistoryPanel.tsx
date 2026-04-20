/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useEffect, useMemo, useState } from 'react';
import type {
  HeadToHeadAnalytics,
  HeadToHeadTimelinePoint,
  OddsSnapshotDetail,
  OddsSnapshotInsightPoint,
  OddsSnapshotSummary,
  TeamFormAnalytics,
  TeamFormTimelinePoint,
} from '../types';
import CollapsibleSection from './CollapsibleSection';

type AnalyticsTab = 'raw' | 'team' | 'headToHead';

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => (
  <span className="group relative inline-flex items-center">
    <span
      tabIndex={0}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-500 text-[10px] text-gray-300 cursor-help"
      aria-label={text}
    >
      ?
    </span>
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-[11px] leading-snug text-gray-100 shadow-lg group-hover:block group-focus-within:block">
      {text}
    </span>
  </span>
);

const MetricLabel: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <p className="text-xs text-gray-400 flex items-center">
    {label}
    <InfoTooltip text={help} />
  </p>
);

const formatSnapshotLabel = (snapshot: OddsSnapshotSummary) => {
  const createdAt = new Date(snapshot.createdAt).toLocaleString('en-GB', {
    hour12: false,
    timeZone: 'Europe/London',
  });

  return `${snapshot.id} | ${createdAt} | ${snapshot.sportKey} | ${snapshot.regions} | ${snapshot.matchCount} matches`;
};

const formatMetric = (value: number | null): string => {
  if (value === null) return 'n/a';
  return value.toFixed(4);
};

const renderDelta = (value: number | null): string => {
  if (value === null) return 'n/a';
  if (value > 0) return `+${value.toFixed(4)}`;
  return value.toFixed(4);
};

const formatTimelineDate = (createdAt: string): string =>
  new Date(createdAt).toLocaleString('en-GB', {
    hour12: false,
    timeZone: 'Europe/London',
  });

const OddsHistoryPanel: React.FC = () => {
  const [snapshots, setSnapshots] = useState<OddsSnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<OddsSnapshotDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('raw');
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [teamA, setTeamA] = useState<string>('');
  const [teamB, setTeamB] = useState<string>('');
  const [teamForm, setTeamForm] = useState<TeamFormAnalytics | null>(null);
  const [headToHead, setHeadToHead] = useState<HeadToHeadAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedSnapshotId) {
      setTeams([]);
      setSelectedTeam('');
      setTeamA('');
      setTeamB('');
      return;
    }

    const abortController = new AbortController();

    const loadTeams = async () => {
      try {
        const response = await fetch(`/api/odds-analytics?snapshotId=${selectedSnapshotId}`, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          const details = await response.text();
          throw new Error(`Failed to load team list (${response.status}): ${details}`);
        }

        const payload = (await response.json()) as { teams?: string[] };
        const nextTeams = Array.isArray(payload.teams) ? payload.teams : [];
        setTeams(nextTeams);

        if (!nextTeams.length) {
          setSelectedTeam('');
          setTeamA('');
          setTeamB('');
          return;
        }

        setSelectedTeam((current) => (current && nextTeams.includes(current) ? current : nextTeams[0]));
        setTeamA((current) => (current && nextTeams.includes(current) ? current : nextTeams[0]));
        setTeamB((current) => {
          if (current && nextTeams.includes(current) && current !== (nextTeams[0] || '')) {
            return current;
          }
          return nextTeams[1] || nextTeams[0] || '';
        });
      } catch (loadError) {
        if (!abortController.signal.aborted) {
          setAnalyticsError(
            loadError instanceof Error ? loadError.message : 'Failed to load available teams'
          );
        }
      }
    };

    void loadTeams();

    return () => abortController.abort();
  }, [selectedSnapshotId]);

  useEffect(() => {
    if (!selectedSnapshotId || !selectedTeam || analyticsTab !== 'team') {
      return;
    }

    const abortController = new AbortController();

    const loadTeamForm = async () => {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      try {
        const response = await fetch(
          `/api/odds-analytics?snapshotId=${selectedSnapshotId}&team=${encodeURIComponent(selectedTeam)}&lookback=40`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          const details = await response.text();
          throw new Error(`Failed to load team form (${response.status}): ${details}`);
        }

        const payload = (await response.json()) as { teamForm?: TeamFormAnalytics };
        setTeamForm(payload.teamForm || null);
      } catch (loadError) {
        if (!abortController.signal.aborted) {
          setAnalyticsError(loadError instanceof Error ? loadError.message : 'Failed to load team form');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingAnalytics(false);
        }
      }
    };

    void loadTeamForm();

    return () => abortController.abort();
  }, [analyticsTab, selectedSnapshotId, selectedTeam]);

  useEffect(() => {
    if (!selectedSnapshotId || !teamA || !teamB || teamA === teamB || analyticsTab !== 'headToHead') {
      return;
    }

    const abortController = new AbortController();

    const loadHeadToHead = async () => {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      try {
        const response = await fetch(
          `/api/odds-analytics?snapshotId=${selectedSnapshotId}&teamA=${encodeURIComponent(teamA)}&teamB=${encodeURIComponent(teamB)}&lookback=40`,
          { signal: abortController.signal }
        );

        if (!response.ok) {
          const details = await response.text();
          throw new Error(`Failed to load head-to-head model (${response.status}): ${details}`);
        }

        const payload = (await response.json()) as { headToHead?: HeadToHeadAnalytics };
        setHeadToHead(payload.headToHead || null);
      } catch (loadError) {
        if (!abortController.signal.aborted) {
          setAnalyticsError(loadError instanceof Error ? loadError.message : 'Failed to load head-to-head model');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingAnalytics(false);
        }
      }
    };

    void loadHeadToHead();

    return () => abortController.abort();
  }, [analyticsTab, selectedSnapshotId, teamA, teamB]);

  const snapshotPayload = useMemo(() => {
    if (!selectedSnapshot) {
      return '';
    }
    return JSON.stringify(selectedSnapshot.payload, null, 2);
  }, [selectedSnapshot]);

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
                <p className="text-sm text-white">
                  {new Date(selectedSnapshot.createdAt).toLocaleString('en-GB', {
                    hour12: false,
                    timeZone: 'Europe/London',
                  })}
                </p>
              </div>
              <div className="bg-gray-900/60 border border-gray-700 rounded-md p-3">
                <p className="text-xs text-gray-400">Request</p>
                <p className="text-sm text-white">
                  {selectedSnapshot.sportKey} | {selectedSnapshot.regions} | {selectedSnapshot.markets}
                </p>
              </div>
            </div>
            <div className="bg-gray-900/60 border border-gray-700 rounded-md p-3">
              <p className="text-xs text-gray-400 mb-1">Source URL</p>
              <p className="text-xs text-slate-300 break-all">{selectedSnapshot.sourceUrl}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAnalyticsTab('raw')}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  analyticsTab === 'raw' ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-200'
                }`}
              >
                Snapshot Raw
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsTab('team')}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  analyticsTab === 'team' ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-200'
                }`}
              >
                Team Form
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsTab('headToHead')}
                className={`px-3 py-1.5 rounded-md text-sm ${
                  analyticsTab === 'headToHead' ? 'bg-green-700 text-white' : 'bg-gray-700 text-gray-200'
                }`}
              >
                Head-to-Head
              </button>
            </div>

            {analyticsTab === 'raw' && (
              <>
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
                        <MetricLabel
                          label="Avg home-odds delta"
                          help="Change in average best available home-team decimal odds across the selected lookback window. Positive means home odds drifted out; negative means shortened."
                        />
                        <p className="text-lg text-white">{renderDelta(selectedSnapshot.insights.avgHomeOddsDelta)}</p>
                      </div>
                      <div className="bg-black/30 border border-gray-700 rounded-md p-3">
                        <MetricLabel
                          label="Avg away-odds delta"
                          help="Change in average best available away-team decimal odds over the lookback. Positive means away odds increased; negative means they shortened."
                        />
                        <p className="text-lg text-white">{renderDelta(selectedSnapshot.insights.avgAwayOddsDelta)}</p>
                      </div>
                      <div className="bg-black/30 border border-gray-700 rounded-md p-3">
                        <MetricLabel
                          label="Avg bookmakers/match delta"
                          help="Change in market depth (number of bookmakers quoting each tracked fixture). Higher values generally indicate stronger market coverage."
                        />
                        <p className="text-lg text-white">
                          {renderDelta(selectedSnapshot.insights.avgBookmakersPerMatchDelta)}
                        </p>
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
              </>
            )}

            {analyticsTab === 'team' && (
              <div className="space-y-4 bg-gray-900/70 border border-emerald-700/50 rounded-md p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <label htmlFor="team-select" className="text-xs text-gray-300 block mb-1">
                      Team
                    </label>
                    <select
                      id="team-select"
                      value={selectedTeam}
                      onChange={(event) => setSelectedTeam(event.target.value)}
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

                {loadingAnalytics && <p className="text-sm text-gray-300">Loading team-form model...</p>}
                {analyticsError && <p className="text-sm text-red-300">{analyticsError}</p>}

                {teamForm && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
            )}

            {analyticsTab === 'headToHead' && (
              <div className="space-y-4 bg-gray-900/70 border border-fuchsia-700/50 rounded-md p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="team-a-select" className="text-xs text-gray-300 block mb-1">
                      Team A
                    </label>
                    <select
                      id="team-a-select"
                      value={teamA}
                      onChange={(event) => setTeamA(event.target.value)}
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
                      onChange={(event) => setTeamB(event.target.value)}
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
            )}
          </div>
        )}

        {!loadingList && snapshots.length === 0 && !error && (
          <p className="text-sm text-gray-400">
            No stored snapshots yet. Refresh odds once and this panel will populate.
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default OddsHistoryPanel;
