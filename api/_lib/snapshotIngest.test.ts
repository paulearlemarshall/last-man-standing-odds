import { describe, expect, it } from 'vitest';
import { parseSnapshotPayloadForMarketPoints } from './snapshotIngest';

describe('snapshot ingestion', () => {
  it('normalizes h2h quotes and removes bookmaker overround', () => {
    const points = parseSnapshotPayloadForMarketPoints([
      {
        id: 'match-1',
        commence_time: '2026-07-04T14:00:00Z',
        home_team: 'Alpha',
        away_team: 'Beta',
        bookmakers: [
          {
            key: 'book',
            title: 'Book',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Alpha', price: 2 },
                  { name: 'Beta', price: 4 },
                  { name: 'Draw', price: 4 },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(points).toHaveLength(3);
    expect(points.reduce((sum, point) => sum + point.implied_prob_novig, 0)).toBeCloseTo(1);
    expect(points.map((point) => point.outcome_side)).toEqual(['home', 'away', 'draw']);
  });

  it('ignores invalid payloads and unsupported markets', () => {
    expect(parseSnapshotPayloadForMarketPoints(null)).toEqual([]);
    expect(parseSnapshotPayloadForMarketPoints([{ id: 'bad' }])).toEqual([]);
  });
});
