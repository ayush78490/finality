import { PredictionMarketSettlement__factory, OutcomeToken__factory } from '../../backend/ethereum/typechain-types';

// Contract ABIs
export const PREDICTION_MARKET_ABI = PredictionMarketSettlement__factory.abi;
export const OUTCOME_TOKEN_ABI = OutcomeToken__factory.abi;

// Contract addresses
export const CONTRACTS = {
  PREDICTION_MARKET: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS || '',
} as const;

// Market data structure matching smart contract
export interface ContractMarket {
  creator: `0x${string}`;
  question: string;
  category: string;
  endTime: bigint;
  status: number; // 0: Open, 1: Closed, 2: Resolved
  outcome: number; // 0: Undecided, 1: Yes, 2: No
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
  totalBacking: bigint;
  platformFees: bigint;
  creatorFees: bigint;
  varaStateHash: `0x${string}`;
}

// Transaction types
export interface CreateMarketParams {
  question: string;
  category: string;
  endTime: number;
  initialYes: bigint;
  initialNo: bigint;
}

export interface DepositParams {
  marketId: bigint;
  isYes: boolean;
  amount: bigint;
}

export interface WithdrawalParams {
  marketId: bigint;
  isYes: boolean;
  tokenAmount: bigint;
}

export interface ClaimRedemptionParams {
  marketId: bigint;
}