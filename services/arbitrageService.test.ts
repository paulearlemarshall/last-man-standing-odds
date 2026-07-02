import { describe, expect, it } from 'vitest';
import type { ApiMatch } from '../types';
import { findArbitrageOpportunities } from './arbitrageService';

function match(prices: [number, number, number]): ApiMatch {
  return {
    id: 'match-1',
    sport_key: 'soccer_epl',
    sport_title: 'Premier League',
    commence_time: '2026-07-04T14:00:00Z',
    home_team: 'Man Utd',
    away_team: 'Brighton',
    bookmakers: [
      {
        key: 'book-a',
        title: 'Book A',
        last_update: '2026-07-01T14:00:00Z',
        markets: [
          {
            key: 'h2h',
            last_update: '2026-07-01T14:00:00Z',
            outcomes: [
              { name: 'Manchester United', price: prices[0] },
              { name: 'Brighton & Hove Albion', price: prices[1] },
              { name: 'Tie', price: prices[2] },
            ],
          },
        ],
      },
    ],
  };
}

describe('findArbitrageOpportunities', () => {
  it('returns normalized opportunities whose stakes sum to the whole stake', () => {
    const [opportunity] = findArbitrageOpportunities([match([4, 4, 4])]);
    expect(opportunity.matchTitle).toBe('Manchester United vs Brighton & Hove Albion');
    expect(opportunity.profitPercentage).toBeCloseTo(33.3333, 3);
    expect(opportunity.outcomes.reduce((total, outcome) => total + outcome.stakePercentage, 0)).toBeCloseTo(1);
  });

  it('returns nothing when the implied probability is not below one', () => {
    expect(findArbitrageOpportunities([match([2, 3, 3])])).toEqual([]);
  });
});
