// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOddsFromApi } from './oddsApiService';

const responseData = [
  {
    id: '1',
    sport_key: 'soccer_epl',
    sport_title: 'EPL',
    commence_time: '2026-07-04T14:00:00Z',
    home_team: 'Alpha',
    away_team: 'Beta',
    bookmakers: [],
  },
];

describe('fetchOddsFromApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it('batches selected regions into one request and caches the combined result', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'x-requests-last': '2', 'x-requests-remaining': '98' },
      })
    );

    const first = await fetchOddsFromApi('soccer_epl', false, ['us', 'uk']);
    const second = await fetchOddsFromApi('soccer_epl', false, ['uk', 'us']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('regions=uk%2Cus');
    expect(first.fetchedRegionCount).toBe(2);
    expect(first.quotaUsage?.requestsLast).toBe(2);
    expect(second.fetchedRegionCount).toBe(0);
    expect(second.data).toEqual(responseData);
  });

  it('removes malformed stale cache entries', async () => {
    localStorage.setItem('odds_cache_broken', 'not-json');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(responseData), { status: 200 }));

    await fetchOddsFromApi('soccer_epl', true, ['uk']);
    expect(localStorage.getItem('odds_cache_broken')).toBeNull();
  });
});
