# wVARA Token - MetaMask Setup (Optional)

## 🎯 Quick Answer

**NO - You don't need to add wVARA to MetaMask to fund the Mirror!**

The funding script (`npm run fund-program`) handles everything automatically.

**However**, if you want to **see your wVARA balance** in MetaMask, you can add it as a custom token (optional).

---

## ✅ What You Actually Need

### To Fund the Mirror:

1. **Get wVARA from faucet:**
   - Visit: https://eth.vara.network/faucet
   - Connect your wallet
   - Request test wVARA

2. **Fund the Mirror (automatic):**
   ```bash
   cd backend/ethereum
   npm run fund-program
   ```
   
   **This script:**
   - ✅ Checks your wVARA balance
   - ✅ Approves Mirror to spend wVARA
   - ✅ Funds the Mirror
   - ✅ **No MetaMask token addition needed!**

---

## 📱 Optional: Add wVARA to MetaMask (To See Balance)

If you want to **see your wVARA balance** in MetaMask:

### Step 1: Get wVARA Token Address

Run:
```bash
cd backend/ethereum
npx tsx scripts/get-wvara-info.ts
```

This will show you the wVARA token address.

### Step 2: Add to MetaMask

1. Open MetaMask
2. Make sure you're on **Hoodi Testnet** (Chain ID: 560048)
3. Scroll down in the assets list
4. Click **"Import tokens"**
5. Click **"Custom Token"** tab
6. Paste the wVARA token address
7. MetaMask should auto-detect:
   - Token Symbol: `wVARA`
   - Token Decimals: `12`
8. Click **"Add Custom Token"**
9. Click **"Import Tokens"**

Now you'll see your wVARA balance in MetaMask!

---

## 🔍 How to Check wVARA Balance

### Method 1: Via Script (No MetaMask needed)
```bash
cd backend/ethereum
npm run check-mirror-status
```

### Method 2: Via MetaMask (After adding token)
- Just look at your assets list
- You'll see wVARA balance

### Method 3: Via Explorer
- Get wVARA address from script
- View on: https://hoodi.fraxscan.com/token/[wvara-address]

---

## 📝 Summary

| Action | Need MetaMask Token? |
|--------|----------------------|
| **Get wVARA from faucet** | ❌ No |
| **Fund Mirror** | ❌ No (script handles it) |
| **See wVARA balance** | ⚠️ Optional (only if you want to see it) |

---

## ✅ Recommended Flow

1. **Get wVARA:**
   - Visit faucet: https://eth.vara.network/faucet
   - Request tokens

2. **Fund Mirror:**
   ```bash
   npm run fund-program
   ```
   - Script does everything automatically
   - No MetaMask token addition needed

3. **Verify:**
   ```bash
   npm run check-mirror-status
   ```

**That's it!** No need to add wVARA to MetaMask unless you want to see the balance there.

---

**Last Updated:** 2026-01-05  
**Answer:** ❌ **No, not required** - Script handles everything automatically

