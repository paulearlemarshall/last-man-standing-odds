import React, { useMemo } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { useSnapshotHistory } from '../hooks/useSnapshotHistory';
import { useSnapshotAnalytics } from '../hooks/useSnapshotAnalytics';
import { SnapshotSelector } from './history/SnapshotSelector';
import { SnapshotRawView } from './history/SnapshotRawView';
import { TeamFormView } from './history/TeamFormView';
import { HeadToHeadView } from './history/HeadToHeadView';

const OddsHistoryPanel: React.FC = () => {
  const {
    snapshots,
    selectedSnapshotId,
    setSelectedSnapshotId,
    selectedSnapshot,
    loadingList,
    loadingSnapshot,
    error,
    loadSnapshots,
  } = useSnapshotHistory();
  const {
    analyticsTab,
    setAnalyticsTab,
    teams,
    selectedTeam,
    setSelectedTeam,
    teamA,
    setTeamA,
    teamB,
    setTeamB,
    teamForm,
    headToHead,
    loadingAnalytics,
    analyticsError,
  } = useSnapshotAnalytics(selectedSnapshotId);

  const snapshotPayload = useMemo(() => {
    if (!selectedSnapshot) {
      return '';
    }
    return JSON.stringify(selectedSnapshot.payload, null, 2);
  }, [selectedSnapshot]);

  return (
    <CollapsibleSection title="Stored Odds Snapshots" defaultOpen={false}>
      <div className="space-y-4">
        <SnapshotSelector
          snapshots={snapshots}
          selectedId={selectedSnapshotId}
          loading={loadingList}
          onRefresh={() => void loadSnapshots()}
          onSelect={setSelectedSnapshotId}
        />

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
              <SnapshotRawView snapshot={selectedSnapshot} payload={snapshotPayload} loading={loadingSnapshot} />
            )}

            {analyticsTab === 'team' && (
              <TeamFormView
                teams={teams}
                selectedTeam={selectedTeam}
                onTeamChange={setSelectedTeam}
                teamForm={teamForm}
                loading={loadingAnalytics}
                error={analyticsError}
              />
            )}

            {analyticsTab === 'headToHead' && (
              <HeadToHeadView
                teams={teams}
                teamA={teamA}
                teamB={teamB}
                onTeamAChange={setTeamA}
                onTeamBChange={setTeamB}
                model={headToHead}
                loading={loadingAnalytics}
                error={analyticsError}
              />
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
