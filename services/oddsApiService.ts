import type { ApiMatch, ApiQuotaUsage, Region } from '../types';
import { apiFetch, resolveApiUrl } from './apiClient';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const parseQuotaHeader = (headers: Headers, name: string): number | null => {
  const rawValue = headers.get(name);
  if (rawValue === null) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const readQuotaUsage = (headers: Headers): ApiQuotaUsage => ({
  requestsRemaining: parseQuotaHeader(headers, 'x-requests-remaining'),
  requestsUsed: parseQuotaHeader(headers, 'x-requests-used'),
  requestsLast: parseQuotaHeader(headers, 'x-requests-last'),
});

export async function fetchOddsFromApi(
  sportKey: string = 'soccer_epl',
  forceRefresh: boolean = false,
  regions: Region[] = ['uk'],
  signal?: AbortSignal
): Promise<{ data: ApiMatch[]; fetchedRegionCount: number; quotaUsage: ApiQuotaUsage | null }> {
  // 1. Identify what we have and what we need
  const regionsToFetch: Region[] = [];
  const cachedMatches: Map<string, ApiMatch> = new Map(); // Map MatchID -> Match

  // Helper to merge matches into the master list
  const mergeDataIntoMaster = (matches: ApiMatch[]) => {
    matches.forEach((match) => {
      if (!cachedMatches.has(match.id)) {
        cachedMatches.set(match.id, JSON.parse(JSON.stringify(match)));
      } else {
        const existingMatch = cachedMatches.get(match.id)!;
        const existingBookieKeys = new Set(existingMatch.bookmakers.map((b) => b.key));

        match.bookmakers.forEach((newBookie) => {
          if (!existingBookieKeys.has(newBookie.key)) {
            existingMatch.bookmakers.push(newBookie);
            existingBookieKeys.add(newBookie.key);
          }
        });
      }
    });
  };

  // 2. Check Cache
  if (!forceRefresh) {
    regions.forEach((region) => {
      const CACHE_KEY = `odds_cache_single_${sportKey}_${region}`;
      try {
        const cachedString = localStorage.getItem(CACHE_KEY);
        if (cachedString) {
          const cachedEntry = JSON.parse(cachedString);
          const age = Date.now() - cachedEntry.timestamp;
          if (age < CACHE_DURATION_MS) {
            mergeDataIntoMaster(cachedEntry.data);
          } else {
            regionsToFetch.push(region);
          }
        } else {
          regionsToFetch.push(region);
        }
      } catch {
        regionsToFetch.push(region);
      }
    });
  } else {
    regionsToFetch.push(...regions);
  }

  // 3. Fetch missing regions
  if (regionsToFetch.length > 0) {
    const sortedRegionsToFetch = [...regionsToFetch].sort();
    let quotaUsage: ApiQuotaUsage | null = null;
    let requestsLastTotal = 0;
    let hasRequestsLast = false;

    await Promise.all(
      sortedRegionsToFetch.map(async (region) => {
        const params = new URLSearchParams({
          sportKey,
          regions: region,
          markets: 'h2h',
        });

        const apiPath = `/api/odds?${params.toString()}`;
        const requestUrl = resolveApiUrl(apiPath);
        if (import.meta.env.DEV) console.log(`[API] Fetching missing region (${region}) via ${requestUrl}`);
        const response = await apiFetch(apiPath, { signal }, 'Odds API');

        const responseQuotaUsage = readQuotaUsage(response.headers);
        if (responseQuotaUsage.requestsLast !== null) {
          requestsLastTotal += responseQuotaUsage.requestsLast;
          hasRequestsLast = true;
        }
        quotaUsage = responseQuotaUsage;

        const responseText = await response.text();
        let freshData: ApiMatch[];

        try {
          freshData = JSON.parse(responseText) as ApiMatch[];
        } catch (_error) {
          throw new Error(`API returned non-JSON content from ${requestUrl}: ${responseText.slice(0, 120)}`);
        }

        mergeDataIntoMaster(freshData);

        const CACHE_KEY = `odds_cache_single_${sportKey}_${region}`;
        const timestamp = Date.now();
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp, data: freshData }));
        } catch {
          // Cache writes are best-effort; quota errors must not fail a successful API request.
        }
      })
    );

    return {
      data: Array.from(cachedMatches.values()),
      fetchedRegionCount: sortedRegionsToFetch.length,
      quotaUsage: quotaUsage
        ? {
            ...quotaUsage,
            requestsLast: hasRequestsLast ? requestsLastTotal : quotaUsage.requestsLast,
          }
        : null,
    };
  }

  return {
    data: Array.from(cachedMatches.values()),
    fetchedRegionCount: 0,
    quotaUsage: null,
  };
}
