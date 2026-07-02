# Fable.md — Code Review & Build Instructions

**Reviewed:** 2026-07-02 · **Reviewer:** Claude Fable 5 · **Scope:** entire repo (~3,700 source lines)
**Audience:** the next AI agent (or human) working on this codebase. Read this top-to-bottom before making changes. Also read `ARCHITECTURE.md` — its product principles (secrets server-side, h2h-only markets, quota visibility, URL-shareable state) are constraints, not suggestions.

---

## 1. Executive summary

The codebase is in good structural shape: clean separation of `api/` (Vercel functions), `services/`, `hooks/`, `utils/`, `components/`; secrets are server-side; quota usage is surfaced; there is real debug instrumentation (latency, quota headers, decision-trace logging). `tsc --noEmit` passes with zero errors.

The four biggest gaps, in priority order:

1. **No light/dark/system theme support at all** — the app is hardcoded dark (`bg-gray-900` in `index.html` and `App.tsx`). This is a required feature and is entirely missing. See §6 and Phase 2.
2. **Tech stack is one-to-two major versions behind** — React 18.2 (current: 19.x), Vite 5 (current: 7.x), Tailwind via the Play CDN (not production-supported; current: Tailwind 4 via Vite plugin), classic JSX runtime with per-file `/** @jsx */` pragmas (obsolete since React 17). See §3 and Phase 1.
3. **Unbounded database growth** — every `/api/odds` request persists the full JSONB payload *plus* a normalized row per bookmaker-outcome quote, with no dedup and no retention. See §5 and Phase 4.
4. **No lint, no formatter, no tests, no CI.** See Phase 5.

Nothing found is an active correctness bug in the happy path, but §7 lists real edge-case defects to fix during the refactor.

---

## 2. What the app is

"Last Man Standing Odds Assistant": a Vite + React SPA on Vercel that:
- Proxies **The Odds API** (`api/odds.ts`, `api/sports.ts`) keeping `THE_ODDS_API_KEY` server-side.
- Normalizes fixtures/teams (`services/oddsTransformService.ts`, `utils/teamNameNormalizer.ts`), groups them into gameweeks, computes an "average" pseudo-bookmaker.
- Suggests non-conflicting picks for N players via incremental-pool backtracking (`services/pickSuggestionService.ts`) with a full decision trace rendered in `DecisionLogPanel`.
- Persists every odds response as a snapshot to **Neon Postgres** (`api/_lib/oddsSnapshotsStore.ts`) and serves history/analytics (`api/odds-history.ts`, `api/odds-analytics.ts`): team-form timelines, head-to-head edges, adaptive time-bucketing, no-vig implied probabilities, confidence scoring.
- Client caches odds per `{sport, region}` in `localStorage` for 5 minutes; server sets `s-maxage=60, stale-while-revalidate=240`.
- App state (sport, league, regions, players + previous picks) is URL-shareable (`utils/shareState.ts`).

---

## 3. Finding: tech stack currency

| Dependency | Current | Latest supported (mid-2026) | Action |
|---|---|---|---|
| react / react-dom | ^18.2.0 | 19.x | Upgrade (Phase 1) |
| vite | ^5.0.0 | 7.x | Upgrade — requires Node 20.19+/22.12+ |
| typescript | ^5.0.0 | 5.9.x | Upgrade; pin minor |
| @types/node | ^20 | ^24 (Node 24 LTS is Vercel's default runtime) | Upgrade |
| Tailwind | **Play CDN `<script>`** in `index.html` | Tailwind 4 via `@tailwindcss/vite` | Replace — the CDN build is explicitly not for production: it re-scans the DOM at runtime, blocks first paint, and can't tree-shake |
| JSX transform | classic (`jsx: "react"` + `/** @jsx React.createElement */` pragmas in every `.tsx`) | automatic (`react-jsx`) | Switch — pragmas and `import React` boilerplate become unnecessary; smaller output |
| @neondatabase/serverless | ^1.1.0 | current | OK |
| @vercel/analytics | ^2.0.1 | current | OK |
| Vercel config | none (`vercel.json`/`vercel.ts` absent) | `vercel.ts` via `@vercel/config` | Add (Phase 1, optional but recommended) |
| API handler types | hand-rolled `IncomingMessage & { query?: ... }` | `@vercel/node` `VercelRequest`/`VercelResponse` | Adopt as devDependency |

The tsconfig comment `// CRITICAL: Set to 'react' (classic) not 'react-jsx'` (tsconfig.json:21) is a leftover from an AI Studio scaffold constraint. It is **not** a real constraint for a Vite build — remove it when migrating.

---

## 4. Finding: modularity & best practice

**Good:** services are pure functions with typed inputs/outputs; `useOddsData` correctly aborts superseded requests via `AbortController` ref; API handlers validate inputs (sportKey regex, region allowlist, market allowlist, clamped numeric params); the snapshot store redacts the API key from persisted URLs.

**Issues, ordered by impact:**

1. **`components/OddsHistoryPanel.tsx` (791 lines) is a god component.** It holds 15 `useState` hooks and four inline data-fetching `useEffect`s (snapshot list, snapshot detail, team list, team-form/H2H analytics). Split into:
   - `hooks/useSnapshotHistory.ts`, `hooks/useSnapshotAnalytics.ts` (fetch + abort + loading/error state),
   - `components/history/SnapshotSelector.tsx`, `SnapshotRawView.tsx`, `TeamFormView.tsx`, `HeadToHeadView.tsx`, plus a shared `MetricCard`/`DataTable`.
   The five near-identical `<table>` blocks should render through one generic table component driven by a column config.

2. **Duplicated arbitrage logic.** `DebugPanel.tsx:23-82` copies `findArbitrageOpportunities` from `ArbitragePanel.tsx` (the comment admits it). Extract to `services/arbitrageService.ts` and import from both.

3. **Duplicated API-handler helpers.** `normalizeQueryValue` and `sendJson` are copy-pasted across `api/odds.ts`, `api/odds-history.ts`, `api/odds-analytics.ts`, `api/sports.ts`. Move to `api/_lib/http.ts`.

4. **Duplicated fetch plumbing on the client.** The `apiBaseUrl` resolution (`import.meta.env.VITE_API_BASE_URL` trim/strip-slash) appears in both `oddsApiService.ts:79` and `sportsDirectoryService.ts:45`, and `OddsHistoryPanel` fetches without it entirely (inconsistent — history calls will break when `VITE_API_BASE_URL` is set for local dev). Create `services/apiClient.ts` with a single `apiFetch(path, init)` that resolves the base URL, checks `response.ok`, and produces the standard error message.

5. **`App.tsx:110`** — `getPreferredSelection(SPORTS_DIRECTORY)` runs on *every render* (it re-parses `window.location.search` each time). Move into lazy initializers: `useState(() => getPreferredSelection(SPORTS_DIRECTORY))`.

6. **`api/_lib/oddsSnapshotsStore.ts` (1,499 lines) mixes four concerns**: schema DDL, ingestion/normalization, query helpers, and analytics math. Split into `schema.ts`, `ingest.ts`, `queries.ts`, `analytics.ts` under `api/_lib/`. The pure math (`average`, `standardDeviation`, bucketing, confidence scoring) should be import-testable without a DB.

7. **`Infinity` as a sentinel price.** `oddsTransformService.ts:99-101` and `oddsHelper.ts:24-26` use `Infinity` for "no odds", which then requires `isFinite` guards at every consumer and would serialize to `null` in JSON anyway. Use `null` and narrow at the edges.

8. **Deep clone via `JSON.parse(JSON.stringify(match))`** (`oddsApiService.ts:37`) — use `structuredClone` (supported in all target runtimes).

9. **Repo hygiene:** a dozen `vercel-*.log` / `vite-*.log` files sit in the repo root (gitignored but noise — delete them); `metadata.json` is an AI Studio artifact; `README.md`'s "What was refactored" section is a changelog, not a README — git history already records it.

10. **Schema-on-request:** `ensureSnapshotsSchema()` runs `CREATE TABLE IF NOT EXISTS` on every cold start and gates every request behind it. Acceptable for a hobby project; long-term, move DDL to a migration script (`npm run db:migrate`) and drop the runtime gate.

---

## 5. Finding: code paths, data & API efficiency

**Good:** region-scoped `localStorage` cache (5 min) with per-region cache keys; CDN cache headers on both proxies; quota headers (`x-requests-remaining/used/last`) forwarded to the client and displayed; only h2h markets fetched; only selected regions fetched; lazy backfill of normalized market points for old snapshots; sensible indexes on the two tables.

**Issues:**

1. **N HTTP requests where 1 suffices.** `oddsApiService.ts` issues one `/api/odds` call *per region*, yet `api/odds.ts:38-43` already accepts comma-separated regions and The Odds API supports it natively. Batch all cache-missed regions into one request, then split the response per region for caching (each match's `bookmakers` can be attributed by fetching regions individually only when splitting matters — simpler: cache the merged result under a combined key `odds_cache_${sportKey}_${sortedRegions.join('-')}`). One round-trip, one snapshot row instead of N, and the quota-header race below disappears.

2. **Quota-header race.** In the per-region `Promise.all` (`oddsApiService.ts:85-127`), `quotaUsage = responseQuotaUsage` is last-write-wins across concurrent responses — `requestsRemaining` shown to the user is whichever response happened to land last, not the minimum. Fixed for free by item 1; otherwise take the response with the lowest `requestsRemaining`.

3. **Unbounded, duplicated persistence.** Every upstream fetch stores (a) the full raw JSONB payload in `odds_api_snapshots` **and** (b) one row per quote in `odds_market_points` (a 20-match, 20-bookmaker, 3-outcome response ≈ 1,200 rows per snapshot). No retention, no dedup. Required:
   - **Dedup:** before insert, compare a hash of the payload (e.g. `md5` of canonical JSON) against the most recent snapshot for the same `{sport_key, regions_csv, markets}`; skip insert on match. Add a `payload_hash` column.
   - **Retention:** a Vercel Cron (`crons` in `vercel.ts`) hitting an `api/cleanup.ts` that deletes snapshots older than N days (cascade handles `odds_market_points`).

4. **`getContextSnapshots` runs three identical correlated subselects** (`oddsSnapshotsStore.ts:527-535`) — same for `getOddsSnapshotInsights` (lines 966-980). Rewrite with a single CTE: `WITH anchor AS (SELECT sport_key, regions_csv, markets FROM odds_api_snapshots WHERE id = $1) SELECT ... JOIN anchor USING (...)`.

5. **Sequential backfill.** `ensureContextSnapshotsNormalized` (lines 564-573) inserts missing snapshots one `await` at a time inside a `for` loop, on the request path of every analytics call. At minimum `Promise.all` the batch; better, backfill asynchronously and return partial data.

6. **Analytics aggregates in TypeScript over full row sets.** `getTeamFormAnalytics` pulls every matching `odds_market_points` row into memory, then buckets/averages in JS. Fine at current volume; if lookback windows grow, push per-snapshot-per-match averaging into SQL (`GROUP BY snapshot_id, match_id`) — the row transfer is the cost, not the math.

7. **Index gap:** analytics queries filter `snapshot_id = ANY(...) AND outcome_name = X`, but the indexes are `(snapshot_id)` and `(outcome_name, captured_at)`. Add a composite `(outcome_name, snapshot_id)` if analytics latency becomes visible.

8. **Stale cache keys are never evicted** — `localStorage` accumulates one entry per `{sport, region}` ever viewed and only recovers via the silent `catch` on quota errors (`oddsApiService.ts:125`). Add a sweep on startup that removes `odds_cache_*` entries older than the cache TTL.

---

## 6. Finding: debugging & timing instrumentation

**Present and working — keep all of this:**
- `DebugPanel` shows API latency (measured with `performance.now()` around the fetch in `useOddsData.ts:44-51`), cumulative quota cost, and live quota headers.
- `DecisionLogPanel` renders a full trace of the pick-suggestion backtracking (candidates, pool growth, skip counts, final assignment) — genuinely good observability for the core algorithm.
- API errors propagate upstream status + body text to the UI rather than being swallowed.

**Gaps:**
1. **No server-side timing.** The API handlers log nothing about upstream latency or DB durations. Add a tiny helper in `api/_lib/http.ts`:
   ```ts
   export const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
     const start = performance.now();
     try { return await fn(); }
     finally { console.log(`[timing] ${label}: ${(performance.now() - start).toFixed(0)}ms`); }
   };
   ```
   Wrap the upstream fetch, `storeOddsSnapshot`, and each analytics query. These logs appear in `vercel logs` and are the only way to diagnose slow requests in production.
2. **Ungated `console.log` on the client** (`oddsApiService.ts:95`). Gate behind `import.meta.env.DEV` or a `debug=1` query param so production consoles stay clean while the DebugPanel remains the sanctioned surface.
3. **Silent failure paths:** the `localStorage.setItem` catch (`oddsApiService.ts:125`) and snapshot-persist catch (`api/odds.ts:93-95`) swallow errors invisibly on the client side. The persist failure at least logs server-side; surface a non-fatal warning flag in the odds response header (e.g. `x-snapshot-stored: false`) so the DebugPanel can show it.

---

## 7. Finding: light/dark/system mode — **MISSING**

There is no theming at all. Dark colors are hardcoded in ~30 places: `index.html:63` (`<body class="bg-gray-900 text-white">`), `App.tsx:278`, and literal `bg-gray-*/text-white/border-gray-*` classes throughout every component. No `prefers-color-scheme` handling, no toggle, no persistence. Full implementation plan in **Phase 2** below.

---

## 8. Edge-case defects (fix during Phase 3)

1. **Share links silently corrupt player picks.** `shareState.ts` encodes previous picks as *indexes into the alphabetically-sorted team list*. If the team set changes between share and open (new fixtures appear, a team drops out), indexes shift and picks decode to the wrong teams — no error, wrong data. Encode team names (URL-encoded) or stable keys instead of positional indexes.
2. **`getInitialLeague` can return `undefined`** (`App.tsx:67`) when the directory is empty for the selected class and the flatMap fallback yields `[]`; `currentLeague.key` then throws. Guard with the static fallback directory.
3. **`handleSportChange` (`App.tsx:219`)** indexes `sportsDirectory[newSportClass][0]` without a guard — same class of crash.
4. **`decodePlayersFromUrl` doesn't dedupe player ids**, and duplicate ids break React keys plus the name/pick update handlers (`player.id === id` matches multiple).
5. **`OddsHistoryPanel.loadSnapshots`** has no `AbortController` and can race if clicked repeatedly (all other fetches in the file abort correctly).
6. **Backtracking worst case:** `suggestPicks` is exponential in theory; the incremental pool keeps it practical, but with many players + restrictive previous picks it can spin. Add a step-budget (e.g. 100k iterations) that aborts to the error log path.

---

# Build instructions for the next AI

Work in phases; each phase is independently shippable and ends with the verification gate. Do not start a later phase with an earlier gate failing.

### Verification gate (run after every phase)
```bash
npm run typecheck          # must exit 0
npm run build              # must exit 0
npm run dev                # manual smoke: odds load, regions toggle, Suggest works, Share copies, history panel loads
# after Phase 5: npm run lint && npm test
```
Local dev requires `.env.local` with `THE_ODDS_API_KEY` and `DATABASE_URL` (Neon); API functions need `vercel dev` (or `VITE_API_PROXY_TARGET` pointing at a deployed instance — see `vite.config.ts`). Deploys: Vercel, framework preset Vite, env vars `THE_ODDS_API_KEY` + `DATABASE_URL`.

---

## Phase 1 — Stack upgrade (React 19, Vite 7, Tailwind 4, automatic JSX)

1. `npm i react@^19 react-dom@^19 && npm i -D vite@^7 typescript@^5.9 @types/react@^19 @types/react-dom@^19 @types/node@^24 @vercel/node`
2. **tsconfig.json:** set `"jsx": "react-jsx"`; delete `jsxFactory`, `jsxFragmentFactory`, and the "CRITICAL" comment; delete `experimentalDecorators` and `useDefineForClassFields` (unused).
3. **vite.config.ts:** delete the entire `esbuild: { jsx: ... }` block; add `@vitejs/plugin-react` (`npm i -D @vitejs/plugin-react`) to `plugins`.
4. **Every `.tsx` file:** remove the `/** @jsx React.createElement */` and `/** @jsxFrag React.Fragment */` pragma lines; remove `import React from 'react'` where React is only used for JSX (keep named imports like `useState`).
5. **React 19 sweep:** `React.FC<Props>` still works but drop it in touched files in favor of plain typed function components. No `forwardRef`/`propTypes`/legacy-context usage exists, so no other migration work is expected.
6. **Tailwind 4:** `npm i -D tailwindcss @tailwindcss/vite`; add the plugin to `vite.config.ts`; create `styles/index.css` with `@import "tailwindcss";` plus the `rainbow-snake` keyframes/classes moved out of `index.html`; import it from `index.tsx`; delete the `<script src="https://cdn.tailwindcss.com">` and inline `<style>` from `index.html`.
7. Optional but recommended: `npm i -D @vercel/config` and add `vercel.ts` declaring `framework: 'vite'` and (Phase 4) the cleanup cron.
8. Type API handlers with `VercelRequest`/`VercelResponse` from `@vercel/node` instead of the `IncomingMessage & { query?: ... }` intersection.

Gate, then commit: `chore: upgrade to React 19 / Vite 7 / Tailwind 4, automatic JSX runtime`.

## Phase 2 — Light / dark / system theme

1. Tailwind 4 dark-mode variant in `styles/index.css`:
   ```css
   @custom-variant dark (&:where(.dark, .dark *));
   ```
2. Create `hooks/useTheme.ts`:
   - `type ThemePreference = 'light' | 'dark' | 'system'`, persisted under `localStorage['theme']` (default `'system'`).
   - Resolved theme = preference, or `matchMedia('(prefers-color-scheme: dark)')` when `'system'`; subscribe to the media query's `change` event so system flips apply live.
   - Effect toggles the `dark` class on `document.documentElement` and sets `document.documentElement.style.colorScheme` so native controls (selects, scrollbars) follow.
3. Add an inline pre-hydration script in `index.html` `<head>` that reads the stored preference and sets the class before first paint (prevents flash):
   ```html
   <script>try{var t=localStorage.theme;var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}</script>
   ```
4. Add a three-state toggle (Light / Dark / System) to `Header.tsx`, styled like the existing region pills.
5. Convert hardcoded colors to paired classes, e.g. `bg-gray-900` → `bg-gray-100 dark:bg-gray-900`, `text-white` → `text-gray-900 dark:text-white`, `bg-gray-800/50` → `bg-white/70 dark:bg-gray-800/50`, borders likewise. Files to sweep (grep for `bg-gray-|bg-slate-|bg-black|text-white|border-gray-`): `index.html` body, `App.tsx`, all 13 files in `components/`. Keep semantic accents (green/blue/red buttons) as-is; verify contrast of `text-green-300`-style accents on light backgrounds and darken where needed (`text-green-700 dark:text-green-300`).
6. Add `<meta name="color-scheme" content="light dark">` to `index.html`.

Verify: toggle all three modes; reload preserves choice; with `'system'` selected, flipping the OS theme updates the app without reload.

## Phase 3 — Modularity refactor + defect fixes

Apply §4 items 1–9 and §8 items 1–6. Suggested order (each its own commit):
1. `services/apiClient.ts` + adopt everywhere (also fixes OddsHistoryPanel's missing base-URL handling).
2. `api/_lib/http.ts` (`sendJson`, `normalizeQueryValue`, `timed`) + adopt in all four handlers.
3. Extract `services/arbitrageService.ts`; delete the duplicate in `DebugPanel`.
4. Split `OddsHistoryPanel` per §4.1.
5. Split `oddsSnapshotsStore.ts` per §4.6.
6. `App.tsx` lazy initializers + directory guards (§8.2, §8.3).
7. Share-state format v2: name-based encoding with backward-compatible decode (try v2, fall back to index decode) (§8.1, §8.4).
8. Replace `Infinity` sentinels with `null` (§4.7); `structuredClone` (§4.8); gate the client `console.log` (§6.2); abort + step-budget fixes (§8.5, §8.6).
9. Delete `vercel-*.log`, `vite-*.log`, `metadata.json`; trim README's changelog section.

## Phase 4 — Data & API efficiency

1. Single batched odds request for all cache-missed regions (§5.1) — this also resolves the quota race (§5.2). Preserve the per-region cache behavior or switch to a combined-key cache; either way keep the 5-minute TTL and add the startup sweep for stale `odds_cache_*` keys (§5.8).
2. Snapshot dedup via `payload_hash` (§5.3): add column with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS payload_hash text`, index it, compare against latest per `{sport_key, regions_csv, markets}` before insert.
3. `api/cleanup.ts` + cron in `vercel.ts` (e.g. daily, delete snapshots `created_at < now() - interval '30 days'`). Protect with a `CRON_SECRET` header check.
4. CTE rewrite of the triple-subselect queries (§5.4); parallelize backfill (§5.5); add `(outcome_name, snapshot_id)` index if analytics feel slow (§5.7).
5. Emit `x-snapshot-stored` header from `api/odds.ts` and show it in DebugPanel (§6.3).

## Phase 5 — Tooling, tests, CI

1. `npm i -D eslint typescript-eslint eslint-plugin-react-hooks prettier` — flat config, React-hooks rules on error; add `lint` and `format` scripts.
2. `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom` — add `test` script. Priority test targets (pure, high-value):
   - `pickSuggestionService` (constraint satisfaction: previous-pick exclusion, opponent exclusion, pool growth, unsolvable case),
   - `oddsTransformService` (average bookmaker math, gameweek splitting on team repetition),
   - `teamNameNormalizer`, `shareState` (round-trip, v1→v2 compat), and the extracted analytics math (bucketing, no-vig, confidence score).
3. GitHub Actions workflow: `typecheck` + `lint` + `test` + `build` on PR.

---

## Invariants — do not regress

- The Odds API key never reaches the browser (no `VITE_`-prefixed secret, never echoed in responses; persisted `source_url` keeps `apiKey=REDACTED`).
- Only `h2h` markets are requested/accepted (`api/odds.ts` rejects others by design — quota control).
- Quota cost stays visible: forward the three `x-requests-*` headers and keep DebugPanel's display.
- URL shareability of sport/league/regions/players must keep working (including old v1 links after the share-format change).
- Region fetches remain user-selected only — never fetch all regions speculatively.
- Team-name normalization happens before any outcome/fixture comparison.
- `prefers-reduced-motion` handling on the rainbow border stays intact when CSS moves.
