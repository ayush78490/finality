import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { formatEther, parseAbiItem } from 'viem';
import { CONTRACTS } from '@/lib/contracts';
import { useSettlementAddress } from './useContracts';

export interface TradeActivity {
    id: string;
    marketId: number;
    user: string;
    isYes: boolean;
    amount: number; // in ETH
    timestamp: Date;
    txHash: string;
    blockNumber: number;
}

/**
 * Hook to fetch recent trading activity for a market
 * Queries DepositMade events from the blockchain
 */
export function useMarketActivity(marketId: number | string, limit: number = 10) {
    const [activities, setActivities] = useState<TradeActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const publicClient = usePublicClient();
    const { address } = useSettlementAddress();

    useEffect(() => {
        if (!publicClient || !address) return;

        async function fetchActivity() {
            try {
                setIsLoading(true);

                // Guard against undefined publicClient
                if (!publicClient) {
                    setIsLoading(false);
                    return;
                }

                // Get current block
                const currentBlock = await publicClient.getBlockNumber();

                // Query last 1000 blocks to stay within RPC limits (roughly 3-4 hours on Ethereum)
                const fromBlock = currentBlock - 1000n > 0n ? currentBlock - 1000n : 0n;

                // Query DepositMade events for this market
                const logs = await publicClient.getLogs({
                    address,
                    event: parseAbiItem('event DepositMade(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 timestamp)'),
                    args: {
                        marketId: BigInt(marketId),
                    },
                    fromBlock,
                    toBlock: currentBlock,
                });

                console.log(`Found ${logs.length} activities for market ${marketId}`);

                // Parse logs into activities
                const parsedActivities: TradeActivity[] = await Promise.all(
                    logs.map(async (log) => {
                        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

                        return {
                            id: `${log.transactionHash}-${log.logIndex}`,
                            marketId: Number(log.args.marketId),
                            user: log.args.user as string,
                            isYes: log.args.isYes as boolean,
                            amount: Number(formatEther(log.args.amount as bigint)),
                            timestamp: new Date(Number(block.timestamp) * 1000),
                            txHash: log.transactionHash,
                            blockNumber: Number(log.blockNumber),
                        };
                    })
                );

                // Sort by timestamp descending and limit
                const sortedActivities = parsedActivities
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .slice(0, limit);

                setActivities(sortedActivities);
                setError(null);
            } catch (err) {
                console.error('Error fetching market activity:', err);
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchActivity();

        // Refresh every 12 seconds (Ethereum block time)
        const interval = setInterval(fetchActivity, 12000);

        return () => clearInterval(interval);
    }, [publicClient, marketId, limit]);

    return { activities, isLoading, error };
}
