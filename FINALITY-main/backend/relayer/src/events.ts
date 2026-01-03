export interface MarketCreatedEvent {
    marketId: bigint;
    creator: string;
    question: string;
    category: string;
    yesToken: string;
    noToken: string;
    endTime: bigint;
    initialYes: bigint;
    initialNo: bigint;
}

export interface DepositMadeEvent {
    marketId: bigint;
    user: string;
    isYes: boolean;
    amount: bigint;
    timestamp: bigint;
}

export interface WithdrawalRequestedEvent {
    marketId: bigint;
    user: string;
    isYes: boolean;
    tokenAmount: bigint;
    timestamp: bigint;
}

export interface TradeFinalizedEvent {
    marketId: bigint;
    user: string;
    isYes: boolean;
    amountIn: bigint;
    tokensOut: bigint;
    varaStateHash: string;
}

export interface MarketResolvedEvent {
    marketId: bigint;
    outcome: number;
    finalStateHash: string;
}

export interface RedemptionClaimedEvent {
    marketId: bigint;
    user: string;
    amount: bigint;
}

// Vara message types
export interface VaraInitializeMarket {
    marketId: string;
    initialYes: string;
    initialNo: string;
    ethereumBlock: string;
}

export interface VaraExecuteTrade {
    marketId: string;
    user: string;
    isYes: boolean;
    amount: string;
}

export interface VaraCalculateWithdrawal {
    marketId: string;
    user: string;
    isYes: boolean;
    tokenAmount: string;
}

export interface VaraTradeResult {
    marketId: string;
    user: string;
    isYes: boolean;
    amountIn: string;
    tokensOut: string;
    creatorFee: string;
    platformFee: string;
    newYesPool: string;
    newNoPool: string;
    stateHash: string;
}

export interface VaraWithdrawalResult {
    marketId: string;
    user: string;
    ethOut: string;
    creatorFee: string;
    platformFee: string;
    stateHash: string;
}

export interface VaraMarketState {
    marketId: string;
    yesPool: string;
    noPool: string;
    totalOrders: string;
    stateHash: string;
}

export interface VaraMultipliers {
    marketId: string;
    yesMultiplier: string;
    noMultiplier: string;
    yesPrice: string;
    noPrice: string;
}
