/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import type { Player } from '../types';

interface PlayerCardProps {
    player: Player;
    allTeams: string[];
    onNameChange: (id: number, newName: string) => void;
    onAddPick: (id: number, team: string) => void;
    onRemovePick: (id: number, team: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, allTeams, onNameChange, onAddPick, onRemovePick }) => {
    
    const availableTeams = allTeams.filter(team => !player.previousPicks.includes(team));

    const handleTeamSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedTeam = e.target.value;
        if (selectedTeam) {
            onAddPick(player.id, selectedTeam);
            e.target.value = ""; // Reset dropdown after selection
        }
    };

    const getSuggestionColor = (suggestionType: 'homeWin' | 'awayWin') => {
        const colorMap = {
            homeWin: 'text-blue-400',
            awayWin: 'text-purple-400',
        };
        return colorMap[suggestionType] || 'text-green-400';
    };
    
    return (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-600 hover:border-green-500 transition-colors duration-300 flex flex-col gap-4">
            <input
                type="text"
                value={player.name}
                onChange={(e) => onNameChange(player.id, e.target.value)}
                className="w-full bg-gray-900 border-2 border-gray-500 rounded-md py-2 px-3 text-white font-semibold text-lg focus:ring-2 focus:ring-green-500 focus:outline-none focus:border-green-500"
                aria-label={`Player ${player.id} name`}
            />

            <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Suggested Pick</h3>
                <div className="bg-gray-900/50 p-3 rounded-md min-h-[7.5rem] border border-gray-600 flex items-center justify-center">
                    {player.suggestion ? (
                        <div className="text-center w-full">
                            <div className="font-semibold text-white">
                                Pick: <span className={getSuggestionColor(player.suggestion.type)}>{player.suggestion.teamName}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                vs {player.suggestion.vsTeam}
                            </div>
                            {player.suggestion.reasoning && (
                                <p className="text-xs text-gray-500 italic mt-2">"{player.suggestion.reasoning}"</p>
                            )}
                            <div className="mt-2 text-sm">
                                <span className="text-gray-300">Odds:</span>{' '}
                                <span className={`font-bold ${getSuggestionColor(player.suggestion.type)}`}>{isFinite(player.suggestion.odds) ? player.suggestion.odds.toFixed(2) : 'N/A'}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">No suggestion yet.</p>
                    )}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Previous Picks</h3>
                <div className="bg-gray-900/50 p-2 rounded-md min-h-[2.75rem] border border-gray-600">
                    {player.previousPicks.length > 0 ? (
                        <ul className="flex flex-wrap gap-2">
                            {player.previousPicks.map(team => (
                                <li 
                                    key={team} 
                                    className="flex items-center bg-green-500/20 text-green-300 text-sm font-medium py-1 pl-3 pr-2 rounded-full"
                                >
                                    <span>{team}</span>
                                    <button 
                                        onClick={() => onRemovePick(player.id, team)}
                                        className="ml-2 text-red-400 hover:text-red-200 transition-colors"
                                        aria-label={`Remove ${team}`}
                                    >
                                        &times;
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 text-sm text-center py-2">No teams picked yet.</p>
                    )}
                </div>
            </div>

            <div>
                <label htmlFor={`team-select-${player.id}`} className="sr-only">Add a team</label>
                <select
                    id={`team-select-${player.id}`}
                    onChange={handleTeamSelect}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    defaultValue=""
                >
                    <option value="" disabled>Add a team...</option>
                    {availableTeams.map(team => (
                        <option key={team} value={team}>{team}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default PlayerCard;