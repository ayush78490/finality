// Utility functions for Finality

/**
 * Format a number as currency (USD)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format a large number with K, M, B suffixes
 */
export function formatCompactNumber(num: number): string {
    if (num >= 1_000_000_000) {
        return `$${(num / 1_000_000_000).toFixed(1)}B`;
    }
    if (num >= 1_000_000) {
        return `$${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `$${(num / 1_000).toFixed(1)}K`;
    }
    return formatCurrency(num);
}

/**
 * Shorten an Ethereum address
 */
export function shortenAddress(address: string, chars = 4): string {
    if (!address) return '';
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Calculate time remaining until a date
 */
export function getTimeRemaining(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/**
 * Calculate potential payout based on bet amount and odds
 */
export function calculatePayout(betAmount: number, odds: number): number {
    // Simple calculation: payout = betAmount / (odds / 100)
    // This is a simplified model; real AMM would be more complex
    return betAmount * (100 / odds);
}

/**
 * Calculate shares received for a bet
 */
export function calculateShares(betAmount: number, odds: number): number {
    // Simplified: shares proportional to bet amount and inverse of odds
    return betAmount / (odds / 100);
}

/**
 * Generate a URL-friendly slug from text
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
    if (total === 0) return 0;
    return (value / total) * 100;
}
