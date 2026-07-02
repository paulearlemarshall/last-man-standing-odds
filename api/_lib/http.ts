import type { ServerResponse } from 'http';

export function normalizeQueryValue(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export async function timed<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    console.log(`[timing] ${label}: ${(performance.now() - start).toFixed(0)}ms`);
  }
}
