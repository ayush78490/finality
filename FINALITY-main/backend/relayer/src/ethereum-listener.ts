import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { MarketCreatedEvent, DepositMadeEvent, WithdrawalRequestedEvent } from './events';

export class EthereumListener extends EventEmitter {
    private provider: ethers.Provider;
    private contract: ethers.Contract;
    private isListening: boolean = false;
    private pollingInterval: NodeJS.Timeout | null = null;
    private lastProcessedBlock: number = 0;
    private readonly POLL_INTERVAL_MS = 12000; // Poll every 12 seconds (Ethereum block time)

    constructor(
        rpcUrl: string,
        contractAddress: string,
        contractAbi: any[]
    ) {
        super();
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.contract = new ethers.Contract(contractAddress, contractAbi, this.provider);
    }

    async start() {
        if (this.isListening) {
            console.log('Already listening to Ethereum events');
            return;
        }

        console.log('Starting Ethereum event listener...');
        this.isListening = true;

        // Get current block number
        this.lastProcessedBlock = await this.provider.getBlockNumber();
        console.log(`Starting from block ${this.lastProcessedBlock}`);

        // Start polling for events
        this.pollingInterval = setInterval(async () => {
            try {
                await this.pollForEvents();
            } catch (error) {
                console.error('Error polling for events:', error);
            }
        }, this.POLL_INTERVAL_MS);

        console.log('Ethereum listener started successfully (polling mode)');
    }

    private async pollForEvents() {
        const currentBlock = await this.provider.getBlockNumber();

        if (currentBlock <= this.lastProcessedBlock) {
            return; // No new blocks
        }

        const fromBlock = this.lastProcessedBlock + 1;
        const toBlock = currentBlock;

        // Query MarketCreated events
        const marketCreatedFilter = this.contract.filters.MarketCreated();
        const marketCreatedEvents = await this.contract.queryFilter(
            marketCreatedFilter,
            fromBlock,
            toBlock
        );

        for (const event of marketCreatedEvents) {
            if (!('args' in event)) continue;
            const args = event.args;
            if (!args) continue;

            const marketCreated: MarketCreatedEvent = {
                marketId: args[0],
                creator: args[1],
                question: args[2],
                category: args[3],
                yesToken: args[4],
                noToken: args[5],
                endTime: args[6],
                initialYes: args[7],
                initialNo: args[8],
            };

            console.log('MarketCreated event:', marketCreated);
            this.emit('MarketCreated', marketCreated, event.blockNumber);
        }

        // Query DepositMade events
        const depositFilter = this.contract.filters.DepositMade();
        const depositEvents = await this.contract.queryFilter(
            depositFilter,
            fromBlock,
            toBlock
        );

        for (const event of depositEvents) {
            if (!('args' in event)) continue;
            const args = event.args;
            if (!args) continue;

            const deposit: DepositMadeEvent = {
                marketId: args[0],
                user: args[1],
                isYes: args[2],
                amount: args[3],
                timestamp: args[4],
            };

            console.log('DepositMade event:', deposit);
            this.emit('DepositMade', deposit);
        }

        // Query WithdrawalRequested events
        const withdrawalFilter = this.contract.filters.WithdrawalRequested();
        const withdrawalEvents = await this.contract.queryFilter(
            withdrawalFilter,
            fromBlock,
            toBlock
        );

        for (const event of withdrawalEvents) {
            if (!('args' in event)) continue;
            const args = event.args;
            if (!args) continue;

            const withdrawal: WithdrawalRequestedEvent = {
                marketId: args[0],
                user: args[1],
                isYes: args[2],
                tokenAmount: args[3],
                timestamp: args[4],
            };

            console.log('WithdrawalRequested event:', withdrawal);
            this.emit('WithdrawalRequested', withdrawal);
        }

        // Update last processed block
        this.lastProcessedBlock = toBlock;

        if (marketCreatedEvents.length > 0 || depositEvents.length > 0 || withdrawalEvents.length > 0) {
            console.log(`Processed blocks ${fromBlock}-${toBlock}: ${marketCreatedEvents.length} markets, ${depositEvents.length} deposits, ${withdrawalEvents.length} withdrawals`);
        }
    }

    async stop() {
        if (!this.isListening) {
            return;
        }

        console.log('Stopping Ethereum event listener...');

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        this.isListening = false;
        console.log('Ethereum listener stopped');
    }

    async getBlockNumber(): Promise<number> {
        return await this.provider.getBlockNumber();
    }
}
