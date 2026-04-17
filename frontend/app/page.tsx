"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-ink font-sans text-white">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeUp {
            from { opacity: 0.3; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-up {
            animation: fadeUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          @keyframes dashMove {
            to { stroke-dashoffset: -200; }
          }
          .animate-dash {
            stroke-dasharray: 10 20;
            animation: dashMove 3s linear infinite;
          }
        `
      }} />

      {/* Global Header */}
      <Header />

      {/* Top Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1200px] -translate-x-1/2 -translate-y-[40%] bg-[radial-gradient(ellipse_at_center,rgba(44,170,138,0.25)_0%,rgba(17,45,36,0.1)_50%,rgba(11,15,12,0)_80%)] opacity-100 mix-blend-screen" />

      {/* Bottom Ambient Glow */}
      <div className="pointer-events-none absolute left-1/2 bottom-0 h-[800px] w-[1000px] -translate-x-1/2 translate-y-[30%] bg-[radial-gradient(ellipse_at_center,rgba(44,170,138,0.30)_0%,rgba(17,45,36,0.15)_45%,rgba(11,15,12,0)_80%)] opacity-100 mix-blend-screen" />

      <div className="relative z-10 mx-auto flex h-full min-h-[100dvh] max-w-[1300px] flex-col items-center px-4 pt-20 sm:px-6 sm:pt-28 md:px-8 md:pt-32">

        {/* Hero Copy */}
        <div className="mt-6 sm:mt-8 flex flex-col items-center text-center opacity-0 animate-fade-up px-2">
          <h1 className="flex max-w-[800px] flex-wrap justify-center items-center gap-x-2 sm:gap-x-4 gap-y-1 sm:gap-y-2 text-[28px] sm:text-[42px] md:text-[56px] lg:text-[64px] font-bold leading-[1.1] tracking-tight text-white">
            <span>PREDICTION</span>
            <span className="hidden sm:inline">THE FUTURE OF</span>
            <span className="sm:hidden">FUTURE OF</span>
            <span>CRYPTO TRADING</span>
          </h1>
          <p className="mt-6 max-w-[700px] text-[15px] leading-relaxed text-mist">
            We deliver secure, scalable, and cutting-edge prediction markets that redefine trust, transparency, and innovation for the digital economy of the future.
          </p>
        </div>

        {/* Top Floating Buttons */}
        <div className="mb-8 mt-6 sm:mb-10 sm:mt-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 z-20 w-full sm:w-auto px-4 sm:px-0">
          <Link
            href="/markets"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-6 sm:px-7 py-3 text-[14px] font-bold text-ink transition hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,255,255,0.3)]"
          >
            Get Started
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m-7-7 7 7-7 7"/>
            </svg>
          </Link>
          <Link
            href="/markets"
            className="flex w-full sm:w-auto items-center justify-center rounded-full border border-line bg-panel/60 px-6 sm:px-7 py-3 text-[14px] font-medium text-mist backdrop-blur transition hover:-translate-y-0.5 hover:bg-line/50 hover:text-white"
          >
            Discover More
          </Link>
        </div>

        {/* Mobile Feature Cards - Shown only on mobile/tablet */}
        <div className="mt-6 grid w-full max-w-[400px] grid-cols-1 gap-4 px-4 md:hidden">
          <div className="rounded-2xl border border-line bg-panel/80 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-shore/20 text-shore">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">Performance</h3>
                <p className="text-[11px] text-mist">Growth <span className="text-shore">↑ 2.39%</span></p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-panel/80 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-ember/20 text-ember">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">Total Earnings</h3>
                <p className="text-[11px] text-mist">$17,780 <span className="text-shore">↑ 1.62%</span></p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-panel/80 p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-risk/20 text-risk">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">Fast Settlement</h3>
                <p className="text-[11px] text-mist">5-minute rounds</p>
              </div>
            </div>
          </div>
        </div>

        {/* Central Complex Diagram Container - Hidden on mobile */}
        <div className="relative mt-2 hidden h-[400px] sm:h-[450px] md:block md:h-[550px] w-full max-w-[1100px]">
          
          {/* Base SVG lines */}
          <div className="absolute inset-0 z-0">
            <svg width="100%" height="100%" viewBox="0 0 1100 550" preserveAspectRatio="xMidYMid meet" className="pointer-events-none">
              <defs>
                <linearGradient id="lineGradLeft" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#43b89b" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#5dfeca" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="lineGradRight" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#43b89b" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#5dfeca" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="hexGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8efae1" stopOpacity="1" />
                  <stop offset="100%" stopColor="#2caa8a" stopOpacity="1" />
                </linearGradient>
              </defs>

              {/* Connecting Paths */}
              <g fill="none" strokeWidth="1.5">
                <path d="M 500 240 C 440 240 420 120 370 120" stroke="url(#lineGradLeft)" />
                <path d="M 500 245 C 450 245 440 135 375 135" stroke="rgba(93,254,202,0.3)" />
                <path d="M 500 240 C 440 240 420 120 370 120" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />

                <path d="M 480 275 C 420 275 380 230 280 230" stroke="url(#lineGradLeft)" />
                <path d="M 470 285 C 410 285 370 245 280 245" stroke="rgba(93,254,202,0.3)" strokeWidth="1" />
                <path d="M 480 295 C 440 295 400 320 280 320" stroke="url(#lineGradLeft)" />
                <path d="M 480 275 C 420 275 380 230 280 230" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />
                <path d="M 480 295 C 440 295 400 320 280 320" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />

                <path d="M 500 310 C 440 310 420 430 370 430" stroke="url(#lineGradLeft)" />
                <path d="M 500 305 C 450 305 440 415 375 415" stroke="rgba(93,254,202,0.3)" />
                <path d="M 500 310 C 440 310 420 430 370 430" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />

                <path d="M 600 240 C 660 240 680 120 730 120" stroke="url(#lineGradRight)" />
                <path d="M 600 245 C 650 245 660 135 725 135" stroke="rgba(93,254,202,0.3)" />
                <path d="M 600 240 C 660 240 680 120 730 120" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />

                <path d="M 620 275 C 680 275 720 230 820 230" stroke="url(#lineGradRight)" />
                <path d="M 630 285 C 690 285 730 245 820 245" stroke="rgba(93,254,202,0.3)" strokeWidth="1" />
                <path d="M 620 295 C 660 295 700 320 820 320" stroke="url(#lineGradRight)" />
                <path d="M 620 275 C 680 275 720 230 820 230" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />
                <path d="M 620 295 C 660 295 700 320 820 320" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />

                <path d="M 600 310 C 660 310 680 430 730 430" stroke="url(#lineGradRight)" />
                <path d="M 600 305 C 650 305 660 415 725 415" stroke="rgba(93,254,202,0.3)" />
                <path d="M 600 310 C 660 310 680 430 730 430" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />

                {/* Bottom mid brand node wire */}
                <path d="M 550 320 C 550 350 550 385 550 420" stroke="url(#lineGradLeft)" />
                <path d="M 550 325 C 550 352 550 387 550 420" stroke="rgba(93,254,202,0.3)" />
                <path d="M 550 320 C 550 350 550 385 550 420" stroke="#5dfeca" strokeWidth="2" className="animate-dash" />
              </g>

              {/* Animated glowing dots tracing the lines */}
              <g fill="#aaffea">
                <circle r="2.5">
                  <animateMotion dur="3s" repeatCount="indefinite" path="M 500 240 C 440 240 420 120 370 120" />
                </circle>
                <circle r="2.5">
                  <animateMotion dur="4s" repeatCount="indefinite" path="M 480 275 C 420 275 380 230 280 230" />
                </circle>
                <circle r="2.5">
                  <animateMotion dur="3.5s" repeatCount="indefinite" path="M 480 295 C 440 295 400 320 280 320" />
                </circle>
                <circle r="2.5">
                  <animateMotion dur="3.2s" repeatCount="indefinite" path="M 500 310 C 440 310 420 430 370 430" />
                </circle>
                
                <circle r="2.5">
                  <animateMotion dur="3s" repeatCount="indefinite" path="M 600 240 C 660 240 680 120 730 120" />
                </circle>
                <circle r="2.5">
                  <animateMotion dur="4s" repeatCount="indefinite" path="M 620 275 C 680 275 720 230 820 230" />
                </circle>
                <circle r="2.5">
                  <animateMotion dur="3.5s" repeatCount="indefinite" path="M 620 295 C 660 295 700 320 820 320" />
                </circle>
                <circle r="2.5">
                  <animateMotion dur="3.2s" repeatCount="indefinite" path="M 600 310 C 660 310 680 430 730 430" />
                </circle>

                <circle r="2.5">
                  <animateMotion dur="2.8s" repeatCount="indefinite" path="M 550 320 C 550 350 550 385 550 420" />
                </circle>
              </g>

            </svg>
          </div>

          {/* Left Card - Performance */}
          <div className="absolute left-[20px] top-[140px] z-10 w-[200px] lg:w-[240px] rounded-[18px] border border-line bg-panel/90 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-white">Performance</h3>
              <div className="rounded border border-line p-1 text-mist">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-mist">The combined growth is <span className="text-shore">↑ 2.39%</span></p>
            
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-white">$6,780</span>
                <span className="text-[10px] text-mist/70">BTC</span>
                <div className="relative mt-2 h-[45px] w-full items-end justify-start overflow-hidden rounded-[4px] bg-[linear-gradient(180deg,#19c1cc_0%,rgba(25,193,204,0.1)_100%)] ring-1 ring-[#19c1cc]/20">
                  <div className="absolute bottom-0 w-full h-[8px] bg-[#19c1cc]" />
                </div>
                <span className="mt-1 text-[9px] text-shore">↑ 2.02%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-white">$4,780</span>
                <span className="text-[10px] text-mist/70">ETH</span>
                <div className="relative mt-2 h-[45px] w-full items-end justify-start overflow-hidden rounded-[4px] bg-[linear-gradient(180deg,#aa3de7_0%,rgba(170,61,231,0.1)_100%)] ring-1 ring-[#aa3de7]/20">
                  <div className="absolute bottom-0 w-full h-[8px] bg-[#aa3de7]" />
                </div>
                <span className="mt-1 text-[9px] text-shore">↑ 1.38%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-white">$7,780</span>
                <span className="text-[10px] text-mist/70">Other</span>
                <div className="relative mt-2 flex h-[45px] w-full items-end justify-between overflow-hidden rounded-[4px] bg-[linear-gradient(180deg,#3de781_0%,rgba(61,231,129,0.1)_100%)] ring-1 ring-[#3de781]/20 p-[2px]">
                   {[...Array(6)].map((_, i) => (
                      <div key={i} className="w-[2px] bg-[#3de781]" style={{ height: `${20 + i * 14}%` }} />
                   ))}
                </div>
                <span className="mt-1 text-[9px] text-shore">↑ 2.56%</span>
              </div>
            </div>
          </div>

          {/* Right Card - Total earnings */}
          <div className="absolute right-[20px] top-[140px] z-10 w-[200px] lg:w-[240px] rounded-[18px] border border-line bg-panel/90 p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-medium text-mist">Total earnings</h3>
              <div className="rounded border border-line p-1 text-mist">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[20px] font-semibold text-white tracking-tight">$17,780.57</span>
              <span className="text-[11px] text-shore">↑ 1.62%</span>
            </div>
            
            <div className="relative mt-5 h-[70px] w-full">
              <svg viewBox="0 0 200 70" preserveAspectRatio="none" className="h-full w-full">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4cc9b0" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#4cc9b0" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0 70 L 0 50 C 40 50, 60 70, 100 60 C 140 50, 160 20, 200 10 L 200 70 Z" fill="url(#areaGrad)" />
                <path d="M 0 50 C 40 50, 60 70, 100 60 C 140 50, 160 20, 200 10" fill="none" stroke="#4cc9b0" strokeWidth="2" strokeLinecap="round" />
                <circle cx="160" cy="27.5" r="4" fill="#fc34c6" stroke="#fff" strokeWidth="1.5" className="shadow-[0_0_10px_#fc34c6]" />
              </svg>
              <div className="absolute right-[15%] top-[10%] rounded bg-white px-2 py-0.5 text-[9px] font-bold text-ink">$14,986</div>
            </div>
            
            <div className="mt-2 flex items-center justify-between text-[9px] text-mist/80">
              <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span>
            </div>
            <div className="absolute left-1 flex h-[60%] flex-col justify-between py-1 text-[8px] text-mist/60">
              <span>20k</span><span>15k</span><span>10k</span><span>5k</span>
            </div>
          </div>

          {/* Central Junction Logo */}
          <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-[140px] w-[140px] sm:h-[170px] sm:w-[170px]">
              <Image src="/finalityLogo.png" alt="Finality logo" fill className="object-contain" priority />
            </div>
          </div>

          {/* Bottom Mid Logo Node */}
          <div className="absolute left-1/2 top-[76%] z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-[-20px] bg-[radial-gradient(circle_at_center,rgba(76,201,176,0.35)_0%,transparent_70%)] blur-md" />
            <div className="relative flex h-[92px] w-[80px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-panel p-[2px]">
              <div className="absolute inset-[2px] [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-ink" />
              <div className="relative z-10 h-9 w-9">
                <Image src="/finalityLogo.png" alt="Finality logo" fill className="object-contain" />
              </div>
            </div>
          </div>

          {/* Surrounding Node Hexagons - Hidden on smaller screens */}
          <div className="absolute left-[280px] lg:left-[330px] top-[70px] z-10 hidden lg:flex h-[90px] w-[80px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[rgba(255,255,255,0.05)] shadow-[0_0_15px_rgba(255,255,255,0.05)] backdrop-blur-md">
            <div className="flex h-[86px] w-[76px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[linear-gradient(135deg,#122b24_0%,#091512_100%)]">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="white"><path d="M15.925 23.969l-9.819-5.794L15.925 32l9.831-13.825-9.831 5.794zM16.075 0L6.256 16.35l9.819 5.819 9.831-5.819L16.075 0z" fill="#fff" opacity="0.8"/></svg>
            </div>
          </div>

          <div className="absolute left-[280px] lg:left-[335px] top-[365px] z-10 hidden lg:flex h-[90px] w-[80px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[rgba(255,255,255,0.05)] backdrop-blur-md">
            <div className="flex h-[86px] w-[76px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[linear-gradient(135deg,#122b24_0%,#091512_100%)]">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="white"><path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16zm-3.2-12.8L16 22.4l3.2-3.2-4.267-4.267L19.2 10.667 16 7.467l-3.2 3.2 4.267 4.267L12.8 19.2zm-6.4 0l3.2 3.2 3.2-3.2-3.2-3.2-3.2 3.2zm12.8-6.4l-3.2-3.2-3.2 3.2 3.2 3.2 3.2-3.2z" fill="#fff" opacity="0.8"/></svg>
            </div>
          </div>

          <div className="absolute right-[280px] lg:right-[330px] top-[70px] z-10 hidden lg:flex h-[90px] w-[80px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[rgba(255,255,255,0.05)] backdrop-blur-md">
            <div className="flex h-[86px] w-[76px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[linear-gradient(135deg,#122b24_0%,#091512_100%)]">
               <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><path d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16z" fill="#26A17B"/><path d="M17.025 10.05h6.65v-3.7H8.324v3.7h6.649v5.044c-2.478.18-4.524 1.258-4.524 2.58 0 1.257 1.868 2.304 4.226 2.535v7.241h2.35v-7.241c2.359-.23 4.225-1.278 4.225-2.535 0-1.322-2.046-2.4-4.225-2.58v-5.044zm0 6.649c-3.141 0-5.717-.55-5.717-1.206 0-.642 2.576-1.18 5.717-1.18 3.167 0 5.717.538 5.717 1.18 0 .656-2.55 1.206-5.717 1.206z" fill="#fff"/></svg>
            </div>
          </div>

          <div className="absolute right-[280px] lg:right-[335px] top-[365px] z-10 hidden lg:flex h-[90px] w-[80px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[rgba(255,255,255,0.05)] backdrop-blur-md">
            <div className="flex h-[86px] w-[76px] items-center justify-center [clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)] bg-[linear-gradient(135deg,#122b24_0%,#091512_100%)]">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><path d="M31.293 16.275c-.326-2.21-2.126-3.411-5.7-4.634.331-1.327.659-2.651.986-3.978L23.46 6.9l-1.025 4.128c-.808-.2-1.616-.395-2.408-.585L21.065 6.3l-3.111-.774-1.004 4.041c-.696-.168-1.383-.332-2.048-.495L14.9 5.86 6.57 7.929l-1.637.408 1.405 5.656c1.077.268 2.053.483 3.01.764.717.21 1.073.498.905 1.173L7.756 25.91a.7.7 0 0 1-.782.529c-1.028-.255-2.074-.515-3.136-.78l-2.028.986 2.062 8.3c1.028.256 2.052.511 3.067.763l-1.054 4.24 3.113.774 1.018-4.095c.813.208 1.625.405 2.454.606l-1.036 4.167 3.113.774 1.047-4.214c4.136.804 7.237.48 8.657-3.23.905-2.368.106-4.502-2.204-5.61 1.233-.526 2.378-1.29 2.766-3.264l-.066-.026zM20.2 24.631c-.961 3.865-7.468 1.83-9.563 1.31l1.71-6.88c2.096.52 8.845 1.579 7.853 5.57zm1.182-9.664c-.88 3.535-6.31 1.765-8.067 1.328l1.554-6.25c1.758.437 7.422 1.272 6.513 4.922z" fill="#fff" opacity="0.8"/></svg>
            </div>
          </div>
          
        </div>

      </div>
    </main>
  );
}