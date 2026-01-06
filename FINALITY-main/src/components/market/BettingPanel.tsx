'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Market, Outcome } from '@/lib/types';
import { calculatePayout, formatCurrency } from '@/lib/utils';
import { useDeposit } from '@/hooks/useContracts';
import { parseContractValue } from '@/lib/contractUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface BettingPanelProps {
    market: Market;
}

export default function BettingPanel({ market }: BettingPanelProps) {
    const { address, isConnected } = useAccount();
    const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(Outcome.YES);
    const [betAmount, setBetAmount] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { deposit, isLoading, isWrongNetwork, switchChain } = useDeposit();

    const amount = parseFloat(betAmount) || 0;
    const odds = selectedOutcome === Outcome.YES ? market.yesOdds : market.noOdds;
    const potentialPayout = amount > 0 ? calculatePayout(amount, odds) : 0;
    const potentialProfit = potentialPayout - amount;

    const handlePlaceBet = async () => {
        if (!isConnected || !address) {
            toast.error('Please connect your wallet first');
            return;
        }

        if (amount <= 0) {
            toast.error('Please enter a valid bet amount');
            return;
        }

        if (market.status !== 'OPEN') {
            toast.error('This market is not open for betting');
            return;
        }

        if (isWrongNetwork) {
            toast.error('Wrong Network!', {
                description: 'Please switch to Hoodi Testnet (Chain ID: 560048) in your wallet',
            });
            try {
                await switchChain();
            } catch (e) {
                // Switch request sent
            }
            return;
        }

        try {
            setIsSubmitting(true);

            const depositParams = {
                marketId: BigInt(market.id),
                isYes: selectedOutcome === Outcome.YES,
                amount: parseContractValue(betAmount),
            };

            const tx = await deposit(depositParams);

            toast.success('Bet placed successfully!', {
                description: `Transaction hash: ${tx}`,
            });

            // Reset form
            setBetAmount('');
            setSelectedOutcome(Outcome.YES);

        } catch (error: any) {
            console.error('Bet placement failed:', error);
            toast.error('Failed to place bet', {
                description: error.message || 'Please try again',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="p-8">
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                Place Your Bet
            </h2>

            {/* Outcome Toggle */}
            <div className="flex gap-4 mb-6">
                <button
                    className={`flex-1 py-3 px-6 font-semibold transition-all ${selectedOutcome === Outcome.YES ? 'opacity-100' : 'opacity-50'
                        }`}
                    style={{
                        backgroundColor: selectedOutcome === Outcome.YES ? '#ffffff' : 'var(--color-bg-tertiary)',
                        color: selectedOutcome === Outcome.YES ? '#000000' : 'white',
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                        border: selectedOutcome === Outcome.YES ? 'none' : '2px solid #ffffff',
                    }}
                    onClick={() => setSelectedOutcome(Outcome.YES)}
                >
                    YES
                </button>
                <button
                    className={`flex-1 py-3 px-6 font-semibold transition-all ${selectedOutcome === Outcome.NO ? 'opacity-100' : 'opacity-50'
                        }`}
                    style={{
                        backgroundColor: selectedOutcome === Outcome.NO ? '#ffffff' : 'var(--color-bg-tertiary)',
                        color: selectedOutcome === Outcome.NO ? '#000000' : 'white',
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                        border: selectedOutcome === Outcome.NO ? 'none' : '2px solid #ffffff',
                    }}
                    onClick={() => setSelectedOutcome(Outcome.NO)}
                >
                    NO
                </button>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
                <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Bet Amount (USD)
                </label>
                <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none"
                    style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        border: '2px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                    }}
                />
            </div>

            {/* Calculation Summary */}
            {amount > 0 && (
                <div className="space-y-3 mb-6 p-4" style={{ backgroundColor: 'var(--color-bg-tertiary)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
                    <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Current Odds</span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{odds}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Potential Payout</span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {formatCurrency(potentialPayout)}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--color-text-tertiary)' }}>Potential Profit</span>
                        <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            +{formatCurrency(potentialProfit)}
                        </span>
                    </div>
                </div>
            )}

            {/* Place Bet Button */}
            <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={amount <= 0 || !isConnected || isLoading || isSubmitting}
                onClick={handlePlaceBet}
            >
                {isLoading || isSubmitting
                    ? 'Placing Bet...'
                    : !isConnected
                        ? 'Connect Wallet to Bet'
                        : amount > 0
                            ? `Place Bet - ${formatCurrency(amount)}`
                            : 'Enter Bet Amount'
                }
            </Button>

            <p className="text-xs text-center mt-4" style={{ color: 'var(--color-text-muted)' }}>
                By placing a bet, you agree to the market rules and resolution criteria.
            </p>
        </Card>
    );
}
