import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiMatch, MatchWeekend, Region } from '../types';
import { fetchOddsFromApi } from '../services/oddsApiService';
import { processApiData } from '../services/oddsTransformService';

interface UseOddsDataResult {
  apiData: ApiMatch[] | null;
  matchWeekends: MatchWeekend[];
  allBookmakers: string[];
  allTeams: string[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastRefreshTime: Date | null;
  apiLatency: number | null;
  quotaCost: number;
  refresh: () => Promise<void>;
}

export function useOddsData(leagueKey: string, selectedRegions: Region[]): UseOddsDataResult {
  const activeRequestRef = useRef<AbortController | null>(null);
  const [apiData, setApiData] = useState<ApiMatch[] | null>(null);
  const [matchWeekends, setMatchWeekends] = useState<MatchWeekend[]>([]);
  const [allBookmakers, setAllBookmakers] = useState<string[]>(['average']);
  const [allTeams, setAllTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [quotaCost, setQuotaCost] = useState(0);

  const loadOdds = useCallback(
    async (forceRefresh: boolean): Promise<void> => {
      activeRequestRef.current?.abort();
      const abortController = new AbortController();
      activeRequestRef.current = abortController;

      try {
        setError(null);

        const startTime = performance.now();
        const { data, fetchedRegionCount } = await fetchOddsFromApi(
          leagueKey,
          forceRefresh,
          selectedRegions,
          abortController.signal
        );
        const endTime = performance.now();
        if (abortController.signal.aborted) {
          return;
        }

        if (fetchedRegionCount > 0) {
          setApiLatency(endTime - startTime);
          setQuotaCost((previous) => previous + fetchedRegionCount);
        }

        setApiData(data);

        const { weekends, bookmakers, allTeams: teams } = processApiData(data);
        setMatchWeekends(weekends);
        setAllBookmakers(bookmakers);
        setAllTeams(teams);
        setLastRefreshTime(new Date());
      } catch (fetchError) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : 'An unknown error occurred.');
      } finally {
        if (activeRequestRef.current === abortController) {
          activeRequestRef.current = null;
        }
      }
    },
    [leagueKey, selectedRegions]
  );

  useEffect(() => {
    setLoading(true);
    loadOdds(false).finally(() => setLoading(false));
  }, [loadOdds]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
    };
  }, [loadOdds]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadOdds(true);
    setIsRefreshing(false);
  }, [loadOdds]);

  return {
    apiData,
    matchWeekends,
    allBookmakers,
    allTeams,
    loading,
    isRefreshing,
    error,
    lastRefreshTime,
    apiLatency,
    quotaCost,
    refresh,
  };
}
