import type { ApiMatch, MatchOdds, MatchWeekend } from '../types';
import { normalizeTeamName } from '../utils/teamNameNormalizer';

const DRAW_LABELS = new Set(['draw', 'tie']);

function findOutcomePrice(outcomes: { name: string; price: number }[], targetTeamName: string): number | null {
  const normalizedTarget = normalizeTeamName(targetTeamName);
  const found = outcomes.find((outcome) => normalizeTeamName(outcome.name) === normalizedTarget);
  return found ? found.price : null;
}

function findDrawPrice(outcomes: { name: string; price: number }[]): number | null {
  const found = outcomes.find((outcome) => DRAW_LABELS.has(outcome.name.trim().toLowerCase()));
  return found ? found.price : null;
}

function createWeekend(matches: MatchOdds[], weekNumber: number): MatchWeekend {
  const firstMatchDate = new Date(matches[0].commence_time);
  const lastMatchDate = new Date(matches[matches.length - 1].commence_time);
  const format = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const dateRange =
    matches.length > 1 && firstMatchDate.toDateString() !== lastMatchDate.toDateString()
      ? `${format(firstMatchDate)} - ${format(lastMatchDate)}`
      : format(firstMatchDate);

  return {
    id: matches[0].id,
    title: `Gameweek ${weekNumber}`,
    dateRange,
    matches,
  };
}

export function processApiData(apiData: ApiMatch[]): { weekends: MatchWeekend[]; bookmakers: string[]; allTeams: string[] } {
  const bookmakerSet = new Set<string>(['average']);
  const teamSet = new Set<string>();

  const enrichedMatches: MatchOdds[] = apiData.map((match) => {
    const homeTeam = normalizeTeamName(match.home_team);
    const awayTeam = normalizeTeamName(match.away_team);
    teamSet.add(homeTeam);
    teamSet.add(awayTeam);

    let homeTotal = 0;
    let awayTotal = 0;
    let drawTotal = 0;
    let homeCount = 0;
    let awayCount = 0;
    let drawCount = 0;

    const normalizedBookmakers = match.bookmakers.map((bookie) => {
      bookmakerSet.add(bookie.key);
      const normalizedMarkets = bookie.markets.map((market) => {
        if (market.key !== 'h2h') {
          return market;
        }

        const normalizedOutcomes = market.outcomes.map((outcome) => {
          if (DRAW_LABELS.has(outcome.name.trim().toLowerCase())) {
            return { ...outcome, name: 'Draw' };
          }

          return { ...outcome, name: normalizeTeamName(outcome.name) };
        });

        const homePrice = findOutcomePrice(normalizedOutcomes, homeTeam);
        const awayPrice = findOutcomePrice(normalizedOutcomes, awayTeam);
        const drawPrice = findDrawPrice(normalizedOutcomes);

        if (homePrice !== null) {
          homeTotal += homePrice;
          homeCount++;
        }

        if (awayPrice !== null) {
          awayTotal += awayPrice;
          awayCount++;
        }

        if (drawPrice !== null) {
          drawTotal += drawPrice;
          drawCount++;
        }

        return { ...market, outcomes: normalizedOutcomes };
      });

      return { ...bookie, markets: normalizedMarkets };
    });

    const averageBookmaker = {
      key: 'average',
      title: 'Average',
      markets: [
        {
          key: 'h2h' as const,
          outcomes: [
            { name: homeTeam, price: homeCount > 0 ? homeTotal / homeCount : Infinity },
            { name: awayTeam, price: awayCount > 0 ? awayTotal / awayCount : Infinity },
            { name: 'Draw', price: drawCount > 0 ? drawTotal / drawCount : Infinity },
          ],
        },
      ],
    };

    return {
      ...match,
      home_team: homeTeam,
      away_team: awayTeam,
      bookmakers: [...normalizedBookmakers, averageBookmaker],
    };
  });

  const sortedMatches = enrichedMatches.sort(
    (a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
  );

  if (sortedMatches.length === 0) {
    return {
      weekends: [],
      bookmakers: Array.from(bookmakerSet).sort(),
      allTeams: Array.from(teamSet).sort(),
    };
  }

  const weekends: MatchWeekend[] = [];
  let currentWeek: MatchOdds[] = [];
  let seenTeams = new Set<string>();

  for (const match of sortedMatches) {
    if (seenTeams.has(match.home_team) || seenTeams.has(match.away_team)) {
      if (currentWeek.length > 0) {
        weekends.push(createWeekend(currentWeek, weekends.length + 1));
      }
      currentWeek = [];
      seenTeams = new Set<string>();
    }

    currentWeek.push(match);
    seenTeams.add(match.home_team);
    seenTeams.add(match.away_team);
  }

  if (currentWeek.length > 0) {
    weekends.push(createWeekend(currentWeek, weekends.length + 1));
  }

  return {
    weekends,
    bookmakers: Array.from(bookmakerSet).sort(),
    allTeams: Array.from(teamSet).sort(),
  };
}
