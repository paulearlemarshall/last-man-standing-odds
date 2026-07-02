import type { ApiMatch, ApiQuotaUsage, Region } from '../types';
import { apiFetch, resolveApiUrl } from './apiClient';

const CACHE_DURATION_MS = 5 * 60 * 1000;
const CACHE_PREFIX = 'odds_cache_';

interface CachedOdds {
  timestamp: number;
  data: ApiMatch[];
  quotaUsage: ApiQuotaUsage | null;
}

const parseQuotaHeader = (headers: Headers, name: string): number | null => {
  const rawValue = headers.get(name);
  if (rawValue === null) return null;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const readQuotaUsage = (headers: Headers): ApiQuotaUsage => ({
  requestsRemaining: parseQuotaHeader(headers, 'x-requests-remaining'),
  requestsUsed: parseQuotaHeader(headers, 'x-requests-used'),
  requestsLast: parseQuotaHeader(headers, 'x-requests-last'),
  snapshotStored: headers.get('x-snapshot-stored') === null ? null : headers.get('x-snapshot-stored') === 'true',
});

function sweepStaleOddsCache(now = Date.now()): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;

      try {
        const entry = JSON.parse(localStorage.getItem(key) || '') as Partial<CachedOdds>;
        if (typeof entry.timestamp !== 'number' || now - entry.timestamp >= CACHE_DURATION_MS) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Cache cleanup is best-effort.
  }
}

function readCache(key: string): CachedOdds | null {
  try {
    const entry = JSON.parse(localStorage.getItem(key) || '') as CachedOdds;
    if (!Array.isArray(entry.data) || Date.now() - entry.timestamp >= CACHE_DURATION_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function fetchOddsFromApi(
  sportKey: string = 'soccer_epl',
  forceRefresh: boolean = false,
  regions: Region[] = ['uk'],
  signal?: AbortSignal
): Promise<{ data: ApiMatch[]; fetchedRegionCount: number; quotaUsage: ApiQuotaUsage | null }> {
  sweepStaleOddsCache();
  const selectedRegions = Array.from(new Set(regions)).sort();
  const cacheKey = `${CACHE_PREFIX}${sportKey}_${selectedRegions.join('-')}`;

  if (!forceRefresh) {
    const cached = readCache(cacheKey);
    if (cached) return { data: structuredClone(cached.data), fetchedRegionCount: 0, quotaUsage: cached.quotaUsage };
  }

  const params = new URLSearchParams({
    sportKey,
    regions: selectedRegions.join(','),
    markets: 'h2h',
  });
  const apiPath = `/api/odds?${params.toString()}`;
  if (import.meta.env.DEV) console.log(`[API] Fetching ${selectedRegions.join(',')} via ${resolveApiUrl(apiPath)}`);

  const response = await apiFetch(apiPath, { signal }, 'Odds API');
  const quotaUsage = readQuotaUsage(response.headers);
  const responseText = await response.text();
  let data: ApiMatch[];

  try {
    data = JSON.parse(responseText) as ApiMatch[];
  } catch (error) {
    throw new Error(`Odds API returned non-JSON content: ${responseText.slice(0, 120)}`, { cause: error });
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data, quotaUsage } satisfies CachedOdds));
  } catch {
    // Cache writes are best-effort; quota errors must not fail a successful request.
  }

  return { data, fetchedRegionCount: selectedRegions.length, quotaUsage };
}
