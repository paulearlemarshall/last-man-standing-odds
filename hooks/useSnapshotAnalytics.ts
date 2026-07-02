import { useEffect, useState } from 'react';
import type { HeadToHeadAnalytics, TeamFormAnalytics } from '../types';
import { apiFetch } from '../services/apiClient';

export type AnalyticsTab = 'raw' | 'team' | 'headToHead';
const BUCKET_MINUTES = 15;
const MIN_DELTA = 0.002;

export function useSnapshotAnalytics(selectedSnapshotId: number | null) {
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('raw');
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [teamForm, setTeamForm] = useState<TeamFormAnalytics | null>(null);
  const [headToHead, setHeadToHead] = useState<HeadToHeadAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSnapshotId) {
      setTeams([]);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await apiFetch(
          `/api/odds-analytics?snapshotId=${selectedSnapshotId}`,
          { signal: controller.signal },
          'Team list API'
        );
        const payload = (await response.json()) as { teams?: string[] };
        const nextTeams = Array.isArray(payload.teams) ? payload.teams : [];
        setTeams(nextTeams);
        setSelectedTeam((current) => (current && nextTeams.includes(current) ? current : (nextTeams[0] ?? '')));
        setTeamA((current) => (current && nextTeams.includes(current) ? current : (nextTeams[0] ?? '')));
        setTeamB((current) =>
          current && nextTeams.includes(current) ? current : (nextTeams[1] ?? nextTeams[0] ?? '')
        );
      } catch (error) {
        if (!controller.signal.aborted)
          setAnalyticsError(error instanceof Error ? error.message : 'Failed to load teams');
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedSnapshotId]);

  useEffect(() => {
    if (!selectedSnapshotId || !selectedTeam || analyticsTab !== 'team') return;
    const controller = new AbortController();
    const load = async () => {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      try {
        const response = await apiFetch(
          `/api/odds-analytics?snapshotId=${selectedSnapshotId}&team=${encodeURIComponent(selectedTeam)}&lookback=40&bucketMinutes=${BUCKET_MINUTES}&minDelta=${MIN_DELTA}`,
          { signal: controller.signal },
          'Team form API'
        );
        const payload = (await response.json()) as { teamForm?: TeamFormAnalytics };
        setTeamForm(payload.teamForm ?? null);
      } catch (error) {
        if (!controller.signal.aborted)
          setAnalyticsError(error instanceof Error ? error.message : 'Failed to load team form');
      } finally {
        if (!controller.signal.aborted) setLoadingAnalytics(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [analyticsTab, selectedSnapshotId, selectedTeam]);

  useEffect(() => {
    if (!selectedSnapshotId || !teamA || !teamB || teamA === teamB || analyticsTab !== 'headToHead') return;
    const controller = new AbortController();
    const load = async () => {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      try {
        const response = await apiFetch(
          `/api/odds-analytics?snapshotId=${selectedSnapshotId}&teamA=${encodeURIComponent(teamA)}&teamB=${encodeURIComponent(teamB)}&lookback=40&bucketMinutes=${BUCKET_MINUTES}&minDelta=${MIN_DELTA}`,
          { signal: controller.signal },
          'Head-to-head API'
        );
        const payload = (await response.json()) as { headToHead?: HeadToHeadAnalytics };
        setHeadToHead(payload.headToHead ?? null);
      } catch (error) {
        if (!controller.signal.aborted)
          setAnalyticsError(error instanceof Error ? error.message : 'Failed to load head-to-head model');
      } finally {
        if (!controller.signal.aborted) setLoadingAnalytics(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [analyticsTab, selectedSnapshotId, teamA, teamB]);

  return {
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
  };
}
