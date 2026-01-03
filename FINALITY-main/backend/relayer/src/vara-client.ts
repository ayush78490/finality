import { EventEmitter } from 'events';
import { GearApi, GearKeyring } from '@gear-js/api';
import {
    VaraInitializeMarket,
    VaraExecuteTrade,
    VaraCalculateWithdrawal,
    VaraTradeResult,
    VaraWithdrawalResult,
} from './events';

/**
 * Vara client for interacting with the Vara network
 * 
 * DEVELOPMENT MODE: Currently using mock responses for testing
 * To use real Vara program, set VARA_USE_MOCK=false in .env
 */
export class VaraClient extends EventEmitter {
    private programId: string;
    private isConnected: boolean = false;
    private useMock: boolean;
    private api: GearApi | null = null;
    private seed: string | null = null;

    constructor(
        private nodeUrl: string,
        programId: string
    ) {
        super();
        this.programId = programId;

        // Debug logging for environment
        console.log('[DEBUG] process.env.VARA_USE_MOCK value:', process.env.VARA_USE_MOCK);
        console.log('[DEBUG] process.env.VARA_USE_MOCK type:', typeof process.env.VARA_USE_MOCK);

        this.useMock = process.env.VARA_USE_MOCK !== 'false';
        this.seed = process.env.VARA_SEED || null;

        console.log(`[DEBUG] VaraClient initialized with useMock=${this.useMock}`);

        if (this.useMock) {
            console.log('⚠️  Vara client running in MOCK mode');
        } else if (!this.seed) {
            console.warn('⚠️  Vara client running without VARA_SEED in production mode. Transactions will fail.');
        } else {
            console.log('✅ Vara client running in PRODUCTION mode');
        }
    }

    async connect() {
        if (this.isConnected) {
            console.log('Already connected to Vara');
            return;
        }

        if (this.useMock) {
            console.log(`Mock Vara client initialized (program: ${this.programId})`);
            this.isConnected = true;
            return;
        }

        console.log(`Connecting to Vara node at ${this.nodeUrl}...`);

        try {
            this.api = await GearApi.create({ providerAddress: this.nodeUrl });
            this.isConnected = true;
            console.log('Connected to Vara successfully');
        } catch (error) {
            console.error('Failed to connect to Vara:', error);
            throw error;
        }
    }

    async disconnect() {
        if (!this.isConnected || !this.api) {
            return;
        }

        console.log('Disconnecting from Vara...');
        await this.api.disconnect();
        this.isConnected = false;
        console.log('Disconnected from Vara');
    }

    /**
     * Initialize market on Vara
     */
    async initializeMarket(params: VaraInitializeMarket): Promise<void> {
        console.log('Initializing market on Vara:', params);

        if (this.useMock) {
            console.log(`✓ Mock: Market ${params.marketId} initialized`);
            return;
        }

        const payload = {
            InitializeMarket: {
                market_id: Number(params.marketId),
                initial_yes: params.initialYes,
                initial_no: params.initialNo,
                ethereum_block: params.ethereumBlock,
            }
        };

        await this.sendMessage(payload);
    }

    /**
     * Execute trade on Vara
     */
    async executeTrade(params: VaraExecuteTrade): Promise<VaraTradeResult> {
        console.log(`[DEBUG] executeTrade called (useMock=${this.useMock})`, params);

        if (this.useMock) {
            return this.mockExecuteTrade(params);
        }

        const payload = {
            ExecuteTrade: {
                market_id: Number(params.marketId),
                user: params.user,
                is_yes: params.isYes,
                amount: params.amount,
            }
        };

        const txResult = await this.sendMessage(payload);

        // In production, we would ideally decode the response from the block
        // For now, return a success result based on the trade parameters
        return {
            marketId: params.marketId,
            user: params.user,
            isYes: params.isYes,
            amountIn: params.amount,
            tokensOut: params.amount, // Simplified or could call mock to get estimate
            creatorFee: '0',
            platformFee: '0',
            newYesPool: '0',
            newNoPool: '0',
            stateHash: txResult.status === 'sent' ? 'pending' : 'error'
        };
    }

    /**
     * Calculate withdrawal on Vara
     */
    async calculateWithdrawal(params: VaraCalculateWithdrawal): Promise<VaraWithdrawalResult> {
        console.log(`[DEBUG] calculateWithdrawal called (useMock=${this.useMock})`, params);

        if (this.useMock) {
            return this.mockCalculateWithdrawal(params);
        }

        const payload = {
            CalculateWithdrawal: {
                market_id: Number(params.marketId),
                user: params.user,
                token_amount: params.tokenAmount,
            }
        };

        const txResult = await this.sendMessage(payload);

        return {
            marketId: params.marketId,
            user: params.user,
            ethOut: params.tokenAmount, // Simplified
            creatorFee: '0',
            platformFee: '0',
            stateHash: txResult.status === 'sent' ? 'pending' : 'error'
        };
    }

    /**
     * Listen for Vara events
     */
    async startListening() {
        console.log('Starting Vara event listener...');

        if (this.useMock) {
            console.log('✓ Mock: Event listener started');
            return;
        }

        if (!this.api) throw new Error('Not connected to Vara');

        this.api.gearEvents.subscribeToGearEvent('UserMessageSent', (event) => {
            const { message } = event.data;
            if (message.destination.toHex() === this.programId) {
                this.handleVaraEvent(message);
            }
        });
    }

    private async sendMessage(payload: any): Promise<any> {
        if (!this.api) throw new Error('Not connected to Vara');
        if (!this.seed) throw new Error('VARA_SEED not provided');

        let accountability;
        try {
            // Check if it's a hex seed or mnemonic
            if (this.seed.startsWith('0x')) {
                accountability = await GearKeyring.fromSeed(this.seed as `0x${string}`);
            } else {
                accountability = await GearKeyring.fromMnemonic(this.seed);
            }
        } catch (error) {
            console.error('❌ Failed to initialize Vara account from seed. Please check VARA_SEED in .env');
            console.error('Error detail:', error instanceof Error ? error.message : String(error));
            console.warn('Note: A hex seed should be 32 bytes (64 hex characters + 0x prefix).');
            throw error;
        }

        const message = {
            destination: this.programId as `0x${string}`,
            payload,
            gasLimit: 10_000_000_000, // Adjust gas as needed
            value: 0,
        };

        console.log('Sending message to Vara...', payload);

        try {
            const extrinsic = this.api.message.send(message);
            await extrinsic.signAndSend(accountability, (result) => {
                if (result.status.isInBlock) {
                    console.log(`✅ Message included in block: ${result.status.asInBlock.toHex()}`);
                }
            });
            return { status: 'sent' };
        } catch (error) {
            console.error('❌ Error sending Vara message:', error);
            throw error;
        }
    }

    private handleVaraEvent(event: any) {
        // Decode and emit events
        console.log('Vara event received:', event);
        this.emit('VaraEvent', event);
    }

    // ============ MOCK IMPLEMENTATIONS ============

    private mockExecuteTrade(params: VaraExecuteTrade): VaraTradeResult {
        const amountIn = BigInt(params.amount);

        // Calculate fees (3% total: 2% creator + 1% platform)
        const totalFee = (amountIn * BigInt(3)) / BigInt(100);
        const creatorFee = (amountIn * BigInt(2)) / BigInt(100);
        const platformFee = (amountIn * BigInt(1)) / BigInt(100);

        // Simple AMM mock: 1.1x output (simplified)
        const tokensOut = amountIn + (amountIn / BigInt(10));

        // Mock pool state (would be calculated by real AMM)
        const mockYesPool = '1000000000000000000'; // 1 ETH
        const mockNoPool = '1000000000000000000';  // 1 ETH

        const result: VaraTradeResult = {
            marketId: params.marketId,
            user: params.user,
            isYes: params.isYes,
            amountIn: params.amount,
            tokensOut: tokensOut.toString(),
            creatorFee: creatorFee.toString(),
            platformFee: platformFee.toString(),
            newYesPool: mockYesPool,
            newNoPool: mockNoPool,
            stateHash: this.generateMockHash(params.marketId, amountIn.toString()),
        };

        console.log('✓ Mock trade result:', {
            tokensOut: result.tokensOut,
            fees: `${creatorFee} + ${platformFee}`,
        });

        return result;
    }

    private mockCalculateWithdrawal(params: VaraCalculateWithdrawal): VaraWithdrawalResult {
        const tokenAmount = BigInt(params.tokenAmount);

        // Simple mock: 1:1 withdrawal minus fees
        const ethOut = tokenAmount;
        const totalFee = (ethOut * BigInt(3)) / BigInt(100);
        const creatorFee = (ethOut * BigInt(2)) / BigInt(100);
        const platformFee = (ethOut * BigInt(1)) / BigInt(100);

        const result: VaraWithdrawalResult = {
            marketId: params.marketId,
            user: params.user,
            ethOut: ethOut.toString(),
            creatorFee: creatorFee.toString(),
            platformFee: platformFee.toString(),
            stateHash: this.generateMockHash(params.marketId, tokenAmount.toString()),
        };

        console.log('✓ Mock withdrawal result:', {
            ethOut: result.ethOut,
            fees: `${creatorFee} + ${platformFee}`,
        });

        return result;
    }

    private generateMockHash(marketId: string, data: string): string {
        // Simple mock hash generation
        const combined = `${marketId}-${data}-${Date.now()}`;
        let hash = '0x';
        for (let i = 0; i < 64; i++) {
            hash += Math.floor(Math.random() * 16).toString(16);
        }
        return hash;
    }
}
