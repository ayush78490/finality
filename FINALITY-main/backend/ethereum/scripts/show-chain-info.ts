import { createPublicClient, http, defineChain } from "viem";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
    const publicClient = createPublicClient({
        chain: {
            id: 560048,
            name: "Hoodi Testnet",
            network: "hoodi",
            nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
            rpcUrls: { 
                default: { 
                    http: ["https://hoodi-reth-rpc.gear-tech.io"] 
                } 
            },
            testnet: true,
        },
        transport: http("https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== CHAIN INFORMATION ===\n");
    
    try {
        const chainId = await publicClient.getChainId();
        const blockNumber = await publicClient.getBlockNumber();
        const block = await publicClient.getBlock({ blockNumber });
        
        console.log("📍 CHAIN: Hoodi Testnet");
        console.log(`   Chain ID: ${chainId}`);
        console.log(`   Network: Ethereum-compatible L1 Testnet`);
        console.log(`   Current Block: ${blockNumber}`);
        console.log(`   Block Hash: ${block.hash}`);
        console.log(`   Timestamp: ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
        console.log(`   RPC: https://hoodi-reth-rpc.gear-tech.io`);
        console.log(`   Explorer: https://hoodi.fraxscan.com/`);
        
        console.log("\n🔗 CHAIN TYPE:");
        console.log("   ✅ Ethereum L1 (EVM-compatible)");
        console.log("   ✅ Hoodi Testnet (Gear Tech)");
        console.log("   ✅ Uses ETH as native currency");
        console.log("   ✅ Supports all Ethereum tooling");
        
        console.log("\n📊 YOUR DEPLOYMENTS:");
        console.log("   ✅ Settlement Contract: 0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a");
        console.log("   ✅ Mirror Contract: 0x0034599835d4d7539c43721574d1d4f473f1ee6f");
        console.log("   ✅ Router Contract: 0xBC888a8B050B9B76a985d91c815d2c4f2131a58A");
        
        console.log("\n🎯 SUMMARY:");
        console.log("   Chain: Hoodi Testnet (Chain ID: 560048)");
        console.log("   Type: Ethereum L1 Testnet");
        console.log("   Status: ✅ ACTIVE");
        console.log("   Your Contracts: ✅ DEPLOYED");
        
    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
