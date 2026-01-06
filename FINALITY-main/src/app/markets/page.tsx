'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarketFilters from '@/components/markets/MarketFilters';
import MarketCard from '@/components/markets/MarketCard';
import ParticlesBackground from '@/components/ParticlesBackground';
import { useAllMarkets } from '@/hooks/useMarkets';
import Button from '@/components/ui/Button';

// Force dynamic rendering to avoid SSR issues with wagmi
export const dynamic = 'force-dynamic';

export default function MarketsPage() {
    const { markets, isLoading, error } = useAllMarkets();
    const { chain } = useAccount();
    const [refreshKey, setRefreshKey] = useState(0);
    
    const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
        window.location.reload();
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 40 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                ease: [0.25, 0.1, 0.25, 1] as const,
            },
        },
    };

    return (
        <>
            <Header />
            <main className="relative min-h-screen py-16 md:py-24 overflow-hidden">
                <ParticlesBackground />

                <div className="container max-w-7xl mx-auto px-6 relative z-10">
                    <motion.div
                        className="mb-12"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className="text-5xl md:text-6xl font-bold mb-4">Markets</h1>
                        <p className="text-lg md:text-xl text-text-secondary max-w-3xl m-0">
                            Explore all prediction markets and find opportunities to trade on your beliefs.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="flex justify-between items-center gap-4"
                    >
                        <MarketFilters />
                        <Button
                            onClick={handleRefresh}
                            variant="secondary"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Loading...' : '🔄 Refresh'}
                        </Button>
                    </motion.div>
                    
                    {/* Network Warning */}
                    {chain && chain.id !== 560048 && (
                        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded">
                            <p className="text-yellow-400 text-sm">
                                ⚠️ Wrong Network: You're on {chain.name} (Chain ID: {chain.id})
                            </p>
                            <p className="text-yellow-300 text-xs mt-1">
                                Please switch to Hoodi Testnet (Chain ID: 560048) to see markets
                            </p>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="text-center">
                                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                                <p className="mt-4 text-text-secondary">Loading markets...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="text-center">
                                <p className="text-red-500">Error loading markets</p>
                                <p className="text-sm text-text-tertiary mt-2">{error.message}</p>
                            </div>
                        </div>
                    ) : markets.length === 0 ? (
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="text-center">
                                <p className="text-text-secondary text-lg">No markets found</p>
                                <p className="text-sm text-text-tertiary mt-2">Be the first to create a market!</p>
                                
                                {/* Debug Info */}
                                <div className="mt-4 p-4 bg-gray-500/10 border border-gray-500/20 rounded text-left max-w-md mx-auto">
                                    <p className="text-gray-300 text-xs mb-2">Debug Info:</p>
                                    <p className="text-gray-400 text-xs">Network: {chain?.name || 'Not connected'} (Chain ID: {chain?.id || 'N/A'})</p>
                                    <p className="text-gray-400 text-xs">Contract: {process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS || 'Not configured'}</p>
                                    <p className="text-gray-400 text-xs">Required: Hoodi Testnet (560048)</p>
                                </div>
                                
                                {error && (
                                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded">
                                        <p className="text-red-400 text-sm">Error loading markets</p>
                                        <p className="text-red-300 text-xs mt-2">
                                            Make sure you're connected to Hoodi Testnet (Chain ID: 560048)
                                        </p>
                                        <p className="text-red-200 text-xs mt-1">
                                            Check browser console for details
                                        </p>
                                    </div>
                                )}
                                
                                <Button
                                    onClick={handleRefresh}
                                    variant="primary"
                                    className="mt-4"
                                >
                                    🔄 Refresh Markets
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <motion.div
                            className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12"
                            variants={containerVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: false, amount: 0.1 }}
                        >
                            {markets.map((market) => (
                                <motion.div key={market.id} variants={cardVariants}>
                                    <MarketCard market={market} />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
}
