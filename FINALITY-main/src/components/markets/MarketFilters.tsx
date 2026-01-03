'use client';

import React, { useState } from 'react';
import { Category } from '@/lib/types';

export default function MarketFilters() {
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'resolved'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const categories = ['all', ...Object.values(Category)];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-8 p-8 bg-bg-card border border-border rounded-2xl items-end">
            {/* Status Filter */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary uppercase tracking-wide">Status</label>
                <div className="flex gap-1 bg-bg-tertiary p-1 rounded-xl">
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'all'
                                ? 'bg-accent-primary text-white'
                                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-card'
                            }`}
                        onClick={() => setActiveFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'active'
                                ? 'bg-accent-primary text-white'
                                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-card'
                            }`}
                        onClick={() => setActiveFilter('active')}
                    >
                        Active
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeFilter === 'resolved'
                                ? 'bg-accent-primary text-white'
                                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-card'
                            }`}
                        onClick={() => setActiveFilter('resolved')}
                    >
                        Resolved
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary uppercase tracking-wide">Category</label>
                <select
                    className="px-4 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm cursor-pointer transition-all hover:border-border-light focus:outline-none focus:border-accent-primary min-w-[200px]"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    {categories.map((category) => (
                        <option key={category} value={category}>
                            {category === 'all' ? 'All Categories' : category}
                        </option>
                    ))}
                </select>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-text-secondary uppercase tracking-wide">Search</label>
                <input
                    type="text"
                    className="px-4 py-2 bg-bg-tertiary border border-border rounded-lg text-text-primary text-sm transition-all hover:border-border-light focus:outline-none focus:border-accent-primary min-w-full lg:min-w-[300px] placeholder:text-text-muted"
                    placeholder="Search markets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>
    );
}
