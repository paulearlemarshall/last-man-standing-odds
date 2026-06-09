import type { DecisionLogEntry, MatchWeekend, Player, PotentialPick } from '../types';
import { getOddsForBookmaker } from '../utils/oddsHelper';

interface SuggestionResult {
  updatedPlayers: Player[];
  logs: DecisionLogEntry[];
}

export function suggestPicks(players: Player[], matchWeekends: MatchWeekend[]): SuggestionResult {
  if (!matchWeekends.length) {
    return {
      updatedPlayers: players,
      logs: [],
    };
  }

  const logs: DecisionLogEntry[] = [];
  let logIdCounter = 0;
  const addLog = (message: string, type: DecisionLogEntry['type'], details?: string) => {
    logs.push({
      id: logIdCounter++,
      timestamp: Date.now(),
      message,
      type,
      details,
    });
  };

  addLog('Starting pick suggestion algorithm...', 'process');

  const firstWeekendMatches = matchWeekends[0].matches;
  const potentialPicks: PotentialPick[] = [];
  addLog(
    `Scanning ${firstWeekendMatches.length} matches from ${matchWeekends[0].title}.`,
    'process',
    matchWeekends[0].dateRange
  );

  firstWeekendMatches.forEach((match) => {
    const { homeWin, awayWin } = getOddsForBookmaker(match, 'average');
    const addedTeams: string[] = [];

    if (isFinite(homeWin)) {
      potentialPicks.push({
        teamName: match.home_team,
        vsTeam: match.away_team,
        odds: homeWin,
        type: 'homeWin',
      });
      addedTeams.push(`${match.home_team} ${homeWin.toFixed(2)}`);
    }

    if (isFinite(awayWin)) {
      potentialPicks.push({
        teamName: match.away_team,
        vsTeam: match.home_team,
        odds: awayWin,
        type: 'awayWin',
      });
      addedTeams.push(`${match.away_team} ${awayWin.toFixed(2)}`);
    }

    addLog(
      `${match.home_team} vs ${match.away_team}`,
      addedTeams.length ? 'info' : 'warning',
      addedTeams.length ? `Candidate picks: ${addedTeams.join(', ')}` : 'No finite average win odds available.'
    );
  });

  // Lower odds are favored for safer picks.
  potentialPicks.sort((a, b) => a.odds - b.odds);
  addLog(
    `Built ${potentialPicks.length} candidate picks sorted by safest average odds.`,
    potentialPicks.length >= players.length ? 'process' : 'warning',
    potentialPicks
      .slice(0, Math.max(players.length, 5))
      .map((pick, index) => `${index + 1}. ${pick.teamName} (${pick.odds.toFixed(2)}) vs ${pick.vsTeam}`)
      .join('\n')
  );

  let bestAssignment: (PotentialPick | null)[] | null = null;
  let poolSize = players.length;

  while (!bestAssignment && poolSize <= potentialPicks.length) {
    const pickPool = potentialPicks.slice(0, poolSize);
    const assignment = new Array(players.length).fill(null);
    const usedPicks = new Array(pickPool.length).fill(false);
    const skipCounts = {
      alreadyUsed: 0,
      previousTeam: 0,
      previousOpponent: 0,
    };

    addLog(
      `Trying assignment with top ${poolSize} candidates.`,
      'process',
      pickPool.map((pick) => `${pick.teamName} ${pick.odds.toFixed(2)}`).join(', ')
    );

    function findAssignment(playerIndex: number): boolean {
      if (playerIndex === players.length) return true;

      const player = players[playerIndex];

      for (let i = 0; i < pickPool.length; i++) {
        if (usedPicks[i]) {
          skipCounts.alreadyUsed++;
          continue;
        }

        const pick = pickPool[i];
        if (player.previousPicks.includes(pick.teamName)) {
          skipCounts.previousTeam++;
          continue;
        }

        if (player.previousPicks.includes(pick.vsTeam)) {
          skipCounts.previousOpponent++;
          continue;
        }

        assignment[playerIndex] = pick;
        usedPicks[i] = true;

        if (findAssignment(playerIndex + 1)) {
          return true;
        }

        usedPicks[i] = false;
        assignment[playerIndex] = null;
      }

      return false;
    }

    if (findAssignment(0)) {
      bestAssignment = assignment;
      addLog(
        `Assignment found using top ${poolSize} candidates.`,
        'success',
        assignment
          .map((pick, index) =>
            pick
              ? `${players[index].name}: ${pick.teamName} (${pick.odds.toFixed(2)}) vs ${pick.vsTeam}`
              : `${players[index].name}: no pick`
          )
          .join('\n')
      );
    } else {
      addLog(
        `No valid assignment with top ${poolSize} candidates.`,
        'warning',
        `Skipped used candidates: ${skipCounts.alreadyUsed}; previous pick conflicts: ${skipCounts.previousTeam}; opponent conflicts: ${skipCounts.previousOpponent}.`
      );
      poolSize++;
    }
  }

  if (!bestAssignment) {
    addLog(
      'Could not assign picks for all players with current constraints.',
      'error',
      `${players.length} players, ${potentialPicks.length} candidate picks. Try adding more fixtures/regions or clearing restrictive previous picks.`
    );
    return {
      updatedPlayers: players.map((player) => ({ ...player, suggestion: null })),
      logs,
    };
  }

  addLog('Picks assigned successfully.', 'success', `${bestAssignment.filter(Boolean).length} players assigned.`);

  return {
    updatedPlayers: players.map((player, index) => ({
      ...player,
      suggestion: bestAssignment![index],
    })),
    logs,
  };
}
