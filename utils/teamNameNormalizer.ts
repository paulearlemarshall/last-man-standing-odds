export const normalizeTeamName = (name: string): string => {
    if (!name) return name;
    
    let potentialName = name.trim();
    
    // General cleaning rule: strip common club suffixes
    potentialName = potentialName.replace(/^(afc|fc)\s+/i, '').trim();
    potentialName = potentialName.replace(/\s+(fc|afc)$/i, '').trim();

    // Specific known variations
    const variationMap = new Map<string, string>([
        ['brighton', 'Brighton & Hove Albion'],
        ['brighton & hove albion', 'Brighton & Hove Albion'],
        ['brighton and hove albion', 'Brighton & Hove Albion'],
        ['man utd', 'Manchester United'],
        ['man city', 'Manchester City'],
        ['spurs', 'Tottenham Hotspur'],
        ['wolves', 'Wolverhampton Wanderers'],
    ]);

    const lowerName = potentialName.toLowerCase();
    if (variationMap.has(lowerName)) {
        return variationMap.get(lowerName)!;
    }

    return potentialName;
};