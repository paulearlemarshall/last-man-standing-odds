import type { Player } from '../types';

export function decodePlayersFromUrl(encodedState: string, allTeams: string[]): Player[] {
  const indexToTeamName = new Map(allTeams.map((team, index) => [index, team]));

  return encodedState
    .split('|')
    .map((part) => {
      const [idStr, encodedName, picksStr] = part.split(';');
      const id = Number.parseInt(idStr, 10);

      if (!Number.isFinite(id)) return null;

      const previousPicks = (picksStr || '')
        .split(',')
        .filter(Boolean)
        .map((indexString) => Number.parseInt(indexString, 10))
        .map((index) => indexToTeamName.get(index))
        .filter((team): team is string => Boolean(team));

      return {
        id,
        name: decodeURIComponent(encodedName || `Player ${id}`),
        previousPicks,
        suggestion: null,
      };
    })
    .filter((player): player is Player => Boolean(player));
}

export function encodePlayersForUrl(players: Player[], teamNameToIndex: Map<string, number>): string {
  return players
    .map((player) => {
      const encodedName = encodeURIComponent(player.name);
      const picks = player.previousPicks
        .map((team) => teamNameToIndex.get(team))
        .filter((index): index is number => index !== undefined)
        .join(',');

      return `${player.id};${encodedName};${picks}`;
    })
    .join('|');
}
