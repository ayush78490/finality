import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// @ts-ignore - @vara-eth/api types may not be fully available
import { EthereumClient, getMirrorClient } from "@vara-eth/api";
import { ethers } from "ethers";
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
    try {
        const balance = await publicClient.getBalance({ address: address as `0x${string}` });
        return balance;
    } catch (error) {
        return 0n;
    }
}

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
    console.log("\n🚀 === Complete Deployment Check ===\n");

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
        console.log(`   https://hoodifaucet.io`);
        console.log(`   Address: ${address}\n`);
        console.log("   After getting ETH, run this script again.\n");
        return;
    }

    // Check WASM file
    console.log("2️⃣ Checking WASM file...");
    const wasmPath = path.join(__dirname, "../../vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm");
    if (fs.existsSync(wasmPath)) {
        const stats = fs.statSync(wasmPath);
        console.log(`   ✅ WASM file found: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`   Path: ${wasmPath}\n`);
    } else {
        console.log("   ❌ WASM file not found!");
        console.log("   Build it with: cd backend/vara && cargo build --release\n");
        return;
    }

    // Check CODE_ID
    const codeId = process.env.MARKET_ENGINE_CODE_ID;
    if (!codeId) {
        console.log("3️⃣ Vara.eth Program Upload");
        console.log("   ⚠️  CODE_ID not set in .env");
        console.log("   You need to upload WASM first:\n");
        console.log("   Steps:");
        console.log("   1. Download ethexe CLI from: https://get.gear.rs");
        console.log("   2. Insert key: ./ethexe key insert", privateKey);
        console.log("   3. Upload: ./ethexe --cfg none tx \\");
        console.log("      --ethereum-rpc \"wss://hoodi-reth-rpc.gear-tech.io/ws\" \\");
        console.log("      --ethereum-router \"0xBC888a8B050B9B76a985d91c815d2c4f2131a58A\" \\");
        console.log(`      --sender \"${address}\" \\`);
        console.log(`      upload ${wasmPath} -w\n`);
        console.log("   4. Save CODE_ID from output to .env\n");
        return;
    } else {
        console.log("3️⃣ Vara.eth Program");
        console.log(`   ✅ CODE_ID: ${codeId}\n`);
    }

    // Check Mirror
    let mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        console.log("4️⃣ Creating Vara.eth Program Instance...");
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
            mirrorAddress = await tx.getProgramId();
            
            if (mirrorAddress) {
                await updateEnv("MARKET_ENGINE_MIRROR_ADDRESS", mirrorAddress);
            }
            console.log(`   ✅ Program created! Mirror: ${mirrorAddress}`);
            console.log(`   Transaction: ${receipt.transactionHash}`);
            console.log(`   Explorer: https://explorer.hoodi.io/address/${mirrorAddress}\n`);
        } catch (error: any) {
            console.error("   ❌ Error:", error.message);
            if (error.message?.includes("insufficient funds")) {
                console.log("   💡 Get more test ETH from: https://hoodifaucet.io\n");
            }
            return;
        }
    } else {
        console.log("4️⃣ Vara.eth Program");
        console.log(`   ✅ Mirror address: ${mirrorAddress}\n`);
    }

    // Deploy settlement contract
    const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    if (!settlementAddress) {
        console.log("5️⃣ Deploying Settlement Contract...");
        console.log("   ⚠️  Use Hardhat to deploy contract:");
        console.log("   Run: npx hardhat run scripts/deploy.ts --network hoodi\n");
        console.log("   Or set SETTLEMENT_CONTRACT_ADDRESS in .env if already deployed\n");
    } else {
        console.log("5️⃣ Settlement Contract");
        console.log(`   ✅ Contract address: ${settlementAddress}\n`);
    }

    console.log("✅ === Deployment Complete ===\n");
    console.log("📝 Summary:");
    console.log(`   Address: ${address}`);
    console.log(`   Balance: ${balanceEth.toFixed(4)} ETH`);
    if (mirrorAddress) {
        console.log(`   Mirror: ${mirrorAddress}`);
    }
    if (settlementAddress) {
        console.log(`   Contract: ${settlementAddress}`);
    }
    console.log("\n🧪 Next: Test contract");
    console.log("   npm run test-contract\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

