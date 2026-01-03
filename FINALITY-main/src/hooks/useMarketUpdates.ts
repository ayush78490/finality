'use client';

import { useEffect, useState } from 'react';
import { useMarket } from './useContracts';
import { contractMarketToMarket } from '@/lib/contractUtils';
import { Market } from '@/lib/types';

export function useMarketUpdates(marketId: string, pollInterval: number = 30000) {
    const [market, setMarket] = useState<Market | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const contractMarketId = BigInt(marketId);
    const { data: contractData, isLoading: contractLoading, error: contractError, refetch } = useMarket(contractMarketId);

    useEffect(() => {
        if (contractData) {
            try {
                const frontendMarket = contractMarketToMarket(contractData, marketId);
                setMarket(frontendMarket);
                setIsLoading(false);
                setError(null);
            } catch (err) {
                console.error('Error converting contract data:', err);
                setError('Failed to process market data');
                setIsLoading(false);
            }
        } else if (!contractLoading) {
            setIsLoading(false);
        }
    }, [contractData, contractLoading, marketId]);

    useEffect(() => {
        if (contractError) {
            setError(contractError.message || 'Failed to load market');
            setIsLoading(false);
        }
    }, [contractError]);

    // Poll for updates
    useEffect(() => {
        const interval = setInterval(() => {
            refetch();
        }, pollInterval);

        return () => clearInterval(interval);
    }, [refetch, pollInterval]);

    return {
        market,
        isLoading,
        error,
        refetch,
    };
}