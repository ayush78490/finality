# Program ID Location - Quick Reference

## 🎯 What is the Program ID?

In Vara.eth, the **Program ID** is the **Mirror Contract Address**. It's the Ethereum contract that acts as the gateway to your WASM program.

---

## 📍 Where is it Stored?

### 1. **Backend Environment File**

**File:** `backend/ethereum/.env`

**Variable Name:** `MARKET_ENGINE_MIRROR_ADDRESS`

**Current Value:**
```
MARKET_ENGINE_MIRROR_ADDRESS=0x0034599835d4d7539c43721574d1d4f473f1ee6f
```

**How to view:**
```bash
cd backend/ethereum
cat .env | grep MARKET_ENGINE_MIRROR_ADDRESS
```

---

## 🔍 Where is it Used?

### 1. **Settlement Contract**

**File:** `backend/ethereum/contracts/PredictionMarketSettlementVaraEth.sol`

**Usage:**
```solidity
IVaraEthMirror public immutable marketEngineMirror;

constructor(address _marketEngineMirror) {
    marketEngineMirror = IVaraEthMirror(_marketEngineMirror);
    // This is set to: 0x0034599835d4d7539c43721574d1d4f473f1ee6f
}
```

**Deployed Contract:** `0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a`  
**Mirror Address (Program ID):** `0x0034599835d4d7539c43721574d1d4f473f1ee6f`

### 2. **Deployment Scripts**

**File:** `backend/ethereum/scripts/deploy.ts`

**Usage:**
```typescript
const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
// Used when deploying the settlement contract
```

### 3. **Funding Scripts**

**File:** `backend/ethereum/scripts/fund-program.ts`

**Usage:**
```typescript
const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
// Used to fund the Mirror with wVARA
```

### 4. **Test Scripts**

**File:** `backend/ethereum/scripts/test-contract.ts`

**Usage:**
```typescript
const mirrorAddress = process.env.MARKET_ENGINE_MIRROR_ADDRESS;
// Used to verify Mirror connection
```

---

## 📊 Complete Program ID Information

### Your Program ID (Mirror Address)
```
0x0034599835d4d7539c43721574d1d4f473f1ee6f
```

### Related Addresses

| Component | Address/ID | Type |
|-----------|-----------|------|
| **Program ID** | `0x0034599835d4d7539c43721574d1d4f473f1ee6f` | Mirror Contract |
| **CODE_ID** | `0x299a8cbc0fdfbdcfde684d1c53dcab740ec46a06641f9f679bbba13d8a76427b` | WASM Code Hash |
| **Settlement Contract** | `0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a` | Main Contract |

### Explorer Links

- **Program ID (Mirror):** https://explorer.hoodi.io/address/0x0034599835d4d7539c43721574d1d4f473f1ee6f
- **Settlement Contract:** https://explorer.hoodi.io/address/0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a

---

## 🔧 How to Check Program ID

### Method 1: View .env File
```bash
cd backend/ethereum
cat .env | grep MARKET_ENGINE_MIRROR_ADDRESS
```

### Method 2: Check Deployment Status
```bash
cd backend/ethereum
npm run status
```

**Output:**
```
✅ Mirror: 0x0034599835d4d7539c43721574d1d4f473f1ee6f
```

### Method 3: Check Contract
```bash
cd backend/ethereum
npm run test-contract
```

**Output:**
```
Mirror Address: 0x0034599835d4d7539c43721574d1d4f473f1ee6f
```

### Method 4: Query Contract On-Chain
```bash
cd backend/ethereum
npx hardhat console --network hoodi
```

Then:
```javascript
const contract = await ethers.getContractAt(
  "PredictionMarketSettlementVaraEth",
  "0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a"
);
const mirror = await contract.marketEngineMirror();
console.log("Program ID:", mirror);
// Output: 0x0034599835d4d7539c43721574d1d4f473f1ee6f
```

---

## 📝 Quick Reference

**Program ID = Mirror Address = `0x0034599835d4d7539c43721574d1d4f473f1ee6f`**

**Stored in:**
- ✅ `backend/ethereum/.env` as `MARKET_ENGINE_MIRROR_ADDRESS`
- ✅ Settlement contract constructor (immutable)
- ✅ All deployment/test scripts

**Used for:**
- ✅ Sending messages to WASM program
- ✅ Reading state hash
- ✅ Funding with wVARA
- ✅ All Vara.eth interactions

---

**Last Updated:** 2026-01-05  
**Status:** ✅ Program ID is set and deployed

