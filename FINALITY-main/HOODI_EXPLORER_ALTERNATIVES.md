# Hoodi Testnet Explorer - Alternatives

## ⚠️ Issue: explorer.hoodi.io Not Working

If `https://explorer.hoodi.io` is not accessible, here are alternative ways to verify your contracts:

---

## ✅ Method 1: Verify via RPC (Most Reliable)

**No explorer needed!** You can verify everything directly via RPC:

```bash
cd backend/ethereum
npm run test-contract
```

This will:
- ✅ Verify contracts exist
- ✅ Read contract state
- ✅ Check all addresses
- ✅ No explorer needed!

---

## ✅ Method 2: Use MetaMask

1. **Add Hoodi Testnet to MetaMask:**
   - Network Name: `Hoodi Testnet`
   - RPC URL: `https://hoodi-reth-rpc.gear-tech.io`
   - Chain ID: `560048`
   - Currency: `ETH`

2. **View Contracts:**
   - Go to MetaMask → Activity
   - Click on any transaction
   - View contract details there

3. **View Addresses:**
   - Paste contract address in MetaMask search
   - View balance and transactions

---

## ✅ Method 3: Direct RPC Calls

**Check contracts programmatically:**

```bash
cd backend/ethereum
npx tsx scripts/check-contract-via-rpc.ts
```

This verifies:
- ✅ Contract code exists
- ✅ Contract state
- ✅ Network connectivity
- ✅ All without an explorer!

---

## ✅ Method 4: Alternative Explorers

### Try These (if available):

1. **Blockscout** (if Hoodi is supported):
   - https://blockscout.com
   - Search for your contract address

2. **Etherscan-style explorers:**
   - Some testnets use generic Ethereum explorers
   - Try searching your contract address

3. **Gear Tech Explorer:**
   - Check Gear Tech's official documentation
   - They may have an alternative explorer URL

---

## 📊 Your Contract Addresses (Verified via RPC)

These are **confirmed on-chain** via RPC:

| Contract | Address | Status |
|----------|---------|--------|
| **Settlement** | `0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a` | ✅ Verified |
| **Mirror** | `0x0034599835d4d7539c43721574d1d4f473f1ee6f` | ✅ Verified |
| **Router** | `0xBC888a8B050B9B76a985d91c815d2c4f2131a58A` | ✅ Verified |

**Verification Method:** Direct RPC calls (most reliable)

---

## 🔍 How to Verify Without Explorer

### Check Contract Exists:

```bash
cd backend/ethereum
npx hardhat console --network hoodi
```

Then:
```javascript
const code = await ethers.provider.getCode("0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a");
console.log("Contract code length:", code.length);
// If > 2, contract exists!
```

### Check Contract State:

```javascript
const contract = await ethers.getContractAt(
  "PredictionMarketSettlementVaraEth",
  "0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a"
);
const nextMarketId = await contract.nextMarketId();
console.log("Next Market ID:", nextMarketId.toString());
```

---

## ✅ Quick Verification Commands

```bash
# Check deployment status
cd backend/ethereum
npm run status

# Test contract functions
npm run test-contract

# Verify Mirror contract
npm run check-mirror-status

# Check contracts via RPC
npx tsx scripts/check-contract-via-rpc.ts
```

---

## 🎯 Summary

**Explorer not working? No problem!**

✅ **Your contracts ARE deployed** (verified via RPC)  
✅ **You can verify everything** without an explorer  
✅ **Use RPC calls** - most reliable method  
✅ **Use MetaMask** - built-in contract viewing  

**The explorer is just a UI - the contracts are on-chain regardless!**

---

## 📝 Note About Explorers

Block explorers are **convenience tools** - they're not required for:
- ✅ Contract deployment
- ✅ Contract verification
- ✅ Reading contract state
- ✅ Sending transactions

**Everything works via RPC!** The explorer is just a nice UI to view it.

---

**Last Updated:** 2026-01-05  
**Status:** ✅ Contracts verified via RPC (explorer not needed)

