# Get wVARA Tokens - Required for Full Trading

## 🎯 Why You Need wVARA

The Mirror contract needs wVARA tokens to execute messages on the Vara network. Without wVARA, the Mirror cannot process trades, withdrawals, or other operations.

## 📝 Step-by-Step Instructions

### Step 1: Get wVARA from Faucet

1. **Visit the Vara.eth Faucet:**
   - URL: https://eth.vara.network/faucet
   - This is the official testnet faucet for wVARA tokens

2. **Connect Your Wallet:**
   - Make sure MetaMask (or your wallet) is connected to **Hoodi Testnet**
   - Your address: `0x25fC28bD6Ff088566B9d194226b958106031d441`

3. **Request wVARA:**
   - Enter your wallet address
   - Click "Get Test wVARA" or similar button
   - Wait for tokens (usually instant)

4. **Verify Balance:**
   ```bash
   cd backend/ethereum
   npm run check-mirror-status
   ```
   You should see your wVARA balance > 0

### Step 2: Fund the Mirror Contract

Once you have wVARA tokens:

```bash
cd backend/ethereum
npm run fund-program
```

Or use the improved script:
```bash
npx tsx scripts/get-wvara-and-fund.ts
```

This will:
1. Check your wVARA balance
2. Approve the Mirror contract to spend your wVARA
3. Fund the Mirror with 10 wVARA for execution

### Step 3: Verify Funding

Check that the Mirror is funded:
```bash
npm run check-mirror-status
```

You should see:
- ✅ wVARA balance > 0
- ✅ Mirror state hash (may still be zero until first message)
- ✅ Mirror not exited

## 🔍 Troubleshooting

### Error: "Insufficient wVARA balance"
- **Solution:** Get wVARA from the faucet (Step 1 above)

### Error: "executableBalanceTopUp reverted"
- **Possible causes:**
  1. Mirror not initialized (needs init message first)
  2. Insufficient wVARA balance
  3. Approval not set correctly

- **Solution:**
  1. Make sure you have at least 10 wVARA
  2. Try approving again: The script will check and re-approve if needed
  3. Check Mirror status: `npm run check-mirror-status`

### Error: "Mirror needs initialization"
- **Solution:** The Mirror contract might need to receive an init message first. This is usually handled automatically when you create the first market, but if it fails, you may need to send an init message manually.

## ✅ Success Indicators

After successful funding, you should see:
- ✅ Approval transaction confirmed
- ✅ Top-up transaction confirmed
- ✅ Mirror can now execute messages

## 🚀 Next Steps After Funding

Once the Mirror is funded:

1. **Test Market Creation:**
   ```bash
   npm run test-contract
   ```
   - This should now work with Mirror integration

2. **Test Trading:**
   - Create a market via frontend
   - Try depositing ETH to buy YES/NO tokens
   - The Mirror should process the trade

3. **Test Withdrawals:**
   - Try withdrawing tokens
   - The Mirror should calculate the withdrawal

## 📊 Current Status

**Your Wallet:** `0x25fC28bD6Ff088566B9d194226b958106031d441`  
**Mirror Address:** `0x0034599835d4d7539c43721574d1d4f473f1ee6f`  
**Required wVARA:** 10 wVARA (10,000,000,000,000 wei)  
**Current Balance:** 0 wVARA ⚠️

**Action Required:** Get wVARA from https://eth.vara.network/faucet

---

**Last Updated:** 2026-01-05

