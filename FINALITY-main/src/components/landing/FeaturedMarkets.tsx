'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useActiveMarkets } from '@/hooks/useMarkets';
import { getTimeRemaining, formatCompactNumber } from '@/lib/utils';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

export default function FeaturedMarkets() {
    const { markets: allMarkets, isLoading } = useActiveMarkets();
    const markets = allMarkets.slice(0, 4); // Get first 4 active markets

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 60, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                duration: 0.7,
                ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
            },
        },
    };

    if (isLoading) {
        return (
            <section className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <div className="container max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center">
                            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                            <p className="mt-4 text-text-secondary">Loading markets...</p>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    if (markets.length === 0) {
        return (
            <section className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <div className="container max-w-7xl mx-auto px-6">
                    <motion.div
                        className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.5 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="text-4xl md:text-5xl font-bold">Featured Markets</h2>
                        <Link href="/create-market">
                            <Button variant="primary">Create First Market →</Button>
                        </Link>
                    </motion.div>
                    <div className="text-center py-12">
                        <p className="text-text-secondary text-lg">No markets available yet. Be the first to create one!</p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-16 md:py-24" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <div className="container max-w-7xl mx-auto px-6">
                <motion.div
                    className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.5 }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold">Featured Markets</h2>
                    <Link href="/markets">
                        <Button variant="ghost">View All Markets →</Button>
                    </Link>
                </motion.div>

                <motion.div
                    className="grid grid-cols-1 lg:grid-cols-2 gap-8"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, amount: 0.1 }}
                >
                    {markets.map((market) => (
                        <motion.div
                            key={market.id}
                            variants={cardVariants}
                        >
                            <Link href={`/markets/${market.slug}`} className="no-underline text-inherit">
                                <Card hover>
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="success">{market.category}</Badge>
                                            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                                ⏱ {getTimeRemaining(market.resolutionDate)}
                                            </span>
                                        </div>

                                        <h3 className="text-lg md:text-xl font-semibold leading-snug m-0 min-h-[3.5em]" style={{ color: 'var(--color-text-primary)' }}>
                                            {market.question}
                                        </h3>

                                        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                                            <motion.div
                                                className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                                                whileHover={{ scale: 1.1 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>YES</span>
                                                <span className="text-3xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                                    {market.yesOdds}%
                                                </span>
                                            </motion.div>
                                            <div className="w-px h-10" style={{ backgroundColor: 'var(--color-border)' }}></div>
                                            <motion.div
                                                className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                                                whileHover={{ scale: 1.1 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>NO</span>
                                                <span className="text-3xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
                                                    {market.noOdds}%
                                                </span>
                                            </motion.div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs uppercase" style={{ color: 'var(--color-text-tertiary)' }}>Pool</span>
                                                <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                    {formatCompactNumber(market.totalLiquidity)} BNB
                                                </span>
                                            </div>
                                            <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                                {market.totalBets} bets
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
