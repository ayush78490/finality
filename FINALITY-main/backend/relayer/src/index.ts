import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { EthereumListener } from './ethereum-listener';
import { VaraClient } from './vara-client';
import { MarketCreatedEvent, DepositMadeEvent, WithdrawalRequestedEvent } from './events';

dotenv.config();

class RelayerService {
    private ethereumListener!: EthereumListener;
    private varaClient: VaraClient;
    private settlementContract!: ethers.Contract;
    private wallet: ethers.Wallet;
    private contractAddress: string | null = null;

    constructor() {
        // Initialize Ethereum components
        const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL!);
        this.wallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider);

        // Initialize Vara client
        this.varaClient = new VaraClient(
            process.env.VARA_NODE_URL!,
            process.env.VARA_PROGRAM_ID!
        );
    }

    private async resolveContractAddress(): Promise<string> {
        const addressOrName = process.env.SETTLEMENT_CONTRACT_ADDRESS!;

        if (ethers.isAddress(addressOrName)) {
            return addressOrName;
        }

        console.log(`Resolving ENS name: ${addressOrName}...`);
        const provider = this.wallet.provider!;
        const resolvedAddress = await provider.resolveName(addressOrName);

        if (!resolvedAddress) {
            throw new Error(`Failed to resolve ENS name: ${addressOrName}`);
        }

        console.log(`Resolved ${addressOrName} to ${resolvedAddress}`);
        return resolvedAddress;
    }

    private initializeEthereumComponents(address: string) {
        this.contractAddress = address;

        const settlementAbi = [
            'function finalizeTradeFromVara(uint256 marketId, address user, bool isYes, uint256 amountIn, uint256 tokensOut, uint256 creatorFee, uint256 platformFee, bytes32 varaStateHash) external',
            'function finalizeWithdrawalFromVara(uint256 marketId, address user, uint256 ethOut, uint256 creatorFee, uint256 platformFee, bytes32 varaStateHash) external',
            'function resolveMarket(uint256 marketId, uint8 outcomeIndex, bytes32 finalStateHash) external',
        ];

        this.settlementContract = new ethers.Contract(
            address,
            settlementAbi,
            this.wallet
        );

        // Initialize Ethereum listener
        const contractAbi = [
            'event MarketCreated(uint256 indexed marketId, address indexed creator, string question, string category, address yesToken, address noToken, uint256 endTime, uint256 initialYes, uint256 initialNo)',
            'event DepositMade(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 timestamp)',
            'event WithdrawalRequested(uint256 indexed marketId, address indexed user, bool isYes, uint256 tokenAmount, uint256 timestamp)',
        ];

        this.ethereumListener = new EthereumListener(
            process.env.ETHEREUM_RPC_URL!,
            address,
            contractAbi
        );

        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        // Handle MarketCreated events
        this.ethereumListener.on('MarketCreated', async (event: MarketCreatedEvent, blockNumber: number) => {
            try {
                console.log(`Processing MarketCreated for market ${event.marketId}`);

                await this.varaClient.initializeMarket({
                    marketId: event.marketId.toString(),
                    initialYes: event.initialYes.toString(),
                    initialNo: event.initialNo.toString(),
                    ethereumBlock: blockNumber.toString(),
                });

                console.log(`Market ${event.marketId} initialized on Vara`);
            } catch (error) {
                console.error('Error processing MarketCreated:', error);
            }
        });

        // Handle DepositMade events
        this.ethereumListener.on('DepositMade', async (event: DepositMadeEvent) => {
            try {
                console.log(`Processing deposit for market ${event.marketId}`);

                const result = await this.varaClient.executeTrade({
                    marketId: event.marketId.toString(),
                    user: event.user,
                    isYes: event.isYes,
                    amount: event.amount.toString(),
                });

                // Submit result back to Ethereum
                const tx = await this.settlementContract.finalizeTradeFromVara(
                    result.marketId,
                    result.user,
                    result.isYes,
                    result.amountIn,
                    result.tokensOut,
                    result.creatorFee,
                    result.platformFee,
                    result.stateHash
                );

                await tx.wait();
                console.log(`Trade finalized on Ethereum for market ${event.marketId}`);
            } catch (error) {
                console.error('Error processing deposit:', error);
            }
        });

        // Handle WithdrawalRequested events
        this.ethereumListener.on('WithdrawalRequested', async (event: WithdrawalRequestedEvent) => {
            try {
                console.log(`Processing withdrawal for market ${event.marketId}`);

                const result = await this.varaClient.calculateWithdrawal({
                    marketId: event.marketId.toString(),
                    user: event.user,
                    isYes: event.isYes,
                    tokenAmount: event.tokenAmount.toString(),
                });

                // Submit result back to Ethereum
                const tx = await this.settlementContract.finalizeWithdrawalFromVara(
                    result.marketId,
                    result.user,
                    result.ethOut,
                    result.creatorFee,
                    result.platformFee,
                    result.stateHash
                );

                await tx.wait();
                console.log(`Withdrawal finalized on Ethereum for market ${event.marketId}`);
            } catch (error) {
                console.error('Error processing withdrawal:', error);
            }
        });
    }

    async start() {
        console.log('Starting Relayer Service...');

        // Resolve contract address if it's an ENS name
        const address = await this.resolveContractAddress();
        this.initializeEthereumComponents(address);

        // Connect to Vara
        await this.varaClient.connect();
        await this.varaClient.startListening();

        // Start Ethereum listener
        await this.ethereumListener.start();

        console.log('Relayer Service started successfully');
        console.log(`Ethereum: ${process.env.ETHEREUM_RPC_URL}`);
        console.log(`Vara: ${process.env.VARA_NODE_URL}`);
        console.log(`Settlement Contract: ${this.contractAddress} (${process.env.SETTLEMENT_CONTRACT_ADDRESS})`);
        console.log(`Vara Program: ${process.env.VARA_PROGRAM_ID}`);
    }

    async stop() {
        console.log('Stopping Relayer Service...');
        await this.ethereumListener.stop();
        await this.varaClient.disconnect();
        console.log('Relayer Service stopped');
    }
}

// Main execution
async function main() {
    const relayer = new RelayerService();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nReceived SIGINT, shutting down gracefully...');
        await relayer.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nReceived SIGTERM, shutting down gracefully...');
        await relayer.stop();
        process.exit(0);
    });

    await relayer.start();
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
