import { useEffect, useState } from 'react';
import { GearApi } from '@gear-js/api';

// Vara Program Configuration
const VARA_PROGRAM_ID = process.env.NEXT_PUBLIC_VARA_PROGRAM_ID || '0x0097e078e6e666d5be98c4839ee4d83c6c3e34a9e508bc84e10bee65ead06ba1';
const VARA_NODE_URL = process.env.NEXT_PUBLIC_VARA_NODE_URL || 'wss://testnet.vara.network';

interface VaraMarketState {
    marketId: number;
    yesPool: bigint;
    noPool: bigint;
    totalOrders: number;
    stateHash: string;
}

interface VaraMultipliers {
    marketId: number;
    yesMultiplier: number;
    noMultiplier: number;
    yesPrice: number;
    noPrice: number;
}

/**
 * Hook to fetch real-time market state from Vara program
 * This queries the Vara smart contract for actual pool sizes and odds
 */
export function useVaraMarketState(marketId: number) {
    const [state, setState] = useState<VaraMarketState | null>(null);
    const [multipliers, setMultipliers] = useState<VaraMultipliers | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let isMounted = true;
        let api: GearApi | null = null;

        async function fetchVaraState() {
            try {
                setIsLoading(true);

                // Connect to Vara network
                api = await GearApi.create({ providerAddress: VARA_NODE_URL });

                // Query market state
                const statePayload = {
                    GetMarketState: { market_id: marketId }
                };

                const stateResult = await api.programState.read({
                    programId: VARA_PROGRAM_ID as `0x${string}`,
                    payload: statePayload
                });

                // Query multipliers (for odds calculation)
                const multipliersPayload = {
                    GetMultipliers: { market_id: marketId }
                };

                const multipliersResult = await api.programState.read({
                    programId: VARA_PROGRAM_ID as `0x${string}`,
                    payload: multipliersPayload
                });

                if (isMounted) {
                    // Parse state result
                    if (stateResult && typeof stateResult === 'object' && 'MarketState' in stateResult) {
                        const marketState = (stateResult as any).MarketState;
                        setState({
                            marketId: Number(marketState.market_id),
                            yesPool: BigInt(marketState.yes_pool),
                            noPool: BigInt(marketState.no_pool),
                            totalOrders: Number(marketState.total_orders),
                            stateHash: marketState.state_hash,
                        });
                    }

                    // Parse multipliers result
                    if (multipliersResult && typeof multipliersResult === 'object' && 'Multipliers' in multipliersResult) {
                        const mults = (multipliersResult as any).Multipliers;
                        setMultipliers({
                            marketId: Number(mults.market_id),
                            yesMultiplier: Number(mults.yes_multiplier),
                            noMultiplier: Number(mults.no_multiplier),
                            yesPrice: Number(mults.yes_price),
                            noPrice: Number(mults.no_price),
                        });
                    }

                    setError(null);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Vara query error:', err);
                if (isMounted) {
                    setError(err as Error);
                    setIsLoading(false);
                }
            }
        }

        fetchVaraState();

        return () => {
            isMounted = false;
            if (api) {
                api.disconnect().catch(console.error);
            }
        };
    }, [marketId]);

    return { state, multipliers, isLoading, error };
}

/**
 * Calculate odds from Vara pool sizes
 */
export function calculateOddsFromVara(yesPool: bigint, noPool: bigint) {
    const totalPool = yesPool + noPool;
    if (totalPool === 0n) {
        return { yesOdds: 50, noOdds: 50 };
    }

    const yesOdds = Math.round(Number((yesPool * 10000n) / totalPool) / 100);
    const noOdds = 100 - yesOdds;

    return { yesOdds, noOdds };
}

/**
 * Format Vara price to percentage (price is in basis points, 10000 = 100%)
 */
export function formatVaraPrice(price: number): number {
    return Math.round(price / 100); // Convert from basis points to percentage
}
