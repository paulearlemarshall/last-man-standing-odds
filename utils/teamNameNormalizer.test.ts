import { describe, expect, it } from 'vitest';
import { normalizeTeamName } from './teamNameNormalizer';

describe('normalizeTeamName', () => {
  it.each([
    [' Man Utd ', 'Manchester United'],
    ['FC Brighton', 'Brighton & Hove Albion'],
    ['Wolves AFC', 'Wolverhampton Wanderers'],
    ['Arsenal FC', 'Arsenal'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeTeamName(input)).toBe(expected);
  });
});
