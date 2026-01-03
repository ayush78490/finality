// Mock data for development and testing

import { Market, MarketStatus, Category, Outcome, PlatformStats, Bet } from './types';

// Platform-wide statistics
export const platformStats: PlatformStats = {
    totalVolume: 12_500_000,
    activeMarkets: 47,
    totalTraders: 8_234,
    marketsResolved: 156,
};

// Sample markets
export const mockMarkets: Market[] = [
    {
        id: '1',
        slug: 'bitcoin-100k-2025',
        question: 'Will Bitcoin reach $100,000 by end of 2025?',
        description: 'This market resolves to YES if Bitcoin (BTC) reaches or exceeds $100,000 USD on any major exchange (Coinbase, Binance, Kraken) before December 31, 2025, 23:59:59 UTC.',
        category: Category.CRYPTO,
        status: MarketStatus.OPEN,
        createdAt: new Date('2024-12-01'),
        resolutionDate: new Date('2025-12-31'),
        creator: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        totalLiquidity: 245000,
        yesPool: 147000,
        noPool: 98000,
        yesOdds: 60,
        noOdds: 40,
        outcome: Outcome.UNRESOLVED,
        resolutionSource: 'CoinGecko API',
        disputeWindow: 48,
        totalBets: 342,
        totalVolume: 245000,
    },
    {
        id: '2',
        slug: 'ethereum-merge-success',
        question: 'Will Ethereum maintain 99.9% uptime post-Dencun upgrade?',
        description: 'Resolves YES if Ethereum mainnet maintains 99.9% or higher uptime in the 30 days following the Dencun upgrade activation.',
        category: Category.CRYPTO,
        status: MarketStatus.OPEN,
        createdAt: new Date('2024-11-15'),
        resolutionDate: new Date('2025-03-15'),
        creator: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        totalLiquidity: 180000,
        yesPool: 126000,
        noPool: 54000,
        yesOdds: 70,
        noOdds: 30,
        outcome: Outcome.UNRESOLVED,
        resolutionSource: 'Etherscan',
        disputeWindow: 72,
        totalBets: 218,
        totalVolume: 180000,
    },
    {
        id: '3',
        slug: 'ai-beats-human-chess-2025',
        question: 'Will an AI defeat the world chess champion in a match?',
        description: 'This market resolves YES if any AI system defeats the reigning FIDE World Chess Champion in an official match of at least 6 games before December 31, 2025.',
        category: Category.TECH,
        status: MarketStatus.OPEN,
        createdAt: new Date('2024-10-20'),
        resolutionDate: new Date('2025-12-31'),
        creator: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
        totalLiquidity: 95000,
        yesPool: 28500,
        noPool: 66500,
        yesOdds: 30,
        noOdds: 70,
        outcome: Outcome.UNRESOLVED,
        resolutionSource: 'FIDE Official Records',
        disputeWindow: 48,
        totalBets: 156,
        totalVolume: 95000,
    },
    {
        id: '4',
        slug: 'super-bowl-chiefs-win',
        question: 'Will the Kansas City Chiefs win Super Bowl LIX?',
        description: 'Resolves YES if the Kansas City Chiefs win Super Bowl LIX in February 2025.',
        category: Category.SPORTS,
        status: MarketStatus.OPEN,
        createdAt: new Date('2024-12-15'),
        resolutionDate: new Date('2025-02-10'),
        creator: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        totalLiquidity: 320000,
        yesPool: 176000,
        noPool: 144000,
        yesOdds: 55,
        noOdds: 45,
        outcome: Outcome.UNRESOLVED,
        resolutionSource: 'NFL Official Results',
        disputeWindow: 24,
        totalBets: 487,
        totalVolume: 320000,
    },
    {
        id: '5',
        slug: 'us-election-2024-resolved',
        question: 'Was the 2024 US Presidential Election won by a Democrat?',
        description: 'This market has been resolved based on the official election results.',
        category: Category.POLITICS,
        status: MarketStatus.RESOLVED,
        createdAt: new Date('2024-01-01'),
        resolutionDate: new Date('2024-11-06'),
        creator: '0xdD870fA1b7C4700F2BD7f44238821C26f7392148',
        totalLiquidity: 1_200_000,
        yesPool: 480000,
        noPool: 720000,
        yesOdds: 40,
        noOdds: 60,
        outcome: Outcome.NO,
        resolutionSource: 'Associated Press',
        disputeWindow: 168,
        totalBets: 2341,
        totalVolume: 1_200_000,
    },
    {
        id: '6',
        slug: 'spacex-mars-mission-2026',
        question: 'Will SpaceX launch a crewed mission to Mars by 2026?',
        description: 'Resolves YES if SpaceX successfully launches a spacecraft with human crew destined for Mars orbit or landing before December 31, 2026.',
        category: Category.TECH,
        status: MarketStatus.OPEN,
        createdAt: new Date('2024-09-01'),
        resolutionDate: new Date('2026-12-31'),
        creator: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        totalLiquidity: 425000,
        yesPool: 127500,
        noPool: 297500,
        yesOdds: 30,
        noOdds: 70,
        outcome: Outcome.UNRESOLVED,
        resolutionSource: 'NASA & SpaceX Official Announcements',
        disputeWindow: 72,
        totalBets: 612,
        totalVolume: 425000,
    },
];

// Sample recent bets for activity feeds
export const mockRecentBets: Bet[] = [
    {
        id: 'bet-1',
        marketId: '1',
        user: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        amount: 5000,
        outcome: Outcome.YES,
        shares: 8333,
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    },
    {
        id: 'bet-2',
        marketId: '1',
        user: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        amount: 2500,
        outcome: Outcome.NO,
        shares: 6250,
        timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    },
    {
        id: 'bet-3',
        marketId: '1',
        user: '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
        amount: 10000,
        outcome: Outcome.YES,
        shares: 16667,
        timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
    },
];

// Helper functions
export function getMarketBySlug(slug: string): Market | undefined {
    return mockMarkets.find(market => market.slug === slug);
}

export function getMarketById(id: string): Market | undefined {
    return mockMarkets.find(market => market.id === id);
}

export function getActiveMarkets(): Market[] {
    return mockMarkets.filter(market => market.status === MarketStatus.OPEN);
}

export function getResolvedMarkets(): Market[] {
    return mockMarkets.filter(market => market.status === MarketStatus.RESOLVED);
}

export function getMarketsByCategory(category: Category): Market[] {
    return mockMarkets.filter(market => market.category === category);
}

export function getFeaturedMarkets(count: number = 4): Market[] {
    return getActiveMarkets().slice(0, count);
}
