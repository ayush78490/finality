'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Box, Cpu, Zap, Shield, Code, Globe, Terminal, FileText } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
    const fadeIn = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6 }
    };

    const sections = [
        {
            title: "What is Finality?",
            icon: <Globe className="w-6 h-6 text-blue-400" />,
            content: "Finality is a next-generation prediction market that leverages the speed of Vara Network for computation and the liquidity of Ethereum for settlement. By splitting these concerns, we provide users with low-latency trading while maintaining high-security asset storage."
        },
        {
            title: "Architecture: The Cross-Chain Bridge",
            icon: <Box className="w-6 h-6 text-purple-400" />,
            content: "Our system uses a dual-chain architecture. Users deposit ETH on Ethereum, which triggers an event. Our Relayer monitors these events and sends a message to the Vara Network, where the AMM (Automated Market Maker) logic determines the price and outcome distribution."
        },
        {
            title: "Vara computation layer",
            icon: <Cpu className="w-6 h-6 text-green-400" />,
            content: "The Vara Network handles all the complex mathematical operations of our Bonding Curve. This ensures that trades are processed instantly without the massive gas fees typically associated with on-chain AMMs on Ethereum Mainnet."
        },
        {
            title: "Ethereum Settlement Layer",
            icon: <Shield className="w-6 h-6 text-yellow-400" />,
            content: "Assets are always secured on Ethereum. The PredictionMarketSettlement contract holds the underlying ETH and mints ERC-20 outcome tokens based on the results computed by Vara. This ensures that you never lose control of your funds."
        },
        {
            title: "vara.eth & ENS Resolution",
            icon: <Zap className="w-6 h-6 text-teal-400" />,
            content: "To simplify configuration and improve transparency, we use 'vara.eth'. Both our relayers and frontend automatically resolve this ENS name to the latest deployed Settlement Contract address on Ethereum, ensuring seamless upgrades and easy identification."
        },
        {
            title: "The Relayer Service",
            icon: <Zap className="w-6 h-6 text-blue-500" />,
            content: "The Relayer is a high-performance backend service that bridges the two networks. It performs ENS resolution, listens for Ethereum events (MarketCreated, DepositMade), and executes Vara Gear extrinsics to finalize trades."
        }
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <motion.div
                    className="text-center mb-20"
                    {...fadeIn}
                >
                    <h1 className="text-5xl font-extrabold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Technical Documentation
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Learn how Finality bridges the gap between Ethereum and Vara Network to create the world's fastest prediction market.
                    </p>
                </motion.div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    {sections.map((section, index) => (SectionCard({ section, index })))}
                </div>

                {/* Feature Highlight: vara.eth */}
                <motion.div
                    className="bg-[#0f0f0f] border border-gray-800 rounded-3xl p-8 mb-20 relative overflow-hidden group"
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Code className="w-32 h-32" />
                    </div>

                    <h2 className="text-3xl font-bold mb-4 flex items-center gap-3">
                        <Terminal className="text-blue-400" />
                        Infrastructure: vara.eth
                    </h2>
                    <p className="text-gray-400 mb-6 leading-relaxed relative z-10">
                        Instead of hardcoded hex addresses, we represent our core infrastructure as <span className="text-blue-400 font-mono">vara.eth</span>.
                        This ENS handle points to our Ethereum Settlement Layer. Our frontend hooks and relayer automatically resolve this name using
                        dynamic resolution logic, making the protocol more human-readable and resilient.
                    </p>

                    <div className="bg-black/50 rounded-xl p-4 font-mono text-sm border border-gray-800 relative z-10">
                        <span className="text-purple-400">const</span> settlementAddress = <span className="text-green-400">await</span> provider.<span className="text-blue-400">resolveName</span>(<span className="text-orange-400">'vara.eth'</span>);
                    </div>
                </motion.div>

                {/* Footer Link */}
                <motion.div
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    {...fadeIn}
                    transition={{ delay: 0.4 }}
                >
                    <Link
                        href="/whitepaper"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-transparent border-2 border-gray-800 text-white font-bold rounded-full hover:bg-gray-900 transition-all hover:scale-105 active:scale-95"
                    >
                        <FileText className="w-5 h-5 text-blue-400" /> Read Whitepaper
                    </Link>
                    <Link
                        href="/markets"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all hover:scale-105 active:scale-95"
                    >
                        Go to Markets <ArrowRight className="w-5 h-5" />
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}

function SectionCard({ section, index }: { section: any, index: number }) {
    return (
        <motion.div
            key={index}
            className="p-8 rounded-3xl bg-[#0a0a0a] border border-gray-900 hover:border-gray-700 transition-all group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            viewport={{ once: true }}
        >
            <div className="mb-4 p-3 bg-gray-900 w-fit rounded-2xl group-hover:scale-110 transition-transform">
                {section.icon}
            </div>
            <h3 className="text-xl font-bold mb-3">{section.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed group-hover:text-gray-400 transition-colors">
                {section.content}
            </p>
        </motion.div>
    );
}
