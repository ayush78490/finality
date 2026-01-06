# Complete Testing Guide - Ready to Deploy

## ✅ Pre-Deployment Checklist

### 1. Environment Setup

**Create `.env` file in `backend/ethereum/`:**

```env
# Hoodi Testnet
HOODI_RPC_URL=https://hoodi-reth-rpc.gear-tech.io
HOODI_WS_URL=wss://hoodi-reth-rpc.gear-tech.io/ws
HOODI_CHAIN_ID=560048

# Your Wallet (already provided)
DEPLOYER_PRIVATE_KEY=0xd8c3d48dc76e3df5c2a90e4fcb8e774a450fae6b66c7c8a6a331ede54523f092

# Derive address from private key (run script below)
DEPLOYER_ADDRESS=0x...  # Will be set automatically

# Vara.eth Router (fixed)
VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
VARA_ETH_WS=wss://hoodi-reth-rpc.gear-tech.io/ws

# Will be set after deployment
MARKET_ENGINE_CODE_ID=
MARKET_ENGINE_MIRROR_ADDRESS=
SETTLEMENT_CONTRACT_ADDRESS=
```

### 2. Get Your Address from Private Key

**Run this to get your address:**

```bash
cd backend/ethereum
node -e "const { privateKeyToAccount } = require('viem/accounts'); console.log(privateKeyToAccount('0xd8c3d48dc76e3df5c2a90e4fcb8e774a450fae6b66c7c8a6a331ede54523f092').address);"
```

**Or use this script:**

```bash
npx ts-node scripts/get-address.ts
```

### 3. Get Test Tokens

**Get Test ETH:**
1. Visit: https://hoodifaucet.io
2. Enter your address (from step 2)
3. Click "Get Test ETH"
4. Wait ~1-2 minutes

**Get Test wVARA:**
1. After deploying program (Step 5)
2. Visit: https://eth.vara.network/faucet
3. Enter your address
4. Click "Get Test wVARA"

---

## 🚀 Complete Deployment Steps

### Step 1: Install Dependencies

```bash
# Root
npm install

# Ethereum contracts
cd backend/ethereum
npm install

# Verify Rust
rustc --version
cargo --version
```

### Step 2: Build Vara Program

```bash
cd backend/vara
cargo build --release

# Verify output exists
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

**Expected:** `prediction_market_vara.opt.wasm` or similar

### Step 3: Download/Install ethexe CLI

**Option 1: Download Pre-built**
```bash
# Visit: https://get.gear.rs
# Download for your platform
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

### Step 4: Upload WASM to Ethereum

```bash
# Insert your key
./ethexe key insert 0xd8c3d48dc76e3df5c2a90e4fcb8e774a450fae6b66c7c8a6a331ede54523f092

# Get your address first (from Step 2)
YOUR_ADDRESS=0x...  # Replace with your address

# Upload WASM
./ethexe --cfg none tx \
  --ethereum-rpc "wss://hoodi-reth-rpc.gear-tech.io/ws" \
  --ethereum-router "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A" \
  --sender "$YOUR_ADDRESS" \
  upload target/wasm32-unknown-unknown/release/prediction_market_vara.opt.wasm -w
```

**Output:**
```
Transaction: 0x...
Code ID: 0x...  # SAVE THIS!
```

**Update `.env`:**
```env
MARKET_ENGINE_CODE_ID=0x...  # From output above
```

### Step 5: Create Program Instance (Mirror)

```bash
cd backend/ethereum

# Make sure MARKET_ENGINE_CODE_ID is set in .env
npm run create-program
```

**Output:**
```
Program ID (Mirror Address): 0x...  # SAVE THIS!
```

**Update `.env`:**
```env
MARKET_ENGINE_MIRROR_ADDRESS=0x...  # From output above
```

### Step 6: Fund Program

```bash
# Make sure MARKET_ENGINE_MIRROR_ADDRESS is set
npm run fund-program
```

**Note:** You need wVARA tokens. Get them from: https://eth.vara.network/faucet

### Step 7: Deploy Settlement Contract

```bash
# Make sure MARKET_ENGINE_MIRROR_ADDRESS is set
npm run deploy
```

**Output:**
```
PredictionMarketSettlementVaraEth deployed to: 0x...  # SAVE THIS!
```

**Update `.env`:**
```env
SETTLEMENT_CONTRACT_ADDRESS=0x...  # From output above
```

### Step 8: Test Contract

```bash
# Make sure SETTLEMENT_CONTRACT_ADDRESS is set
npx ts-node scripts/test-contract.ts
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] ✅ Program uploaded (CODE_ID received)
- [ ] ✅ Program created (Mirror address received)
- [ ] ✅ Program funded (wVARA balance > 0)
- [ ] ✅ Settlement contract deployed
- [ ] ✅ All addresses in .env
- [ ] ✅ Contracts visible on Hoodi explorer
- [ ] ✅ Test script runs successfully

---

## 🧪 Testing Functions

### Test 1: Create Market

```bash
# Using Hardhat console
npx hardhat console --network hoodi

# In console:
const Settlement = await ethers.getContractFactory('PredictionMarketSettlementVaraEth');
const settlement = Settlement.attach(process.env.SETTLEMENT_CONTRACT_ADDRESS);

const endTime = Math.floor(Date.now() / 1000) + 86400;
const tx = await settlement.createMarket(
    "Will Bitcoin reach $100k?",
    "Crypto",
    endTime,
    ethers.parseEther('0.01'),
    ethers.parseEther('0.01'),
    { value: ethers.parseEther('0.02') }
);
await tx.wait();
```

### Test 2: Check State Hash

```bash
# In console:
const stateHash = await settlement.getStateHash();
console.log('State Hash:', stateHash);
```

### Test 3: Get Market Info

```bash
# In console:
const marketId = 0;
const market = await settlement.getMarketInfo(marketId);
console.log('Market:', market);
```

---

## 🔍 Troubleshooting

### "Insufficient funds"
- **Solution:** Get more test ETH from https://hoodifaucet.io

### "Program not funded"
- **Solution:** 
  1. Get wVARA from https://eth.vara.network/faucet
  2. Run `npm run fund-program`

### "Invalid Mirror address"
- **Solution:** 
  1. Verify `MARKET_ENGINE_MIRROR_ADDRESS` in .env
  2. Re-run `npm run create-program`

### "WASM upload failed"
- **Solution:**
  1. Check RPC URL
  2. Ensure you have test ETH
  3. Verify WASM file exists

### "Contract deployment failed"
- **Solution:**
  1. Check Mirror address is correct
  2. Ensure you have test ETH
  3. Verify network is Hoodi

---

## 📊 Expected Results

### After Successful Deployment:

1. **Program Upload:**
   - Transaction hash on Hoodi explorer
   - CODE_ID received

2. **Program Creation:**
   - Mirror contract deployed
   - Mirror address received

3. **Program Funding:**
   - wVARA approved
   - Executable balance topped up

4. **Contract Deployment:**
   - Settlement contract deployed
   - Contract address received

5. **Testing:**
   - Market creation works
   - State hash retrievable
   - Market info readable

---

## 🎯 Next Steps After Testing

1. **Frontend Integration**
   - Update frontend to use new contract
   - Integrate `@vara-eth/api` for Mirror calls
   - Test end-to-end flow

2. **Production Deployment**
   - Security audit
   - Mainnet deployment
   - Monitoring setup

---

## 📚 Resources

- **Hoodi Faucet:** https://hoodifaucet.io
- **Vara.eth Faucet:** https://eth.vara.network/faucet
- **Hoodi Explorer:** https://explorer.hoodi.io
- **Vara.eth Docs:** https://eth.vara.network/getting-started

---

## ✅ Ready to Test!

Everything is set up. Follow the steps above and you'll have a working Vara.eth prediction market on Hoodi testnet!

**Questions?** Check the troubleshooting section or review `TESTNET_SETUP_GUIDE.md`

