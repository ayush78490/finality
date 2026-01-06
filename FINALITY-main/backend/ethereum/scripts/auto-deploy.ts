import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// @ts-ignore
import { EthereumClient, getMirrorClient } from "@vara-eth/api";
import dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

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

async function updateEnv(key: string, value: string) {
    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf-8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
        envContent += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env: ${key}=${value}`);
}

async function main() {
    console.log("\n🚀 === Automated Deployment ===\n");

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const address = process.env.DEPLOYER_ADDRESS;

    if (!privateKey || !address) {
        throw new Error("DEPLOYER_PRIVATE_KEY and DEPLOYER_ADDRESS must be set");
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    // Check balance
    console.log("1️⃣ Checking balance...");
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    const balanceEth = Number(balance) / 1e18;
    console.log(`   Balance: ${balanceEth.toFixed(4)} ETH\n`);

    if (balanceEth < 0.01) {
        console.log("⚠️  Insufficient balance!");
        console.log(`   Get test ETH from: https://hoodifaucet.io`);
        console.log(`   Address: ${address}\n`);
        return;
    }

    // Check CODE_ID
    let codeId = process.env.MARKET_ENGINE_CODE_ID;
    if (!codeId) {
        console.log("2️⃣ CODE_ID not found");
        console.log("   ⚠️  You need to upload WASM first:");
        console.log("   1. Download ethexe from: https://get.gear.rs");
        console.log("   2. Run upload command (see upload-wasm-instructions.md)");
        console.log("   3. Set MARKET_ENGINE_CODE_ID in .env\n");
        return;
    }
    console.log(`2️⃣ CODE_ID: ${codeId}\n`);

    // Create program
    let mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        console.log("3️⃣ Creating Vara.eth Program...");
        try {
            const walletClient = createWalletClient({
                account,
                chain: hoodi,
                transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
            });

            const routerAddr = process.env.VARA_ETH_ROUTER || "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A";
            const ethereumClient = new EthereumClient(
                publicClient,
                walletClient,
                routerAddr as `0x${string}`
            );
            
            await ethereumClient.isInitialized;
            const router = ethereumClient.router;

            console.log(`   Creating from CODE_ID: ${codeId}...`);
            const tx = await router.createProgram(codeId as `0x${string}`);
            const receipt = await tx.sendAndWaitForReceipt();
            mirrorAddress = await tx.getProgramId();
            
            if (mirrorAddress) {
                await updateEnv("MARKET_ENGINE_MIRROR_ADDRESS", mirrorAddress);
            }
            console.log(`   ✅ Program created!`);
            console.log(`   Mirror: ${mirrorAddress}`);
            console.log(`   Transaction: ${receipt.transactionHash}`);
            console.log(`   Explorer: https://explorer.hoodi.io/address/${mirrorAddress}\n`);
        } catch (error: any) {
            console.error("   ❌ Error:", error.message);
            if (error.message?.includes("insufficient funds")) {
                console.log("   💡 Get more test ETH\n");
            }
            return;
        }
    } else {
        console.log(`3️⃣ Mirror: ${mirrorAddress}\n`);
    }

    // Deploy contract
    const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    if (!settlementAddress) {
        console.log("4️⃣ Deploying Settlement Contract...");
        console.log("   ⚠️  Use Hardhat to deploy:");
        console.log("   Run: npx hardhat run scripts/deploy.ts --network hoodi\n");
        console.log("   This requires Mirror address to be set first.\n");
    } else {
        console.log(`4️⃣ Contract: ${settlementAddress}\n`);
    }

    console.log("✅ === Deployment Complete ===\n");
    console.log("📝 Summary:");
    console.log(`   Address: ${address}`);
    console.log(`   Balance: ${balanceEth.toFixed(4)} ETH`);
    if (mirrorAddress) console.log(`   Mirror: ${mirrorAddress}`);
    if (settlementAddress) console.log(`   Contract: ${settlementAddress}`);
    console.log("\n🧪 Next: Test contract");
    console.log("   npm run test-contract\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

