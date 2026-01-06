# 🚀 Quick Start - Run These Commands

## Step 1: Get Test ETH (Do This First!)

Visit: https://hoodifaucet.io
Enter: 0x25fC28bD6Ff088566B9d194226b958106031d441

## Step 2: Upload WASM (Get CODE_ID)

You need to download ethexe CLI first:
1. Visit: https://get.gear.rs
2. Download for Linux
3. Then run:

```bash
./ethexe key insert 0xd8c3d48dc76e3df5c2a90e4fcb8e774a450fae6b66c7c8a6a331ede54523f092

./ethexe --cfg none tx \
  --ethereum-rpc "wss://hoodi-reth-rpc.gear-tech.io/ws" \
  --ethereum-router "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A" \
  --sender "0x25fC28bD6Ff088566B9d194226b958106031d441" \
  upload backend/vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm -w
```

Save CODE_ID from output!

## Step 3: Create Program

```bash
cd backend/ethereum
# Set CODE_ID in .env first, then:
npm run create-program
```

## Step 4: Fund Program

```bash
# Get wVARA from: https://eth.vara.network/faucet
npm run fund-program
```

## Step 5: Deploy Contract

```bash
npm run deploy
```

## Step 6: Test

```bash
npm run test-contract
```

