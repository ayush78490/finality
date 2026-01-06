import { createPublicClient, http, defineChain } from "viem";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const hoodi = defineChain({
    id: 560048,
    name: "Hoodi Testnet",
    network: "hoodi",
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: { 
        default: { 
            http: [process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"] 
        } 
    },
    testnet: true,
});

async function main() {
    const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    
    if (!settlementAddress || !mirrorAddress) {
        throw new Error("Contract addresses not set in .env");
    }

    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== Verifying Contracts via RPC (No Explorer Needed) ===\n");
    console.log(`Network: Hoodi Testnet (Chain ID: 560048)`);
    console.log(`RPC: https://hoodi-reth-rpc.gear-tech.io\n`);

    // Check Settlement Contract
    console.log("1️⃣ Settlement Contract:");
    console.log(`   Address: ${settlementAddress}`);
    try {
        const code = await publicClient.getBytecode({ 
            address: settlementAddress as `0x${string}` 
        });
        if (code && code !== '0x') {
            console.log(`   ✅ Contract exists (${(code.length - 2) / 2} bytes)`);
            
            // Try to read a public variable
            const contract = await publicClient.readContract({
                address: settlementAddress as `0x${string}`,
                abi: [{
                    type: 'function',
                    name: 'nextMarketId',
                    inputs: [],
                    outputs: [{ type: 'uint256' }],
                    stateMutability: 'view'
                }],
                functionName: 'nextMarketId',
            });
            console.log(`   ✅ Contract is active (nextMarketId: ${contract.toString()})`);
        } else {
            console.log(`   ❌ No code at this address`);
        }
    } catch (error: any) {
        console.log(`   ⚠️  Error: ${error.message}`);
    }

    // Check Mirror Contract
    console.log("\n2️⃣ Mirror Contract:");
    console.log(`   Address: ${mirrorAddress}`);
    try {
        const code = await publicClient.getBytecode({ 
            address: mirrorAddress as `0x${string}` 
        });
        if (code && code !== '0x') {
            console.log(`   ✅ Contract exists (${(code.length - 2) / 2} bytes)`);
            
            const stateHash = await publicClient.readContract({
                address: mirrorAddress as `0x${string}`,
                abi: [{
                    type: 'function',
                    name: 'stateHash',
                    inputs: [],
                    outputs: [{ type: 'bytes32' }],
                    stateMutability: 'view'
                }],
                functionName: 'stateHash',
            });
            console.log(`   ✅ State Hash: ${stateHash}`);
        } else {
            console.log(`   ❌ No code at this address`);
        }
    } catch (error: any) {
        console.log(`   ⚠️  Error: ${error.message}`);
    }

    // Get block info
    console.log("\n3️⃣ Network Info:");
    try {
        const blockNumber = await publicClient.getBlockNumber();
        const block = await publicClient.getBlock({ blockNumber });
        console.log(`   Current Block: ${blockNumber}`);
        console.log(`   Block Hash: ${block.hash}`);
        console.log(`   Timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
    } catch (error: any) {
        console.log(`   ⚠️  Error: ${error.message}`);
    }

    console.log("\n=== Alternative Ways to View Contracts ===");
    console.log("\n1. Use RPC directly (no explorer needed):");
    console.log("   - All contract data is accessible via RPC");
    console.log("   - Use: npm run test-contract");
    console.log("\n2. Check transaction hashes:");
    console.log("   - Your contracts are on-chain (verified above)");
    console.log("   - Transactions are recorded on Hoodi testnet");
    console.log("\n3. Use MetaMask:");
    console.log("   - Add Hoodi Testnet to MetaMask");
    console.log("   - View contracts in MetaMask's activity tab");
    console.log("\n4. Alternative Explorers (if available):");
    console.log("   - Try: https://blockscout.com (if Hoodi is supported)");
    console.log("   - Or use RPC calls directly (most reliable)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
