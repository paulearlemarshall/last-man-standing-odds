import { SPORTS_DIRECTORY, type LeagueDefinition } from '../constants/sportsDirectory';

interface ApiSport {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
}

export type SportsDirectory = Record<string, LeagueDefinition[]>;

const DYNAMIC_LOGOS_BY_KEY: Record<string, string> = {
  soccer_fifa_world_cup:
    'https://upload.wikimedia.org/wikipedia/en/thumb/1/17/2026_FIFA_World_Cup_emblem.svg/960px-2026_FIFA_World_Cup_emblem.svg.png',
};

const fallbackLogoByKey = new Map(
  [
    ...Object.values(SPORTS_DIRECTORY)
      .flat()
      .map((league) => [league.key, league.logo] as const),
    ...Object.entries(DYNAMIC_LOGOS_BY_KEY),
  ]
);

function toSportsDirectory(apiSports: ApiSport[]): SportsDirectory {
  return apiSports
    .filter((sport) => sport.active && !sport.has_outrights)
    .sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title))
    .reduce<SportsDirectory>((directory, sport) => {
      const group = sport.group || 'Other';
      const leagues = directory[group] || [];
      leagues.push({
        key: sport.key,
        name: sport.title,
        logo: fallbackLogoByKey.get(sport.key) || '',
      });
      directory[group] = leagues;
      return directory;
    }, {});
}

export async function fetchSportsDirectory(signal?: AbortSignal): Promise<SportsDirectory> {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  const apiPath = '/api/sports';
  const requestUrl = apiBaseUrl ? `${apiBaseUrl}${apiPath}` : apiPath;
  const response = await fetch(requestUrl, { signal });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Sports API returned ${response.status}: ${response.statusText}${details ? ` - ${details}` : ''}`);
  }

  const sports = (await response.json()) as ApiSport[];
  const directory = toSportsDirectory(sports);

  return Object.keys(directory).length ? directory : SPORTS_DIRECTORY;
}
