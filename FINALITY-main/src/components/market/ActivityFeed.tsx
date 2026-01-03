import React from 'react';
import { useMarketActivity } from '@/hooks/useMarketActivity';
import Card from '@/components/ui/Card';

interface ActivityFeedProps {
    marketId: number | string;
}

export default function ActivityFeed({ marketId }: ActivityFeedProps) {
    const { activities, isLoading } = useMarketActivity(marketId, 10);

    if (isLoading && activities.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Recent Activity
                </h3>
                <div className="text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                    Loading activity...
                </div>
            </Card>
        );
    }

    if (activities.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Recent Activity
                </h3>
                <div className="text-center py-8" style={{ color: 'var(--color-text-tertiary)' }}>
                    <p>No activity yet</p>
                    <p className="text-sm mt-2">Recent trades will appear here once trading begins</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Recent Activity
            </h3>
            <div className="space-y-3">
                {activities.map((activity) => (
                    <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--color-surface-secondary)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                    backgroundColor: activity.isYes
                                        ? 'var(--color-success)'
                                        : 'var(--color-danger)',
                                }}
                            />
                            <div>
                                <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                    {activity.isYes ? 'YES' : 'NO'} Trade
                                </div>
                                <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                    {activity.user.slice(0, 6)}...{activity.user.slice(-4)}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {activity.amount.toFixed(4)} ETH
                            </div>
                            <div className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                                {formatTimeAgo(activity.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}
