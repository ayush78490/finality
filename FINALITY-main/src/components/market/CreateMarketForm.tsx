'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Category } from '@/lib/types';
import { useCreateMarket } from '@/hooks/useContracts';
import { parseContractValue } from '@/lib/contractUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface CreateMarketFormProps {
    onSuccess?: () => void;
}

export default function CreateMarketForm({ onSuccess }: CreateMarketFormProps) {
    const { address, isConnected } = useAccount();
    const [formData, setFormData] = useState({
        question: '',
        category: Category.CRYPTO,
        endTime: '',
        initialYes: '',
        initialNo: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { createMarket, isLoading } = useCreateMarket();

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected || !address) {
            toast.error('Please connect your wallet first');
            return;
        }

        const { question, category, endTime, initialYes, initialNo } = formData;

        if (!question.trim()) {
            toast.error('Please enter a market question');
            return;
        }

        if (!endTime) {
            toast.error('Please select an end time');
            return;
        }

        const endTimeDate = new Date(endTime);
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        if (endTimeDate <= oneHourFromNow) {
            toast.error('End time must be at least 1 hour from now');
            return;
        }

        const yesAmount = parseFloat(initialYes);
        const noAmount = parseFloat(initialNo);

        if (yesAmount <= 0 || noAmount <= 0) {
            toast.error('Initial liquidity must be greater than 0');
            return;
        }

        const minLiquidity = 0.01; // 0.01 ETH
        if (yesAmount + noAmount < minLiquidity) {
            toast.error(`Minimum initial liquidity is ${minLiquidity} ETH`);
            return;
        }

        try {
            setIsSubmitting(true);

            const params = {
                question: question.trim(),
                category,
                endTime: Math.floor(endTimeDate.getTime() / 1000), // Convert to Unix timestamp
                initialYes: parseContractValue(initialYes),
                initialNo: parseContractValue(initialNo),
            };

            const tx = await createMarket(params);

            toast.success('Market created successfully!', {
                description: `Transaction hash: ${tx}`,
            });

            // Reset form
            setFormData({
                question: '',
                category: Category.CRYPTO,
                endTime: '',
                initialYes: '',
                initialNo: '',
            });

            onSuccess?.();

        } catch (error: any) {
            console.error('Market creation failed:', error);
            toast.error('Failed to create market', {
                description: error.message || 'Please try again',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto p-8">
            <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
                Create New Market
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Question */}
                <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Market Question *
                    </label>
                    <textarea
                        value={formData.question}
                        onChange={(e) => handleInputChange('question', e.target.value)}
                        placeholder="Will Bitcoin reach $100,000 by end of 2025?"
                        className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none resize-none"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '2px solid var(--color-border)',
                            color: 'var(--color-text-primary)',
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                        }}
                        rows={3}
                        maxLength={280}
                        required
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {formData.question.length}/280 characters
                    </p>
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Category *
                    </label>
                    <select
                        value={formData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '2px solid var(--color-border)',
                            color: 'var(--color-text-primary)',
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                        }}
                        required
                    >
                        {Object.values(Category).map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* End Time */}
                <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                        End Time *
                    </label>
                    <input
                        type="datetime-local"
                        value={formData.endTime}
                        onChange={(e) => handleInputChange('endTime', e.target.value)}
                        className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '2px solid var(--color-border)',
                            color: 'var(--color-text-primary)',
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                        }}
                        min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                        required
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Market must end at least 1 hour from now
                    </p>
                </div>

                {/* Initial Liquidity */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Initial YES (ETH) *
                        </label>
                        <input
                            type="number"
                            value={formData.initialYes}
                            onChange={(e) => handleInputChange('initialYes', e.target.value)}
                            placeholder="0.01"
                            step="0.01"
                            min="0.001"
                            className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '2px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                            }}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Initial NO (ETH) *
                        </label>
                        <input
                            type="number"
                            value={formData.initialNo}
                            onChange={(e) => handleInputChange('initialNo', e.target.value)}
                            placeholder="0.01"
                            step="0.01"
                            min="0.001"
                            className="w-full px-4 py-3 text-lg font-semibold transition-all focus:outline-none"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '2px solid var(--color-border)',
                                color: 'var(--color-text-primary)',
                                clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                            }}
                            required
                        />
                    </div>
                </div>

                {/* Total Cost */}
                {(parseFloat(formData.initialYes) > 0 || parseFloat(formData.initialNo) > 0) && (
                    <div className="p-4" style={{ backgroundColor: 'var(--color-bg-tertiary)', clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))' }}>
                        <div className="flex justify-between text-sm">
                            <span style={{ color: 'var(--color-text-tertiary)' }}>Total Initial Liquidity</span>
                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                {(parseFloat(formData.initialYes) + parseFloat(formData.initialNo)).toFixed(4)} ETH
                            </span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                            <span style={{ color: 'var(--color-text-tertiary)' }}>Network Fee</span>
                            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                ~0.001 ETH
                            </span>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={!isConnected || isLoading || isSubmitting}
                >
                    {isLoading || isSubmitting
                        ? 'Creating Market...'
                        : !isConnected
                            ? 'Connect Wallet to Create Market'
                            : 'Create Market'
                    }
                </Button>

                <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                    By creating a market, you become the market creator and earn 2% of all trading fees.
                </p>
            </form>
        </Card>
    );
}