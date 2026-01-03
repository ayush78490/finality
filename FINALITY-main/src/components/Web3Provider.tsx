'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useEffect, useState } from 'react';

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setMounted(true);
        setIsClient(typeof window !== 'undefined');
    }, []);

    // Don't render anything until we're mounted and confirmed on client
    if (!mounted || !isClient) {
        return (
            <div style={{ visibility: 'hidden' }}>
                {children}
            </div>
        );
    }

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#ffffff',
                        accentColorForeground: 'black',
                        borderRadius: 'none',
                        fontStack: 'system',
                    })}
                    modalSize="compact"
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
