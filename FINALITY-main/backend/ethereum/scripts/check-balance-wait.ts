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

async function checkBalance() {
    const address = process.env.DEPLOYER_ADDRESS;
    if (!address) {
        console.error("❌ DEPLOYER_ADDRESS not set");
        process.exit(1);
    }

    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    try {
        const balance = await publicClient.getBalance({ address: address as `0x${string}` });
        const balanceEth = Number(balance) / 1e18;
        return balanceEth;
    } catch (error) {
        console.error("Error checking balance:", error);
        return 0;
    }
}

async function main() {
    console.log("\n⏳ Checking balance...");
    console.log("   Address: " + process.env.DEPLOYER_ADDRESS);
    console.log("   (This will check if you've received ETH)\n");

    const balance = await checkBalance();
    
    if (balance >= 0.01) {
        console.log(`✅ Balance: ${balance.toFixed(4)} ETH`);
        console.log("\n🚀 Ready to proceed!");
        console.log("   Run: bash scripts/continue-deployment.sh\n");
    } else {
        console.log(`❌ Balance: ${balance.toFixed(4)} ETH`);
        console.log("\n⚠️  Still need test ETH");
        console.log("   Solutions: See IP_BLOCK_SOLUTIONS.md\n");
    }
}

main();

