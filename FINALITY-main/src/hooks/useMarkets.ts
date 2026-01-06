'use client';

import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, PREDICTION_MARKET_ABI, ContractMarket } from '@/lib/contracts';
import { useMemo } from 'react';
import { Market, MarketStatus, Category, Outcome } from '@/lib/types';
import { formatEther } from 'viem';
import { useSettlementAddress } from './useContracts';

// Hook to get the total number of markets
export function useMarketCount() {
    const { address } = useSettlementAddress();
    const { data, isLoading, error } = useReadContract({
        address,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'nextMarketId',
        chainId: 560048, // Explicitly set Hoodi Testnet
        query: {
            enabled: !!address,
            retry: 3,
        },
    });

    // Debug logging
    if (error) {
        console.error('Error fetching market count:', error);
        console.error('Contract address:', address);
        console.error('Chain ID: 560048');
    }

    return {
        count: data ? Number(data) : 0,
        isLoading: isLoading || !address,
        error,
    };
}

// Hook to fetch all markets from the contract
export function useAllMarkets() {
    const { count, isLoading: countLoading } = useMarketCount();

    const { address } = useSettlementAddress();

    // Create an array of contract calls to fetch all markets
    const contracts = useMemo(() => {
        if (count === 0 || !address) return [];

        return Array.from({ length: count }, (_, i) => ({
            address,
            abi: PREDICTION_MARKET_ABI,
            functionName: 'markets',
            args: [BigInt(i)],
            chainId: 560048, // Explicitly set Hoodi Testnet
        }));
    }, [count, address]);

    const { data: marketsData, isLoading: marketsLoading, error } = useReadContracts({
        contracts,
    });

    // Debug logging
    if (error) {
        console.error('Error fetching markets:', error);
        console.error('Contract address:', address);
        console.error('Market count:', count);
    }
    if (marketsData) {
        console.log('Markets data received:', marketsData.length, 'results');
        console.log('Success count:', marketsData.filter(r => r.status === 'success').length);
    }

    // Transform contract data to Market type
    const markets = useMemo(() => {
        if (!marketsData) return [];

        return marketsData
            .map((result, index) => {
                if (result.status !== 'success' || !result.result) return null;

                // Contract returns a tuple, destructure it
                const [
                    creator,
                    question,
                    category,
                    endTime,
                    status,
                    outcome,
                    yesToken,
                    noToken,
                    totalBacking,
                    platformFees,
                    creatorFees,
                    lastStateHash, // Changed from varaStateHash to lastStateHash
                ] = result.result as unknown as readonly [
                    `0x${string}`,
                    string,
                    string,
                    bigint,
                    number,
                    number,
                    `0x${string}`,
                    `0x${string}`,
                    bigint,
                    bigint,
                    bigint,
                    `0x${string}`
                ];

                // For now, use simplified calculation
                // TODO: Fetch actual token supplies for accurate odds
                // The contract stores totalBacking but we need to query YES/NO token totalSupply
                const totalLiquidity = Number(formatEther(totalBacking));

                // Simplified: assume equal distribution for initial display
                // Real odds would require fetching yesToken.totalSupply() and noToken.totalSupply()
                const yesPool = totalLiquidity / 2;
                const noPool = totalLiquidity / 2;
                const totalPool = yesPool + noPool;

                // Calculate odds as percentages
                const yesOdds = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
                const noOdds = 100 - yesOdds;

                // Map contract status to MarketStatus enum
                const statusMap: Record<number, MarketStatus> = {
                    0: MarketStatus.OPEN,
                    1: MarketStatus.CLOSED,
                    2: MarketStatus.RESOLVED,
                };

                // Map contract outcome to Outcome enum
                const outcomeMap: Record<number, Outcome> = {
                    0: Outcome.UNRESOLVED,
                    1: Outcome.YES,
                    2: Outcome.NO,
                };

                // Generate slug from question
                const slug = question
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .substring(0, 60);

                const market: Market = {
                    id: index.toString(),
                    slug: `${slug}-${index}`,
                    question: question,
                    description: `Market created on-chain. Resolution time: ${new Date(Number(endTime) * 1000).toLocaleString()}`,
                    category: category as Category || Category.OTHER,
                    status: statusMap[status] || MarketStatus.OPEN,
                    createdAt: new Date(), // We don't have this from contract
                    resolutionDate: new Date(Number(endTime) * 1000),
                    creator: creator,
                    yesToken: yesToken,
                    noToken: noToken,
                    totalLiquidity,
                    yesPool,
                    noPool,
                    yesOdds,
                    noOdds,
                    outcome: outcomeMap[outcome] || Outcome.UNRESOLVED,
                    totalBets: 0, // We don't track this on-chain currently
                    totalVolume: totalLiquidity,
                };

                return market;
            })
            .filter((market): market is Market => market !== null);
    }, [marketsData]);

    return {
        markets,
        isLoading: countLoading || marketsLoading,
        error,
    };
}

// Hook to get a single market by ID
export function useMarket(marketId: number) {
    const { address } = useSettlementAddress();
    const { data, isLoading, error } = useReadContract({
        address,
        abi: PREDICTION_MARKET_ABI,
        functionName: 'markets',
        args: [BigInt(marketId)],
        chainId: 560048, // Explicitly set Hoodi Testnet
        query: {
            enabled: !!address,
        },
    });

    const market = useMemo(() => {
        if (!data) return null;

        // Contract returns a tuple, destructure it
        const [
            creator,
            question,
            category,
            endTime,
            status,
            outcome,
            yesToken,
            noToken,
            totalBacking,
            platformFees,
            creatorFees,
            lastStateHash, // Changed from varaStateHash to lastStateHash
        ] = data as unknown as readonly [
            `0x${string}`,
            string,
            string,
            bigint,
            number,
            number,
            `0x${string}`,
            `0x${string}`,
            bigint,
            bigint,
            bigint,
            `0x${string}`
        ];

        const yesPool = Number(formatEther(totalBacking)) / 2;
        const noPool = Number(formatEther(totalBacking)) / 2;
        const totalPool = yesPool + noPool;

        const yesOdds = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
        const noOdds = 100 - yesOdds;

        const statusMap: Record<number, MarketStatus> = {
            0: MarketStatus.OPEN,
            1: MarketStatus.CLOSED,
            2: MarketStatus.RESOLVED,
        };

        const outcomeMap: Record<number, Outcome> = {
            0: Outcome.UNRESOLVED,
            1: Outcome.YES,
            2: Outcome.NO,
        };

        const slug = question
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 60);

        const market: Market = {
            id: marketId.toString(),
            slug: `${slug}-${marketId}`,
            question: question,
            description: `Market created on-chain. Resolution time: ${new Date(Number(endTime) * 1000).toLocaleString()}`,
            category: category as Category || Category.OTHER,
            status: statusMap[status] || MarketStatus.OPEN,
            createdAt: new Date(),
            resolutionDate: new Date(Number(endTime) * 1000),
            creator: creator,
            totalLiquidity: Number(formatEther(totalBacking)),
            yesPool,
            noPool,
            yesOdds,
            noOdds,
            outcome: outcomeMap[outcome] || Outcome.UNRESOLVED,
            totalBets: 0,
            totalVolume: Number(formatEther(totalBacking)),
        };

        return market;
    }, [data, marketId]);

    return {
        market,
        isLoading,
        error,
    };
}

// Helper hooks for filtered markets
export function useActiveMarkets() {
    const { markets, isLoading, error } = useAllMarkets();

    const activeMarkets = useMemo(() => {
        return markets.filter(market => market.status === MarketStatus.OPEN);
    }, [markets]);

    return { markets: activeMarkets, isLoading, error };
}

export function useResolvedMarkets() {
    const { markets, isLoading, error } = useAllMarkets();

    const resolvedMarkets = useMemo(() => {
        return markets.filter(market => market.status === MarketStatus.RESOLVED);
    }, [markets]);

    return { markets: resolvedMarkets, isLoading, error };
}

export function useMarketsByCategory(category: Category) {
    const { markets, isLoading, error } = useAllMarkets();

    const categoryMarkets = useMemo(() => {
        return markets.filter(market => market.category === category);
    }, [markets, category]);

    return { markets: categoryMarkets, isLoading, error };
}
