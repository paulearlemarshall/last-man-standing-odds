import { describe, expect, it } from 'vitest';
import { average, buildConfidenceScore, round4, standardDeviation } from './analyticsMath';

describe('analytics math', () => {
  it('handles empty and populated averages', () => {
    expect(average([])).toBeNull();
    expect(average([1, 2, 3])).toBe(2);
  });

  it('uses sample standard deviation', () => {
    expect(standardDeviation([1, 2, 3])).toBe(1);
    expect(standardDeviation([1])).toBeNull();
  });

  it('rounds metrics and bounds confidence', () => {
    expect(round4(0.123456)).toBe(0.1235);
    expect(buildConfidenceScore({ sampleQuotes: 10_000, snapshotCount: 100, volatility: 0, timeSpanHours: 1000 })).toBe(
      1
    );
  });
});
