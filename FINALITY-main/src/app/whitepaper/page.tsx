'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, FileText, ArrowLeft, Shield, Cpu, Zap, Share2 } from 'lucide-react';
import Link from 'next/link';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

export default function WhitepaperPage() {
    const reportTemplateRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownloadPDF = async () => {
        if (isGenerating) return;

        const input = reportTemplateRef.current;
        if (!input) {
            toast.error('Could not find whitepaper content');
            return;
        }

        try {
            setIsGenerating(true);
            toast.info('Generating PDF, please wait...');

            // Wait for animations/layouts to settle
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save('Finality_Whitepaper.pdf');
            toast.success('Whitepaper downloaded successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Failed to generate PDF. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Navigation & Actions */}
                <div className="flex justify-between items-center mb-12">
                    <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" /> Back to Home
                    </Link>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <FileDown className="w-5 h-5" /> Download PDF
                            </>
                        )}
                    </button>
                </div>

                {/* Whitepaper Content Container (Target for PDF) */}
                <div
                    ref={reportTemplateRef}
                    className="bg-white text-black p-12 PageShadow rounded-lg overflow-hidden"
                    style={{ minHeight: '1100px' }}
                >
                    {/* Header Block */}
                    <div className="border-b-2 border-black pb-8 mb-12 flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Finality Protocol</h1>
                            <p className="text-gray-600 font-mono text-sm">v1.2.0 | Technical Whitepaper | January 2026</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold">vara.eth</p>
                            <p className="text-xs text-gray-400">Core Settlement Layer</p>
                        </div>
                    </div>

                    {/* Abstract */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                            <FileText className="w-6 h-6 text-blue-600" /> Abstract
                        </h2>
                        <p className="leading-relaxed text-gray-800 italic bg-gray-50 p-6 border-l-4 border-blue-600">
                            Finality is an asynchronous cross-chain prediction market protocol that decouples asset settlement from trade computation.
                            By utilizing the Vara Network for its high-throughput, WASM-based execution environment and Ethereum for its robust
                            liquidity and security, Finality achieves sub-second trade execution on low-latency outcomes while maintaining
                            non-custodial security of underlying ETH assets. We introduce the concept of ENS-based infrastructure resolution through "vara.eth".
                        </p>
                    </section>

                    {/* Infrastructure */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                            <Cpu className="w-6 h-6 text-gray-700" /> I. Cross-Chain Architecture
                        </h2>
                        <div className="grid grid-cols-2 gap-8 mb-6">
                            <div className="p-4 border border-gray-200 rounded-xl">
                                <h3 className="font-bold mb-2">Computational Layer (Vara)</h3>
                                <p className="text-sm text-gray-600">
                                    Handles the Automated Market Maker (AMM) logic and bonding curve calculations.
                                    Ensures that market odds are updated in parallel with no bottleneck.
                                </p>
                            </div>
                            <div className="p-4 border border-gray-200 rounded-xl">
                                <h3 className="font-bold mb-2">Settlement Layer (Ethereum)</h3>
                                <p className="text-sm text-gray-600">
                                    A smart contract repository on Sepolia/Mainnet that holds collateral and mints
                                    outcome tokens (YES/NO) upon verified instruction from the relayer.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* ENS Resolution */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                            <Shield className="w-6 h-6 text-gray-700" /> II. ENS Utility: vara.eth
                        </h2>
                        <p className="leading-relaxed text-gray-700 mb-4">
                            The protocol identifies the Settlement Contract through the <span className="font-mono bg-gray-100 px-1">vara.eth</span> handle.
                            This provides several architectural advantages:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-gray-600">
                            <li><strong>Resilience</strong>: Contract upgrades do not require frontend or relayer hard-redeployments.</li>
                            <li><strong>Transparency</strong>: Users can verify the contract address via a human-readable name.</li>
                            <li><strong>Interoperability</strong>: External tools can resolve the protocol's entry point dynamically.</li>
                        </ul>
                    </section>

                    {/* AMM Logic */}
                    <section className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                            <Zap className="w-6 h-6 text-gray-700" /> III. Algorithmic Market Making
                        </h2>
                        <p className="leading-relaxed text-gray-700 mb-4">
                            Finality employs a Constant Product Market Maker (CPMM) model, adapted for prediction markets.
                            The pricing is governed by the ratio of YES/NO tokens in the Vara-managed pools.
                        </p>
                        <div className="bg-gray-900 text-green-400 p-8 rounded-xl font-mono text-lg text-center my-8">
                            Price_Yes = Pool_No / (Pool_Yes + Pool_No)
                        </div>
                    </section>

                    {/* Conclusion */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 uppercase tracking-tight flex items-center gap-2">
                            <Share2 className="w-6 h-6 text-gray-700" /> IV. Conclusion
                        </h2>
                        <p className="leading-relaxed text-gray-700">
                            Finality represents the convergence of high-performance asynchronous computation and stable, secure settlement.
                            By offloading the "thinking" to Vara and the "holding" to Ethereum, we provide the ultimate trading experience for the prediction of future events.
                        </p>
                    </section>

                    {/* Footer for PDF */}
                    <div className="mt-20 pt-8 border-t border-gray-100 text-center text-gray-400 text-xs uppercase tracking-widest">
                        Confidential Technical Document | © 2026 Finality Protocol
                    </div>
                </div>

                <style jsx>{`
                    .PageShadow {
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    }
                    @media print {
                        .no-print { display: none; }
                    }
                `}</style>
            </div>
        </div>
    );
}
