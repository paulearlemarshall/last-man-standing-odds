import type { ApiMatch, ArbitrageOpportunity } from '../types';
import { normalizeTeamName } from '../utils/teamNameNormalizer';

const isDrawOutcome = (name: string) => {
  const normalized = name.trim().toLowerCase();
  return normalized === 'draw' || normalized === 'tie';
};

export function findArbitrageOpportunities(matches: ApiMatch[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  matches.forEach((match) => {
    const homeTeam = normalizeTeamName(match.home_team);
    const awayTeam = normalizeTeamName(match.away_team);
    const bestOdds = {
      home: { price: 0, bookmaker: '' },
      away: { price: 0, bookmaker: '' },
      draw: { price: 0, bookmaker: '' },
    };

    match.bookmakers.forEach((bookmaker) => {
      const h2h = bookmaker.markets.find((market) => market.key === 'h2h');
      if (!h2h) return;

      h2h.outcomes.forEach((outcome) => {
        const normalizedName = normalizeTeamName(outcome.name);
        if (normalizedName === homeTeam && outcome.price > bestOdds.home.price) {
          bestOdds.home = { price: outcome.price, bookmaker: bookmaker.title };
        } else if (normalizedName === awayTeam && outcome.price > bestOdds.away.price) {
          bestOdds.away = { price: outcome.price, bookmaker: bookmaker.title };
        } else if (isDrawOutcome(outcome.name) && outcome.price > bestOdds.draw.price) {
          bestOdds.draw = { price: outcome.price, bookmaker: bookmaker.title };
        }
      });
    });

    const { home, away, draw } = bestOdds;
    if (home.price <= 0 || away.price <= 0 || draw.price <= 0) return;

    const impliedProbabilitySum = 1 / home.price + 1 / away.price + 1 / draw.price;
    if (impliedProbabilitySum >= 1) return;

    const getStake = (price: number) => 1 / price / impliedProbabilitySum;
    opportunities.push({
      matchId: match.id,
      matchTitle: `${homeTeam} vs ${awayTeam}`,
      commenceTime: match.commence_time,
      profitPercentage: (1 / impliedProbabilitySum - 1) * 100,
      outcomes: [
        { name: homeTeam, price: home.price, bookmaker: home.bookmaker, stakePercentage: getStake(home.price) },
        { name: awayTeam, price: away.price, bookmaker: away.bookmaker, stakePercentage: getStake(away.price) },
        { name: 'Draw', price: draw.price, bookmaker: draw.bookmaker, stakePercentage: getStake(draw.price) },
      ],
    });
  });

  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}
