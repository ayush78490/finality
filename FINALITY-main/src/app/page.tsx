'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/landing/HeroSection';
import StatsSection from '@/components/landing/StatsSection';
import HowItWorks from '@/components/landing/HowItWorks';
import FeaturedMarkets from '@/components/landing/FeaturedMarkets';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <HowItWorks />
        <FeaturedMarkets />
      </main>
      <Footer />
    </>
  );
}
