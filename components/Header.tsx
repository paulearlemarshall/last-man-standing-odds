import React from 'react';

interface HeaderProps {
  title?: string;
  logoUrl?: string;
}

const Header: React.FC<HeaderProps> = ({
  title = 'Premier League Odds',
  logoUrl = 'https://b.fssta.com/uploads/application/soccer/competition-logos/EnglishPremierLeague.png',
}) => {
  return (
    <header className="text-center py-4 border-b-2 border-green-500/30">
      <div className="flex items-center justify-center">
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
      </div>
    </header>
  );
};

export default Header;
