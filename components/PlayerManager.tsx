/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import type { Player } from '../types';
import PlayerCard from './PlayerCard';
import CollapsibleSection from './CollapsibleSection';

interface PlayerManagerProps {
    players: Player[];
    playerCount: number;
    allTeams: string[];
    onPlayerCountChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    onNameChange: (id: number, newName: string) => void;
    onAddPick: (id: number, team: string) => void;
    onRemovePick: (id: number, team: string) => void;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({
    players,
    playerCount,
    allTeams,
    onPlayerCountChange,
    onNameChange,
    onAddPick,
    onRemovePick,
}) => {
    return (
        <CollapsibleSection title="Setup Your Picks">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <p className="text-gray-300">Manage player names and previously picked teams.</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <label htmlFor="player-count" className="font-medium text-gray-300">Players:</label>
                    <select
                        id="player-count"
                        value={playerCount}
                        onChange={onPlayerCountChange}
                        className="bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                    >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {players.map(player => (
                    <PlayerCard 
                        key={player.id} 
                        player={player}
                        allTeams={allTeams}
                        onNameChange={onNameChange}
                        onAddPick={onAddPick}
                        onRemovePick={onRemovePick}
                    />
                 ))}
            </div>
        </CollapsibleSection>
    );
};

export default PlayerManager;