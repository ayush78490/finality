'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { generateMarketChartData } from '@/lib/chartData';
import { formatCompactNumber } from '@/lib/utils';

interface VolumeChartProps {
    marketSlug: string;
}

export default function VolumeChart({ marketSlug }: VolumeChartProps) {
    const data = generateMarketChartData(marketSlug, 14).slice(-14); // Last 14 days

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div
                    className="p-3"
                    style={{
                        backgroundColor: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                    }}
                >
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        {payload[0].payload.date}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        Volume: ${formatCompactNumber(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-6"
            style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '2px solid var(--color-border)',
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
            }}
        >
            <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                Trading Volume (14 Days)
            </h3>

            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                        dataKey="date"
                        stroke="var(--color-text-tertiary)"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="var(--color-text-tertiary)"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => `$${formatCompactNumber(value)}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                        dataKey="volume"
                        fill="#ffffff"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
