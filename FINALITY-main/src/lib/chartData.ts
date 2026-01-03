// Market chart data generator
export interface PricePoint {
    timestamp: number;
    date: string;
    yesPrice: number;
    noPrice: number;
    volume: number;
}

// Generate realistic price history data
export function generateMarketChartData(marketId: string, days: number = 30): PricePoint[] {
    const data: PricePoint[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Different patterns for different markets
    const patterns: Record<string, { startYes: number; trend: 'up' | 'down' | 'volatile' }> = {
        'bitcoin-100k-2025': { startYes: 45, trend: 'up' },
        'eth-uptime-dencun': { startYes: 65, trend: 'up' },
        'ai-chess-champion': { startYes: 40, trend: 'volatile' },
        'chiefs-superbowl': { startYes: 50, trend: 'up' },
        'us-election-2024': { startYes: 35, trend: 'down' },
        'spacex-mars-2026': { startYes: 25, trend: 'volatile' },
    };

    const pattern = patterns[marketId] || { startYes: 50, trend: 'volatile' };
    let currentYes = pattern.startYes;

    for (let i = days; i >= 0; i--) {
        const timestamp = now - (i * dayMs);
        const date = new Date(timestamp);

        // Add trend-based movement
        let change = 0;
        if (pattern.trend === 'up') {
            change = Math.random() * 2 - 0.5; // Slight upward bias
        } else if (pattern.trend === 'down') {
            change = Math.random() * 2 - 1.5; // Downward bias
        } else {
            change = Math.random() * 4 - 2; // Volatile
        }

        currentYes = Math.max(5, Math.min(95, currentYes + change));
        const yesPrice = Math.round(currentYes * 100) / 100;
        const noPrice = Math.round((100 - currentYes) * 100) / 100;

        // Generate volume (higher on recent days)
        const recencyFactor = 1 - (i / days);
        const baseVolume = 5000 + Math.random() * 15000;
        const volume = Math.round(baseVolume * (0.5 + recencyFactor));

        data.push({
            timestamp,
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            yesPrice,
            noPrice,
            volume,
        });
    }

    return data;
}

// Generate hourly data for last 24 hours
export function generateHourlyData(marketId: string): PricePoint[] {
    const data: PricePoint[] = [];
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;

    const patterns: Record<string, number> = {
        'bitcoin-100k-2025': 60,
        'eth-uptime-dencun': 70,
        'ai-chess-champion': 30,
        'chiefs-superbowl': 55,
        'us-election-2024': 25,
        'spacex-mars-2026': 30,
    };

    let currentYes = patterns[marketId] || 50;

    for (let i = 24; i >= 0; i--) {
        const timestamp = now - (i * hourMs);
        const date = new Date(timestamp);

        const change = Math.random() * 3 - 1.5;
        currentYes = Math.max(5, Math.min(95, currentYes + change));

        const yesPrice = Math.round(currentYes * 100) / 100;
        const noPrice = Math.round((100 - currentYes) * 100) / 100;
        const volume = Math.round(1000 + Math.random() * 3000);

        data.push({
            timestamp,
            date: date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
            yesPrice,
            noPrice,
            volume,
        });
    }

    return data;
}
