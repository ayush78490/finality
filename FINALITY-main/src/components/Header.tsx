'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Button from './ui/Button';
import WalletConnectButton from './WalletConnectButton';

export default function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <header
            className="sticky top-0 z-[1020] backdrop-blur-xl py-4"
            style={{
                backgroundColor: 'rgba(10, 10, 15, 0.95)',
                borderBottom: '1px solid var(--color-border)',
            }}
        >
            <div className="container max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between gap-8">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 text-xl font-bold no-underline transition-opacity hover:opacity-80" style={{ color: 'var(--color-text-primary)' }}>
                        <span className="text-3xl">⚡</span>
                        <span className="text-gradient">Finality</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8 flex-1 ml-12">
                        <Link href="/markets" className="relative font-medium no-underline transition-colors group" style={{ color: 'var(--color-text-secondary)' }}>
                            Markets
                            <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 transition-all group-hover:w-full" style={{ backgroundColor: 'var(--color-accent-primary)' }}></span>
                        </Link>
                        <Link href="/how-it-works" className="relative font-medium no-underline transition-colors group" style={{ color: 'var(--color-text-secondary)' }}>
                            How it Works
                            <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 transition-all group-hover:w-full" style={{ backgroundColor: 'var(--color-accent-primary)' }}></span>
                        </Link>
                        <a
                            href="/docs"
                            className="relative font-medium no-underline transition-colors group"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Docs
                            <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 transition-all group-hover:w-full" style={{ backgroundColor: 'var(--color-accent-primary)' }}></span>
                        </a>
                    </nav>

                    {/* CTA Button */}
                    <div className="hidden md:flex items-center gap-4">
                        <WalletConnectButton />
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden bg-transparent border-none text-3xl cursor-pointer p-2 transition-opacity hover:opacity-70"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {mobileMenuOpen ? '✕' : '☰'}
                    </button>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="flex md:hidden flex-col gap-4 pt-6 pb-4 mt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <Link
                            href="/markets"
                            className="font-medium no-underline p-4 rounded-lg transition-all"
                            onClick={() => setMobileMenuOpen(false)}
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Markets
                        </Link>
                        <Link
                            href="/how-it-works"
                            className="font-medium no-underline p-4 rounded-lg transition-all"
                            onClick={() => setMobileMenuOpen(false)}
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            How it Works
                        </Link>
                        <a
                            href="https://docs.finality.xyz"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium no-underline p-4 rounded-lg transition-all"
                            onClick={() => setMobileMenuOpen(false)}
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Docs
                        </a>
                        <div className="mt-4">
                            <WalletConnectButton />
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
