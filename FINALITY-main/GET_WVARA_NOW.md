# Why wVARA Balance is 0 - How to Fix

## 🚨 Why It Shows 0 wVARA

**You haven't gotten wVARA from the faucet yet!**

wVARA tokens don't appear automatically - you need to request them from the faucet.

---

## ✅ How to Get wVARA

### Step 1: Visit the Faucet

**URL:** https://eth.vara.network/faucet

### Step 2: Connect Your Wallet

1. Make sure MetaMask is connected
2. Make sure you're on **Hoodi Testnet** (Chain ID: 560048)
3. Your wallet address: `0x25fC28bD6Ff088566B9d194226b958106031d441`

### Step 3: Request wVARA

1. Enter your wallet address (or it should auto-detect)
2. Click "Get Test wVARA" or similar button
3. Approve the transaction in MetaMask
4. Wait for confirmation (usually instant)

### Step 4: Verify You Received wVARA

```bash
cd backend/ethereum
npm run check-mirror-status
```

You should see: `wVARA Balance: > 0`

---

## 🔍 Check Your Balance

### Method 1: Via Script
```bash
cd backend/ethereum
npx tsx scripts/get-wvara-info.ts
```

### Method 2: Via MetaMask (if you added the token)
- Look at your assets list
- You should see wVARA balance

### Method 3: Via Explorer
- wVARA Token: https://hoodi.fraxscan.com/token/0x2C960bd5347C2Eb4d9bBEA0CB9671C5b641Dcbb9
- Your Wallet: https://hoodi.fraxscan.com/address/0x25fC28bD6Ff088566B9d194226b958106031d441

---

## ⚠️ Common Issues

### Issue: "Faucet says I already claimed"
**Solution:**
- Wait a few minutes
- Try again
- Check if you're on the correct network (Hoodi Testnet)

### Issue: "Transaction fails"
**Solution:**
- Make sure you have ETH for gas fees
- Make sure you're on Hoodi Testnet
- Check MetaMask for error details

### Issue: "Still shows 0 after claiming"
**Solution:**
- Wait 1-2 minutes for transaction to confirm
- Refresh/check again: `npm run check-mirror-status`
- Verify transaction on explorer

---

## 📝 Quick Steps

1. **Go to faucet:** https://eth.vara.network/faucet
2. **Connect wallet** (Hoodi Testnet)
3. **Request wVARA**
4. **Approve transaction**
5. **Wait for confirmation**
6. **Verify:** `npm run check-mirror-status`

---

## ✅ After Getting wVARA

Once you have wVARA:

```bash
cd backend/ethereum
npm run fund-program
```

This will:
- ✅ Check your balance
- ✅ Approve Mirror
- ✅ Fund the Mirror
- ✅ Enable deposits/betting!

---

**Last Updated:** 2026-01-05  
**Status:** ⚠️ Get wVARA from faucet: https://eth.vara.network/faucet

