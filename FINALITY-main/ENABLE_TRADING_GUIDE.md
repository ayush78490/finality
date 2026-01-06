# 🚀 Enable Full Trading - Complete Guide

## Current Status

✅ **Contract Deployed:** `0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a`  
✅ **Market Creation:** Working  
✅ **Market Viewing:** Working  
⚠️ **Trading:** Requires wVARA funding  
⚠️ **Withdrawals:** Requires wVARA funding  

## Step-by-Step: Enable Full Trading

### Step 1: Get wVARA Tokens

**You need wVARA tokens to fund the Mirror contract so it can execute trades.**

1. **Visit the Faucet:**
   - URL: **https://eth.vara.network/faucet**
   - Make sure you're on **Hoodi Testnet** in MetaMask

2. **Connect Your Wallet:**
   - Your address: `0x25fC28bD6Ff088566B9d194226b958106031d441`
   - Connect MetaMask to the faucet site

3. **Request wVARA:**
   - Enter your address or connect wallet
   - Click "Get Test wVARA" or similar
   - Wait for confirmation (usually instant)

4. **Verify You Received wVARA:**
   ```bash
   cd backend/ethereum
   npm run check-mirror-status
   ```
   You should see: `wVARA Balance: > 0`

### Step 2: Fund the Mirror Contract

Once you have wVARA tokens:

```bash
cd backend/ethereum
npm run fund-program
```

**What this does:**
1. Checks your wVARA balance (needs at least 10 wVARA)
2. Approves the Mirror contract to spend your wVARA
3. Funds the Mirror with 10 wVARA for execution

**Expected Output:**
```
✅ Approval transaction: 0x...
✅ Top-up transaction: 0x...
✅ Mirror Funded Successfully
```

### Step 3: Test Trading

Once the Mirror is funded, test the trading functions:

```bash
cd backend/ethereum
npm run test-trading
```

**This will test:**
- ✅ Depositing ETH to buy YES/NO tokens
- ✅ Checking token balances
- ✅ Requesting withdrawals
- ✅ Verifying state hash updates

### Step 4: Test via Frontend

1. **Start the frontend:**
   ```bash
   npm run dev
   ```

2. **Connect MetaMask:**
   - Make sure you're on Hoodi Testnet
   - Connect your wallet

3. **Create or View Markets:**
   - Go to `/markets` to see existing markets
   - Go to `/create-market` to create a new one

4. **Test Trading:**
   - Click on a market
   - Try depositing ETH to buy YES or NO tokens
   - The Mirror should process the trade
   - Check your token balance

## Troubleshooting

### Error: "Insufficient wVARA balance"
**Solution:** Get wVARA from https://eth.vara.network/faucet

### Error: "executableBalanceTopUp reverted"
**Possible causes:**
1. Mirror not initialized (needs init message)
2. Insufficient wVARA
3. Approval issue

**Solution:**
1. Make sure you have at least 10 wVARA
2. The script will check and re-approve if needed
3. Check Mirror status: `npm run check-mirror-status`

### Error: "State hash is zero"
**This is normal if:**
- Mirror hasn't processed any messages yet
- First market creation might set it to zero

**After trading:**
- State hash should update when Mirror processes trades
- Check with: `npm run test-trading`

### Trading fails with "execution reverted"
**Check:**
1. Mirror is funded: `npm run check-mirror-status`
2. Market is open (status = 0)
3. You have enough ETH for gas + deposit
4. Market hasn't ended yet

## Verification Checklist

After completing all steps, verify:

- [ ] wVARA balance > 0
- [ ] Mirror funded successfully
- [ ] Approval transaction confirmed
- [ ] Top-up transaction confirmed
- [ ] Market creation works
- [ ] Deposit function works
- [ ] Token balances update
- [ ] State hash updates (after trading)
- [ ] Withdrawal requests work

## Quick Commands Reference

```bash
# Check Mirror status and wVARA balance
npm run check-mirror-status

# Fund Mirror with wVARA
npm run fund-program

# Test trading functions
npm run test-trading

# Test contract (market creation)
npm run test-contract

# Check deployment status
npm run status
```

## Expected Results

### After Funding:
- ✅ Mirror can execute messages
- ✅ State hash updates when trading
- ✅ Trades process through Vara.eth
- ✅ Withdrawals calculate correctly

### After Trading:
- ✅ YES/NO tokens received
- ✅ Token balances correct
- ✅ State hash updated
- ✅ Market data reflects trades

## Next Steps

Once trading is enabled:

1. **Test Full Flow:**
   - Create market
   - Deposit ETH (buy tokens)
   - Check token balance
   - Request withdrawal
   - Verify everything works

2. **Frontend Integration:**
   - Test via UI
   - Verify real-time updates
   - Check error handling

3. **Production Readiness:**
   - Monitor gas costs
   - Test edge cases
   - Verify security

---

**Current Status:** ⚠️ Waiting for wVARA tokens  
**Action Required:** Get wVARA from https://eth.vara.network/faucet  
**Last Updated:** 2026-01-05

