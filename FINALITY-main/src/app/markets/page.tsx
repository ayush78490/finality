'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarketFilters from '@/components/markets/MarketFilters';
import MarketCard from '@/components/markets/MarketCard';
import ParticlesBackground from '@/components/ParticlesBackground';
import { useAllMarkets } from '@/hooks/useMarkets';

// Force dynamic rendering to avoid SSR issues with wagmi
export const dynamic = 'force-dynamic';

export default function MarketsPage() {
    const { markets, isLoading, error } = useAllMarkets();

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
                    >
                        <MarketFilters />
                    </motion.div>

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
