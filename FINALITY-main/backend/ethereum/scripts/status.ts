import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { createPublicClient, http, defineChain } from "viem";

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
    console.log("\n📊 === Deployment Status ===\n");

    const address = process.env.DEPLOYER_ADDRESS;
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!address || !privateKey) {
        console.log("❌ Wallet not configured");
        console.log("   Set DEPLOYER_ADDRESS and DEPLOYER_PRIVATE_KEY in .env\n");
        return;
    }

    console.log(`Wallet: ${address}\n`);

    // Check balance
    try {
        const publicClient = createPublicClient({
            chain: hoodi,
            transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
        });
        const balance = await publicClient.getBalance({ address: address as `0x${string}` });
        const balanceEth = Number(balance) / 1e18;
        console.log(`Balance: ${balanceEth.toFixed(4)} ETH`);
        if (balanceEth < 0.01) {
            console.log("   ⚠️  Low balance! Get test ETH: https://hoodifaucet.io\n");
        } else {
            console.log("   ✅ Sufficient balance\n");
        }
    } catch (error) {
        console.log("   ⚠️  Could not check balance\n");
    }

    // Check WASM
    const wasmPath = path.join(__dirname, "../../vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm");
    if (fs.existsSync(wasmPath)) {
        const stats = fs.statSync(wasmPath);
        console.log(`✅ WASM file: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
        console.log("❌ WASM file not found");
        console.log("   Build: cd backend/vara && cargo build --release\n");
    }

    // Check CODE_ID
    const codeId = process.env.MARKET_ENGINE_CODE_ID;
    if (codeId) {
        console.log(`✅ CODE_ID: ${codeId}`);
    } else {
        console.log("❌ CODE_ID not set");
        console.log("   Upload WASM first to get CODE_ID\n");
    }

    // Check Mirror
    const mirror = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (mirror) {
        console.log(`✅ Mirror: ${mirror}`);
    } else {
        console.log("❌ Mirror address not set");
        console.log("   Run: npm run create-program\n");
    }

    // Check Contract
    const contract = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    if (contract) {
        console.log(`✅ Contract: ${contract}`);
    } else {
        console.log("❌ Contract not deployed");
        console.log("   Run: npm run deploy\n");
    }

    console.log("\n📝 Next Steps:");
    if (!codeId) {
        console.log("   1. Upload WASM to get CODE_ID");
    } else if (!mirror) {
        console.log("   1. Create program: npm run create-program");
    } else if (!contract) {
        console.log("   1. Deploy contract: npm run deploy");
    } else {
        console.log("   1. Test contract: npm run test-contract");
    }
    console.log("");
}

main();

