/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState, useMemo } from 'react';
import type { MatchWeekend, MatchOdds } from '../types';
import MatchCard from './MatchCard';
import OddsVisualization from './OddsVisualization';
import CollapsibleSection from './CollapsibleSection';
import { getOddsForBookmaker } from '../utils/oddsHelper';

interface MatchWeekendViewProps {
  weekend: MatchWeekend;
  bookmakers: string[];
}

type SortKey = 'matchDate' | 'homeWin' | 'draw' | 'awayWin' | 'bestOdds';
interface SortConfig {
  key: SortKey;
  direction: 'ascending' | 'descending';
}

interface SortButtonProps {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  color: 'slate' | 'blue' | 'yellow' | 'purple' | 'green';
}

const SortButton: React.FC<SortButtonProps> = ({ label, sortKey, sortConfig, setSortConfig, color }) => {
  const colorMap = {
    slate: { active: 'bg-slate-500', hover: 'hover:bg-slate-600' },
    blue: { active: 'bg-blue-500', hover: 'hover:bg-blue-600' },
    yellow: { active: 'bg-yellow-500', hover: 'hover:bg-yellow-600' },
    purple: { active: 'bg-purple-500', hover: 'hover:bg-purple-600' },
    green: { active: 'bg-green-500', hover: 'hover:bg-green-600' },
  };
  const theme = colorMap[color];
  const isActive = sortConfig.key === sortKey;
  const directionIcon = sortConfig.direction === 'ascending' ? '▲' : '▼';

  const handleClick = () => {
    let newDirection: 'ascending' | 'descending' = 'descending';
    if (isActive) {
      newDirection = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    }
    setSortConfig({ key: sortKey, direction: newDirection });
  };

  const activeClasses = `${theme.active} text-white`;
  const inactiveClasses = `bg-gray-700 text-gray-300 ${theme.hover}`;

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${isActive ? activeClasses : inactiveClasses}`}
      aria-label={`Sort by ${label} ${isActive ? (sortConfig.direction === 'ascending' ? 'ascending' : 'descending') : ''}`}
    >
      {label} {isActive && <span className="ml-1 text-xs">{directionIcon}</span>}
    </button>
  );
};

const MatchWeekendView: React.FC<MatchWeekendViewProps> = ({ weekend, bookmakers }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'matchDate', direction: 'ascending' });
  const [selectedBookmaker, setSelectedBookmaker] = useState('average');

  const sortedMatches = useMemo(() => {
    const sortableMatches = [...weekend.matches];
    sortableMatches.sort((a, b) => {
        let aValue: number, bValue: number;

        const aOdds = getOddsForBookmaker(a, selectedBookmaker);
        const bOdds = getOddsForBookmaker(b, selectedBookmaker);

        switch (sortConfig.key) {
            case 'matchDate':
                aValue = new Date(a.commence_time).getTime();
                bValue = new Date(b.commence_time).getTime();
                break;
            case 'homeWin': aValue = aOdds.homeWin; bValue = bOdds.homeWin; break;
            case 'draw': aValue = aOdds.draw; bValue = bOdds.draw; break;
            case 'awayWin': aValue = aOdds.awayWin; bValue = bOdds.awayWin; break;
            case 'bestOdds': aValue = aOdds.bestOdds; bValue = bOdds.bestOdds; break;
            default: return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
    });
    return sortableMatches;
  }, [weekend.matches, sortConfig, selectedBookmaker]);

  return (
    <CollapsibleSection title={weekend.title}>
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-gray-400">{weekend.dateRange}</p>
            <div className="flex items-center gap-3">
              <label htmlFor={`bookmaker-select-${weekend.id}`} className="font-medium text-gray-300 text-sm">Bookmaker:</label>
              <select
                id={`bookmaker-select-${weekend.id}`}
                value={selectedBookmaker}
                onChange={(e) => setSelectedBookmaker(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-green-500 focus:outline-none text-sm capitalize"
              >
                {bookmakers.map(b => <option key={b} value={b} className="capitalize">{b.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
        </div>
        <div className="mb-6 flex-shrink-0 flex flex-wrap items-center justify-start sm:justify-end gap-2" role="toolbar" aria-label="Sort matches">
            <SortButton label="Date" sortKey="matchDate" sortConfig={sortConfig} setSortConfig={setSortConfig} color="slate" />
            <SortButton label="Home" sortKey="homeWin" sortConfig={sortConfig} setSortConfig={setSortConfig} color="blue" />
            <SortButton label="Draw" sortKey="draw" sortConfig={sortConfig} setSortConfig={setSortConfig} color="yellow" />
            <SortButton label="Away" sortKey="awayWin" sortConfig={sortConfig} setSortConfig={setSortConfig} color="purple" />
            <SortButton label="Best" sortKey="bestOdds" sortConfig={sortConfig} setSortConfig={setSortConfig} color="green" />
        </div>

        <div className="space-y-8">
            <OddsVisualization matches={weekend.matches} selectedBookmaker={selectedBookmaker} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedMatches.map((match) => (
                  <MatchCard 
                    key={match.id} 
                    match={match}
                    selectedBookmaker={selectedBookmaker}
                  />
                ))}
            </div>
        </div>
    </CollapsibleSection>
  );
};

export default MatchWeekendView;