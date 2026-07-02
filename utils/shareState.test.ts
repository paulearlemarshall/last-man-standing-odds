import { describe, expect, it } from 'vitest';
import type { Player } from '../types';
import { decodePlayersFromUrl, encodePlayersForUrl } from './shareState';

const players: Player[] = [
  {
    id: 1,
    name: 'Paul & Co',
    previousPicks: ['Manchester United', 'Brighton & Hove Albion'],
    suggestion: null,
  },
];

describe('share state', () => {
  it('round-trips v2 links without depending on the current team list', () => {
    const encoded = encodePlayersForUrl(players);
    expect(decodePlayersFromUrl(encoded, [])).toEqual(players);
  });

  it('continues to decode legacy index-based links', () => {
    expect(decodePlayersFromUrl('1;Paul;0,2', ['Alpha', 'Beta', 'Gamma'])[0].previousPicks).toEqual(['Alpha', 'Gamma']);
  });

  it('drops duplicate and malformed player ids', () => {
    const decoded = decodePlayersFromUrl('v2:1;One;Alpha|1;Duplicate;Beta|nope;Invalid;Gamma', []);
    expect(decoded.map((player) => player.name)).toEqual(['One']);
  });
});
