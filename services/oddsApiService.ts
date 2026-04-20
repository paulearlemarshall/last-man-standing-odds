
import type { ApiMatch, Region } from '../types';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchOddsFromApi(
    sportKey: string = 'soccer_epl', 
    forceRefresh: boolean = false,
    regions: Region[] = ['uk'],
    signal?: AbortSignal
): Promise<{ data: ApiMatch[], fetchedRegionCount: number }> {
    
    // 1. Identify what we have and what we need
    const regionsToFetch: Region[] = [];
    const cachedMatches: Map<string, ApiMatch> = new Map(); // Map MatchID -> Match

    // Helper to merge matches into the master list
    const mergeDataIntoMaster = (matches: ApiMatch[]) => {
        matches.forEach(match => {
            if (!cachedMatches.has(match.id)) {
                cachedMatches.set(match.id, JSON.parse(JSON.stringify(match)));
            } else {
                const existingMatch = cachedMatches.get(match.id)!;
                const existingBookieKeys = new Set(existingMatch.bookmakers.map(b => b.key));
                
                match.bookmakers.forEach(newBookie => {
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
        regions.forEach(region => {
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
            } catch (e) {
                regionsToFetch.push(region);
            }
        });
    } else {
        regionsToFetch.push(...regions);
    }

    // 3. Fetch missing regions
    if (regionsToFetch.length > 0) {
        const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
        const sortedRegionsToFetch = [...regionsToFetch].sort();

        await Promise.all(
            sortedRegionsToFetch.map(async (region) => {
                const params = new URLSearchParams({
                    sportKey,
                    regions: region,
                    markets: 'h2h'
                });

                const apiPath = `/api/odds?${params.toString()}`;
                const requestUrl = apiBaseUrl ? `${apiBaseUrl}${apiPath}` : apiPath;
                console.log(`[API] Fetching missing region (${region}) via ${requestUrl}`);
                const response = await fetch(requestUrl, { signal });
                
                if (!response.ok) {
                    const details = await response.text();
                    throw new Error(`API returned ${response.status}: ${response.statusText}${details ? ` - ${details}` : ''}`);
                }

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
                } catch (_error) {}
            })
        );

        return {
            data: Array.from(cachedMatches.values()),
            fetchedRegionCount: sortedRegionsToFetch.length
        };
    }

    return { 
        data: Array.from(cachedMatches.values()), 
        fetchedRegionCount: 0 
    };
}
