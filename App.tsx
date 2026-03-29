/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useEffect, useMemo, useState } from 'react';
import type { DecisionLogEntry, Player, Region } from './types';

import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorDisplay from './components/ErrorDisplay';
import PlayerManager from './components/PlayerManager';
import MatchWeekendView from './components/MatchWeekendView';
import DebugPanel from './components/DebugPanel';
import ArbitragePanel from './components/ArbitragePanel';
import DecisionLogPanel from './components/DecisionLogPanel';

import { SPORTS_DIRECTORY } from './constants/sportsDirectory';
import { useOddsData } from './hooks/useOddsData';
import { suggestPicks } from './services/pickSuggestionService';
import { decodePlayersFromUrl, encodePlayersForUrl } from './utils/shareState';

const DEFAULT_SPORT_CLASS = 'Soccer';
const DEFAULT_LEAGUE_KEY = 'soccer_epl';

const ALL_REGIONS: Region[] = ['uk', 'us', 'eu', 'au'];

const getInitialSportClass = (): string => {
    const params = new URLSearchParams(window.location.search);
    const sport = params.get('sport');
    return sport && SPORTS_DIRECTORY[sport] ? sport : DEFAULT_SPORT_CLASS;
};

const getInitialLeague = (sportClass: string, useUrlLeague: boolean = true) => {
    const params = new URLSearchParams(window.location.search);
    const requestedLeagueKey = useUrlLeague ? params.get('league') : null;
    const leaguesForSport = SPORTS_DIRECTORY[sportClass] || SPORTS_DIRECTORY[DEFAULT_SPORT_CLASS];

    if (requestedLeagueKey) {
        const requestedLeague = leaguesForSport.find((league) => league.key === requestedLeagueKey);
        if (requestedLeague) {
            return requestedLeague;
        }
    }

    return leaguesForSport.find((league) => league.key === DEFAULT_LEAGUE_KEY) || leaguesForSport[0];
};

const getInitialRegions = (): Region[] => {
    const params = new URLSearchParams(window.location.search);
    const regionParam = params.get('regions');

    if (!regionParam) {
        return ['uk'];
    }

    const parsed = regionParam
        .split(',')
        .map((region) => region.trim().toLowerCase())
        .filter((region): region is Region => ALL_REGIONS.includes(region as Region));

    return parsed.length ? parsed : ['uk'];
};

const App: React.FC = () => {
    const [currentSportClass, setCurrentSportClass] = useState<string>(() => getInitialSportClass());
    const [currentLeague, setCurrentLeague] = useState(() => getInitialLeague(getInitialSportClass()));
    const [selectedRegions, setSelectedRegions] = useState<Region[]>(() => getInitialRegions());

    const {
        apiData,
        matchWeekends,
        allBookmakers,
        allTeams,
        loading,
        isRefreshing,
        error,
        lastRefreshTime,
        apiLatency,
        quotaCost,
        refresh,
    } = useOddsData(currentLeague.key, selectedRegions);

    const [players, setPlayers] = useState<Player[]>([
        { id: 1, name: 'Player 1', previousPicks: [], suggestion: null },
    ]);
    const [decisionLogs, setDecisionLogs] = useState<DecisionLogEntry[]>([]);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [hasHydratedPlayers, setHasHydratedPlayers] = useState(false);

    useEffect(() => {
        if (!shareMessage) return;
        const timeoutId = window.setTimeout(() => setShareMessage(null), 2500);
        return () => window.clearTimeout(timeoutId);
    }, [shareMessage]);

    const teamNameToIndex = useMemo(() => new Map(allTeams.map((team, index) => [team, index])), [allTeams]);

    useEffect(() => {
        if (hasHydratedPlayers || allTeams.length === 0) {
            return;
        }

        const encodedPlayers = new URLSearchParams(window.location.search).get('players');
        if (!encodedPlayers) {
            setHasHydratedPlayers(true);
            return;
        }

        const decodedPlayers = decodePlayersFromUrl(encodedPlayers, allTeams);
        if (decodedPlayers.length > 0) {
            setPlayers(decodedPlayers);
        }

        setHasHydratedPlayers(true);
    }, [allTeams, hasHydratedPlayers]);

    const handleSportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSportClass = e.target.value;
        setCurrentSportClass(newSportClass);
        setCurrentLeague(SPORTS_DIRECTORY[newSportClass][0]);
    };

    const handleReset = () => {
        setCurrentSportClass(DEFAULT_SPORT_CLASS);
        setCurrentLeague(getInitialLeague(DEFAULT_SPORT_CLASS, false));
        setSelectedRegions(['uk']);
        setPlayers([{ id: 1, name: 'Player 1', previousPicks: [], suggestion: null }]);
        setDecisionLogs([]);
        setShareMessage(null);
    };

    const handleShare = async () => {
        try {
            const encodedPlayers = encodePlayersForUrl(players, teamNameToIndex);
            const url = new URL(window.location.href);

            url.searchParams.set('players', encodedPlayers);
            url.searchParams.set('sport', currentSportClass);
            url.searchParams.set('league', currentLeague.key);
            url.searchParams.set('regions', selectedRegions.join(','));

            await navigator.clipboard.writeText(url.toString());
            setShareMessage('Shareable link copied to clipboard.');
        } catch (_error) {
            setShareMessage('Could not copy link automatically.');
        }
    };

    const toggleRegion = (region: Region) => {
        setSelectedRegions((current) => {
            if (current.includes(region)) {
                return current.length === 1 ? current : current.filter((item) => item !== region);
            }
            return [...current, region];
        });
    };

    const handleSuggestPicks = () => {
        const { updatedPlayers, logs } = suggestPicks(players, matchWeekends);
        setPlayers(updatedPlayers);
        setDecisionLogs(logs);
    };

    const handlePlayerCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const count = parseInt(e.target.value, 10);

        setPlayers((current) => {
            const updated = [...current];
            while (updated.length < count) {
                const newId = updated.length > 0 ? Math.max(...updated.map((player) => player.id)) + 1 : 1;
                updated.push({ id: newId, name: `Player ${newId}`, previousPicks: [], suggestion: null });
            }
            return updated.slice(0, count);
        });
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <Header title={currentLeague.name} logoUrl={currentLeague.logo} />
            <div className="container mx-auto p-4 sm:p-6">
                <div className="flex flex-col items-center justify-center gap-4 py-4 px-6 mb-8 bg-gray-800/50 border-y-2 border-green-500/30 rounded-lg">
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="relative">
                            <select value={currentSportClass} onChange={handleSportChange} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-white border-none focus:ring-2 focus:ring-green-500 outline-none cursor-pointer appearance-none pr-8 font-bold">
                                {Object.keys(SPORTS_DIRECTORY).map(sport => <option key={sport} value={sport}>{sport}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white"><svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg></div>
                        </div>
                        <div className="relative">
                            <select value={currentLeague.key} onChange={(e) => { const league = SPORTS_DIRECTORY[currentSportClass].find(l => l.key === e.target.value); if (league) setCurrentLeague(league); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md text-white border-none focus:ring-2 focus:ring-green-500 outline-none cursor-pointer appearance-none pr-8">
                                {SPORTS_DIRECTORY[currentSportClass].map(league => <option key={league.key} value={league.key}>{league.name}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white"><svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg></div>
                        </div>
                        <div className="flex bg-slate-700 rounded-md p-1">
                            {ALL_REGIONS.map(region => (
                                <button key={region} onClick={() => toggleRegion(region)} className={`px-3 py-1 rounded-sm text-sm font-bold transition-colors uppercase ${selectedRegions.includes(region) ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-slate-600'}`}>
                                    {region}
                                </button>
                            ))}
                        </div>
                        <button onClick={refresh} disabled={loading || isRefreshing} className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md disabled:opacity-50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M20 4h-5v5M4 20h5v-5" /></svg>
                            Refresh
                        </button>
                        <button onClick={handleSuggestPicks} disabled={loading || !matchWeekends.length} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 transition-colors">Suggest</button>
                        <button onClick={handleShare} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">Share</button>
                        <button onClick={handleReset} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors">Reset</button>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        {lastRefreshTime && <p className="text-xs text-gray-500">Last refreshed: {lastRefreshTime.toLocaleTimeString()}</p>}
                        {shareMessage && <p className="text-xs text-blue-300">{shareMessage}</p>}
                    </div>
                </div>
                <main className="space-y-8">
                    <PlayerManager players={players} playerCount={players.length} allTeams={allTeams} onPlayerCountChange={handlePlayerCountChange} onNameChange={(id, name) => setPlayers(p => p.map(player => player.id === id ? { ...player, name } : player))} onAddPick={(id, team) => setPlayers(p => p.map(player => player.id === id ? { ...player, previousPicks: [...player.previousPicks, team].sort() } : player))} onRemovePick={(id, team) => setPlayers(p => p.map(player => player.id === id ? { ...player, previousPicks: player.previousPicks.filter(t => t !== team) } : player))} />
                    {loading && <LoadingSpinner />}
                    {error && <ErrorDisplay message={error} />}
                    {!loading && !error && matchWeekends.length > 0 && (
                        <>
                            {matchWeekends.map(weekend => <MatchWeekendView key={weekend.id} weekend={weekend} bookmakers={allBookmakers} />)}
                            <ArbitragePanel data={apiData} />
                            <DecisionLogPanel logs={decisionLogs} />
                            <DebugPanel data={apiData} apiLatency={apiLatency} quotaCost={quotaCost} />
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default App;
