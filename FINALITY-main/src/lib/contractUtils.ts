import { ContractMarket } from './contracts';
import { Market, MarketStatus, Outcome } from './types';

// Convert contract market data to frontend market data
export function contractMarketToMarket(contractMarket: any, id: string): Market {
  // Handle both object and array formats
  const data = Array.isArray(contractMarket) ? {
    creator: contractMarket[0],
    question: contractMarket[1],
    category: contractMarket[2],
    endTime: contractMarket[3],
    status: contractMarket[4],
    outcome: contractMarket[5],
    yesToken: contractMarket[6],
    noToken: contractMarket[7],
    totalBacking: contractMarket[8],
    platformFees: contractMarket[9],
    creatorFees: contractMarket[10],
    varaStateHash: contractMarket[11],
  } : contractMarket;
  return {
    id,
    slug: generateSlug(contractMarket.question, id),
    question: contractMarket.question,
    description: contractMarket.question, // Could be enhanced with more metadata
    category: contractMarket.category as any, // Assuming category matches our enum
    status: contractStatusToStatus(contractMarket.status),
    createdAt: new Date(0), // Not available in contract, could be estimated
    resolutionDate: new Date(Number(contractMarket.endTime) * 1000),
    creator: contractMarket.creator,
    totalLiquidity: Number(contractMarket.totalBacking),
    yesPool: Number(contractMarket.totalBacking) * 0.5, // Approximate, real calculation would be complex
    noPool: Number(contractMarket.totalBacking) * 0.5,  // Approximate
    yesOdds: 50, // Would need real calculation from AMM
    noOdds: 50,  // Would need real calculation from AMM
    outcome: contractOutcomeToOutcome(contractMarket.outcome),
    resolutionSource: 'Smart Contract',
    totalBets: 0, // Not available in contract
    totalVolume: Number(contractMarket.totalBacking),
  };
}

// Helper functions
function contractStatusToStatus(status: number): MarketStatus {
  switch (status) {
    case 0: return MarketStatus.OPEN;
    case 1: return MarketStatus.CLOSED;
    case 2: return MarketStatus.RESOLVED;
    default: return MarketStatus.OPEN;
  }
}

function contractOutcomeToOutcome(outcome: number): Outcome {
  switch (outcome) {
    case 0: return Outcome.UNRESOLVED;
    case 1: return Outcome.YES;
    case 2: return Outcome.NO;
    default: return Outcome.UNRESOLVED;
  }
}

function generateSlug(question: string, id: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) + '-' + id;
}

// Calculate payout based on odds (simplified)
export function calculateContractPayout(amount: number, odds: number): number {
  // For binary markets, payout = amount * (100 / odds)
  return amount * (100 / odds);
}

// Format contract values for display
export function formatContractValue(value: bigint, decimals: number = 18): string {
  const formatted = Number(value) / Math.pow(10, decimals);
  return formatted.toFixed(4);
}

// Parse user input to contract format
export function parseContractValue(value: string, decimals: number = 18): bigint {
  const num = parseFloat(value);
  return BigInt(Math.floor(num * Math.pow(10, decimals)));
}