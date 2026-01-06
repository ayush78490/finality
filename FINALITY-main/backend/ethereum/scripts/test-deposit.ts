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
    
    // Get first market
    const nextMarketId = await contract.nextMarketId();
    if (Number(nextMarketId) === 0) {
        console.log("❌ No markets found");
        process.exit(1);
    }
    
    const marketId = 0;
    console.log(`\nTesting deposit on Market ${marketId}...`);
    
    try {
        const depositAmount = ethers.parseEther("0.001"); // Small amount
        console.log(`Depositing ${ethers.formatEther(depositAmount)} ETH for YES...`);
        
        const tx = await contract.deposit(marketId, true, { value: depositAmount, gasLimit: 5000000 });
        console.log(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Deposit successful!");
        } else {
            console.log("❌ Deposit failed (status: 0)");
        }
    } catch (error: any) {
        console.error("❌ Deposit failed:");
        console.error("Error:", error.message);
        
        if (error.message?.includes("execution reverted")) {
            console.error("\n💡 This is likely because:");
            console.error("   1. Mirror contract not funded with wVARA");
            console.error("   2. Mirror.sendMessage() is reverting");
            console.error("\n   Solution: Fund Mirror with wVARA");
            console.error("   Run: npm run fund-program");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
