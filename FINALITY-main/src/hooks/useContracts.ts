'use client';

import { useContractRead, useWriteContract, usePublicClient, useWalletClient, useEnsAddress, useAccount, useSwitchChain } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { CONTRACTS, PREDICTION_MARKET_ABI, ContractMarket, CreateMarketParams, DepositParams, WithdrawalParams, ClaimRedemptionParams } from '@/lib/contracts';
import { useCallback, useMemo } from 'react';

// Hoodi Testnet Chain ID
const HOODI_CHAIN_ID = 560048;

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
    chainId: HOODI_CHAIN_ID, // Explicitly set Hoodi Testnet
    query: {
      enabled: !!address,
    },
  });
}

// Hook for creating markets
export function useCreateMarket() {
  const { data: walletClient } = useWalletClient();
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const createMarket = useCallback(async (params: CreateMarketParams) => {
    if (!walletClient) throw new Error('Wallet not connected');
    if (!address) throw new Error('Contract address not resolved');

    // Check if user is on the correct network
    if (chain?.id !== HOODI_CHAIN_ID) {
      // Try to switch to Hoodi Testnet
      try {
        await switchChain({ chainId: HOODI_CHAIN_ID });
        throw new Error('Please switch to Hoodi Testnet. The network switch request has been sent to your wallet.');
      } catch (switchError: any) {
        if (switchError.message?.includes('switch')) {
          throw switchError;
        }
        throw new Error(`Wrong network! Please switch to Hoodi Testnet (Chain ID: ${HOODI_CHAIN_ID}) in your wallet. Current network: ${chain?.name || 'Unknown'} (Chain ID: ${chain?.id || 'Unknown'})`);
      }
    }

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
      chainId: HOODI_CHAIN_ID, // Explicitly set chain ID
    });
  }, [writeContractAsync, walletClient, chain, switchChain, address]);

  return {
    createMarket,
    isLoading: isPending,
    isSuccess,
    error,
    isWrongNetwork: chain?.id !== HOODI_CHAIN_ID,
  };
}

// depositing (trading)
export function useDeposit() {
  const { data: walletClient } = useWalletClient();
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending, isSuccess, error } = useWriteContract();
  const { address } = useSettlementAddress();

  const isWrongNetwork = useMemo(() => chain?.id !== HOODI_CHAIN_ID, [chain]);

  const deposit = useCallback(async (params: DepositParams) => {
    if (!walletClient) throw new Error('Wallet not connected');
    if (!address) throw new Error('Contract address not resolved');

    // Check if user is on the correct network
    if (isWrongNetwork) {
      // Try to switch to Hoodi Testnet
      try {
        await switchChain({ chainId: HOODI_CHAIN_ID });
        throw new Error('Please switch to Hoodi Testnet. The network switch request has been sent to your wallet.');
      } catch (switchError: any) {
        if (switchError.message?.includes('switch')) {
          throw switchError;
        }
        throw new Error(`Wrong network! Please switch to Hoodi Testnet (Chain ID: ${HOODI_CHAIN_ID}) in your wallet. Current network: ${chain?.name || 'Unknown'} (Chain ID: ${chain?.id || 'Unknown'})`);
      }
    }

    return writeContractAsync({
      address,
      abi: PREDICTION_MARKET_ABI,
      functionName: 'deposit',
      args: [params.marketId, params.isYes],
      value: params.amount,
      gas: 5000000n, // Increased gas limit for Mirror call
      chainId: HOODI_CHAIN_ID, // Explicitly set chain ID
    });
  }, [writeContractAsync, walletClient, address, chain, isWrongNetwork, switchChain]);

  return {
    deposit,
    isLoading: isPending,
    isSuccess,
    error,
    isWrongNetwork,
    switchChain: () => switchChain({ chainId: HOODI_CHAIN_ID }),
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
    chainId: HOODI_CHAIN_ID, // Explicitly set Hoodi Testnet
    query: {
      enabled: !!address,
    },
  });

  const owner = useContractRead({
    address,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'owner',
    chainId: HOODI_CHAIN_ID, // Explicitly set Hoodi Testnet
    query: {
      enabled: !!address,
    },
  });

  const marketEngineMirror = useContractRead({
    address,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'marketEngineMirror',
    chainId: HOODI_CHAIN_ID, // Explicitly set Hoodi Testnet
    query: {
      enabled: !!address,
    },
  });

  return {
    nextMarketId: nextMarketId.data,
    owner: owner.data,
    marketEngineMirror: marketEngineMirror.data,
  };
}