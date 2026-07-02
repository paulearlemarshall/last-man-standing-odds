import type { ServerResponse } from 'http';
import { type ApiRequest, normalizeQueryValue, sendJson, timed } from './_lib/http.js';
import { storeOddsSnapshot } from './_lib/oddsSnapshotsStore.js';

type Region = 'uk' | 'us' | 'eu' | 'au';

const ALLOWED_REGIONS = new Set<Region>(['uk', 'us', 'eu', 'au']);
const DEFAULT_REGION: Region = 'uk';
const SPORT_KEY_REGEX = /^[a-z0-9_]+$/i;

export default async function handler(req: ApiRequest, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Server is missing THE_ODDS_API_KEY' });
  }

  const sportKeyRaw = normalizeQueryValue(req.query?.sportKey) || 'soccer_epl';
  if (!SPORT_KEY_REGEX.test(sportKeyRaw)) {
    return sendJson(res, 400, { error: 'Invalid sportKey format' });
  }

  const regionsRaw = normalizeQueryValue(req.query?.regions) || DEFAULT_REGION;
  const normalizedRegions = regionsRaw
    .split(',')
    .map((region) => region.trim().toLowerCase())
    .filter((region): region is Region => ALLOWED_REGIONS.has(region as Region));

  const regions = normalizedRegions.length ? Array.from(new Set(normalizedRegions)) : [DEFAULT_REGION];

  const marketsRaw = normalizeQueryValue(req.query?.markets) || 'h2h';
  if (marketsRaw !== 'h2h') {
    return sendJson(res, 400, { error: 'Only h2h markets are currently supported' });
  }
  const markets = 'h2h';

  const upstreamParams = new URLSearchParams({
    regions: regions.join(','),
    markets,
    apiKey,
  });

  const upstreamUrl = `https://api.the-odds-api.com/v4/sports/${sportKeyRaw}/odds/?${upstreamParams.toString()}`;
  const persistedSourceUrl = (() => {
    const sanitizedParams = new URLSearchParams({
      regions: regions.join(','),
      markets,
      apiKey: 'REDACTED',
    });
    return `https://api.the-odds-api.com/v4/sports/${sportKeyRaw}/odds/?${sanitizedParams.toString()}`;
  })();

  try {
    const response = await timed('odds.upstream', () =>
      fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })
    );

    const responseText = await response.text();

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: 'Upstream odds API error',
        status: response.status,
        details: responseText,
      });
    }

    let snapshotStored = true;
    try {
      await timed('odds.storeSnapshot', () =>
        storeOddsSnapshot({
          sportKey: sportKeyRaw,
          regions: regions.join(','),
          markets,
          sourceUrl: persistedSourceUrl,
          responseText,
        })
      );
    } catch (persistError) {
      snapshotStored = false;
      console.error('Failed to store odds snapshot:', persistError);
    }
    res.setHeader('x-snapshot-stored', String(snapshotStored));

    const quotaHeaderNames = ['x-requests-remaining', 'x-requests-used', 'x-requests-last'];
    quotaHeaderNames.forEach((headerName) => {
      const headerValue = response.headers.get(headerName);
      if (headerValue !== null) {
        res.setHeader(headerName, headerValue);
      }
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=240');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return sendJson(res, 500, {
      error: 'Failed to fetch odds',
      details: message,
    });
  }
}
