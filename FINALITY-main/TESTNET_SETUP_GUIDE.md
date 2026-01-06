# Complete Testnet Setup Guide - Hoodi (Vara.eth)

## 🎯 What You Need to Provide

### 1. Wallet Information
- **Wallet Address**: Your Ethereum address (0x...) for receiving test tokens
- **Private Key**: For deploying contracts (keep secure, use `.env` files)

### 2. Environment Details
- Operating System: (Linux/Mac/Windows)
- Node.js version: (run `node --version`)
- Rust version: (run `rustc --version`)

---

## 📋 Step 1: Get Test Tokens

### Get Test ETH (Hoodi)
1. Visit: https://hoodifaucet.io
2. Enter your wallet address
3. Click "Get Test ETH"
4. Wait for confirmation (~1-2 minutes)
5. Verify: Check your wallet balance on Hoodi explorer

### Get Test wVARA
1. **After deploying your program** (Step 4)
2. Visit: https://eth.vara.network/faucet
3. Enter your wallet address
4. Click "Get Test wVARA"
5. You'll need this to fund your program's execution balance

---

## 🛠️ Step 2: Environment Setup

### 2.1 Install Rust

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Add WASM target
rustup target add wasm32-unknown-unknown

# Verify
rustc --version
cargo --version
```

### 2.2 Install Foundry (for Solidity interface)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify
forge --version
```

### 2.3 Install Vara.eth CLI

**Option 1: Download Pre-built**
```bash
# Visit: https://get.gear.rs
# Download ethexe-cli for your platform
# Extract and make executable
chmod +x ethexe
```

**Option 2: Build from Source**
```bash
git clone https://github.com/gear-tech/gear.git
cd gear
cargo build -p ethexe-cli -r
# Binary at: target/release/ethexe
```

### 2.4 Install Node.js Dependencies

```bash
# Root directory
npm install

# Ethereum contracts
cd backend/ethereum
npm install @vara-eth/api viem @nomicfoundation/hardhat-toolbox

# Frontend (if needed)
cd ../../src
npm install @vara-eth/api
```

---

## ⚙️ Step 3: Configure Environment

### 3.1 Create `.env` Files

**`backend/ethereum/.env`:**
```env
# Hoodi Testnet Configuration
HOODI_RPC_URL=https://hoodi-reth-rpc.gear-tech.io
HOODI_WS_URL=wss://hoodi-reth-rpc.gear-tech.io/ws
HOODI_CHAIN_ID=560048

# Deployment
DEPLOYER_PRIVATE_KEY=0x...  # YOUR PRIVATE KEY (keep secure!)
DEPLOYER_ADDRESS=0x...      # YOUR ADDRESS

# Vara.eth Router (Hoodi testnet - fixed address)
VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A

# Vara.eth WebSocket (for API)
VARA_ETH_WS=wss://hoodi-reth-rpc.gear-tech.io/ws

# Contract Addresses (will be set after deployment)
SETTLEMENT_CONTRACT_ADDRESS=
MARKET_ENGINE_MIRROR_ADDRESS=
MARKET_ENGINE_CODE_ID=
```

**`backend/vara/.env`:**
```env
# Vara.eth Configuration
VARA_ETH_WS=wss://hoodi-reth-rpc.gear-tech.io/ws
VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
```

**`.env.local` (root - for frontend):**
```env
NEXT_PUBLIC_HOODI_RPC_URL=https://hoodi-reth-rpc.gear-tech.io
NEXT_PUBLIC_HOODI_CHAIN_ID=560048
NEXT_PUBLIC_VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
NEXT_PUBLIC_VARA_ETH_WS=wss://hoodi-reth-rpc.gear-tech.io/ws
NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS=
NEXT_PUBLIC_MARKET_ENGINE_MIRROR_ADDRESS=
```

### 3.2 Update Hardhat Config

**`backend/ethereum/hardhat.config.ts`:**
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hoodi: {
            url: process.env.HOODI_RPC_URL || "https://hoodi-reth-rpc.gear-tech.io",
            accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
            chainId: 560048,
        },
        hardhat: {
            chainId: 31337,
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
        customChains: [
            {
                network: "hoodi",
                chainId: 560048,
                urls: {
                    apiURL: "https://explorer.hoodi.io/api",
                    browserURL: "https://explorer.hoodi.io",
                },
            },
        ],
    },
};

export default config;
```

---

## 🚀 Step 4: Deploy Vara.eth Program

### 4.1 Build WASM

```bash
cd backend/vara
cargo build --release

# Verify output
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

**Expected output:**
- `prediction_market_vara.wasm` (or similar)
- Size should be reasonable (< 5MB)

### 4.2 Upload WASM to Ethereum

```bash
# Insert your key into ethexe
./ethexe key insert $DEPLOYER_PRIVATE_KEY

# Upload WASM
./ethexe --cfg none tx \
  --ethereum-rpc "$HOODI_WS_URL" \
  --ethereum-router "$VARA_ETH_ROUTER" \
  --sender "$DEPLOYER_ADDRESS" \
  upload target/wasm32-unknown-unknown/release/prediction_market_vara.opt.wasm -w
```

**Output:**
```
Transaction: 0x...
Code ID: 0x...  # SAVE THIS!
```

**Save the Code ID** - you'll need it for program creation.

### 4.3 Create Program Instance (Mirror Contract)

Create `backend/ethereum/scripts/create-vara-eth-program.ts`:

```typescript
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EthereumClient } from "@vara-eth/api";
import dotenv from "dotenv";

dotenv.config();

const hoodi = defineChain({
    id: 560048,
    name: "Hoodi Testnet",
    network: "hoodi",
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: { default: { http: [process.env.HOODI_RPC_URL!] } },
    testnet: true,
});

async function main() {
    const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
    
    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL),
    });
    
    const walletClient = createWalletClient({
        account,
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL),
    });

    // Setup Vara.eth client
    const ethereumClient = new EthereumClient(
        publicClient,
        walletClient,
        process.env.VARA_ETH_ROUTER as `0x${string}`
    );
    
    await ethereumClient.isInitialized;
    const router = ethereumClient.router;

    // Get CODE_ID from environment or prompt
    const codeId = process.env.MARKET_ENGINE_CODE_ID || process.argv[2];
    if (!codeId) {
        throw new Error("CODE_ID required. Set MARKET_ENGINE_CODE_ID in .env or pass as argument");
    }

    console.log(`Creating program from Code ID: ${codeId}`);

    // Create program instance
    const tx = await router.createProgram(codeId as `0x${string}`);
    const receipt = await tx.sendAndWaitForReceipt();

    // Get the program ID (Mirror address)
    const programId = await tx.getProgramId();
    
    console.log("\n=== Program Created Successfully ===");
    console.log(`Program ID (Mirror Address): ${programId}`);
    console.log(`Transaction Hash: ${receipt.transactionHash}`);
    console.log(`\nSave this to your .env file:`);
    console.log(`MARKET_ENGINE_MIRROR_ADDRESS=${programId}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

**Run:**
```bash
cd backend/ethereum
npx ts-node scripts/create-vara-eth-program.ts <CODE_ID>
```

**Save the Mirror Address** - this is your program's Ethereum address.

### 4.4 Fund Program with wVARA

Create `backend/ethereum/scripts/fund-program.ts`:

```typescript
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { EthereumClient, getMirrorClient } from "@vara-eth/api";
import dotenv from "dotenv";

dotenv.config();

const hoodi = defineChain({
    id: 560048,
    name: "Hoodi Testnet",
    network: "hoodi",
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: { default: { http: [process.env.HOODI_RPC_URL!] } },
    testnet: true,
});

async function main() {
    const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
    
    const publicClient = createPublicClient({
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL),
    });
    
    const walletClient = createWalletClient({
        account,
        chain: hoodi,
        transport: http(process.env.HOODI_RPC_URL),
    });

    const ethereumClient = new EthereumClient(
        publicClient,
        walletClient,
        process.env.VARA_ETH_ROUTER as `0x${string}`
    );
    
    await ethereumClient.isInitialized;
    
    const wvara = ethereumClient.wvara;
    const mirror = getMirrorClient(
        process.env.MARKET_ENGINE_MIRROR_ADDRESS as `0x${string}`,
        walletClient,
        publicClient
    );

    // Amount to fund (10 wVARA = 10_000_000_000_000)
    const amount = BigInt(10_000_000_000_000);
    
    console.log(`Funding program with ${amount} wVARA...`);

    // Step 1: Approve wVARA for the program to spend
    console.log("Step 1: Approving wVARA...");
    const approveTx = await wvara.approve(process.env.MARKET_ENGINE_MIRROR_ADDRESS as `0x${string}`, amount);
    const approveReceipt = await approveTx.sendAndWaitForReceipt();
    console.log(`Approval transaction: ${approveReceipt.transactionHash}`);

    // Step 2: Top up executable balance via Mirror
    console.log("Step 2: Topping up executable balance...");
    const topUpTx = await mirror.executableBalanceTopUp(amount);
    const topUpReceipt = await topUpTx.sendAndWaitForReceipt();
    console.log(`Top-up transaction: ${topUpReceipt.transactionHash}`);

    console.log("\n=== Program Funded Successfully ===");
    console.log(`Program can now execute messages using ${amount} wVARA`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

**Run:**
```bash
cd backend/ethereum
npx ts-node scripts/fund-program.ts
```

---

## 📝 Step 5: Deploy Settlement Contract

### 5.1 Update Deployment Script

Update `backend/ethereum/scripts/deploy.ts`:

```typescript
import { ethers } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Deploying PredictionMarketSettlementVaraEth to Hoodi...');

    const [deployer] = await ethers.getSigners();
    console.log('Deploying with account:', deployer.address);
    console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());

    // Get Mirror address from environment
    const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
    if (!mirrorAddress) {
        throw new Error("MARKET_ENGINE_MIRROR_ADDRESS not set in .env");
    }
    console.log('Market Engine Mirror:', mirrorAddress);

    // Deploy PredictionMarketSettlementVaraEth
    const PredictionMarketSettlement = await ethers.getContractFactory('PredictionMarketSettlementVaraEth');
    const settlement = await PredictionMarketSettlement.deploy(mirrorAddress);
    await settlement.waitForDeployment();

    const settlementAddress = await settlement.getAddress();
    console.log('PredictionMarketSettlementVaraEth deployed to:', settlementAddress);

    // Save deployment info
    const deploymentInfo = {
        network: 'hoodi',
        settlementContract: settlementAddress,
        marketEngineMirror: mirrorAddress,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
    };

    console.log('\n=== Deployment Complete ===');
    console.log(JSON.stringify(deploymentInfo, null, 2));
    console.log('\nUpdate your .env files with:');
    console.log(`SETTLEMENT_CONTRACT_ADDRESS=${settlementAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### 5.2 Deploy

```bash
cd backend/ethereum
npx hardhat run scripts/deploy.ts --network hoodi
```

---

## ✅ Step 6: Verify Deployment

### 6.1 Check Contracts on Explorer

1. Visit: https://explorer.hoodi.io
2. Search for your contract addresses
3. Verify they're deployed correctly

### 6.2 Test Basic Functions

Create a test script to verify everything works.

---

## 🎯 Next Steps

1. **Update Frontend** - Integrate `@vara-eth/api`
2. **Test End-to-End** - Create market, trade, withdraw
3. **Monitor** - Check program balance, state hashes
4. **Iterate** - Fix any issues, improve UX

---

## 🆘 Troubleshooting

### Issue: "Insufficient funds"
- **Solution**: Get more test ETH from faucet

### Issue: "Program not funded"
- **Solution**: Fund program with wVARA (Step 4.4)

### Issue: "Invalid Mirror address"
- **Solution**: Verify Mirror address is correct in .env

### Issue: "WASM upload failed"
- **Solution**: Check RPC URL, ensure you have test ETH

---

## 📚 Resources

- **Hoodi Faucet**: https://hoodifaucet.io
- **Vara.eth Faucet**: https://eth.vara.network/faucet
- **Hoodi Explorer**: https://explorer.hoodi.io
- **Vara.eth Docs**: https://eth.vara.network/getting-started

---

**Ready to start?** Follow the steps above and let me know if you encounter any issues!

