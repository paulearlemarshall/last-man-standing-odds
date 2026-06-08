import type { IncomingMessage, ServerResponse } from 'http';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Server is missing THE_ODDS_API_KEY' });
  }

  const upstreamParams = new URLSearchParams({ apiKey });
  const upstreamUrl = `https://api.the-odds-api.com/v4/sports/?${upstreamParams.toString()}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: 'Upstream sports API error',
        status: response.status,
        details: responseText,
      });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(responseText);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return sendJson(res, 500, {
      error: 'Failed to fetch sports',
      details: message,
    });
  }
}
