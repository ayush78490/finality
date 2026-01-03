import React from 'react';
import { Market } from '@/lib/types';
import { formatCompactNumber } from '@/lib/utils';
import { useTokenSupplyOdds } from '@/hooks/useTokenSupplyOdds';
import Card from '@/components/ui/Card';

interface OddsPanelProps {
    market: Market;
}

export default function OddsPanel({ market }: OddsPanelProps) {
    // Fetch real-time odds from token supplies
    const tokenOdds = useTokenSupplyOdds(
        market.yesToken as `0x${string}`,
        market.noToken as `0x${string}`
    );

    // Use token supply data if available, fallback to market data
    const displayData = React.useMemo(() => {
        if (tokenOdds.yesOdds !== null && tokenOdds.noOdds !== null) {
            return {
                yesOdds: tokenOdds.yesOdds,
                noOdds: tokenOdds.noOdds,
                yesPool: tokenOdds.yesSupply || market.yesPool,
                noPool: tokenOdds.noSupply || market.noPool,
                isRealTime: true,
            };
        }
        return {
            yesOdds: market.yesOdds,
            noOdds: market.noOdds,
            yesPool: market.yesPool,
            noPool: market.noPool,
            isRealTime: false,
        };
    }, [tokenOdds, market]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* YES Card */}
            <Card className="p-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>YES</h3>
                        <div className="text-5xl font-bold font-mono" style={{ color: 'var(--color-success)' }}>
                            {displayData.yesOdds}%
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span style={{ color: 'var(--color-text-tertiary)' }}>Pool Size</span>
                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {formatCompactNumber(displayData.yesPool)} ETH
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span style={{ color: 'var(--color-text-tertiary)' }}>Potential Return</span>
                            <span className="font-semibold" style={{ color: 'var(--color-success)' }}>
                                {displayData.yesOdds > 0 ? (100 / displayData.yesOdds).toFixed(2) : '0.00'}x
                            </span>
                        </div>
                        {displayData.isRealTime && (
                            <div className="flex justify-between text-xs pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                                <span style={{ color: 'var(--color-success)' }}>● Live from Token Supply</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* NO Card */}
            <Card className="p-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>NO</h3>
                        <div className="text-5xl font-bold font-mono" style={{ color: 'var(--color-danger)' }}>
                            {displayData.noOdds}%
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span style={{ color: 'var(--color-text-tertiary)' }}>Pool Size</span>
                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {formatCompactNumber(displayData.noPool)} ETH
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span style={{ color: 'var(--color-text-tertiary)' }}>Potential Return</span>
                            <span className="font-semibold" style={{ color: 'var(--color-danger)' }}>
                                {displayData.noOdds > 0 ? (100 / displayData.noOdds).toFixed(2) : '0.00'}x
                            </span>
                        </div>
                        {displayData.isRealTime && (
                            <div className="flex justify-between text-xs pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                                <span style={{ color: 'var(--color-success)' }}>● Live from Token Supply</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
