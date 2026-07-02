const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

export async function apiFetch(path: string, init?: RequestInit, label = 'API'): Promise<Response> {
  const response = await fetch(resolveApiUrl(path), init);
  if (response.ok) return response;

  const details = await response.text();
  throw new Error(`${label} returned ${response.status}: ${response.statusText}${details ? ` - ${details}` : ''}`);
}
