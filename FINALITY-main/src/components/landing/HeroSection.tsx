'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Button from '../ui/Button';
import ParticlesBackground from '../ParticlesBackground';

export default function HeroSection() {
    return (
        <section className="relative py-16 md:py-24 overflow-hidden min-h-[70vh] flex items-center">
            {/* Particles Background */}
            <ParticlesBackground />

            <div className="container max-w-7xl mx-auto px-6">
                <div className="relative z-10 text-center max-w-4xl mx-auto">
                    <motion.h1
                        className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 tracking-tight"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    >
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.8 }}
                        >
                            Finality — Where Markets Meet{' '}
                        </motion.span>
                        <motion.span
                            className="text-gradient"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 0.8, type: 'spring' }}
                        >
                            Truth
                        </motion.span>
                    </motion.h1>

                    <motion.p
                        className="text-xl md:text-2xl text-text-secondary mb-12 max-w-3xl mx-auto"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9, duration: 0.8 }}
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        Predict real-world outcomes with irreversible settlement and transparent resolution.
                    </motion.p>

                    <motion.div
                        className="flex gap-4 justify-center flex-wrap"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2, duration: 0.8 }}
                    >
                        <Link href="/markets">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button variant="primary" size="lg">
                                    Explore Markets
                                </Button>
                            </motion.div>
                        </Link>
                        <Link href="/create-market">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button variant="secondary" size="lg">
                                    Create Market
                                </Button>
                            </motion.div>
                        </Link>
                        <Link href="/whitepaper">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button variant="ghost" size="lg">
                                    Read Whitepaper
                                </Button>
                            </motion.div>
                        </Link>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
