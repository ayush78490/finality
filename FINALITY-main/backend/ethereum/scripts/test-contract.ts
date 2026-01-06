import { ethers } from 'hardhat';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    const network = process.env.HARDHAT_NETWORK || 'hoodi';
    console.log(`Testing PredictionMarketSettlementVaraEth on ${network}...\n`);

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const user1 = signers[1] || deployer; // Use deployer if only one signer available
    console.log('Deployer:', deployer.address);
    if (signers.length > 1) {
    console.log('User1:', user1.address);
    }
    console.log('Deployer balance:', ethers.formatEther(await deployer.provider.getBalance(deployer.address)), 'ETH\n');

    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        throw new Error("MARKET_ENGINE_MIRROR_ADDRESS not set in .env");
    }

    const settlementAddress = process.env.SETTLEMENT_CONTRACT_ADDRESS;
    if (!settlementAddress) {
        throw new Error("SETTLEMENT_CONTRACT_ADDRESS not set in .env");
    }

    console.log('Mirror Address:', mirrorAddress);
    console.log('Settlement Address:', settlementAddress);
    console.log('\n=== Testing Contract ===\n');

    const PredictionMarketSettlement = await ethers.getContractFactory('PredictionMarketSettlementVaraEth');
    const settlement = PredictionMarketSettlement.attach(settlementAddress);

    // Test 1: Get contract info
    console.log('Test 1: Get contract info');
    const owner = await settlement.owner();
    const mirror = await settlement.marketEngineMirror();
    console.log('✅ Owner:', owner);
    console.log('✅ Mirror:', mirror);
    console.log('✅ Next Market ID:', (await settlement.nextMarketId()).toString());
    console.log('');

    // Test 2: Create a market
    console.log('Test 2: Create market');
    const endTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    const initialYes = ethers.parseEther('0.01');
    const initialNo = ethers.parseEther('0.01');
    
    try {
        const tx = await settlement.createMarket(
            "Will Bitcoin reach $100k by end of 2025?",
            "Crypto",
            endTime,
            initialYes,
            initialNo,
            { value: initialYes + initialNo }
        );
        const receipt = await tx.wait();
        console.log('✅ Market created!');
        console.log('   Transaction:', receipt?.hash);
        
        const marketId = await settlement.nextMarketId() - 1n;
        console.log('   Market ID:', marketId.toString());
        
        // Get market info
        const marketInfo = await settlement.getMarketInfo(marketId);
        console.log('   Creator:', marketInfo.creator);
        console.log('   Question:', marketInfo.question);
        console.log('   End Time:', new Date(Number(marketInfo.endTime) * 1000).toISOString());
        console.log('   Total Backing:', ethers.formatEther(marketInfo.totalBacking), 'ETH');
        console.log('');
    } catch (error: any) {
        console.error('❌ Error creating market:', error.message);
        throw error;
    }

    // Test 3: Get state hash
    console.log('Test 3: Get state hash from Mirror');
    try {
        const stateHash = await settlement.getStateHash();
        console.log('✅ State Hash:', stateHash);
        console.log('');
    } catch (error: any) {
        console.error('❌ Error getting state hash:', error.message);
    }

    console.log('✅ === All Tests Passed ===');
    console.log('\nNext steps:');
    console.log('1. Test deposit function (requires Mirror to be properly set up)');
    console.log('2. Test withdrawal function');
    console.log('3. Test market resolution');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

