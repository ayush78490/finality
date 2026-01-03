'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ParticlesBackground from '@/components/ParticlesBackground';

export default function HowItWorksPage() {
    const steps = [
        {
            number: '01',
            title: 'Create a Market',
            description: 'Anyone can create a prediction market by defining a clear yes/no question about a future event. Set the resolution date, provide resolution criteria, and add initial liquidity.',
            details: [
                'Define a binary outcome question',
                'Set resolution date and criteria',
                'Add initial liquidity to the pool',
                'Market goes live for trading',
            ],
            icon: '/icons/create-market.png',
        },
        {
            number: '02',
            title: 'Trade YES or NO',
            description: 'Users buy YES or NO tokens based on their prediction. Prices adjust automatically based on supply and demand, reflecting the market\'s collective wisdom.',
            details: [
                'Buy YES if you think the event will happen',
                'Buy NO if you think it won\'t happen',
                'Prices range from $0.01 to $0.99',
                'Your potential profit depends on the odds',
            ],
            icon: '/icons/trade-predictions.png',
        },
        {
            number: '03',
            title: 'Event Resolves',
            description: 'When the event concludes, the market enters a resolution phase. Oracles and validators determine the true outcome based on predefined criteria.',
            details: [
                'Resolution date is reached',
                'Oracle submits the outcome',
                'Validators can dispute if incorrect',
                'Final outcome is determined',
            ],
            icon: '/icons/event-resolves.png',
        },
        {
            number: '04',
            title: 'Claim Winnings',
            description: 'Winners redeem their tokens for $1.00 each. All settlements are final and executed on-chain. Losers\' tokens become worthless.',
            details: [
                'Winning tokens worth $1.00 each',
                'Losing tokens worth $0.00',
                'Claim your winnings anytime',
                'All settlements are irreversible',
            ],
            icon: '/icons/claim-winnings.png',
        },
    ];

    const faqs = [
        {
            question: 'How are prices determined?',
            answer: 'Prices are determined by an Automated Market Maker (AMM) that adjusts based on supply and demand. When more people buy YES, the YES price increases and NO price decreases, and vice versa.',
        },
        {
            question: 'What happens if there\'s a dispute?',
            answer: 'If validators believe the oracle\'s resolution is incorrect, they can stake tokens to dispute it. The community then votes on the correct outcome, with the majority decision being final.',
        },
        {
            question: 'Can I sell my position early?',
            answer: 'Yes! You can sell your YES or NO tokens at any time before the market resolves. The price you receive depends on the current market odds.',
        },
        {
            question: 'What are the fees?',
            answer: 'There\'s a small trading fee (typically 2-3%) that goes to liquidity providers and the platform. This ensures the market remains liquid and sustainable.',
        },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6 },
        },
    };

    return (
        <>
            <Header />
            <main className="relative min-h-screen py-16 md:py-24 overflow-hidden">
                <ParticlesBackground />

                <div className="container max-w-6xl mx-auto px-6 relative z-10">
                    {/* Hero Section */}
                    <motion.div
                        className="text-center mb-20"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1 className="text-5xl md:text-7xl font-extrabold mb-6">
                            How <span className="text-gradient">Finality</span> Works
                        </h1>
                        <p className="text-xl md:text-2xl max-w-3xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                            A decentralized prediction market platform where you can bet on real-world outcomes
                        </p>
                    </motion.div>

                    {/* Steps Section */}
                    <motion.div
                        className="space-y-16 mb-24"
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: false, amount: 0.2 }}
                    >
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                variants={itemVariants}
                                className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
                            >
                                {/* Icon & Number */}
                                <div className={`${index % 2 === 1 ? 'md:order-2' : ''}`}>
                                    <div
                                        className="relative p-8 rounded-2xl"
                                        style={{
                                            backgroundColor: 'var(--color-bg-card)',
                                            border: '2px solid var(--color-border)',
                                            clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
                                        }}
                                    >
                                        <div className="absolute top-4 right-4 text-6xl font-bold opacity-10">
                                            {step.number}
                                        </div>
                                        <div className="mb-4 w-24 h-24 relative">
                                            <img
                                                src={step.icon}
                                                alt={step.title}
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                            {step.title}
                                        </h3>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
                                    <p className="text-lg mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                                        {step.description}
                                    </p>
                                    <ul className="space-y-3">
                                        {step.details.map((detail, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <span className="text-lg mt-1" style={{ color: 'var(--color-accent-primary)' }}>→</span>
                                                <span style={{ color: 'var(--color-text-tertiary)' }}>{detail}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* FAQ Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.3 }}
                        transition={{ duration: 0.8 }}
                        className="mb-16"
                    >
                        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
                            Frequently Asked Questions
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {faqs.map((faq, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: false }}
                                    transition={{ duration: 0.6, delay: index * 0.1 }}
                                    whileHover={{ scale: 1.02 }}
                                    className="p-6 rounded-xl"
                                    style={{
                                        backgroundColor: 'var(--color-bg-card)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                >
                                    <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                                        {faq.question}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-tertiary)' }}>
                                        {faq.answer}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* CTA Section */}
                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false }}
                        transition={{ duration: 0.8 }}
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">
                            Ready to Start Trading?
                        </h2>
                        <p className="text-lg mb-8" style={{ color: 'var(--color-text-secondary)' }}>
                            Explore active markets and make your first prediction
                        </p>
                        <motion.a
                            href="/markets"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="inline-block px-8 py-4 text-lg font-semibold transition-all"
                            style={{
                                backgroundColor: 'var(--color-accent-primary)',
                                color: '#000000',
                                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                                boxShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
                            }}
                        >
                            Browse Markets →
                        </motion.a>
                    </motion.div>
                </div>
            </main>
            <Footer />
        </>
    );
}
