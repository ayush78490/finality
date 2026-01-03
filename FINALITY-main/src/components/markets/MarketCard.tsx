'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Market, MarketStatus } from '@/lib/types';
import { getTimeRemaining, formatCompactNumber } from '@/lib/utils';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

interface MarketCardProps {
    market: Market;
}

export default function MarketCard({ market }: MarketCardProps) {
    const getStatusBadgeVariant = () => {
        switch (market.status) {
            case MarketStatus.OPEN:
                return 'success';
            case MarketStatus.CLOSED:
                return 'warning';
            case MarketStatus.RESOLVED:
                return 'info';
            default:
                return 'default';
        }
    };

    return (
        <Link href={`/markets/${market.slug}`} className="no-underline text-inherit">
            <Card hover>
                <div className="flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex gap-2 flex-wrap">
                            <Badge variant={getStatusBadgeVariant()}>{market.status}</Badge>
                            <Badge variant="default">{market.category}</Badge>
                        </div>
                        {market.status === MarketStatus.OPEN && (
                            <span className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                ⏱ {getTimeRemaining(market.resolutionDate)}
                            </span>
                        )}
                    </div>

                    {/* Question */}
                    <h3 className="text-xl font-semibold leading-snug m-0 min-h-[2.8em]" style={{ color: 'var(--color-text-primary)' }}>
                        {market.question}
                    </h3>

                    {/* Odds */}
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

                    {/* Footer */}
                    <div className="grid grid-cols-2 gap-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Total Liquidity</span>
                            <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {formatCompactNumber(market.totalLiquidity)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>Bets</span>
                            <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{market.totalBets}</span>
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
