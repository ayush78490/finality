'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Market } from '@/lib/types';
import { useClaimRedemption } from '@/hooks/useContracts';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface ClaimWinningsProps {
    market: Market;
}

export default function ClaimWinnings({ market }: ClaimWinningsProps) {
    const { address, isConnected } = useAccount();
    const [isClaiming, setIsClaiming] = useState(false);

    const { claimRedemption, isLoading } = useClaimRedemption();

    const canClaim = market.status === 'RESOLVED' && market.outcome !== 'UNRESOLVED';

    const handleClaimWinnings = async () => {
        if (!isConnected || !address) {
            toast.error('Please connect your wallet first');
            return;
        }

        if (!canClaim) {
            toast.error('Market is not resolved or you may not have winning tokens');
            return;
        }

        try {
            setIsClaiming(true);

            const claimParams = {
                marketId: BigInt(market.id),
            };

            const tx = await claimRedemption(claimParams);

            toast.success('Winnings claimed successfully!', {
                description: `Transaction hash: ${tx}`,
            });

        } catch (error: any) {
            console.error('Claim failed:', error);
            toast.error('Failed to claim winnings', {
                description: error.message || 'Please try again',
            });
        } finally {
            setIsClaiming(false);
        }
    };

    if (!canClaim) {
        return (
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Claim Winnings
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {market.status !== 'RESOLVED'
                        ? 'Market must be resolved before claiming winnings.'
                        : 'This market has not been resolved yet.'
                    }
                </p>
            </Card>
        );
    }

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Claim Winnings
            </h3>

            <div className="space-y-4">
                <div className="p-4" style={{ backgroundColor: 'var(--color-bg-tertiary)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
                    <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Market Outcome</span>
                        <span className="font-semibold" style={{ color: market.outcome === 'YES' ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>
                            {market.outcome}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Your Position</span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Claim available winnings
                        </span>
                    </div>
                </div>

                <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={!isConnected || isLoading || isClaiming}
                    onClick={handleClaimWinnings}
                >
                    {isLoading || isClaiming
                        ? 'Claiming Winnings...'
                        : !isConnected
                            ? 'Connect Wallet to Claim'
                            : 'Claim Winnings'
                    }
                </Button>
            </div>

            <p className="text-xs text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
                Only claim if you hold winning tokens from this resolved market.
            </p>
        </Card>
    );
}