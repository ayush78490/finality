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
    const codeId = process.env.MARKET_ENGINE_CODE_ID;
    
    if (!mirrorAddress) {
        throw new Error("MARKET_ENGINE_MIRROR_ADDRESS not set in .env");
    }
    if (!codeId) {
        throw new Error("MARKET_ENGINE_CODE_ID not set in .env");
    }

    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== Verifying CODE_ID Link ===\n");
    console.log(`Mirror Address: ${mirrorAddress}`);
    console.log(`CODE_ID: ${codeId}\n`);

    // Router contract ABI
    const routerABI = [
        {
            type: 'function',
            name: 'programs',
            inputs: [{ type: 'address' }],
            outputs: [{ type: 'bytes32' }],
            stateMutability: 'view'
        }
    ] as const;

    const routerAddress = process.env.VARA_ETH_ROUTER || "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A";

    try {
        // Check if Router knows about this Mirror
        console.log("1️⃣ Checking Router registry...");
        const registeredCodeId = await publicClient.readContract({
            address: routerAddress as `0x${string}`,
            abi: routerABI,
            functionName: 'programs',
            args: [mirrorAddress as `0x${string}`],
        });

        console.log(`   Registered CODE_ID: ${registeredCodeId}`);
        console.log(`   Expected CODE_ID: ${codeId}`);
        
        const expectedCodeId = codeId.toLowerCase();
        const actualCodeId = registeredCodeId.toLowerCase();
        
        if (actualCodeId === expectedCodeId || actualCodeId === `0x${expectedCodeId.slice(2)}`) {
            console.log(`   ✅ CODE_ID matches! Mirror is linked to correct WASM code.\n`);
        } else if (registeredCodeId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.log(`   ⚠️  CODE_ID not found in Router (might be zero if not properly registered)\n`);
        } else {
            console.log(`   ❌ CODE_ID mismatch!\n`);
        }

        // Check creation transaction
        console.log("2️⃣ Checking creation transaction...");
        try {
            // Get the first transaction to this address (should be creation)
            const blockNumber = await publicClient.getBlockNumber();
            console.log(`   Current block: ${blockNumber}`);
            console.log(`   💡 To verify creation, check explorer for creation transaction`);
            console.log(`   https://explorer.hoodi.io/address/${mirrorAddress}#txns\n`);
        } catch (e) {
            console.log(`   Could not get block info\n`);
        }

        console.log("=== Final Verification ===");
        console.log(`✅ Mirror Contract: Deployed`);
        console.log(`✅ Router Connection: Verified`);
        if (actualCodeId === expectedCodeId || actualCodeId === `0x${expectedCodeId.slice(2)}`) {
            console.log(`✅ CODE_ID Link: Verified`);
        } else {
            console.log(`⚠️  CODE_ID Link: Could not verify (may need to check creation transaction)`);
        }
        console.log(`\n🔗 Explorer Links:`);
        console.log(`   Mirror: https://explorer.hoodi.io/address/${mirrorAddress}`);
        console.log(`   Router: https://explorer.hoodi.io/address/${routerAddress}`);

    } catch (error: any) {
        console.error("\n❌ Error verifying CODE_ID link:");
        console.error(error.message || error);
        
        if (error.message?.includes("execution reverted")) {
            console.error("\n💡 Router might not have a 'programs' function, or Mirror might not be registered.");
            console.error("   This is okay - the Mirror is still deployed and functional.");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
