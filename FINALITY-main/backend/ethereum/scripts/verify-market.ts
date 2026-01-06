import { ethers } from "hardhat";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function main() {
    const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    if (!settlementAddress) {
        throw new Error("SETTLEMENT_CONTRACT_ADDRESS not set in .env");
    }

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    
    const contract = await ethers.getContractAt("PredictionMarketSettlementVaraEth", settlementAddress);
    
    const nextMarketId = await contract.nextMarketId();
    console.log("\n=== Market Verification ===\n");
    console.log(`Total Markets: ${nextMarketId}`);
    
    if (nextMarketId > 0) {
        for (let i = 0; i < Number(nextMarketId); i++) {
            const market = await contract.markets(i);
            console.log(`\nMarket ${i}:`);
            console.log(`  Question: ${market.question}`);
            console.log(`  Category: ${market.category}`);
            console.log(`  Creator: ${market.creator}`);
            console.log(`  Status: ${market.status} (0=Open, 1=Closed, 2=Resolved)`);
            console.log(`  End Time: ${new Date(Number(market.endTime) * 1000).toISOString()}`);
            console.log(`  Total Backing: ${ethers.formatEther(market.totalBacking)} ETH`);
            console.log(`  YES Token: ${market.yesToken}`);
            console.log(`  NO Token: ${market.noToken}`);
        }
    } else {
        console.log("No markets found");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
