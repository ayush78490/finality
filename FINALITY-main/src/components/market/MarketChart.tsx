'use client';

import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { generateMarketChartData, generateHourlyData, PricePoint } from '@/lib/chartData';

interface MarketChartProps {
    marketSlug: string;
}

type TimeRange = '24h' | '7d' | '30d';

export default function MarketChart({ marketSlug }: MarketChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');

    const getData = (): PricePoint[] => {
        switch (timeRange) {
            case '24h':
                return generateHourlyData(marketSlug);
            case '7d':
                return generateMarketChartData(marketSlug, 7);
            case '30d':
                return generateMarketChartData(marketSlug, 30);
            default:
                return generateMarketChartData(marketSlug, 7);
        }
    };

    const data = getData();

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
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        {payload[0].payload.date}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        YES: {payload[0].value.toFixed(2)}%
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        NO: {payload[1].value.toFixed(2)}%
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
            transition={{ duration: 0.6 }}
            className="p-6"
            style={{
                backgroundColor: 'var(--color-bg-card)',
                border: '2px solid var(--color-border)',
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
            }}
        >
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    Price History
                </h3>

                <div className="flex gap-2">
                    {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className="px-4 py-2 text-sm font-semibold transition-all"
                            style={{
                                backgroundColor: timeRange === range ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                                color: timeRange === range ? '#000000' : 'var(--color-text-secondary)',
                                clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                            }}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                        dataKey="date"
                        stroke="var(--color-text-tertiary)"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="var(--color-text-tertiary)"
                        style={{ fontSize: '12px' }}
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="yesPrice"
                        stroke="#ffffff"
                        strokeWidth={2}
                        dot={false}
                        name="YES Price (%)"
                        activeDot={{ r: 6, fill: '#ffffff' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="noPrice"
                        stroke="#666666"
                        strokeWidth={2}
                        dot={false}
                        name="NO Price (%)"
                        strokeDasharray="5 5"
                        activeDot={{ r: 6, fill: '#666666' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </motion.div>
    );
}
