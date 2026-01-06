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

    const amount = BigInt(10_000_000_000_000); // 10 wVARA
    
    console.log(`\n=== Funding Mirror Contract ===`);
    console.log(`Mirror Address: ${mirrorAddress}`);
    console.log(`Deployer: ${account.address}`);
    console.log(`Amount: ${amount} wVARA (10 wVARA)\n`);

    // Check wVARA balance
    const wvaraBalance = await wvara.balanceOf(account.address);
    console.log(`Current wVARA Balance: ${wvaraBalance.toString()} (${Number(wvaraBalance) / 1e12} wVARA)`);
    
    if (wvaraBalance < amount) {
        console.log(`\n❌ Insufficient wVARA balance!`);
        console.log(`\n📝 To get wVARA:`);
        console.log(`1. Visit: https://eth.vara.network/faucet`);
        console.log(`2. Connect your wallet: ${account.address}`);
        console.log(`3. Request test wVARA tokens`);
        console.log(`4. Wait for tokens to arrive (usually instant)`);
        console.log(`5. Run this script again: npm run fund-program`);
        console.log(`\n💡 You need at least 10 wVARA (${amount.toString()} wei)`);
        process.exit(1);
    }

    // Check approval
    const currentAllowance = await wvara.allowance(account.address, mirrorAddress as `0x${string}`);
    console.log(`Current Allowance: ${currentAllowance.toString()} (${Number(currentAllowance) / 1e12} wVARA)`);
    
    if (currentAllowance < amount) {
        console.log(`\nStep 1: Approving wVARA...`);
        const approveTx = await wvara.approve(mirrorAddress as `0x${string}`, amount);
        const approveReceipt = await approveTx.sendAndWaitForReceipt();
        console.log(`✅ Approval transaction: ${approveReceipt.transactionHash}`);
        console.log(`   View: https://explorer.hoodi.io/tx/${approveReceipt.transactionHash}`);
    } else {
        console.log(`✅ Already approved`);
    }

    // Fund the Mirror
    console.log(`\nStep 2: Topping up executable balance...`);
    try {
        const topUpTx = await mirror.executableBalanceTopUp(amount);
        const topUpReceipt = await topUpTx.sendAndWaitForReceipt();
        console.log(`✅ Top-up transaction: ${topUpReceipt.transactionHash}`);
        console.log(`   View: https://explorer.hoodi.io/tx/${topUpReceipt.transactionHash}`);
        
        console.log(`\n✅ === Mirror Funded Successfully ===`);
        console.log(`Mirror can now execute messages using ${amount} wVARA`);
        console.log(`\n🔗 View Mirror on explorer:`);
        console.log(`https://explorer.hoodi.io/address/${mirrorAddress}`);
    } catch (error: any) {
        console.error(`\n❌ Error funding Mirror:`);
        console.error(error.message || error);
        
        // Check if Mirror needs initialization
        const stateHash = await mirror.stateHash();
        const nonce = await publicClient.readContract({
            address: mirrorAddress as `0x${string}`,
            abi: [{
                type: 'function',
                name: 'nonce',
                inputs: [],
                outputs: [{ type: 'uint256' }],
                stateMutability: 'view'
            }],
            functionName: 'nonce',
        });
        
        if (Number(nonce) === 0) {
            console.log(`\n⚠️  Mirror might need initialization first`);
            console.log(`   Nonce: ${nonce} (0 means no init message sent yet)`);
            console.log(`   Try sending an init message to the Mirror first`);
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
