/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import type { MatchOdds } from '../types';
import { getOddsForBookmaker } from '../utils/oddsHelper';

interface MatchCardProps {
  match: MatchOdds;
  selectedBookmaker: string;
}

const TeamDisplay: React.FC<{ teamName: string; colorClass: string }> = ({ teamName, colorClass }) => (
    <div className="flex flex-col items-center text-center w-2/5">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 border-2 transition-colors duration-300 ${colorClass}`}>
            <span className="text-2xl font-bold text-white shadow-sm">{teamName.substring(0, 3).toUpperCase()}</span>
        </div>
        <span className="font-semibold text-sm sm:text-base break-words">{teamName}</span>
    </div>
);

const OddsDisplay: React.FC<{ label: string; value: number; colorClass: string; }> = ({ label, value, colorClass }) => (
    <div className="flex flex-col items-center p-2 bg-gray-900 rounded-md w-1/3">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-lg font-bold ${colorClass}`}>{isFinite(value) ? value.toFixed(2) : 'N/A'}</span>
    </div>
);


const MatchCard: React.FC<MatchCardProps> = ({ match, selectedBookmaker }) => {
  const matchDate = new Date(match.commence_time);
  const formattedDate = isNaN(matchDate.getTime()) 
    ? match.commence_time 
    : matchDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const formattedTime = isNaN(matchDate.getTime()) 
    ? '' 
    : matchDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  const { homeWin, draw, awayWin, bestOdds } = getOddsForBookmaker(match, selectedBookmaker);

  // Determine colors based on odds (Lower odds = Higher probability = Green/Favorite)
  let homeTeamColor = "bg-gray-700 border-gray-600";
  let awayTeamColor = "bg-gray-700 border-gray-600";

  if (isFinite(homeWin) && isFinite(awayWin)) {
      if (homeWin < awayWin) {
          homeTeamColor = "bg-green-600 border-green-500 shadow-[0_0_15px_rgba(22,163,74,0.5)]";
          awayTeamColor = "bg-red-700 border-red-600 opacity-90";
      } else if (awayWin < homeWin) {
          awayTeamColor = "bg-green-600 border-green-500 shadow-[0_0_15px_rgba(22,163,74,0.5)]";
          homeTeamColor = "bg-red-700 border-red-600 opacity-90";
      }
  }

  return (
    <div className="relative bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 hover:border-blue-500 transform hover:scale-105 transition-all duration-300 flex flex-col justify-between">
      <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
        Best Odds: {isFinite(bestOdds) ? bestOdds.toFixed(2) : 'N/A'}
      </div>
      <div className="p-4 flex-grow">
        <div className="flex justify-between items-center mb-4">
            <TeamDisplay teamName={match.home_team} colorClass={homeTeamColor} />
            <div className="text-center">
                <span className="text-2xl font-bold text-gray-400">vs</span>
                <div className="text-xs text-gray-500 mt-1">{formattedTime}</div>
            </div>
            <TeamDisplay teamName={match.away_team} colorClass={awayTeamColor} />
        </div>
        
        <div className="mt-4 flex justify-around items-center space-x-2">
           <OddsDisplay label="Home" value={homeWin} colorClass="text-blue-400" />
           <OddsDisplay label="Draw" value={draw} colorClass="text-yellow-400" />
           <OddsDisplay label="Away" value={awayWin} colorClass="text-purple-400" />
        </div>
      </div>
      <div className="bg-gray-800/50 text-center py-2 px-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">{formattedDate}</p>
      </div>
    </div>
  );
};

export default MatchCard;