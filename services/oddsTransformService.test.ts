import { describe, expect, it } from 'vitest';
import type { ApiMatch } from '../types';
import { processApiData } from './oddsTransformService';

function apiMatch(
  id: string,
  home: string,
  away: string,
  commenceTime: string,
  homePrice = 2,
  awayPrice = 3
): ApiMatch {
  return {
    id,
    sport_key: 'soccer_epl',
    sport_title: 'Premier League',
    commence_time: commenceTime,
    home_team: home,
    away_team: away,
    bookmakers: [
      {
        key: 'book-a',
        title: 'Book A',
        last_update: commenceTime,
        markets: [
          {
            key: 'h2h',
            last_update: commenceTime,
            outcomes: [
              { name: home, price: homePrice },
              { name: away, price: awayPrice },
              { name: 'Tie', price: 3.4 },
            ],
          },
        ],
      },
    ],
  };
}

describe('processApiData', () => {
  it('normalizes outcome names and computes average prices', () => {
    const result = processApiData([apiMatch('1', 'Man Utd', 'Brighton', '2026-07-04T14:00:00Z', 1.8, 4.2)]);
    const processed = result.weekends[0].matches[0];
    const average = processed.bookmakers.find((bookmaker) => bookmaker.key === 'average');

    expect(processed.home_team).toBe('Manchester United');
    expect(processed.away_team).toBe('Brighton & Hove Albion');
    expect(average?.markets[0].outcomes).toEqual([
      { name: 'Manchester United', price: 1.8 },
      { name: 'Brighton & Hove Albion', price: 4.2 },
      { name: 'Draw', price: 3.4 },
    ]);
  });

  it('starts a new gameweek when a team appears again', () => {
    const result = processApiData([
      apiMatch('1', 'Alpha', 'Beta', '2026-07-04T14:00:00Z'),
      apiMatch('2', 'Gamma', 'Delta', '2026-07-04T16:00:00Z'),
      apiMatch('3', 'Alpha', 'Gamma', '2026-07-11T14:00:00Z'),
    ]);

    expect(result.weekends.map((item) => item.matches.map((match) => match.id))).toEqual([['1', '2'], ['3']]);
  });
});
