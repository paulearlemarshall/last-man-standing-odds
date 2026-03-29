/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useMemo } from 'react';
import type { ApiMatch, ArbitrageOpportunity } from '../types';
import CollapsibleSection from './CollapsibleSection';
import { normalizeTeamName } from '../utils/teamNameNormalizer';

const isDrawOutcome = (name: string) => {
    const normalized = name.trim().toLowerCase();
    return normalized === 'draw' || normalized === 'tie';
};

const findTeamOutcome = (outcomes: { name: string; price: number }[], teamName: string) => {
    const normalizedTeamName = normalizeTeamName(teamName);
    return outcomes.find(o => normalizeTeamName(o.name) === normalizedTeamName);
};

const findDrawOutcome = (outcomes: { name: string; price: number }[]) => {
    return outcomes.find(o => isDrawOutcome(o.name));
};

// This logic is duplicated from the ArbitragePanel to keep this component self-contained for debugging purposes.
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
            if (!h2h) return;

            const home = findTeamOutcome(h2h.outcomes, homeTeam);
            const away = findTeamOutcome(h2h.outcomes, awayTeam);
            const draw = findDrawOutcome(h2h.outcomes);

            if (home && home.price > bestOdds.home.price) {
                bestOdds.home = { price: home.price, bookmaker: bookmaker.title };
            }

            if (away && away.price > bestOdds.away.price) {
                bestOdds.away = { price: away.price, bookmaker: bookmaker.title };
            }

            if (draw && draw.price > bestOdds.draw.price) {
                bestOdds.draw = { price: draw.price, bookmaker: bookmaker.title };
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
                    profitPercentage,
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

interface DebugPanelProps {
    data: ApiMatch[] | null;
    apiLatency: number | null;
    quotaCost: number;
}

const StatCard: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color }) => (
    <div className="bg-gray-700 p-3 rounded-lg text-center">
        <div className={`text-2xl font-bold ${color || 'text-green-400'}`}>{value}</div>
        <div className="text-xs sm:text-sm text-gray-400">{label}</div>
    </div>
);

const AdvancedStat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="bg-gray-800 p-3 rounded-md">
        <p className="text-sm font-semibold text-gray-400 mb-1">{label}</p>
        <div className="text-md text-white">{children}</div>
    </div>
);

const stdDev = (arr: number[]): number => {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return Math.sqrt(arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / arr.length);
};

const DebugPanel: React.FC<DebugPanelProps> = ({ data, apiLatency, quotaCost }) => {
    const stats = useMemo(() => {
        if (!data) return null;

        const bookmakers = new Set<string>();
        const teams = new Set<string>();
        const datesByIsoDay = new Map<string, { label: string; ts: number }>();
        let totalOdds = 0;
        let validOddsCount = 0;
        let totalPossibleOdds = 0;
        
        let minOdd = { odd: Infinity, team: '', match: '' };
        let maxOdd = { odd: 0, team: '', match: '' };
        let mostCompetitiveMatch = { stdDev: Infinity, match: '' };
        let marketDisagreement = { match: '', outcome: '', stdDev: 0 };

        const bookmakerVigorish = new Map<string, { totalVig: number; count: number }>();
        const bestOddsProvider = new Map<string, { home: number; away: number; draw: number }>();

        data.forEach(match => {
            const homeTeam = normalizeTeamName(match.home_team);
            const awayTeam = normalizeTeamName(match.away_team);
            teams.add(homeTeam);
            teams.add(awayTeam);

            const matchDate = new Date(match.commence_time);
            if (!isNaN(matchDate.getTime())) {
                const isoDay = matchDate.toISOString().slice(0, 10);
                if (!datesByIsoDay.has(isoDay)) {
                    datesByIsoDay.set(isoDay, {
                        ts: matchDate.getTime(),
                        label: matchDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                    });
                }
            }

            let homeTotal = 0, awayTotal = 0, drawTotal = 0;
            let homeCount = 0, awayCount = 0, drawCount = 0;
            
            const oddsByOutcome = { home: new Map<string, number>(), away: new Map<string, number>(), draw: new Map<string, number>() };
            let bestMatchOdds = { home: { price: 0 }, away: { price: 0 }, draw: { price: 0 }};

            match.bookmakers.forEach(bookie => {
                bookmakers.add(bookie.title);
                bestOddsProvider.has(bookie.title) || bestOddsProvider.set(bookie.title, { home: 0, away: 0, draw: 0 });

                const h2h = bookie.markets.find(m => m.key === 'h2h');
                if (h2h) {
                    totalOdds += h2h.outcomes.length;
                    
                    const home = findTeamOutcome(h2h.outcomes, homeTeam);
                    const away = findTeamOutcome(h2h.outcomes, awayTeam);
                    const draw = findDrawOutcome(h2h.outcomes);
                    
                    // Dynamic completeness: If the market has a draw, we expect 3 outcomes. If not, we expect 2.
                    const hasDraw = !!draw;
                    totalPossibleOdds += hasDraw ? 3 : 2;

                    if (home) { 
                        homeTotal += home.price; homeCount++; 
                        oddsByOutcome.home.set(bookie.key, home.price);
                        if (home.price > bestMatchOdds.home.price) bestMatchOdds.home = { price: home.price };
                        validOddsCount++;
                    }
                    if (away) { 
                        awayTotal += away.price; awayCount++;
                        oddsByOutcome.away.set(bookie.key, away.price);
                        if (away.price > bestMatchOdds.away.price) bestMatchOdds.away = { price: away.price };
                        validOddsCount++;
                    }
                    if (draw) { 
                        drawTotal += draw.price; drawCount++;
                        oddsByOutcome.draw.set(bookie.key, draw.price);
                        if (draw.price > bestMatchOdds.draw.price) bestMatchOdds.draw = { price: draw.price };
                        validOddsCount++;
                    }

                    if (home && away) {
                         let vig = (1/home.price) + (1/away.price);
                         if (draw) vig += (1/draw.price);

                        const current = bookmakerVigorish.get(bookie.title) || { totalVig: 0, count: 0 };
                        bookmakerVigorish.set(bookie.title, { totalVig: current.totalVig + vig, count: current.count + 1 });
                    }
                }
            });

            // Find which bookmakers offered the best odds for this match
            match.bookmakers.forEach(bookie => {
                const h2h = bookie.markets.find(m => m.key === 'h2h');
                if(h2h) {
                    const home = findTeamOutcome(h2h.outcomes, homeTeam);
                    const away = findTeamOutcome(h2h.outcomes, awayTeam);
                    const draw = findDrawOutcome(h2h.outcomes);
                    const counts = bestOddsProvider.get(bookie.title)!;
                    if(home && home.price === bestMatchOdds.home.price) counts.home++;
                    if(away && away.price === bestMatchOdds.away.price) counts.away++;
                    if(draw && draw.price === bestMatchOdds.draw.price) counts.draw++;
                }
            });

            const matchTitle = `${homeTeam} vs ${awayTeam}`;
            
            const homeStdDev = stdDev(Array.from(oddsByOutcome.home.values()));
            if (homeStdDev > marketDisagreement.stdDev) marketDisagreement = { match: matchTitle, outcome: 'Home Win', stdDev: homeStdDev };
            const awayStdDev = stdDev(Array.from(oddsByOutcome.away.values()));
            if (awayStdDev > marketDisagreement.stdDev) marketDisagreement = { match: matchTitle, outcome: 'Away Win', stdDev: awayStdDev };
            const drawStdDev = stdDev(Array.from(oddsByOutcome.draw.values()));
            if (drawStdDev > marketDisagreement.stdDev) marketDisagreement = { match: matchTitle, outcome: 'Draw', stdDev: drawStdDev };

            const avgHome = homeCount > 0 ? homeTotal / homeCount : Infinity;
            const avgAway = awayCount > 0 ? awayTotal / awayCount : Infinity;
            const avgDraw = drawCount > 0 ? drawTotal / drawCount : Infinity;

            if (avgHome < minOdd.odd) minOdd = { odd: avgHome, team: homeTeam, match: matchTitle };
            if (avgAway < minOdd.odd) minOdd = { odd: avgAway, team: awayTeam, match: matchTitle };
            if (avgHome > maxOdd.odd && isFinite(avgHome)) maxOdd = { odd: avgHome, team: homeTeam, match: matchTitle };
            if (avgAway > maxOdd.odd && isFinite(avgAway)) maxOdd = { odd: avgAway, team: awayTeam, match: matchTitle };

            // Calculate competitiveness (StdDev of probabilities)
            let stdDevVal = Infinity;
            if (isFinite(avgHome) && isFinite(avgAway)) {
                if (isFinite(avgDraw)) {
                    const probHome = 1 / avgHome;
                    const probAway = 1 / avgAway;
                    const probDraw = 1 / avgDraw;
                    const meanProb = (probHome + probAway + probDraw) / 3;
                    stdDevVal = Math.sqrt(
                        ((probHome - meanProb) ** 2 + (probAway - meanProb) ** 2 + (probDraw - meanProb) ** 2) / 3
                    );
                } else {
                    const probHome = 1 / avgHome;
                    const probAway = 1 / avgAway;
                    const meanProb = (probHome + probAway) / 2;
                    stdDevVal = Math.sqrt(
                        ((probHome - meanProb) ** 2 + (probAway - meanProb) ** 2) / 2
                    );
                }
                
                if (stdDevVal < mostCompetitiveMatch.stdDev) {
                    mostCompetitiveMatch = { stdDev: stdDevVal, match: matchTitle };
                }
            }
        });
        
        const opportunities = findArbitrageOpportunities(data);
        const bestArbitrage = opportunities.length > 0 ? opportunities[0] : null;
        
        const bookmakerVigAverages = Array.from(bookmakerVigorish.entries()).map(([name, { totalVig, count }]) => ({
            name,
            averageVig: ((totalVig / count) - 1) * 100
        })).sort((a,b) => a.averageVig - b.averageVig);

        const completeness = totalPossibleOdds > 0 ? (validOddsCount / totalPossibleOdds) * 100 : 0;

        return {
            matchCount: data.length,
            bookmakerCount: bookmakers.size,
            totalOdds,
            completeness,
            uniqueTeams: Array.from(teams).sort(),
            uniqueDates: Array.from(datesByIsoDay.values()).sort((a, b) => a.ts - b.ts).map(d => d.label),
            bestArbitrage,
            biggestFavorite: isFinite(minOdd.odd) ? minOdd : null,
            biggestUnderdog: maxOdd.odd > 0 ? maxOdd : null,
            mostCompetitive: isFinite(mostCompetitiveMatch.stdDev) ? mostCompetitiveMatch : null,
            marketDisagreement: marketDisagreement.stdDev > 0 ? marketDisagreement : null,
            bookmakerVigAverages,
            bestOddsProvider: Array.from(bestOddsProvider.entries()).sort((a, b) => (b[1].home+b[1].away+b[1].draw) - (a[1].home+a[1].away+a[1].draw)),
        };
    }, [data]);

    if (!stats) {
        return (
             <CollapsibleSection title="Debug Information" defaultOpen={false}>
                <p className="text-gray-500">No data available to display.</p>
            </CollapsibleSection>
        );
    }

    return (
        <CollapsibleSection title="Debug Information" defaultOpen={false}>
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-300">Performance & Data Health</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard 
                            label="API Latency" 
                            value={apiLatency ? `${Math.round(apiLatency)}ms` : 'N/A'} 
                            color={apiLatency && apiLatency > 1000 ? 'text-yellow-400' : 'text-green-400'} 
                        />
                         <StatCard 
                            label="Session Quota Cost" 
                            value={quotaCost} 
                            color={quotaCost > 5 ? 'text-red-400' : 'text-blue-400'} 
                        />
                        <StatCard label="Matches Fetched" value={stats.matchCount} />
                        <StatCard label="Unique Bookmakers" value={stats.bookmakerCount} />
                        <StatCard 
                            label="Data Completeness" 
                            value={`${stats.completeness.toFixed(1)}%`} 
                            color={stats.completeness < 90 ? 'text-red-400' : 'text-blue-400'}
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                         <h3 className="text-lg font-semibold mb-3 text-gray-300">Unique Teams ({stats.uniqueTeams.length})</h3>
                         <select className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none">
                            {stats.uniqueTeams.map(team => <option key={team} value={team}>{team}</option>)}
                         </select>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-gray-300">Match Dates</h3>
                        <div className="bg-gray-700 p-3 rounded-lg max-h-32 overflow-y-auto">
                            <ul className="text-sm text-gray-200 space-y-1">
                                {stats.uniqueDates.map(date => <li key={date}>{date}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-300">Advanced Odds Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <AdvancedStat label="Best Arbitrage Opportunity">
                            {stats.bestArbitrage 
                                ? <><span className="font-bold text-green-400">{stats.bestArbitrage.profitPercentage.toFixed(2)}%</span> on {stats.bestArbitrage.matchTitle}</>
                                : 'None found'
                            }
                       </AdvancedStat>
                       <AdvancedStat label="Most Competitive Match (Closest Odds)">
                            {stats.mostCompetitive ? stats.mostCompetitive.match : 'N/A'}
                       </AdvancedStat>
                       <AdvancedStat label="Biggest Favourite">
                            {stats.biggestFavorite 
                                ? <>{stats.biggestFavorite.team} ({stats.biggestFavorite.odd.toFixed(2)}) in {stats.biggestFavorite.match}</>
                                : 'N/A'
                            }
                       </AdvancedStat>
                       <AdvancedStat label="Biggest Underdog">
                            {stats.biggestUnderdog
                                ? <>{stats.biggestUnderdog.team} ({stats.biggestUnderdog.odd.toFixed(2)}) in {stats.biggestUnderdog.match}</>
                                : 'N/A'
                            }
                       </AdvancedStat>
                        <AdvancedStat label="Biggest Market Disagreement">
                            {stats.marketDisagreement
                                ? <>On <span className="font-bold">{stats.marketDisagreement.outcome}</span> for {stats.marketDisagreement.match}</>
                                : 'N/A'
                            }
                       </AdvancedStat>
                    </div>
                </div>
                
                <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-300">Bookmaker Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-md font-semibold mb-2 text-gray-300">Average Vigorish (Bookmaker's Cut)</h4>
                            <div className="bg-gray-800 p-3 rounded-md max-h-48 overflow-y-auto">
                                {stats.bookmakerVigAverages.map(({name, averageVig}) => (
                                    <div key={name} className="flex justify-between items-center text-sm py-1">
                                        <span className="text-gray-300">{name}</span>
                                        <span className="font-semibold text-red-400">{averageVig.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-md font-semibold mb-2 text-gray-300">Best Odds Provider</h4>
                             <div className="bg-gray-800 p-2 rounded-md max-h-48 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-400 uppercase">
                                        <tr>
                                            <th className="px-2 py-1">Bookmaker</th>
                                            <th className="px-2 py-1 text-center">Home</th>
                                            <th className="px-2 py-1 text-center">Away</th>
                                            <th className="px-2 py-1 text-center">Draw</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-200">
                                        {stats.bestOddsProvider.map(([name, counts]) => (
                                            <tr key={name} className="border-t border-gray-700">
                                                <td className="px-2 py-1 font-semibold">{name}</td>
                                                <td className="px-2 py-1 text-center text-blue-300">{counts.home}</td>
                                                <td className="px-2 py-1 text-center text-purple-300">{counts.away}</td>
                                                <td className="px-2 py-1 text-center text-yellow-300">{counts.draw}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-300">Raw API Response</h3>
                    <pre className="bg-gray-900 text-sm text-green-300 p-4 rounded-lg overflow-x-auto max-h-96">
                        <code>
                            {JSON.stringify(data, null, 2)}
                        </code>
                    </pre>
                </div>
            </div>
        </CollapsibleSection>
    );
};

export default DebugPanel;
