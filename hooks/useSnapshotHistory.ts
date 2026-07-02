import { useCallback, useEffect, useRef, useState } from 'react';
import type { OddsSnapshotDetail, OddsSnapshotSummary } from '../types';
import { apiFetch } from '../services/apiClient';

export function useSnapshotHistory() {
  const [snapshots, setSnapshots] = useState<OddsSnapshotSummary[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<number | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<OddsSnapshotDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listAbortControllerRef = useRef<AbortController | null>(null);

  const loadSnapshots = useCallback(async () => {
    listAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    listAbortControllerRef.current = abortController;
    setLoadingList(true);
    setError(null);
    try {
      const response = await apiFetch(
        '/api/odds-history?limit=40',
        { signal: abortController.signal },
        'Snapshot list API'
      );
      const payload = (await response.json()) as { snapshots?: OddsSnapshotSummary[] };
      const nextSnapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
      setSnapshots(nextSnapshots);
      setSelectedSnapshotId((current) =>
        current && nextSnapshots.some((snapshot) => snapshot.id === current) ? current : (nextSnapshots[0]?.id ?? null)
      );
      if (!nextSnapshots.length) setSelectedSnapshot(null);
    } catch (loadError) {
      if (!abortController.signal.aborted) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load snapshot list');
      }
    } finally {
      if (!abortController.signal.aborted) setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
    return () => listAbortControllerRef.current?.abort();
  }, [loadSnapshots]);

  useEffect(() => {
    if (!selectedSnapshotId) {
      setSelectedSnapshot(null);
      return;
    }
    const abortController = new AbortController();
    const loadDetail = async () => {
      setLoadingSnapshot(true);
      setError(null);
      try {
        const response = await apiFetch(
          `/api/odds-history?id=${selectedSnapshotId}`,
          { signal: abortController.signal },
          'Snapshot detail API'
        );
        setSelectedSnapshot((await response.json()) as OddsSnapshotDetail);
      } catch (loadError) {
        if (!abortController.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load snapshot detail');
        }
      } finally {
        if (!abortController.signal.aborted) setLoadingSnapshot(false);
      }
    };
    void loadDetail();
    return () => abortController.abort();
  }, [selectedSnapshotId]);

  return {
    snapshots,
    selectedSnapshotId,
    setSelectedSnapshotId,
    selectedSnapshot,
    loadingList,
    loadingSnapshot,
    error,
    loadSnapshots,
  };
}
