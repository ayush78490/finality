import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    sepolia,
} from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Finality',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-walletconnect-project-id-for-development',
    chains: [
        sepolia,
        mainnet,
        polygon,
        optimism,
        arbitrum,
        base,
    ],
    ssr: false, // Disable SSR to prevent localStorage errors
});
