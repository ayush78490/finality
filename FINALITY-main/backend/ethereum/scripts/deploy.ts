import { ethers } from 'hardhat';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main() {
    const network = process.env.HARDHAT_NETWORK || 'hoodi';
    console.log(`Deploying PredictionMarketSettlementVaraEth to ${network}...`);

    const [deployer] = await ethers.getSigners();
    console.log('Deploying with account:', deployer.address);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log('Account balance:', ethers.formatEther(balance), 'ETH');

    // Get Mirror address from environment
    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        throw new Error(
            "MARKET_ENGINE_MIRROR_ADDRESS not set in .env\n" +
            "Run 'npm run create-program' first to create the Vara.eth program"
        );
    }

    console.log('Market Engine Mirror:', mirrorAddress);
    console.log('\nDeploying contracts...');

    // Deploy PredictionMarketSettlementVaraEth
    const PredictionMarketSettlement = await ethers.getContractFactory('PredictionMarketSettlementVaraEth');
    const settlement = await PredictionMarketSettlement.deploy(mirrorAddress);
    await settlement.waitForDeployment();

    const settlementAddress = await settlement.getAddress();
    console.log('\n✅ === Deployment Complete ===');
    console.log('PredictionMarketSettlementVaraEth deployed to:', settlementAddress);

    // Save deployment info
    const deploymentInfo = {
        network: network,
        settlementContract: settlementAddress,
        marketEngineMirror: mirrorAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };

    console.log('\n📝 Deployment Information:');
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    // Save to .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
        // Remove existing SETTLEMENT_CONTRACT_ADDRESS if present
        envContent = envContent.replace(/^SETTLEMENT_CONTRACT_ADDRESS=.*$/m, '');
    }
    // Add the new SETTLEMENT_CONTRACT_ADDRESS
    envContent += `SETTLEMENT_CONTRACT_ADDRESS=${settlementAddress}\n`;
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Saved to .env file automatically');
    console.log('\n📝 Also update frontend .env with:');
    console.log(`NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS=${settlementAddress}`);
    
    console.log('\n🔗 View on explorer:');
    if (network === 'hoodi') {
        console.log(`https://explorer.hoodi.io/address/${settlementAddress}`);
    }
    
    console.log('\n⏭️  Next steps:');
    console.log('1. Update frontend .env with SETTLEMENT_CONTRACT_ADDRESS');
    console.log('2. Test market creation');
    console.log('3. Test trading functionality');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
