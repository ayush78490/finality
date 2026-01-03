import { ethers } from 'hardhat';

async function main() {
    console.log('Deploying PredictionMarketSettlement to Sepolia...');

    const [deployer] = await ethers.getSigners();
    console.log('Deploying with account:', deployer.address);
    console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());

    // Get relayer address from environment or use deployer
    const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
    console.log('Relayer address:', relayerAddress);

    // Deploy OutcomeToken library (if needed)
    console.log('\nDeploying contracts...');

    // Deploy PredictionMarketSettlement
    const PredictionMarketSettlement = await ethers.getContractFactory('PredictionMarketSettlement');
    const settlement = await PredictionMarketSettlement.deploy(relayerAddress);
    await settlement.waitForDeployment();

    const settlementAddress = await settlement.getAddress();
    console.log('PredictionMarketSettlement deployed to:', settlementAddress);

    // Save deployment info
    const deploymentInfo = {
        network: 'sepolia',
        settlementContract: settlementAddress,
        relayer: relayerAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };

    console.log('\n=== Deployment Complete ===');
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log('\nSave this information for your relayer configuration!');
    console.log('\nNext steps:');
    console.log('1. Deploy Vara program');
    console.log('2. Update relayer .env with these addresses');
    console.log('3. Start the relayer service');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
