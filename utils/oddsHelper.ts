import type { MatchOdds } from '../types';

interface OddsResult {
  homeWin: number | null;
  draw: number | null;
  awayWin: number | null;
  bestOdds: number | null;
}

export const getOddsForBookmaker = (match: MatchOdds, bookmakerKey: string): OddsResult => {
  let bookmaker = match.bookmakers.find((b) => b.key === bookmakerKey);

  // Fallback to average if the selected bookmaker doesn't have odds for this match
  if (!bookmaker) {
    bookmaker = match.bookmakers.find((b) => b.key === 'average');
  }

  const h2hMarket = bookmaker?.markets.find((m) => m.key === 'h2h');

  const homeOutcome = h2hMarket?.outcomes.find((o) => o.name === match.home_team);
  const awayOutcome = h2hMarket?.outcomes.find((o) => o.name === match.away_team);
  const drawOutcome = h2hMarket?.outcomes.find((o) => o.name === 'Draw');

  const homeWin = homeOutcome?.price ?? null;
  const awayWin = awayOutcome?.price ?? null;
  const draw = drawOutcome?.price ?? null;

  const validOdds = [homeWin, draw, awayWin].filter((odd): odd is number => odd !== null);
  // Decimal odds: higher value means better payout.
  const bestOdds = validOdds.length > 0 ? Math.max(...validOdds) : null;

  return { homeWin, draw, awayWin, bestOdds };
};
