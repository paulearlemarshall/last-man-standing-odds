import { describe, expect, it } from 'vitest';
import type { MatchOdds, MatchWeekend, Player } from '../types';
import { suggestPicks } from './pickSuggestionService';

function match(id: string, home: string, away: string, homeOdds: number, awayOdds: number): MatchOdds {
  return {
    id,
    commence_time: '2026-07-04T14:00:00Z',
    home_team: home,
    away_team: away,
    bookmakers: [
      {
        key: 'average',
        title: 'Average',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: home, price: homeOdds },
              { name: away, price: awayOdds },
              { name: 'Draw', price: 3.5 },
            ],
          },
        ],
      },
    ],
  };
}

function player(id: number, previousPicks: string[] = []): Player {
  return { id, name: `Player ${id}`, previousPicks, suggestion: null };
}

const weekend = (matches: MatchOdds[]): MatchWeekend[] => [
  { id: 'week-1', title: 'Gameweek 1', dateRange: 'Jul 4', matches },
];

describe('suggestPicks', () => {
  it('assigns unique picks while favoring lower odds', () => {
    const result = suggestPicks(
      [player(1), player(2)],
      weekend([match('1', 'Alpha', 'Beta', 1.4, 4), match('2', 'Gamma', 'Delta', 1.8, 3)])
    );

    expect(result.updatedPlayers.map((item) => item.suggestion?.teamName)).toEqual(['Alpha', 'Gamma']);
  });

  it('excludes both previous teams and their current opponents', () => {
    const result = suggestPicks(
      [player(1, ['Alpha'])],
      weekend([match('1', 'Alpha', 'Beta', 1.4, 4), match('2', 'Gamma', 'Delta', 1.8, 3)])
    );

    expect(result.updatedPlayers[0].suggestion?.teamName).toBe('Gamma');
  });

  it('returns no suggestions when constraints are unsatisfiable', () => {
    const result = suggestPicks([player(1, ['Alpha', 'Beta'])], weekend([match('1', 'Alpha', 'Beta', 1.4, 4)]));

    expect(result.updatedPlayers[0].suggestion).toBeNull();
    expect(result.logs.some((entry) => entry.type === 'error')).toBe(true);
  });
});
