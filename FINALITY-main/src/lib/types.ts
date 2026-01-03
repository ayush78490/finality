// TypeScript interfaces and types for Finality

export enum MarketStatus {
    OPEN = "OPEN",
    CLOSED = "CLOSED",
    RESOLVED = "RESOLVED",
}

export enum Category {
    CRYPTO = "Crypto",
    SPORTS = "Sports",
    POLITICS = "Politics",
    TECH = "Tech",
    ENTERTAINMENT = "Entertainment",
    OTHER = "Other",
}

export enum Outcome {
    YES = "YES",
    NO = "NO",
    UNRESOLVED = "UNRESOLVED",
}

export interface Market {
    id: string;
    slug: string;
    question: string;
    description: string;
    category: Category;
    status: MarketStatus;
    createdAt: Date;
    resolutionDate: Date;
    creator: string;

    // Token addresses
    yesToken?: string;
    noToken?: string;

    // Pool & Odds
    totalLiquidity: number;
    yesPool: number;
    noPool: number;
    yesOdds: number; // Percentage
    noOdds: number;  // Percentage

    // Resolution
    outcome: Outcome;
    resolutionSource?: string;
    disputeWindow?: number; // hours

    // Stats
    totalBets: number;
    totalVolume: number;
}

export interface Bet {
    id: string;
    marketId: string;
    user: string;
    amount: number;
    outcome: Outcome;
    shares: number;
    timestamp: Date;
    txHash?: string;
}

export interface User {
    address: string;
    totalBets: number;
    totalVolume: number;
    winRate: number;
}

export interface PlatformStats {
    totalVolume: number;
    activeMarkets: number;
    totalTraders: number;
    marketsResolved: number;
}
