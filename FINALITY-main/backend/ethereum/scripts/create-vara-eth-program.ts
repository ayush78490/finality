import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// @ts-ignore - @vara-eth/api types may not be fully available
import { EthereumClient } from "@vara-eth/api";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from "fs";

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from ethereum directory
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
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });
    
    const walletClient = createWalletClient({
        account,
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    const routerAddress = process.env.VARA_ETH_ROUTER || "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A";
    console.log(`Connecting to Vara.eth Router: ${routerAddress}`);

    // Setup Vara.eth client
    const ethereumClient = new EthereumClient(
        publicClient,
        walletClient,
        routerAddress as `0x${string}`
    );
    
    await ethereumClient.isInitialized;
    const router = ethereumClient.router;

    // Get CODE_ID from environment or command line argument
    const codeId = process.env.MARKET_ENGINE_CODE_ID || process.argv[2];
    if (!codeId) {
        throw new Error(
            "CODE_ID required.\n" +
            "Set MARKET_ENGINE_CODE_ID in .env or pass as argument:\n" +
            "  npm run create-program <CODE_ID>"
        );
    }

    if (!codeId.startsWith("0x") || codeId.length !== 66) {
        throw new Error(`Invalid CODE_ID format: ${codeId}. Expected 0x followed by 64 hex characters.`);
    }

    console.log(`\n=== Creating Vara.eth Program ===`);
    console.log(`Code ID: ${codeId}`);
    console.log(`Deployer: ${account.address}`);
    console.log(`Network: Hoodi Testnet (Chain ID: 560048)\n`);

    try {
        // Create program instance
        console.log("Creating program instance (this may take a minute)...");
        const tx = await router.createProgram(codeId as `0x${string}`);
        const receipt = await tx.sendAndWaitForReceipt();

        // Get the program ID (Mirror address)
        const programId = await tx.getProgramId();
        
        // Save to .env file
        const envPath = path.join(__dirname, "../.env");
        let envContent = "";
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, "utf-8");
            // Remove existing MARKET_ENGINE_MIRROR_ADDRESS if present
            envContent = envContent.replace(/^MARKET_ENGINE_MIRROR_ADDRESS=.*$/m, "");
        }
        // Add the new MIRROR_ADDRESS
        envContent += `MARKET_ENGINE_MIRROR_ADDRESS=${programId}\n`;
        fs.writeFileSync(envPath, envContent);
        
        console.log("\n✅ === Program Created Successfully ===");
        console.log(`Program ID (Mirror Address): ${programId}`);
        console.log(`Transaction Hash: ${receipt.transactionHash}`);
        console.log(`Block Number: ${receipt.blockNumber}`);
        console.log(`\n✅ Saved to .env file automatically`);
        console.log(`\n🔗 View on explorer:`);
        console.log(`https://explorer.hoodi.io/address/${programId}`);
        console.log(`\n⏭️  Next step: Fund the program with wVARA`);
        console.log(`   Run: npm run fund-program`);
    } catch (error: any) {
        console.error("\n❌ Error creating program:");
        if (error.message) {
            console.error(error.message);
        } else {
            console.error(error);
        }
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

