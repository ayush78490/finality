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
    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        throw new Error("MARKET_ENGINE_MIRROR_ADDRESS not set in .env");
    }

    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== Verifying Mirror Contract Deployment ===\n");
    console.log(`Mirror Address: ${mirrorAddress}`);
    console.log(`Network: Hoodi Testnet (Chain ID: 560048)\n`);

    // Mirror contract ABI (minimal - just what we need to verify)
    const mirrorABI = [
        {
            type: 'function',
            name: 'stateHash',
            inputs: [],
            outputs: [{ type: 'bytes32' }],
            stateMutability: 'view'
        },
        {
            type: 'function',
            name: 'exited',
            inputs: [],
            outputs: [{ type: 'bool' }],
            stateMutability: 'view'
        },
        {
            type: 'function',
            name: 'nonce',
            inputs: [],
            outputs: [{ type: 'uint256' }],
            stateMutability: 'view'
        },
        {
            type: 'function',
            name: 'initializer',
            inputs: [],
            outputs: [{ type: 'address' }],
            stateMutability: 'view'
        },
        {
            type: 'function',
            name: 'router',
            inputs: [],
            outputs: [{ type: 'address' }],
            stateMutability: 'view'
        }
    ] as const;

    try {
        // Check 1: Contract exists (has code)
        console.log("1️⃣ Checking if contract exists...");
        const code = await publicClient.getBytecode({ 
            address: mirrorAddress as `0x${string}` 
        });
        
        if (!code || code === '0x') {
            console.log("   ❌ Contract does NOT exist at this address!");
            console.log("   The address has no code deployed.");
            process.exit(1);
        }
        console.log("   ✅ Contract exists (has code)");
        console.log(`   Code size: ${(code.length - 2) / 2} bytes\n`);

        // Check 2: Contract state
        console.log("2️⃣ Checking contract state...");
        
        const stateHash = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: mirrorABI,
            functionName: 'stateHash',
        });
        console.log(`   State Hash: ${stateHash}`);

        const exited = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: mirrorABI,
            functionName: 'exited',
        });
        console.log(`   Exited: ${exited} ${exited ? '(⚠️ Program exited)' : '(✅ Active)'}`);

        const nonce = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: mirrorABI,
            functionName: 'nonce',
        });
        console.log(`   Nonce: ${nonce.toString()} ${Number(nonce) === 0 ? '(⚠️ No messages sent yet)' : '(✅ Has received messages)'}`);

        const initializer = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: mirrorABI,
            functionName: 'initializer',
        });
        console.log(`   Initializer: ${initializer}`);

        const router = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: mirrorABI,
            functionName: 'router',
        });
        console.log(`   Router: ${router}`);
        console.log(`   Expected Router: ${process.env.VARA_ETH_ROUTER || '0xBC888a8B050B9B76a985d91c815d2c4f2131a58A'}`);
        const expectedRouter = (process.env.VARA_ETH_ROUTER || '0xBC888a8B050B9B76a985d91c815d2c4f2131a58A').toLowerCase();
        if (router.toLowerCase() === expectedRouter) {
            console.log(`   ✅ Router matches!\n`);
        } else {
            console.log(`   ⚠️  Router mismatch!\n`);
        }

        // Check 3: Contract balance
        console.log("3️⃣ Checking contract balance...");
        const balance = await publicClient.getBalance({ 
            address: mirrorAddress as `0x${string}` 
        });
        console.log(`   ETH Balance: ${balance.toString()} wei (${Number(balance) / 1e18} ETH)`);

        // Check 4: Recent transactions
        console.log("\n4️⃣ Checking recent activity...");
        try {
            // Try to get transaction count (indicates activity)
            const txCount = await publicClient.getTransactionCount({ 
                address: mirrorAddress as `0x${string}` 
            });
            console.log(`   Transaction Count: ${txCount}`);
        } catch (e) {
            console.log(`   Could not get transaction count`);
        }

        // Summary
        console.log("\n=== Verification Summary ===");
        console.log(`✅ Contract Deployed: Yes`);
        console.log(`✅ Contract Active: ${!exited ? 'Yes' : 'No'}`);
        console.log(`✅ Router Connected: ${router.toLowerCase() === expectedRouter ? 'Yes' : 'No'}`);
        console.log(`⚠️  Initialized: ${Number(nonce) > 0 ? 'Yes (has messages)' : 'No (no messages yet)'}`);
        console.log(`\n🔗 View on Explorer:`);
        console.log(`https://explorer.hoodi.io/address/${mirrorAddress}`);
        
        if (Number(nonce) === 0) {
            console.log(`\n💡 Note: Mirror is deployed but hasn't received any messages yet.`);
            console.log(`   This is normal - it will be initialized when you create your first market.`);
        }

    } catch (error: any) {
        console.error("\n❌ Error verifying Mirror contract:");
        console.error(error.message || error);
        
        if (error.message?.includes("execution reverted")) {
            console.error("\n💡 This might mean:");
            console.error("   - Contract address is incorrect");
            console.error("   - Contract is not a Mirror contract");
            console.error("   - Network mismatch");
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
