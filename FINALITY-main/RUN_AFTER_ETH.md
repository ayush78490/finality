# 🚀 Run This After Getting Test ETH

## Quick Command

Once you've received test ETH from https://hoodifaucet.io, run:

```bash
cd backend/ethereum
bash scripts/continue-deployment.sh
```

This will automatically:
1. ✅ Check your balance
2. ✅ Upload WASM (get CODE_ID)
3. ✅ Create Vara.eth program
4. ✅ Fund with wVARA (will prompt you)
5. ✅ Deploy settlement contract

---

## Or Run Steps Manually

### Step 2: Upload WASM
```bash
~/Downloads/ethexe --cfg none tx \
  --ethereum-rpc "wss://hoodi-reth-rpc.gear-tech.io/ws" \
  --ethereum-router "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A" \
  --sender "0x25fC28bD6Ff088566B9d194226b958106031d441" \
  upload backend/vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm -w
```

**Save CODE_ID and add to .env:**
```bash
echo "MARKET_ENGINE_CODE_ID=0x..." >> backend/ethereum/.env
```

### Step 3: Create Program
```bash
cd backend/ethereum
npm run create-program
```

**Save Mirror address and add to .env:**
```bash
echo "MARKET_ENGINE_MIRROR_ADDRESS=0x..." >> backend/ethereum/.env
```

### Step 4: Fund Program
```bash
# Get wVARA from: https://eth.vara.network/faucet
npm run fund-program
```

### Step 5: Deploy Contract
```bash
npm run deploy
```

---

**Check status anytime:**
```bash
cd backend/ethereum && npm run status
```

