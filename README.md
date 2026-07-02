# Last Man Standing Odds Assistant

A React 19 + Vite 8 application for managing Last-Man-Standing picks with live head-to-head odds from The Odds API. See [ARCHITECTURE.md](./ARCHITECTURE.md) for runtime boundaries and product invariants.

## Local development

```bash
npm install
npm run db:migrate
vercel dev
```

Plain `npm run dev` serves the frontend only. Use `vercel dev` when testing `/api` routes, snapshot persistence, or analytics.

## Environment

Create `.env.local` with:

- `THE_ODDS_API_KEY` — required for live sports and odds.
- `DATABASE_URL` — required for snapshot history and analytics.
- `CRON_SECRET` — required by the protected cleanup endpoint; Vercel supplies it to configured cron requests.

`ODDS_API_KEY` and `POSTGRES_URL` are supported fallbacks.

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
npm run format:check
npm run build
```

GitHub Actions runs the same checks on pushes to `main` and on pull requests.

## Deployment

Import the repository into Vercel with the Vite framework preset and configure the environment variables above. `vercel.json` defines the daily 30-day snapshot cleanup schedule. Run `npm run db:migrate` against the target database before the first production release.

## Security

- API and database secrets remain server-side and must never use a `VITE_` prefix.
- Only `h2h` markets and explicitly selected regions are accepted.
- Persisted upstream URLs redact the Odds API key.
- `/api/cleanup` requires `Authorization: Bearer <CRON_SECRET>`.
