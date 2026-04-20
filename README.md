# Last Man Standing Odds Assistant

A React + Vite app to manage Last-Man-Standing style picks using live odds from The Odds API.

## What was refactored

- ✅ Removed hardcoded Odds API key from frontend code.
- ✅ Added secure server-side endpoint at `api/odds.ts` for Vercel.
- ✅ Split large app logic into focused modules:
  - `constants/sportsDirectory.ts`
  - `hooks/useOddsData.ts`
  - `services/oddsTransformService.ts`
  - `services/pickSuggestionService.ts`
  - `utils/shareState.ts`
- ✅ Fixed odds bugs:
  - `bestOdds` now uses highest decimal odds (`Math.max`).
  - Team/outcome matching now normalizes names more robustly.
  - Debug date sorting now uses stable timestamps.
- ✅ Replaced blocking `alert()` share UX with inline status message.

## Local development

```bash
npm install
npm run dev
```

> Note: The app fetches data from `/api/odds`. For local API function behavior, use `vercel dev`.

## Environment variables

Create environment vars (locally and on Vercel):

- `THE_ODDS_API_KEY` (required)
- `GEMINI_API_KEY` (optional, only if Gemini features are used)

Use `.env.example` as reference.

## Deploy to a new Vercel project

1. Push this repo/branch to GitHub.
2. In Vercel: **Add New Project** → import repo.
3. Framework preset: **Vite**.
4. Add env var:
   - `THE_ODDS_API_KEY=<your_key>`
5. Deploy.

Vercel will serve:
- frontend app from Vite build output
- serverless endpoint from `api/odds.ts`

## Security notes

- Do **not** expose API keys in client files.
- Keep all third-party API secrets in Vercel project environment variables.

## Maintenance

- 2026-04-20: Added a lightweight PR workflow smoke-test update to verify automated commit + PR tooling.
