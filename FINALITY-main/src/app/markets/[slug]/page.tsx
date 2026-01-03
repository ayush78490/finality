'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { notFound, useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MarketHeader from '@/components/market/MarketHeader';
import OddsPanel from '@/components/market/OddsPanel';
import BettingPanel from '@/components/market/BettingPanel';
import MarketDetails from '@/components/market/MarketDetails';
import ClaimWinnings from '@/components/market/ClaimWinnings';
import WithdrawTokens from '@/components/market/WithdrawTokens';
import ActivityFeed from '@/components/market/ActivityFeed';
import MarketChart from '@/components/market/MarketChart';
import VolumeChart from '@/components/market/VolumeChart';
import ParticlesBackground from '@/components/ParticlesBackground';
import { useAllMarkets } from '@/hooks/useMarkets';

// Force dynamic rendering to avoid SSR issues with wagmi
export const dynamic = 'force-dynamic';

export default function MarketDetailPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const { markets, isLoading } = useAllMarkets();

    // Find market by slug
    const market = useMemo(() => {
        return markets.find(m => m.slug === slug);
    }, [markets, slug]);

    if (isLoading) {
        return (
            <>
                <Header />
                <main className="relative min-h-screen py-16 md:py-24 overflow-hidden">
                    <ParticlesBackground />
                    <div className="container max-w-7xl mx-auto px-6 relative z-10">
                        <div className="flex items-center justify-center min-h-[400px]">
                            <div className="text-center">
                                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                                <p className="mt-4 text-text-secondary">Loading market...</p>
                            </div>
                        </div>
                    </div>
                </main>
                <Footer />
            </>
        );
    }

    if (!market) {
        notFound();
    }

    return (
        <>
            <Header />
            <main className="relative min-h-screen py-16 md:py-24 overflow-hidden">
                <ParticlesBackground />

                <div className="container max-w-7xl mx-auto px-6 relative z-10">
                    <MarketHeader market={market} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                        {/* Left Column - Odds, Charts & Betting */}
                        <div className="lg:col-span-2 space-y-8">
                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, amount: 0.3 }}
                                transition={{ duration: 0.6 }}
                            >
                                <OddsPanel market={market} />
                            </motion.div>

                            {/* Charts Section */}
                            <MarketChart marketSlug={market.slug} />
                            <VolumeChart marketSlug={market.slug} />

                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, amount: 0.3 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                            >
                                <BettingPanel market={market} />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, amount: 0.3 }}
                                transition={{ duration: 0.6, delay: 0.15 }}
                            >
                                <WithdrawTokens market={market} />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, amount: 0.3 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                <ClaimWinnings market={market} />
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: false, amount: 0.3 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                <MarketDetails market={market} />
                            </motion.div>
                        </div>

                        {/* Right Column - Activity Feed */}
                        <motion.div
                            className="lg:col-span-1"
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: false, amount: 0.3 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <ActivityFeed marketId={market.id} />
                        </motion.div>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
