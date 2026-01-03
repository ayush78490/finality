'use client';

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CreateMarketForm from '@/components/market/CreateMarketForm';
import ParticlesBackground from '@/components/ParticlesBackground';

// Force dynamic rendering to avoid SSR issues with wagmi
export const dynamic = 'force-dynamic';

export default function CreateMarketPage() {
    const router = useRouter();

    const handleSuccess = () => {
        // Redirect to markets page after successful creation
        setTimeout(() => {
            router.push('/markets');
        }, 2000);
    };

    return (
        <>
            <Header />
            <main className="relative min-h-screen py-16 md:py-24 overflow-hidden">
                <ParticlesBackground />

                <div className="container max-w-4xl mx-auto px-6 relative z-10">
                    <div className="mb-12">
                        <h1 className="text-5xl md:text-6xl font-bold mb-4">Create Market</h1>
                        <p className="text-lg md:text-xl text-text-secondary max-w-3xl">
                            Create a new prediction market and earn fees from every trade.
                            Set clear resolution criteria and watch the market evolve.
                        </p>
                    </div>

                    <CreateMarketForm onSuccess={handleSuccess} />
                </div>
            </main>
            <Footer />
        </>
    );
}