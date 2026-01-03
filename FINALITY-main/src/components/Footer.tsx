import React from 'react';
import Link from 'next/link';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="pt-16 pb-8 mt-16" style={{ backgroundColor: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)' }}>
            <div className="container max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2fr] gap-12 mb-12">
                    {/* Logo & Description */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            <span className="text-3xl">⚡</span>
                            <span className="text-gradient">Finality</span>
                        </div>
                        <p className="text-base m-0" style={{ color: 'var(--color-text-tertiary)' }}>
                            Where markets meet truth.
                        </p>
                    </div>

                    {/* Links */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col gap-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-primary)' }}>Product</h4>
                            <Link href="/markets" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>Markets</Link>
                            <Link href="#how-it-works" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>How it Works</Link>
                            <Link href="#" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>Create Market</Link>
                        </div>

                        <div className="flex flex-col gap-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-primary)' }}>Resources</h4>
                            <a
                                href="https://docs.finality.xyz"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="no-underline text-sm transition-colors hover:opacity-80"
                                style={{ color: 'var(--color-text-tertiary)' }}
                            >
                                Documentation
                            </a>
                            <a
                                href="https://github.com/finality"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="no-underline text-sm transition-colors hover:opacity-80"
                                style={{ color: 'var(--color-text-tertiary)' }}
                            >
                                GitHub
                            </a>
                            <Link href="#" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>API</Link>
                        </div>

                        <div className="flex flex-col gap-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-primary)' }}>Legal</h4>
                            <Link href="#" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>Terms of Service</Link>
                            <Link href="#" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>Privacy Policy</Link>
                            <Link href="#" className="no-underline text-sm transition-colors hover:opacity-80" style={{ color: 'var(--color-text-tertiary)' }}>Disclaimer</Link>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 text-center md:text-left" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>
                        © {currentYear} Finality. All rights reserved.
                    </p>
                    <div className="flex items-center gap-2 px-4 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-success)' }}></span>
                        <span>Ethereum Compatible</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
