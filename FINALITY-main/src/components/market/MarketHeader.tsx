import React from 'react';
import { Market, MarketStatus } from '@/lib/types';
import { formatDate, shortenAddress } from '@/lib/utils';
import Badge from '@/components/ui/Badge';

interface MarketHeaderProps {
    market: Market;
}

export default function MarketHeader({ market }: MarketHeaderProps) {
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
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Badge variant={getStatusBadgeVariant()}>{market.status}</Badge>
                <Badge variant="default">{market.category}</Badge>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {market.question}
            </h1>

            <div className="flex flex-wrap gap-6 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                <div>
                    <span className="font-semibold">Resolution Date:</span>{' '}
                    {formatDate(market.resolutionDate)}
                </div>
                <div>
                    <span className="font-semibold">Creator:</span>{' '}
                    {shortenAddress(market.creator)}
                </div>
                <div>
                    <span className="font-semibold">Total Bets:</span> {market.totalBets}
                </div>
            </div>
        </div>
    );
}
