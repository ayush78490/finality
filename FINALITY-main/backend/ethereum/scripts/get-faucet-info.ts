import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
    const address = process.env.DEPLOYER_ADDRESS;
    
    if (!address) {
        console.error("❌ DEPLOYER_ADDRESS not set in .env");
        process.exit(1);
    }

    console.log("\n💰 === Faucet Information ===\n");
    console.log(`Your Address: ${address}\n`);
    
    console.log("📝 Step 1: Get Test ETH (Hoodi)");
    console.log("   Visit: https://hoodifaucet.io");
    console.log(`   Enter address: ${address}`);
    console.log("   Click 'Get Test ETH'");
    console.log("   Wait ~1-2 minutes for confirmation\n");
    
    console.log("📝 Step 2: Get Test wVARA (After Program Deployment)");
    console.log("   Visit: https://eth.vara.network/faucet");
    console.log(`   Enter address: ${address}`);
    console.log("   Click 'Get Test wVARA'");
    console.log("   Note: You can only request once every 24 hours\n");
    
    console.log("🔍 Verify Balance:");
    console.log(`   Hoodi Explorer: https://explorer.hoodi.io/address/${address}\n`);
    
    console.log("✅ After getting tokens:");
    console.log("   1. Verify balance on explorer");
    console.log("   2. Proceed with deployment");
    console.log("");
}

main();

