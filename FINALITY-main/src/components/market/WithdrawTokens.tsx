'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Market, Outcome } from '@/lib/types';
import { useRequestWithdrawal } from '@/hooks/useContracts';
import { parseContractValue } from '@/lib/contractUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface WithdrawTokensProps {
    market: Market;
}

export default function WithdrawTokens({ market }: WithdrawTokensProps) {
    const { address, isConnected } = useAccount();
    const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(Outcome.YES);
    const [tokenAmount, setTokenAmount] = useState<string>('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const { requestWithdrawal, isLoading } = useRequestWithdrawal();

    const canWithdraw = market.status === 'OPEN';

    const handleWithdraw = async () => {
        if (!isConnected || !address) {
            toast.error('Please connect your wallet first');
            return;
        }

        if (!canWithdraw) {
            toast.error('Withdrawals are only available while market is open');
            return;
        }

        const amount = parseFloat(tokenAmount);
        if (amount <= 0) {
            toast.error('Please enter a valid token amount');
            return;
        }

        try {
            setIsWithdrawing(true);

            const withdrawalParams = {
                marketId: BigInt(market.id),
                isYes: selectedOutcome === Outcome.YES,
                tokenAmount: parseContractValue(tokenAmount),
            };

            const tx = await requestWithdrawal(withdrawalParams);

            toast.success('Withdrawal requested successfully!', {
                description: `Transaction hash: ${tx}. Tokens will be burned and ETH will be returned after Vara processing.`,
            });

            // Reset form
            setTokenAmount('');

        } catch (error: any) {
            console.error('Withdrawal failed:', error);
            toast.error('Failed to request withdrawal', {
                description: error.message || 'Please try again',
            });
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Withdraw Tokens
            </h3>

            {!canWithdraw && (
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    Withdrawals are only available while the market is open.
                </p>
            )}

            {canWithdraw && (
                <div className="space-y-4">
                    {/* Token Type Selection */}
                    <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Token Type
                        </label>
                        <div className="flex gap-4">
                            <button
                                className={`flex-1 py-2 px-4 font-semibold transition-all ${selectedOutcome === Outcome.YES ? 'opacity-100' : 'opacity-50'
                                    }`}
                                style={{
                                    backgroundColor: selectedOutcome === Outcome.YES ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                                    color: selectedOutcome === Outcome.YES ? '#000000' : 'var(--color-text-primary)',
                                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                                }}
                                onClick={() => setSelectedOutcome(Outcome.YES)}
                            >
                                YES Tokens
                            </button>
                            <button
                                className={`flex-1 py-2 px-4 font-semibold transition-all ${selectedOutcome === Outcome.NO ? 'opacity-100' : 'opacity-50'
                                    }`}
                                style={{
                                    backgroundColor: selectedOutcome === Outcome.NO ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                                    color: selectedOutcome === Outcome.NO ? '#000000' : 'var(--color-text-primary)',
                                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))',
                                }}
                                onClick={() => setSelectedOutcome(Outcome.NO)}
                            >
                                NO Tokens
                            </button>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Token Amount
                        </label>
                        <input
                            type="number"
                            value={tokenAmount}
                            onChange={(e) => setTokenAmount(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '2px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                            }}
                        />
                    </div>

                    {/* Withdraw Button */}
                    <Button
                        variant="secondary"
                        size="lg"
                        fullWidth
                        disabled={!isConnected || isLoading || isWithdrawing || !tokenAmount || parseFloat(tokenAmount) <= 0}
                        onClick={handleWithdraw}
                    >
                        {isLoading || isWithdrawing
                            ? 'Requesting Withdrawal...'
                            : !isConnected
                                ? 'Connect Wallet to Withdraw'
                                : 'Request Withdrawal'
                        }
                    </Button>
                </div>
            )}

            <p className="text-xs text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
                Withdrawals burn your tokens and return proportional ETH after Vara processing and fees.
            </p>
        </Card>
    );
}