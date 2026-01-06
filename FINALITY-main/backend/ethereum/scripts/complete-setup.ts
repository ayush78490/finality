import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EthereumClient, getMirrorClient } from "@vara-eth/api";
import { ethers } from "hardhat";
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

async function checkBalance(address: string, publicClient: any) {
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    return balance;
}

async function updateEnv(key: string, value: string) {
    const envPath = path.join(__dirname, "../.env");
    let envContent = fs.readFileSync(envPath, "utf-8");
    
    // Update or add the key
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
    console.log("\n🚀 === Complete Setup & Deployment ===\n");

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const address = process.env.DEPLOYER_ADDRESS;

    if (!privateKey || !address) {
        throw new Error("DEPLOYER_PRIVATE_KEY and DEPLOYER_ADDRESS must be set in .env");
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    // Check balance
    console.log("1️⃣ Checking wallet balance...");
    const balance = await checkBalance(address, publicClient);
    const balanceEth = Number(balance) / 1e18;
    console.log(`   Balance: ${balanceEth.toFixed(4)} ETH\n`);

    if (balanceEth < 0.01) {
        console.log("⚠️  Low balance! Get test ETH from:");
        console.log(`   https://hoodifaucet.io\n`);
        console.log("   Enter address:", address);
        console.log("   After getting ETH, run this script again.\n");
        return;
    }

    // Check if CODE_ID is set
    const codeId = process.env.MARKET_ENGINE_CODE_ID;
    if (!codeId) {
        console.log("2️⃣ Vara.eth Program Deployment");
        console.log("   ⚠️  CODE_ID not set in .env");
        console.log("   You need to:");
        console.log("   1. Build Vara program: cd backend/vara && cargo build --release");
        console.log("   2. Upload WASM: ./ethexe upload target/.../prediction_market_vara.opt.wasm");
        console.log("   3. Set MARKET_ENGINE_CODE_ID in .env");
        console.log("   4. Run: npm run create-program\n");
        return;
    }

    // Check if Mirror is set
    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        console.log("3️⃣ Creating Vara.eth Program Instance...");
        try {
            const walletClient = createWalletClient({
                account,
                chain: hoodi,
                transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
            });

            const ethereumClient = new EthereumClient(
                publicClient,
                walletClient,
                process.env.VARA_ETH_ROUTER as `0x${string}`
            );
            
            await ethereumClient.isInitialized;
            const router = ethereumClient.router;

            console.log(`   Creating program from Code ID: ${codeId}...`);
            const tx = await router.createProgram(codeId as `0x${string}`);
            const receipt = await tx.sendAndWaitForReceipt();
            const programId = await tx.getProgramId();
            
            await updateEnv("MARKET_ENGINE_MIRROR_ADDRESS", programId);
            console.log(`   ✅ Program created! Mirror: ${programId}`);
            console.log(`   Transaction: ${receipt.transactionHash}\n`);
        } catch (error: any) {
            console.error("   ❌ Error:", error.message);
            return;
        }
    } else {
        console.log("3️⃣ Vara.eth Program");
        console.log(`   ✅ Mirror address: ${mirrorAddress}\n`);
    }

    // Check if program is funded
    console.log("4️⃣ Checking Program Funding...");
    try {
        const walletClient = createWalletClient({
            account,
            chain: hoodi,
            transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
        });

        const ethereumClient = new EthereumClient(
            publicClient,
            walletClient,
            process.env.VARA_ETH_ROUTER as `0x${string}`
        );
        
        await ethereumClient.isInitialized;
        const mirror = getMirrorClient(
            process.env.MARKET_ENGINE_MIRROR_ADDRESS as `0x${string}`,
            walletClient,
            publicClient
        );

        // Try to get executable balance (if function exists)
        console.log("   Program funding status: Check manually");
        console.log("   To fund: npm run fund-program\n");
    } catch (error) {
        console.log("   ⚠️  Could not check funding status\n");
    }

    // Deploy settlement contract
    const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    if (!settlementAddress) {
        console.log("5️⃣ Deploying Settlement Contract...");
        try {
            const [deployer] = await ethers.getSigners();
            const PredictionMarketSettlement = await ethers.getContractFactory('PredictionMarketSettlementVaraEth');
            
            const mirrorAddr = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
            if (!mirrorAddr) {
                throw new Error("MARKET_ENGINE_MIRROR_ADDRESS not set");
            }

            console.log(`   Deploying with Mirror: ${mirrorAddr}...`);
            const settlement = await PredictionMarketSettlement.deploy(mirrorAddr);
            await settlement.waitForDeployment();
            const addr = await settlement.getAddress();
            
            await updateEnv("SETTLEMENT_CONTRACT_ADDRESS", addr);
            console.log(`   ✅ Contract deployed: ${addr}`);
            console.log(`   Explorer: https://explorer.hoodi.io/address/${addr}\n`);
        } catch (error: any) {
            console.error("   ❌ Error:", error.message);
            return;
        }
    } else {
        console.log("5️⃣ Settlement Contract");
        console.log(`   ✅ Contract address: ${settlementAddress}\n`);
    }

    console.log("✅ === Setup Complete ===\n");
    console.log("📝 Summary:");
    console.log(`   Address: ${address}`);
    console.log(`   Balance: ${balanceEth.toFixed(4)} ETH`);
    if (process.env.MARKET_ENGINE_MIRROR_ADDRESS) {
        console.log(`   Mirror: ${process.env.MARKET_ENGINE_MIRROR_ADDRESS}`);
    }
    if (process.env.SETTLEMENT_CONTRACT_ADDRESS) {
        console.log(`   Contract: ${process.env.SETTLEMENT_CONTRACT_ADDRESS}`);
    }
    console.log("\n🧪 Next: Run tests");
    console.log("   npm run test-contract\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

