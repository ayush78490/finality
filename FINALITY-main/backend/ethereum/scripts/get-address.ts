import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    
    if (!privateKey) {
        console.error("❌ DEPLOYER_PRIVATE_KEY not set in .env");
        process.exit(1);
    }

    try {
        const account = privateKeyToAccount(privateKey as `0x${string}`);
        const address = account.address;
        
        console.log("\n✅ === Wallet Address ===");
        console.log(`Address: ${address}`);
        console.log(`\n📝 Add this to your .env file:`);
        console.log(`DEPLOYER_ADDRESS=${address}`);
        console.log(`\n💡 Use this address to get test tokens from:`);
        console.log(`   - Test ETH: https://hoodifaucet.io`);
        console.log(`   - Test wVARA: https://eth.vara.network/faucet`);
        console.log("");
    } catch (error: any) {
        console.error("❌ Error deriving address:", error.message);
        process.exit(1);
    }
}

main();
