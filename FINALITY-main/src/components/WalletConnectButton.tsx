'use client';

import React, { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function WalletConnectButton() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold transition-all duration-200"
                style={{
                    backgroundColor: 'var(--color-accent-primary)',
                    color: '#000000',
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                }}
                disabled
            >
                Loading...
            </button>
        );
    }

    return (
        <ConnectButton.Custom>
            {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
            }) => {
                const ready = mounted && authenticationStatus !== 'loading';
                const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus || authenticationStatus === 'authenticated');

                return (
                    <div
                        {...(!ready && {
                            'aria-hidden': true,
                            style: {
                                opacity: 0,
                                pointerEvents: 'none',
                                userSelect: 'none',
                            },
                        })}
                    >
                        {(() => {
                            if (!connected) {
                                return (
                                    <button
                                        onClick={openConnectModal}
                                        type="button"
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold transition-all duration-200 hover:-translate-y-0.5"
                                        style={{
                                            backgroundColor: 'var(--color-accent-primary)',
                                            color: '#000000',
                                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                                            boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                                        }}
                                    >
                                        Connect Wallet
                                    </button>
                                );
                            }

                            if (chain.unsupported) {
                                return (
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--color-danger)',
                                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                                        }}
                                    >
                                        Wrong network
                                    </button>
                                );
                            }

                            return (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={openChainModal}
                                        type="button"
                                        className="inline-flex items-center gap-2 px-4 py-2 font-medium transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            border: '2px solid var(--color-border-light)',
                                            color: 'var(--color-text-primary)',
                                            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
                                        }}
                                    >
                                        {chain.hasIcon && (
                                            <div
                                                style={{
                                                    background: chain.iconBackground,
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: 999,
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {chain.iconUrl && (
                                                    <img
                                                        alt={chain.name ?? 'Chain icon'}
                                                        src={chain.iconUrl}
                                                        style={{ width: 16, height: 16 }}
                                                    />
                                                )}
                                            </div>
                                        )}
                                        {chain.name}
                                    </button>

                                    <button
                                        onClick={openAccountModal}
                                        type="button"
                                        className="inline-flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-200 hover:-translate-y-0.5"
                                        style={{
                                            backgroundColor: 'var(--color-accent-primary)',
                                            color: '#000000',
                                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
                                            boxShadow: '0 0 20px rgba(255, 255, 255, 0.5)',
                                        }}
                                    >
                                        {account.displayName}
                                        {account.displayBalance ? ` (${account.displayBalance})` : ''}
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                );
            }}
        </ConnectButton.Custom>
    );
}
