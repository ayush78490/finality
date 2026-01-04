'use client';

import { useContractRead, useWriteContract, usePublicClient, useWalletClient, useEnsAddress } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { CONTRACTS, PREDICTION_MARKET_ABI, ContractMarket, CreateMarketParams, DepositParams, WithdrawalParams, ClaimRedemptionParams } from '@/lib/contracts';
import { useCallback, useMemo } from 'react';

// Hook to resolve the settlement address (handles ENS)
export function useSettlementAddress() {
  if (!CONTRACTS.PREDICTION_MARKET || CONTRACTS.PREDICTION_MARKET.trim() === '') {
    throw new Error('NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS environment variable is not set. Please set it in your .env file.');
  }
  const isEns = CONTRACTS.PREDICTION_MARKET.endsWith('.eth');

  const { data: ensAddress, isLoading: isEnsLoading } = useEnsAddress({
    name: isEns ? CONTRACTS.PREDICTION_MARKET : undefined,
    chainId: mainnet.id, // Usually resolve on mainnet, or use current chain if Sepolia has it
  });

  const address = useMemo(() => {
    if (!isEns) return CONTRACTS.PREDICTION_MARKET as `0x${string}`;
    return ensAddress as `0x${string}` | undefined;
  }, [isEns, ensAddress]);

  return {
    address,
    isLoading: isEnsLoading && isEns,
  };
}

// Hook for reading market data
export function useMarket(marketId: bigint) {
  const { address } = useSettlementAddress();

  return useContractRead({
    address,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'markets',
    args: [marketId],
    query: {
      enabled: !!address,
    },
  });
}

// Hook for creating markets
export function useCreateMarket() {
  const { data: walletClient } = useWalletClient();

  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const createMarket = useCallback(async (params: CreateMarketParams) => {
    if (!walletClient) throw new Error('Wallet not connected');
    if (!address) throw new Error('Contract address not resolved');

    const value = (params.initialYes + params.initialNo);

    return writeContractAsync({
      address,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'createMarket',
      args: [
        params.question,
        params.category,
        BigInt(params.endTime),
        params.initialYes,
        params.initialNo,
      ],
      value,
      gas: 5000000n, // Set reasonable gas limit to avoid exceeding network cap
    });
  }, [writeContractAsync, walletClient]);

  return {
    createMarket,
    isLoading: isPending,
    isSuccess,
    error,
  };
}

// depositing (trading)
export function useDeposit() {
  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const deposit = useCallback(async (params: DepositParams) => {
    if (!address) throw new Error('Contract address not resolved');

    return writeContractAsync({
      address,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'deposit',
      args: [params.marketId, params.isYes],
      value: params.amount,
      gas: 3000000n,
    });
  }, [writeContractAsync, address]);

  return {
    deposit,
    isLoading: isPending,
    isSuccess,
    error,
  };
}

// requesting withdrawal
export function useRequestWithdrawal() {
  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const requestWithdrawal = useCallback(async (params: WithdrawalParams) => {
    if (!address) throw new Error('Contract address not resolved');

    return writeContractAsync({
      address,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'requestWithdrawal',
      args: [params.marketId, params.isYes, params.tokenAmount],
      gas: 2000000n,
    });
  }, [writeContractAsync, address]);

  return {
    requestWithdrawal,
    isLoading: isPending,
    isSuccess,
    error,
  };
}

// claiming winnings
export function useClaimRedemption() {
  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const claimRedemption = useCallback(async (params: ClaimRedemptionParams) => {
    if (!address) throw new Error('Contract address not resolved');

    return writeContractAsync({
      address,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'claimRedemption',
      args: [params.marketId],
      gas: 2000000n,
    });
  }, [writeContractAsync, address]);

  return {
    claimRedemption,
    isLoading: isPending,
    isSuccess,
    error,
  };
}

// platform fees
export function useWithdrawPlatformFees() {
  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const withdrawFees = useCallback(async (marketId: bigint) => {
    if (!address) throw new Error('Contract address not resolved');

    return writeContractAsync({
      address,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'withdrawPlatformFees',
      args: [marketId],
      gas: 1500000n,
    });
  }, [writeContractAsync, address]);

  return {
    withdrawFees,
    isLoading: isPending,
    isSuccess,
    error,
  };
}

// Hook for getting contract info
export function useContractInfo() {
  const { address } = useSettlementAddress();

  const nextMarketId = useContractRead({
    address,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'nextMarketId',
    query: {
      enabled: !!address,
    },
  });

  const owner = useContractRead({
    address,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'owner',
    query: {
      enabled: !!address,
    },
  });

  const relayer = useContractRead({
    address,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'relayer',
    query: {
      enabled: !!address,
    },
  });

  return {
    nextMarketId: nextMarketId.data,
    owner: owner.data,
    relayer: relayer.data,
  };
}