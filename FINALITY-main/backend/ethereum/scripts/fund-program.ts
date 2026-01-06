import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EthereumClient, getMirrorClient } from "@vara-eth/api";
import dotenv from "dotenv";
import * as path from "path";

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

    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        throw new Error(
            "MARKET_ENGINE_MIRROR_ADDRESS not set in .env\n" +
            "Run 'npm run create-program' first to create the program"
        );
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

    // Amount to fund (10 wVARA = 10_000_000_000_000)
    // wVARA has 12 decimals, so 10 wVARA = 10 * 10^12
    const amount = BigInt(10_000_000_000_000);
    
    console.log(`\n=== Funding Vara.eth Program ===`);
    console.log(`Mirror Address: ${mirrorAddress}`);
    console.log(`Amount: ${amount} wVARA (10 wVARA)`);
    console.log(`Deployer: ${account.address}\n`);

    try {
        // Check wVARA balance first
        const wvaraBalance = await wvara.balanceOf(account.address);
        console.log(`\nCurrent wVARA Balance: ${wvaraBalance.toString()} (${Number(wvaraBalance) / 1e12} wVARA)`);
        
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
        
        // Check current balance
        const balance = await publicClient.getBalance({ address: account.address });
        console.log(`Deployer ETH balance: ${balance.toString()} wei`);
        
        // Check approval
        const currentAllowance = await wvara.allowance(account.address, mirrorAddress as `0x${string}`);
        console.log(`Current Allowance: ${currentAllowance.toString()} (${Number(currentAllowance) / 1e12} wVARA)`);
        
        // Step 1: Approve wVARA for the program to spend
        if (currentAllowance < amount) {
        console.log("\nStep 1: Approving wVARA...");
        const approveTx = await wvara.approve(mirrorAddress as `0x${string}`, amount);
        const approveReceipt = await approveTx.sendAndWaitForReceipt();
        console.log(`✅ Approval transaction: ${approveReceipt.transactionHash}`);
            console.log(`   View: https://explorer.hoodi.io/tx/${approveReceipt.transactionHash}`);
        } else {
            console.log("\n✅ Already approved");
        }

        // Step 2: Top up executable balance via Mirror
        console.log("\nStep 2: Topping up executable balance...");
        const topUpTx = await mirror.executableBalanceTopUp(amount);
        const topUpReceipt = await topUpTx.sendAndWaitForReceipt();
        console.log(`✅ Top-up transaction: ${topUpReceipt.transactionHash}`);
        console.log(`   View: https://explorer.hoodi.io/tx/${topUpReceipt.transactionHash}`);

        console.log("\n✅ === Program Funded Successfully ===");
        console.log(`Program can now execute messages using ${amount} wVARA`);
        console.log(`\n🔗 View on explorer:`);
        console.log(`https://explorer.hoodi.io/address/${mirrorAddress}`);
        console.log(`\n⏭️  Next step: Deploy Settlement Contract`);
        console.log(`   Run: npm run deploy`);
    } catch (error: any) {
        console.error("\n❌ Error funding program:");
        if (error.message) {
            console.error(error.message);
        } else {
            console.error(error);
        }
        
        if (error.message?.includes("insufficient funds")) {
            console.error("\n💡 Tip: Get test wVARA from:");
            console.error("   https://eth.vara.network/faucet");
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

