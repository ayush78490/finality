'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { platformStats } from '@/lib/mockData';
import { formatCompactNumber } from '@/lib/utils';

export default function StatsSection() {
    const stats = platformStats;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                ease: [0, 0, 0.58, 1] as const,
            },
        },
    };

    return (
        <section className="py-16 md:py-24">
            <div className="container max-w-7xl mx-auto px-6">
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-4 gap-8"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    <motion.div
                        className="text-center p-6 rounded-lg transition-transform hover:-translate-y-1"
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        style={{ backgroundColor: 'var(--color-bg-card)' }}
                    >
                        <div className="text-sm uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            Total Volume
                        </div>
                        <motion.div
                            className="text-3xl md:text-4xl font-bold font-mono"
                            style={{ color: 'var(--color-text-primary)' }}
                            initial={{ scale: 0.5 }}
                            whileInView={{ scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                        >
                            {formatCompactNumber(stats.totalVolume)}
                        </motion.div>
                    </motion.div>

                    <motion.div
                        className="text-center p-6 rounded-lg transition-transform hover:-translate-y-1"
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        style={{ backgroundColor: 'var(--color-bg-card)' }}
                    >
                        <div className="text-sm uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            Active Markets
                        </div>
                        <motion.div
                            className="text-3xl md:text-4xl font-bold font-mono"
                            style={{ color: 'var(--color-text-primary)' }}
                            initial={{ scale: 0.5 }}
                            whileInView={{ scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.1 }}
                        >
                            {stats.activeMarkets}
                        </motion.div>
                    </motion.div>

                    <motion.div
                        className="text-center p-6 rounded-lg transition-transform hover:-translate-y-1"
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        style={{ backgroundColor: 'var(--color-bg-card)' }}
                    >
                        <div className="text-sm uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            Traders
                        </div>
                        <motion.div
                            className="text-3xl md:text-4xl font-bold font-mono"
                            style={{ color: 'var(--color-text-primary)' }}
                            initial={{ scale: 0.5 }}
                            whileInView={{ scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
                        >
                            {formatCompactNumber(stats.totalTraders)}
                        </motion.div>
                    </motion.div>

                    <motion.div
                        className="text-center p-6 rounded-lg transition-transform hover:-translate-y-1"
                        variants={itemVariants}
                        whileHover={{ scale: 1.05 }}
                        style={{ backgroundColor: 'var(--color-bg-card)' }}
                    >
                        <div className="text-sm uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            Markets Resolved
                        </div>
                        <motion.div
                            className="text-3xl md:text-4xl font-bold font-mono"
                            style={{ color: 'var(--color-text-primary)' }}
                            initial={{ scale: 0.5 }}
                            whileInView={{ scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.3 }}
                        >
                            {stats.marketsResolved}
                        </motion.div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
