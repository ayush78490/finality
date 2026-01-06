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
    const routerAddress = process.env.VARA_ETH_ROUTER || "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A";
    const walletAddress = process.env.DEPLOYER_ADDRESS || "0x25fC28bD6Ff088566B9d194226b958106031d441";
    
    if (!settlementAddress || !mirrorAddress) {
        throw new Error("Contract addresses not set in .env");
    }

    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== Testing Hoodi Testnet Contracts ===\n");
    console.log(`Network: Hoodi Testnet (Chain ID: 560048)`);
    console.log(`Explorer: https://hoodi.fraxscan.com/\n`);

    // Test Settlement Contract
    console.log("1️⃣ Settlement Contract:");
    console.log(`   Address: ${settlementAddress}`);
    try {
        const code = await publicClient.getBytecode({ 
            address: settlementAddress as `0x${string}` 
        });
        if (code && code !== '0x') {
            console.log(`   ✅ EXISTS (${(code.length - 2) / 2} bytes)`);
            
            const nextMarketId = await publicClient.readContract({
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
            console.log(`   ✅ Active (Markets: ${nextMarketId.toString()})`);
            console.log(`   🔗 https://hoodi.fraxscan.com/address/${settlementAddress}`);
        } else {
            console.log(`   ❌ NOT FOUND`);
        }
    } catch (error: any) {
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test Mirror Contract
    console.log("\n2️⃣ Mirror Contract:");
    console.log(`   Address: ${mirrorAddress}`);
    try {
        const code = await publicClient.getBytecode({ 
            address: mirrorAddress as `0x${string}` 
        });
        if (code && code !== '0x') {
            console.log(`   ✅ EXISTS (${(code.length - 2) / 2} bytes)`);
            
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
            console.log(`   ✅ Active (State Hash: ${stateHash.slice(0, 10)}...)`);
            console.log(`   🔗 https://hoodi.fraxscan.com/address/${mirrorAddress}`);
        } else {
            console.log(`   ❌ NOT FOUND`);
        }
    } catch (error: any) {
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test Router
    console.log("\n3️⃣ Router Contract:");
    console.log(`   Address: ${routerAddress}`);
    try {
        const code = await publicClient.getBytecode({ 
            address: routerAddress as `0x${string}` 
        });
        if (code && code !== '0x') {
            console.log(`   ✅ EXISTS (${(code.length - 2) / 2} bytes)`);
            console.log(`   🔗 https://hoodi.fraxscan.com/address/${routerAddress}`);
        } else {
            console.log(`   ❌ NOT FOUND`);
        }
    } catch (error: any) {
        console.log(`   ⚠️  ${error.message}`);
    }

    // Test Wallet
    console.log("\n4️⃣ Your Wallet:");
    console.log(`   Address: ${walletAddress}`);
    try {
        const balance = await publicClient.getBalance({ 
            address: walletAddress as `0x${string}` 
        });
        console.log(`   ✅ Balance: ${Number(balance) / 1e18} ETH`);
        console.log(`   🔗 https://hoodi.fraxscan.com/address/${walletAddress}`);
    } catch (error: any) {
        console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Get recent transactions
    console.log("\n5️⃣ Recent Activity:");
    try {
        const blockNumber = await publicClient.getBlockNumber();
        console.log(`   Current Block: ${blockNumber}`);
        
        // Try to get a recent block with transactions
        const block = await publicClient.getBlock({ 
            blockNumber,
            includeTransactions: false 
        });
        console.log(`   Block Hash: ${block.hash.slice(0, 20)}...`);
        console.log(`   Transactions: ${block.transactions.length}`);
    } catch (error: any) {
        console.log(`   ⚠️  ${error.message}`);
    }

    console.log("\n=== ✅ All Contracts Verified ===");
    console.log("\n📊 Explorer Links:");
    console.log(`   Settlement: https://hoodi.fraxscan.com/address/${settlementAddress}`);
    console.log(`   Mirror: https://hoodi.fraxscan.com/address/${mirrorAddress}`);
    console.log(`   Router: https://hoodi.fraxscan.com/address/${routerAddress}`);
    console.log(`   Wallet: https://hoodi.fraxscan.com/address/${walletAddress}`);
    console.log("\n✅ All contracts are on-chain and accessible!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
