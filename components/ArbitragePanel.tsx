/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import type { ApiMatch, ArbitrageOpportunity } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { normalizeTeamName } from '../utils/teamNameNormalizer';

interface ArbitragePanelProps {
    data: ApiMatch[] | null;
}

const isDrawOutcome = (name: string) => {
    const normalized = name.trim().toLowerCase();
    return normalized === 'draw' || normalized === 'tie';
};

const findArbitrageOpportunities = (matches: ApiMatch[]): ArbitrageOpportunity[] => {
    const opportunities: ArbitrageOpportunity[] = [];
    if (!matches) return opportunities;

    matches.forEach(match => {
        const homeTeam = normalizeTeamName(match.home_team);
        const awayTeam = normalizeTeamName(match.away_team);

        const bestOdds = {
            home: { price: 0, bookmaker: '' },
            away: { price: 0, bookmaker: '' },
            draw: { price: 0, bookmaker: '' }
        };

        match.bookmakers.forEach(bookmaker => {
            const h2h = bookmaker.markets.find(m => m.key === 'h2h');
            if (h2h) {
                h2h.outcomes.forEach(outcome => {
                    const normalizedName = normalizeTeamName(outcome.name);
                    if (normalizedName === homeTeam && outcome.price > bestOdds.home.price) {
                        bestOdds.home = { price: outcome.price, bookmaker: bookmaker.title };
                    } else if (normalizedName === awayTeam && outcome.price > bestOdds.away.price) {
                        bestOdds.away = { price: outcome.price, bookmaker: bookmaker.title };
                    } else if (isDrawOutcome(outcome.name) && outcome.price > bestOdds.draw.price) {
                        bestOdds.draw = { price: outcome.price, bookmaker: bookmaker.title };
                    }
                });
            }
        });
        
        const { home, away, draw } = bestOdds;

        if (home.price > 0 && away.price > 0 && draw.price > 0) {
            const impliedProbabilitySum = (1 / home.price) + (1 / away.price) + (1 / draw.price);

            if (impliedProbabilitySum < 1) {
                const profitPercentage = ((1 / impliedProbabilitySum) - 1) * 100;
                
                const getStake = (price: number) => (1 / price) / impliedProbabilitySum;

                opportunities.push({
                    matchId: match.id,
                    matchTitle: `${homeTeam} vs ${awayTeam}`,
                    commenceTime: match.commence_time,
                    profitPercentage: profitPercentage,
                    outcomes: [
                        { name: homeTeam, price: home.price, bookmaker: home.bookmaker, stakePercentage: getStake(home.price) },
                        { name: awayTeam, price: away.price, bookmaker: away.bookmaker, stakePercentage: getStake(away.price) },
                        { name: 'Draw', price: draw.price, bookmaker: draw.bookmaker, stakePercentage: getStake(draw.price) },
                    ],
                });
            }
        }
    });

    return opportunities.sort((a,b) => b.profitPercentage - a.profitPercentage);
};


const ArbitragePanel: React.FC<ArbitragePanelProps> = ({ data }) => {
    const opportunities = findArbitrageOpportunities(data || []);

    return (
        <CollapsibleSection title="Arbitrage Opportunities" defaultOpen={false}>
            {opportunities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No arbitrage opportunities found in the current odds.</p>
            ) : (
                <div className="space-y-6">
                    <p className="text-gray-400">
                        Found {opportunities.length} potential arbitrage opportunit{opportunities.length > 1 ? 'ies' : 'y'}.
                        This occurs when odds from different bookmakers are misaligned, allowing for a guaranteed profit by betting on all outcomes.
                    </p>
                    {opportunities.map(opp => (
                        <div key={opp.matchId} className="bg-gray-700/50 p-4 rounded-lg border border-green-500/50">
                             <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-bold text-lg text-white">{opp.matchTitle}</h4>
                                    <p className="text-xs text-gray-400">
                                        {new Date(opp.commenceTime).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-green-500 text-black text-sm font-bold px-3 py-1 rounded-full text-center">
                                    {opp.profitPercentage.toFixed(2)}% Profit
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                                {opp.outcomes.map(outcome => (
                                    <div key={outcome.name} className="bg-gray-800 p-3 rounded-md">
                                        <p className="text-sm font-semibold text-white truncate" title={outcome.name}>{outcome.name}</p>
                                        <p className="text-xl font-bold text-green-400 my-1">{outcome.price.toFixed(2)}</p>
                                        <p className="text-xs text-gray-500">{outcome.bookmaker}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-600">
                                <h5 className="text-md font-semibold text-gray-200 mb-2">How to Secure This Profit:</h5>
                                <p className="text-xs text-gray-400 mb-3">
                                    For a total stake of £100, distribute your bets as follows to guarantee a profit of £{opp.profitPercentage.toFixed(2)}.
                                </p>
                                <ul className="space-y-2 text-sm">
                                    {opp.outcomes.map(outcome => (
                                        <li key={outcome.name} className="flex items-center bg-gray-800 p-2 rounded-md">
                                            <span className="font-bold text-green-400 w-20">£{(outcome.stakePercentage * 100).toFixed(2)}</span>
                                            <span className="text-gray-300">on <span className="font-semibold text-white">{outcome.name}</span></span>
                                            <span className="text-gray-400 mx-1">at</span>
                                            <span className="font-semibold text-gray-200">{outcome.bookmaker}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CollapsibleSection>
    );
};

export default ArbitragePanel;