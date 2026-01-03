import { useReadContracts } from 'wagmi';
import { formatEther } from 'viem';

const ERC20_ABI = [
    {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

/**
 * Hook to fetch real-time odds by querying YES/NO token supplies
 * This gives us the actual market odds based on minted tokens
 * Auto-refreshes every 4 seconds for real-time updates
 */
export function useTokenSupplyOdds(yesTokenAddress: `0x${string}`, noTokenAddress: `0x${string}`) {
    const { data, isLoading, error, refetch } = useReadContracts({
        contracts: [
            {
                address: yesTokenAddress,
                abi: ERC20_ABI,
                functionName: 'totalSupply',
            },
            {
                address: noTokenAddress,
                abi: ERC20_ABI,
                functionName: 'totalSupply',
            },
        ],
        query: {
            refetchInterval: 4000, // Refetch every 4 seconds for real-time updates
        },
    });

    if (isLoading || !data || data[0].status !== 'success' || data[1].status !== 'success') {
        return {
            yesSupply: null,
            noSupply: null,
            yesOdds: null,
            noOdds: null,
            isLoading,
            error,
        };
    }

    const yesSupply = data[0].result;
    const noSupply = data[1].result;

    const totalSupply = yesSupply + noSupply;

    if (totalSupply === 0n) {
        return {
            yesSupply: 0,
            noSupply: 0,
            yesOdds: 50,
            noOdds: 50,
            isLoading: false,
            error: null,
        };
    }

    // Calculate odds as percentages
    const yesOdds = Math.round(Number((yesSupply * 10000n) / totalSupply) / 100);
    const noOdds = 100 - yesOdds;

    return {
        yesSupply: Number(formatEther(yesSupply)),
        noSupply: Number(formatEther(noSupply)),
        yesOdds,
        noOdds,
        isLoading: false,
        error: null,
    };
}
