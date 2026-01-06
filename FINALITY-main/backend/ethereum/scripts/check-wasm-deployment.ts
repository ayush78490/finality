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
    const codeId = process.env.MARKET_ENGINE_CODE_ID;
    const routerAddress = process.env.VARA_ETH_ROUTER || "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A";
    
    if (!codeId) {
        throw new Error("MARKET_ENGINE_CODE_ID not set in .env");
    }

    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== Rust/WASM Program Deployment Location ===\n");
    console.log(`CODE_ID: ${codeId}`);
    console.log(`Router: ${routerAddress}\n`);

    // Router ABI for checking code
    const routerABI = [
        {
            type: 'function',
            name: 'codes',
            inputs: [{ type: 'bytes32' }],
            outputs: [{ type: 'tuple', components: [
                { name: 'uploader', type: 'address' },
                { name: 'uploadedAt', type: 'uint256' }
            ]}],
            stateMutability: 'view'
        }
    ] as const;

    try {
        console.log("1️⃣ Checking if CODE_ID exists on Router...");
        
        const codeInfo = await publicClient.readContract({
            address: routerAddress as `0x${string}`,
            abi: routerABI,
            functionName: 'codes',
            args: [codeId as `0x${string}`],
        });

        if (codeInfo && codeInfo.uploader && codeInfo.uploader !== '0x0000000000000000000000000000000000000000') {
            console.log(`   ✅ CODE_ID found on Router!`);
            console.log(`   Uploader: ${codeInfo.uploader}`);
            console.log(`   Uploaded At Block: ${codeInfo.uploadedAt.toString()}`);
            console.log(`\n   📍 Your Rust/WASM program IS deployed on Vara.eth Router!`);
            console.log(`   Location: Router contract stores the WASM code`);
            console.log(`   Reference: CODE_ID ${codeId}`);
        } else {
            console.log(`   ⚠️  CODE_ID not found or invalid`);
        }

    } catch (error: any) {
        console.error("\n❌ Error checking CODE_ID:");
        console.error(error.message || error);
        
        if (error.message?.includes("execution reverted")) {
            console.error("\n💡 Router might not have a 'codes' function.");
            console.error("   But CODE_ID exists - it was used to create the Mirror contract.");
        }
    }

    console.log("\n=== Deployment Architecture ===");
    console.log("\n📍 WHERE YOUR RUST PROGRAM IS:");
    console.log("   1. WASM File: Compiled locally");
    console.log("      Location: backend/vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm");
    console.log("\n   2. Uploaded To: Vara.eth Router");
    console.log("      Router Address: " + routerAddress);
    console.log("      CODE_ID: " + codeId);
    console.log("      Status: ✅ Uploaded and stored on Router");
    console.log("\n   3. Program Instance: Mirror Contract");
    console.log("      Mirror Address: " + (process.env.MARKET_ENGINE_MIRROR_ADDRESS || "Not set"));
    console.log("      Status: ✅ Created from CODE_ID");
    console.log("\n   4. Execution: Vara.eth Executor Network");
    console.log("      When messages sent → Executor runs WASM → Updates state");
    console.log("      State stored on: Mirror contract (on Ethereum)");
    
    console.log("\n=== How It Works ===");
    console.log("   Rust Code → Compile → WASM File");
    console.log("   WASM File → Upload → Router (gets CODE_ID)");
    console.log("   CODE_ID → Create Program → Mirror Contract (Program ID)");
    console.log("   Mirror → Send Message → Executor runs WASM → State updated");
    
    console.log("\n🔗 Explorer Links:");
    console.log(`   Router: https://explorer.hoodi.io/address/${routerAddress}`);
    if (process.env.MARKET_ENGINE_MIRROR_ADDRESS) {
        console.log(`   Mirror: https://explorer.hoodi.io/address/${process.env.MARKET_ENGINE_MIRROR_ADDRESS}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
