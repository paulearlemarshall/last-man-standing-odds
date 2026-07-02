export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values);
  if (mean === null) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export const round4 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10_000) / 10_000;

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function buildConfidenceScore(input: {
  sampleQuotes: number;
  snapshotCount: number;
  volatility: number | null;
  timeSpanHours: number | null;
  overlapCoverage?: number;
}): number {
  const sampleComponent = clamp(input.sampleQuotes / 250, 0, 1) * 0.45;
  const snapshotComponent = clamp(input.snapshotCount / 12, 0, 1) * 0.25;
  const timeSpanComponent = clamp((input.timeSpanHours ?? 0) / 72, 0, 1) * 0.2;
  const overlapComponent = clamp(input.overlapCoverage ?? 1, 0, 1) * 0.1;
  const volatilityPenalty = input.volatility === null ? 0.05 : clamp(input.volatility / 0.25, 0, 1) * 0.15;
  return (
    Math.round(
      clamp(sampleComponent + snapshotComponent + timeSpanComponent + overlapComponent - volatilityPenalty, 0, 1) * 100
    ) / 100
  );
}
