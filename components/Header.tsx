import React from 'react';
import type { ThemePreference } from '../hooks/useTheme';

interface HeaderProps {
  title?: string;
  logoUrl?: string;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}

const Header: React.FC<HeaderProps> = ({
  title = 'Premier League Odds',
  logoUrl = 'https://b.fssta.com/uploads/application/soccer/competition-logos/EnglishPremierLeague.png',
  theme,
  onThemeChange,
}) => {
  return (
    <header className="text-center py-4 border-b-2 border-green-500/30">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={`${title} Logo`} className="h-12 w-12 mr-4 object-contain" />
        ) : (
          <div className="h-12 w-12 mr-4 rounded-md bg-green-600/20 border border-green-500/40 flex items-center justify-center text-green-200 font-bold">
            {title.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">{title}</h1>
          <p className="text-sm sm:text-lg text-gray-400 mt-1">Latest betting odds powered by The Odds API</p>
        </div>
        <div
          className="sm:ml-6 inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 border border-gray-300 dark:border-gray-700"
          aria-label="Color theme"
        >
          {(['light', 'dark', 'system'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onThemeChange(option)}
              aria-pressed={theme === option}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                theme === option
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;
