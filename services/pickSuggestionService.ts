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

  firstWeekendMatches.forEach((match) => {
    const { homeWin, awayWin } = getOddsForBookmaker(match, 'average');

    if (isFinite(homeWin)) {
      potentialPicks.push({
        teamName: match.home_team,
        vsTeam: match.away_team,
        odds: homeWin,
        type: 'homeWin',
      });
    }

    if (isFinite(awayWin)) {
      potentialPicks.push({
        teamName: match.away_team,
        vsTeam: match.home_team,
        odds: awayWin,
        type: 'awayWin',
      });
    }
  });

  // Lower odds are favored for safer picks.
  potentialPicks.sort((a, b) => a.odds - b.odds);

  let bestAssignment: (PotentialPick | null)[] | null = null;
  let poolSize = players.length;

  while (!bestAssignment && poolSize <= potentialPicks.length) {
    const pickPool = potentialPicks.slice(0, poolSize);
    const assignment = new Array(players.length).fill(null);
    const usedPicks = new Array(pickPool.length).fill(false);

    function findAssignment(playerIndex: number): boolean {
      if (playerIndex === players.length) return true;

      const player = players[playerIndex];

      for (let i = 0; i < pickPool.length; i++) {
        if (usedPicks[i]) continue;

        const pick = pickPool[i];
        if (player.previousPicks.includes(pick.teamName) || player.previousPicks.includes(pick.vsTeam)) {
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
    } else {
      poolSize++;
    }
  }

  if (!bestAssignment) {
    addLog('Could not assign picks for all players with current constraints.', 'error');
    return {
      updatedPlayers: players.map((player) => ({ ...player, suggestion: null })),
      logs,
    };
  }

  addLog('Picks assigned successfully.', 'success');

  return {
    updatedPlayers: players.map((player, index) => ({
      ...player,
      suggestion: bestAssignment![index],
    })),
    logs,
  };
}
