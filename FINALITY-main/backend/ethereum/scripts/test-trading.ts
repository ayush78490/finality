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
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    const contract = await ethers.getContractAt("PredictionMarketSettlementVaraEth", settlementAddress);
    
    console.log("=== Testing Trading Functions ===\n");
    
    // Get first market
    const nextMarketId = await contract.nextMarketId();
    if (Number(nextMarketId) === 0) {
        console.log("❌ No markets found. Create a market first.");
        process.exit(1);
    }
    
    const marketId = 0;
    const market = await contract.markets(marketId);
    
    console.log(`Testing with Market ${marketId}:`);
    console.log(`  Question: ${market.question}`);
    console.log(`  Status: ${market.status} (0=Open, 1=Closed, 2=Resolved)\n`);
    
    // Test 1: Deposit (Buy YES tokens)
    console.log("Test 1: Deposit ETH to buy YES tokens");
    try {
        const depositAmount = ethers.parseEther("0.01"); // 0.01 ETH
        console.log(`  Depositing ${ethers.formatEther(depositAmount)} ETH for YES...`);
        
        const tx = await contract.deposit(marketId, true, { value: depositAmount });
        console.log(`  Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`  ✅ Deposit successful!`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
        
        // Get updated state hash
        const updatedMarket = await contract.markets(marketId);
        const stateHash = updatedMarket.lastStateHash;
        console.log(`  State Hash: ${stateHash}`);
        
        if (stateHash !== ethers.ZeroHash) {
            console.log(`  ✅ State hash updated (Mirror is working!)`);
        } else {
            console.log(`  ⚠️  State hash is zero (Mirror might not be funded)`);
        }
        
    } catch (error: any) {
        console.error(`  ❌ Deposit failed: ${error.message}`);
        if (error.message?.includes("revert") || error.message?.includes("execution reverted")) {
            console.error(`  💡 This might be because:`);
            console.error(`     - Mirror contract not funded with wVARA`);
            console.error(`     - Market is closed or resolved`);
            console.error(`     - Insufficient ETH balance`);
        }
    }
    
    // Test 2: Check token balances
    console.log("\nTest 2: Check token balances");
    try {
        const yesToken = await ethers.getContractAt("OutcomeToken", market.yesToken);
        const noToken = await ethers.getContractAt("OutcomeToken", market.noToken);
        
        const yesBalance = await yesToken.balanceOf(deployer.address);
        const noBalance = await noToken.balanceOf(deployer.address);
        
        console.log(`  YES Token Balance: ${ethers.formatEther(yesBalance)}`);
        console.log(`  NO Token Balance: ${ethers.formatEther(noBalance)}`);
        
        if (yesBalance > 0 || noBalance > 0) {
            console.log(`  ✅ Tokens received!`);
        }
    } catch (error: any) {
        console.error(`  ❌ Error checking balances: ${error.message}`);
    }
    
    // Test 3: Request withdrawal (if we have tokens)
    console.log("\nTest 3: Request withdrawal");
    try {
        const yesToken = await ethers.getContractAt("OutcomeToken", market.yesToken);
        const tokenBalance = await yesToken.balanceOf(deployer.address);
        
        if (tokenBalance === 0n) {
            console.log(`  ⚠️  No tokens to withdraw. Deposit first.`);
        } else {
            const withdrawAmount = tokenBalance / 2n; // Withdraw half
            console.log(`  Requesting withdrawal of ${ethers.formatEther(withdrawAmount)} YES tokens...`);
            
            // Approve tokens first
            const approveTx = await yesToken.approve(settlementAddress, withdrawAmount);
            await approveTx.wait();
            console.log(`  ✅ Tokens approved`);
            
            const tx = await contract.requestWithdrawal(marketId, true, withdrawAmount);
            console.log(`  Transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`  ✅ Withdrawal requested!`);
            console.log(`  Block: ${receipt.blockNumber}`);
        }
    } catch (error: any) {
        console.error(`  ❌ Withdrawal failed: ${error.message}`);
    }
    
    console.log("\n=== Trading Tests Complete ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

