import React from 'react';
import { Market } from '@/lib/types';
import Card from '@/components/ui/Card';

interface MarketDetailsProps {
    market: Market;
}

export default function MarketDetails({ market }: MarketDetailsProps) {
    return (
        <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                Market Details
            </h2>

            <div className="space-y-6">
                {/* Description */}
                <div>
                    <h3 className="text-sm font-semibold uppercase mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        Description
                    </h3>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                        {market.description}
                    </p>
                </div>

                {/* Resolution Source */}
                {market.resolutionSource && (
                    <div>
                        <h3 className="text-sm font-semibold uppercase mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            Resolution Source
                        </h3>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            {market.resolutionSource}
                        </p>
                    </div>
                )}

                {/* Dispute Window */}
                {market.disputeWindow && (
                    <div>
                        <h3 className="text-sm font-semibold uppercase mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            Dispute Window
                        </h3>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            {market.disputeWindow} hours after resolution
                        </p>
                    </div>
                )}

                {/* Rules */}
                <div>
                    <h3 className="text-sm font-semibold uppercase mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        Rules
                    </h3>
                    <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
                        <li>Market resolves based on the specified resolution source</li>
                        <li>All bets are final and cannot be cancelled</li>
                        <li>Winnings are distributed proportionally to winning shares</li>
                        <li>Platform takes a small fee from the total pool</li>
                    </ul>
                </div>
            </div>
        </Card>
    );
}
