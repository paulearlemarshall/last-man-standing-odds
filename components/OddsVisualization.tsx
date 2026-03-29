/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import type { MatchOdds } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { getOddsForBookmaker } from '../utils/oddsHelper';

interface BarDisplayProps {
    teamName: string;
    winProbability: number;
    color: 'green' | 'red';
}

const BarDisplay: React.FC<BarDisplayProps> = ({ teamName, winProbability, color }) => {
    const barWidth = Math.min(winProbability * 100, 100);
    const barColorClass = color === 'green' ? 'bg-green-500' : 'bg-red-500';
    const textColorClass = color === 'green' ? 'text-green-300' : 'text-red-300';

    return (
        <div className="flex items-center gap-4 text-sm">
            <div className="w-1/3 sm:w-1/4 font-medium text-gray-300 truncate text-right">
                {teamName}
            </div>
            <div className="w-2/3 sm:w-3/4 flex items-center gap-2">
                <div className="w-full bg-gray-700 rounded-full h-5 overflow-hidden">
                    <div
                        className={`${barColorClass} h-5 rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${barWidth}%` }}
                        role="progressbar"
                        aria-valuenow={Math.round(winProbability * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${teamName} win probability`}
                    ></div>
                </div>
                <div className={`w-16 text-left font-semibold ${textColorClass}`}>
                    {(winProbability * 100).toFixed(1)}%
                </div>
            </div>
        </div>
    );
};


interface OddsVisualizationProps {
    matches: MatchOdds[];
    selectedBookmaker: string;
}

const OddsVisualization: React.FC<OddsVisualizationProps> = ({ matches, selectedBookmaker }) => {
    if (!matches || matches.length === 0) {
        return null;
    }

    const matchPairs = matches.map(match => {
        const { homeWin: homePrice, awayWin: awayPrice } = getOddsForBookmaker(match, selectedBookmaker);

        const homeProb = isFinite(homePrice) && homePrice > 0 ? 1 / homePrice : 0;
        const awayProb = isFinite(awayPrice) && awayPrice > 0 ? 1 / awayPrice : 0;

        const homeTeam = { teamName: match.home_team, winProbability: homeProb };
        const awayTeam = { teamName: match.away_team, winProbability: awayProb };
        
        if (homeProb >= awayProb) {
            return { favorite: homeTeam, underdog: awayTeam };
        } else {
            return { favorite: awayTeam, underdog: homeTeam };
        }
    }).sort((a, b) => b.favorite.winProbability - a.favorite.winProbability);
    

    return (
        <CollapsibleSection title="Match Win Probabilities" defaultOpen={false}>
            <div className="space-y-4">
                {matchPairs.map((pair, index) => (
                    <div key={`${pair.favorite.teamName}-${index}`} className="space-y-1.5 border-b border-gray-700/50 last:border-b-0 pb-4 last:pb-0">
                        <BarDisplay 
                            teamName={pair.favorite.teamName} 
                            winProbability={pair.favorite.winProbability} 
                            color="green" 
                        />
                        <BarDisplay 
                            teamName={pair.underdog.teamName} 
                            winProbability={pair.underdog.winProbability} 
                            color="red" 
                        />
                    </div>
                ))}
            </div>
        </CollapsibleSection>
    );
};

export default OddsVisualization;