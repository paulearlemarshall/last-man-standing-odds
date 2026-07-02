import type { Player } from '../types';

const V2_PREFIX = 'v2:';

function uniquePlayers(players: Array<Player | null>): Player[] {
  const seenIds = new Set<number>();
  return players.filter((player): player is Player => {
    if (!player || seenIds.has(player.id)) return false;
    seenIds.add(player.id);
    return true;
  });
}

function decodePlayer(part: string, decodePicks: (value: string) => string[]): Player | null {
  const [idStr, encodedName, picksStr] = part.split(';');
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id)) return null;

  try {
    return {
      id,
      name: decodeURIComponent(encodedName || `Player ${id}`),
      previousPicks: decodePicks(picksStr || ''),
      suggestion: null,
    };
  } catch {
    return null;
  }
}

export function decodePlayersFromUrl(encodedState: string, allTeams: string[]): Player[] {
  if (encodedState.startsWith(V2_PREFIX)) {
    return uniquePlayers(
      encodedState
        .slice(V2_PREFIX.length)
        .split('|')
        .map((part) =>
          decodePlayer(part, (picks) =>
            picks
              .split(',')
              .filter(Boolean)
              .map((pick) => decodeURIComponent(pick))
          )
        )
    );
  }

  const indexToTeamName = new Map(allTeams.map((team, index) => [index, team]));

  return uniquePlayers(
    encodedState.split('|').map((part) =>
      decodePlayer(part, (picks) =>
        picks
          .split(',')
          .filter(Boolean)
          .map((indexString) => Number.parseInt(indexString, 10))
          .map((index) => indexToTeamName.get(index))
          .filter((team): team is string => Boolean(team))
      )
    )
  );
}

export function encodePlayersForUrl(players: Player[]): string {
  return `${V2_PREFIX}${players
    .map((player) => {
      const encodedName = encodeURIComponent(player.name);
      const picks = player.previousPicks.map((team) => encodeURIComponent(team)).join(',');

      return `${player.id};${encodedName};${picks}`;
    })
    .join('|')}`;
}
