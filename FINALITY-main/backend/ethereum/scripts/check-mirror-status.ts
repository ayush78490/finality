import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EthereumClient, getMirrorClient } from "@vara-eth/api";
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
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
    }

    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        throw new Error("MARKET_ENGINE_MIRROR_ADDRESS not set in .env");
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

    const ethereumClient = new EthereumClient(
        publicClient,
        walletClient,
        routerAddress as `0x${string}`
    );
    
    await ethereumClient.isInitialized;
    
    const wvara = ethereumClient.wvara;
    const mirror = getMirrorClient(
        mirrorAddress as `0x${string}`,
        walletClient,
        publicClient
    );

    console.log(`\n=== Mirror Contract Status ===`);
    console.log(`Mirror Address: ${mirrorAddress}`);
    console.log(`Deployer: ${account.address}\n`);

    try {
        // Check wVARA balance
        const wvaraBalance = await wvara.balanceOf(account.address);
        console.log(`wVARA Balance: ${wvaraBalance.toString()} (${Number(wvaraBalance) / 1e12} wVARA)`);
        
        // Check Mirror state
        const stateHash = await mirror.stateHash();
        console.log(`State Hash: ${stateHash}`);
        
        // Try to read Mirror contract state
        const exited = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: [{
                type: 'function',
                name: 'exited',
                inputs: [],
                outputs: [{ type: 'bool' }],
                stateMutability: 'view'
            }],
            functionName: 'exited',
        });
        console.log(`Exited: ${exited}`);
        
        const initializer = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: [{
                type: 'function',
                name: 'initializer',
                inputs: [],
                outputs: [{ type: 'address' }],
                stateMutability: 'view'
            }],
            functionName: 'initializer',
        });
        console.log(`Initializer: ${initializer}`);
        
        if (wvaraBalance === 0n) {
            console.log(`\n⚠️  No wVARA balance! Get wVARA from: https://eth.vara.network/faucet`);
        }
        
    } catch (error: any) {
        console.error("Error checking Mirror status:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
