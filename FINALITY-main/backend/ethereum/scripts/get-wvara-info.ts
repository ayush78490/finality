import { createPublicClient, http, defineChain } from "viem";
import { EthereumClient } from "@vara-eth/api";
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
    const routerAddress = process.env.VARA_ETH_ROUTER || "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A";
    const walletAddress = process.env.DEPLOYER_ADDRESS || "0x25fC28bD6Ff088566B9d194226b958106031d441";
    
    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io"),
    });

    console.log("\n=== wVARA Token Information ===\n");
    
    try {
        // Get wVARA address from Router
        const routerABI = [
            {
                type: 'function',
                name: 'wrappedVara',
                inputs: [],
                outputs: [{ type: 'address' }],
                stateMutability: 'view'
            }
        ] as const;

        const wvaraAddress = await publicClient.readContract({
            address: routerAddress as `0x${string}`,
            abi: routerABI,
            functionName: 'wrappedVara',
        });

        console.log("✅ wVARA Token Address:");
        console.log(`   ${wvaraAddress}`);
        console.log(`\n   🔗 View on Explorer:`);
        console.log(`   https://hoodi.fraxscan.com/token/${wvaraAddress}`);
        
        // Get wVARA balance
        const wvaraABI = [
            {
                type: 'function',
                name: 'balanceOf',
                inputs: [{ type: 'address' }],
                outputs: [{ type: 'uint256' }],
                stateMutability: 'view'
            },
            {
                type: 'function',
                name: 'decimals',
                inputs: [],
                outputs: [{ type: 'uint8' }],
                stateMutability: 'view'
            },
            {
                type: 'function',
                name: 'symbol',
                inputs: [],
                outputs: [{ type: 'string' }],
                stateMutability: 'view'
            }
        ] as const;

        const balance = await publicClient.readContract({
            address: wvaraAddress as `0x${string}`,
            abi: wvaraABI,
            functionName: 'balanceOf',
            args: [walletAddress as `0x${string}`],
        });

        const decimals = await publicClient.readContract({
            address: wvaraAddress as `0x${string}`,
            abi: wvaraABI,
            functionName: 'decimals',
        });

        const symbol = await publicClient.readContract({
            address: wvaraAddress as `0x${string}`,
            abi: wvaraABI,
            functionName: 'symbol',
        });

        console.log(`\n📊 Your wVARA Balance:`);
        console.log(`   ${Number(balance) / (10 ** Number(decimals))} ${symbol}`);
        
        if (balance === 0n) {
            console.log(`\n   ⚠️  No wVARA! Get from: https://eth.vara.network/faucet`);
        }

        console.log(`\n=== MetaMask Setup (Optional) ===`);
        console.log(`\nYou DON'T need to add wVARA to MetaMask to fund the Mirror.`);
        console.log(`The funding script handles everything automatically.`);
        console.log(`\nBut if you want to SEE your wVARA balance in MetaMask:`);
        console.log(`\n1. Open MetaMask`);
        console.log(`2. Click "Import tokens"`);
        console.log(`3. Paste this address: ${wvaraAddress}`);
        console.log(`4. MetaMask should auto-detect the token`);
        console.log(`5. Click "Add Custom Token"`);
        console.log(`\nToken Details:`);
        console.log(`   Address: ${wvaraAddress}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);

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
