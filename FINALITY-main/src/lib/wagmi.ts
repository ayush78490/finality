import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    sepolia,
} from 'wagmi/chains';
import { defineChain } from 'viem';

// Hoodi Testnet configuration
const hoodi = defineChain({
    id: 560048,
    name: 'Hoodi Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: {
            http: ['https://hoodi-reth-rpc.gear-tech.io'],
            webSocket: ['wss://hoodi-reth-rpc.gear-tech.io/ws'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Hoodi Explorer',
            url: 'https://explorer.hoodi.io',
        },
    },
    testnet: true,
});

export const config = getDefaultConfig({
    appName: 'Finality',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-walletconnect-project-id-for-development',
    chains: [
        hoodi, // Hoodi testnet (primary)
        sepolia,
        mainnet,
        polygon,
        optimism,
        arbitrum,
        base,
    ],
    ssr: false, // Disable SSR to prevent localStorage errors
});
