'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function HowItWorks() {
    const steps = [
        {
            number: '01',
            title: 'Markets are Created',
            description: 'Anyone can create a prediction market on real-world events with clear resolution criteria.',
            icon: '/icons/create-market.png',
        },
        {
            number: '02',
            title: 'Users Bet Yes or No',
            description: 'Trade on outcomes you believe in. Your position determines potential returns.',
            icon: '/icons/trade-predictions.png',
        },
        {
            number: '03',
            title: 'Event Resolves',
            description: 'When the event concludes, oracles and validators determine the true outcome.',
            icon: '/icons/event-resolves.png',
        },
        {
            number: '04',
            title: 'Final Settlement',
            description: 'Winners claim their earnings. All settlements are irreversible and on-chain.',
            icon: '/icons/claim-winnings.png',
        },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 50 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                ease: [0.25, 0.1, 0.25, 1] as const,
            },
        },
    };

    return (
        <section id="how-it-works" className="py-16 md:py-24">
            <div className="container max-w-7xl mx-auto px-6">
                <motion.div
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
                    <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto">
                        Four simple steps from prediction to settlement
                    </p>
                </motion.div>

                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: false, amount: 0.2 }}
                >
                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            variants={itemVariants}
                            whileHover={{ scale: 1.05, y: -8 }}
                            className="relative p-8 rounded-2xl transition-shadow duration-200"
                            style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                        >
                            <div className="absolute top-4 right-4 text-5xl font-bold leading-none" style={{ color: 'var(--color-bg-tertiary)' }}>
                                {step.number}
                            </div>
                            <div className="mb-4 w-20 h-20 relative">
                                <img
                                    src={step.icon}
                                    alt={step.title}
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                {step.title}
                            </h3>
                            <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--color-text-tertiary)' }}>
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
