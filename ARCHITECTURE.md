# Architecture

Last Man Standing Odds Assistant is a React + Vite application backed by Vercel serverless API routes. It helps manage Last-Man-Standing picks by fetching fixture odds, normalizing team and bookmaker data, grouping fixtures into playable gameweeks, and suggesting candidate picks.

## Product Principles

- Keep API secrets server-side. Browser code must never receive or embed The Odds API key.
- Prefer live active competitions over stale hardcoded league lists.
- Default to EPL only when The Odds API currently reports EPL as active.
- Treat hardcoded sports data as a fallback, not the source of truth.
- Fetch only fixture-style head-to-head markets unless the UI and data model are extended for other market types.
- Exclude outright/winner markets from the main fixture picker because they do not have normal `home_team` and `away_team` structure.
- Preserve shareable state in the URL for league, sport group, regions, and players.
- Make quota cost visible and predictable by fetching only selected regions.
- Normalize team names before comparing API outcomes with fixtures.
- Avoid silently dropping matches after the API returns them; transforms should enrich, sort, and group rather than hide data.

## Runtime Shape

The app has three main layers:

- Frontend UI: React components in `App.tsx` and `components/`.
- Client services/hooks: fetch, cache, normalize, and process data in `services/`, `hooks/`, and `utils/`.
- Serverless API routes: Vercel functions in `api/` that call third-party services with server-side credentials.

At runtime:

1. The app loads a sports directory from `/api/sports`.
2. The frontend filters that response to active, non-outright sports.
3. If `soccer_epl` exists in the active list, it becomes the default league.
4. If EPL is inactive, the app falls back to the requested URL league if valid, then the first active sport in the selected group.
5. Odds are fetched through `/api/odds` for the selected league and regions.
6. Returned fixtures are processed into normalized matches, bookmaker lists, team lists, and gameweek groups.
7. The UI renders match cards, bookmaker views, visualizations, debug data, arbitrage checks, history, and pick suggestions.

## API Routes

### `api/sports.ts`

Proxies The Odds API sports endpoint:

```text
GET https://api.the-odds-api.com/v4/sports/
```

This route:

- Reads `THE_ODDS_API_KEY` or `ODDS_API_KEY` from server environment variables.
- Returns the upstream sports list to the browser without exposing the API key.
- Uses Vercel cache headers so the sports list can be reused briefly.

The frontend then maps active, non-outright entries into the dropdown directory shape.

### `api/odds.ts`

Proxies The Odds API odds endpoint:

```text
GET https://api.the-odds-api.com/v4/sports/{sportKey}/odds/
```

This route:

- Validates `sportKey` format.
- Allows only `uk`, `us`, `eu`, and `au` regions.
- Forces `markets=h2h`.
- Stores odds snapshots through `api/_lib/oddsSnapshotsStore.ts`.
- Redacts the API key from persisted source URLs.

The `h2h` restriction is intentional because the current app data model assumes fixture odds with home, draw, and away outcomes.

## Sports Directory

The static file `constants/sportsDirectory.ts` is now fallback metadata. It is still useful for:

- Known league display names.
- Known league logos.
- Offline or failed `/api/sports` startup.

The active dropdown should come from `services/sportsDirectoryService.ts`, which calls `/api/sports` and maps the upstream sports into:

```ts
Record<string, LeagueDefinition[]>;
```

Outrights are excluded because entries such as `soccer_fifa_world_cup_winner` do not represent a single fixture. They need separate UI and analytics if supported later.

## Odds Fetching

`hooks/useOddsData.ts` owns the current odds request lifecycle:

- Cancels stale requests with `AbortController`.
- Tracks loading and refresh states.
- Tracks API latency when a network fetch occurs.
- Tracks quota cost by number of fetched regions.
- Calls `fetchOddsFromApi`.
- Sends raw API data to `processApiData`.

`services/oddsApiService.ts` handles browser-side fetching and short-lived local cache:

- Cache key is per sport and region.
- Cache duration is 5 minutes.
- Regions are fetched independently.
- Results from multiple regions are merged by match id.
- Bookmakers from different regions are merged into the same match.

The app requests:

```text
markets=h2h
```

It does not currently request spreads, totals, alternate markets, or outrights.

## Data Processing

`services/oddsTransformService.ts` turns raw API fixtures into app data:

- Normalizes home and away team names.
- Normalizes outcome names to match team names.
- Normalizes draw labels such as `draw` and `tie` to `Draw`.
- Computes an `average` bookmaker from available h2h prices.
- Sorts matches by `commence_time`.
- Groups matches into gameweeks by walking sorted fixtures and starting a new group when a team repeats.

The transform should not filter out valid returned fixtures. If matches disappear, first check:

- Whether the selected sport is active in `/api/sports`.
- Whether The Odds API returns events for the selected sport, regions, and `h2h` market.
- Whether localStorage has a stale 5-minute cache entry.

## Bookmaker Dropdown

The bookmaker dropdown in `components/MatchWeekendView.tsx` is derived from bookmakers present in the fetched odds payload, plus the synthetic `average` option.

Selecting a bookmaker changes displayed and sorted odds. It should not remove matches. If a selected bookmaker has no odds for a match, `utils/oddsHelper.ts` falls back to `average`.

## Regions and Quota

Supported regions are:

```text
uk, us, eu, au
```

Each selected region can trigger a separate API fetch. More regions generally means broader bookmaker coverage, but higher quota cost. The UI tracks quota cost as the number of fetched regions.

## Share State

`utils/shareState.ts` encodes player picks into the URL. `App.tsx` also persists:

- `sport`
- `league`
- `regions`
- `players`

On startup, URL-selected leagues are honored only if they exist in the current sports directory.

## History and Analytics

Odds snapshots are stored through `api/_lib/oddsSnapshotsStore.ts`. The history and analytics panels read from:

- `api/odds-history.ts`
- `api/odds-analytics.ts`

Those modules assume h2h fixture data. They should be reviewed before adding non-h2h market support.

## Deployment

Vercel serves:

- The Vite frontend build.
- Serverless API routes from `api/`.

Required environment variable:

```text
THE_ODDS_API_KEY
```

Fallback accepted variable:

```text
ODDS_API_KEY
```

Optional environment variable:

```text
GEMINI_API_KEY
```

## Extension Guidelines

When extending the app:

- Add backend proxy routes for third-party APIs rather than calling secret-bearing APIs from the browser.
- Update this document when changing market assumptions, default sport behavior, quota behavior, or persistence shape.
- Keep market-specific logic explicit. Do not mix fixture markets and outrights in the same UI model.
- Add tests or run typecheck/build after touching shared data types, API route contracts, or transform logic.
- Prefer API-provided active sports over static league lists.
- Keep fallback behavior visible to the user when dynamic loading fails.
