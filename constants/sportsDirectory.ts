export interface LeagueDefinition {
  key: string;
  name: string;
  logo: string;
}

export const SPORTS_DIRECTORY: Record<string, LeagueDefinition[]> = {
  "American Football": [
    { key: 'americanfootball_cfl', name: 'CFL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/1/18/Canadian_Football_League_logo.svg/1200px-Canadian_Football_League_logo.svg.png' },
    { key: 'americanfootball_ncaaf', name: 'NCAAF', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/NCAA_logo.svg/1200px-NCAA_logo.svg.png' },
    { key: 'americanfootball_nfl', name: 'NFL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png' },
    { key: 'americanfootball_nfl_preseason', name: 'NFL Preseason', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/National_Football_League_logo.svg/1200px-National_Football_League_logo.svg.png' },
    { key: 'americanfootball_ufl', name: 'UFL', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/United_Football_League_logo_2024.svg/1200px-United_Football_League_logo_2024.svg.png' }
  ],
  "Aussie Rules": [
    { key: 'aussierules_afl', name: 'AFL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Australian_Football_League.svg/1200px-Australian_Football_League.svg.png' }
  ],
  "Baseball": [
    { key: 'baseball_mlb', name: 'MLB', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Major_League_Baseball_logo.svg/1200px-Major_League_Baseball_logo.svg.png' },
    { key: 'baseball_mlb_preseason', name: 'MLB Preseason', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Major_League_Baseball_logo.svg/1200px-Major_League_Baseball_logo.svg.png' },
    { key: 'baseball_milb', name: 'Minor League Baseball', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Minor_League_Baseball_logo.svg/1200px-Minor_League_Baseball_logo.svg.png' },
    { key: 'baseball_npb', name: 'NPB (Japan)', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/40/Nippon_Professional_Baseball_logo.svg/1200px-Nippon_Professional_Baseball_logo.svg.png' },
    { key: 'baseball_kbo', name: 'KBO League', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/ce/KBO_League_logo.svg/1200px-KBO_League_logo.svg.png' },
    { key: 'baseball_ncaa', name: 'NCAA Baseball', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/NCAA_logo.svg/1200px-NCAA_logo.svg.png' }
  ],
  "Basketball": [
    { key: 'basketball_euroleague', name: 'Basketball Euroleague', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0d/Euroleague_Basketball_logo.svg/1200px-Euroleague_Basketball_logo.svg.png' },
    { key: 'basketball_nba', name: 'NBA', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/1200px-National_Basketball_Association_logo.svg.png' },
    { key: 'basketball_nba_preseason', name: 'NBA Preseason', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/1200px-National_Basketball_Association_logo.svg.png' },
    { key: 'basketball_nba_summer_league', name: 'NBA Summer League', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/03/National_Basketball_Association_logo.svg/1200px-National_Basketball_Association_logo.svg.png' },
    { key: 'basketball_wnba', name: 'WNBA', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/WNBA_logo.svg/1200px-WNBA_logo.svg.png' },
    { key: 'basketball_ncaab', name: 'NCAAB', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/NCAA_logo.svg/1200px-NCAA_logo.svg.png' },
    { key: 'basketball_wncaab', name: 'WNCAAB', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/NCAA_logo.svg/1200px-WNCAAB_logo.svg.png' },
    { key: 'basketball_nbl', name: 'NBL (Australia)', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/36/NBL_Australia_logo.svg/1200px-NBL_Australia_logo.svg.png' }
  ],
  "Boxing": [
    { key: 'boxing_boxing', name: 'Boxing', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Boxing_glove.svg/1200px-Boxing_glove.svg.png' }
  ],
  "Cricket": [
    { key: 'cricket_asia_cup', name: 'Asia Cup', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_big_bash', name: 'Big Bash', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_caribbean_premier_league', name: 'Caribbean Premier League', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_icc_trophy', name: 'ICC Champions Trophy', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_icc_world_cup', name: 'ICC World Cup', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_icc_world_cup_womens', name: 'ICC Women\'s World Cup', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_international_t20', name: 'International Twenty20', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_ipl', name: 'IPL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_odi', name: 'One Day Internationals', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_psl', name: 'Pakistan Super League', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_t20_blast', name: 'T20 Blast', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_test_match', name: 'Test Matches', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' },
    { key: 'cricket_the_hundred', name: 'The Hundred', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7d/Cricket_ball.svg/1200px-Cricket_ball.svg.png' }
  ],
  "Ice Hockey": [
    { key: 'icehockey_nhl', name: 'NHL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/05_NHL_Shield.svg/1200px-05_NHL_Shield.svg.png' },
    { key: 'icehockey_nhl_preseason', name: 'NHL Preseason', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/05_NHL_Shield.svg/1200px-05_NHL_Shield.svg.png' },
    { key: 'icehockey_ahl', name: 'AHL', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/05/AHL_logo.svg/1200px-AHL_logo.svg.png' }
  ],
  "Soccer": [
    { key: 'soccer_epl', name: 'EPL', logo: 'https://b.fssta.com/uploads/application/soccer/competition-logos/EnglishPremierLeague.png' },
    { key: 'soccer_uefa_champs_league', name: 'UEFA Champions League', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/UEFA_Champions_League.svg/250px-UEFA_Champions_League.svg.png' },
    { key: 'soccer_spain_la_liga', name: 'La Liga - Spain', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/LaLiga_logo_2023.svg/1200px-LaLiga_logo_2023.svg.png' },
    { key: 'soccer_germany_bundesliga', name: 'Bundesliga - Germany', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/df/Bundesliga_logo_%282017%29.svg/1200px-Bundesliga_logo_%282017%29.svg.png' },
    { key: 'soccer_italy_serie_a', name: 'Serie A - Italy', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Serie_A_logo_2022.svg/1200px-Serie_A_logo_2022.svg.png' },
    { key: 'soccer_france_ligue_one', name: 'Ligue 1 - France', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Ligue1_Uber_Eats_logo.png/1200px-Ligue1_Uber_Eats_logo.png' },
    { key: 'soccer_usa_mls', name: 'MLS', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/MLS_crest_logo_RGB_gradient.svg/1200px-MLS_crest_logo_RGB_gradient.svg.png' }
  ]
};
