# Deposit/Bet Failure - Fix Guide

## 🚨 Issue: Transaction Shows "Confirmed" Then "Failed"

### What's Happening:

1. **Transaction is sent** → MetaMask shows "Confirmed" (optimistic)
2. **Contract executes** → Calls Mirror contract
3. **Mirror call fails** → Not funded with wVARA
4. **Transaction reverts** → MetaMask shows "Failed"

---

## ✅ Root Cause

**The Mirror contract isn't funded with wVARA!**

The `deposit()` function calls:
```solidity
marketEngineMirror.sendMessage{value: msg.value}(tradePayload, false);
```

This will **revert** if the Mirror doesn't have wVARA to execute the message.

---

## 🔧 Fixes Applied

### 1. ✅ Added Network Validation
- Deposit hook now checks for correct network
- Auto-switches to Hoodi Testnet if needed
- Added explicit `chainId: 560048`

### 2. ✅ Added Better Error Handling
- Network validation before deposit
- Clear error messages
- Auto-network switching

### 3. ⚠️ Still Needs: Mirror Funding

**To make deposits work, you need to:**

1. **Get wVARA tokens:**
   - Visit: https://eth.vara.network/faucet
   - Connect wallet: `0x25fC28bD6Ff088566B9d194226b958106031d441`
   - Request test wVARA

2. **Fund the Mirror:**
   ```bash
   cd backend/ethereum
   npm run fund-program
   ```

---

## 🎯 Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Create Markets** | ✅ Works | No Mirror call needed |
| **View Markets** | ✅ Works | Read-only |
| **Deposit/Bet** | ⚠️ Fails | Mirror needs wVARA |
| **Withdrawals** | ⚠️ Fails | Mirror needs wVARA |

---

## 🔍 How to Verify

### Check if Mirror is Funded:

```bash
cd backend/ethereum
npm run check-mirror-status
```

**If wVARA balance is 0:**
- Get wVARA from faucet
- Fund Mirror: `npm run fund-program`

---

## 📝 What Changed

### Fixed Files:
1. `src/hooks/useContracts.ts`
   - Added network validation to `useDeposit()`
   - Added explicit `chainId: 560048`
   - Added network switching

2. `src/components/market/BettingPanel.tsx`
   - Added network check before deposit
   - Better error messages

---

## ✅ Next Steps

1. **For Market Creation:** ✅ Already works!
2. **For Deposits/Betting:** 
   - Get wVARA from faucet
   - Fund Mirror: `npm run fund-program`
   - Then deposits will work!

---

**Last Updated:** 2026-01-05  
**Status:** ✅ Network validation fixed, ⚠️ Mirror needs wVARA funding

