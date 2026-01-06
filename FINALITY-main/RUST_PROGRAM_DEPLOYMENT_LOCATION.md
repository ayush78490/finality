# Where Your Rust/WASM Program is Deployed

## 🎯 Quick Answer

**Your Rust program (WASM) is deployed on the Vara.eth Router contract on Hoodi Testnet.**

---

## 📍 Exact Deployment Location

### 1. **Source Code** (Local)
```
Location: backend/vara/src/
Files:
  - lib.rs
  - market_engine.rs
  - trading_bot.rs
  - types.rs
```

### 2. **Compiled WASM** (Local)
```
Location: backend/vara/target/wasm32-gear/release/
File: prediction_market_vara.opt.wasm
Size: 48 KB (47,919 bytes)
Status: ✅ Compiled and ready
```

### 3. **Uploaded to Vara.eth Router** (ON-CHAIN)
```
📍 DEPLOYED HERE:
   Contract: 0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
   Network: Hoodi Testnet (Ethereum L1)
   CODE_ID: 0x299a8cbc0fdfbdcfde684d1c53dcab740ec46a06641f9f679bbba13d8a76427b
   Status: ✅ UPLOADED AND STORED
```

**This is where your Rust program actually lives!**

The Router contract stores your WASM code and assigns it a CODE_ID (hash of the WASM).

### 4. **Program Instance** (Mirror Contract)
```
Location: 0x0034599835d4d7539c43721574d1d4f473f1ee6f
Network: Hoodi Testnet
Type: Mirror Contract (gateway to WASM)
Status: ✅ Created from CODE_ID
```

This Mirror contract is the "program ID" - it's the gateway that lets you interact with your WASM code.

### 5. **Execution** (Vara.eth Executor Network)
```
When you send a message → Vara.eth executor network runs your WASM
State updates → Stored on Mirror contract (on Ethereum)
```

---

## 🔄 Complete Deployment Flow

```
1. Rust Code (local)
   ↓
2. Compile → WASM file (local: 48 KB)
   ↓
3. Upload → Vara.eth Router (ON-CHAIN)
   ├─ Router Address: 0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
   ├─ CODE_ID: 0x299a8cbc0fdfbdcfde684d1c53dcab740ec46a06641f9f679bbba13d8a76427b
   └─ Status: ✅ STORED HERE
   ↓
4. Create Program → Mirror Contract (ON-CHAIN)
   ├─ Mirror Address: 0x0034599835d4d7539c43721574d1d4f473f1ee6f
   └─ Status: ✅ ACTIVE
   ↓
5. Send Messages → Executor runs WASM → State on Mirror
```

---

## ✅ Verification

### Your Rust Program IS Deployed:

| Component | Location | Status |
|-----------|----------|--------|
| **WASM Code** | Router: `0xBC888a8B050B9B76a985d91c815d2c4f2131a58A` | ✅ Stored |
| **CODE_ID** | `0x299a8cbc0fdfbdcfde684d1c53dcab740ec46a06641f9f679bbba13d8a76427b` | ✅ Active |
| **Program Instance** | Mirror: `0x0034599835d4d7539c43721574d1d4f473f1ee6f` | ✅ Active |
| **Execution** | Vara.eth Executor Network | ✅ Ready |

---

## 🔍 How to Verify

### Check Router (where WASM is stored):
```bash
# View on explorer
https://explorer.hoodi.io/address/0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
```

### Check Mirror (program instance):
```bash
# View on explorer
https://explorer.hoodi.io/address/0x0034599835d4d7539c43721574d1d4f473f1ee6f
```

### Check CODE_ID:
```bash
cd backend/ethereum
cat .env | grep MARKET_ENGINE_CODE_ID
# Output: MARKET_ENGINE_CODE_ID=0x299a8cbc0fdfbdcfde684d1c53dcab740ec46a06641f9f679bbba13d8a76427b
```

---

## 📊 Architecture Summary

### Where Everything Lives:

```
┌─────────────────────────────────────────────────┐
│ Ethereum L1 (Hoodi Testnet)                     │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ Vara.eth Router                          │  │
│  │ 0xBC888a8B050B9B76a985d91c815d2c4f2131a58A│  │
│  │                                           │  │
│  │ ✅ YOUR WASM CODE IS STORED HERE          │  │
│  │ CODE_ID: 0x299a8cbc0fdfbdcfde684d1c...    │  │
│  └──────────────────────────────────────────┘  │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │ Mirror Contract (Program Instance)       │  │
│  │ 0x0034599835d4d7539c43721574d1d4f473f1ee6f│  │
│  │                                           │  │
│  │ ✅ Gateway to your WASM program           │  │
│  │ ✅ Stores state hash                      │  │
│  │ ✅ Receives messages                      │  │
│  └──────────────────────────────────────────┘  │
│                    ↓                            │
│  ┌──────────────────────────────────────────┐  │
│  │ Settlement Contract                       │  │
│  │ 0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a│  │
│  │                                           │  │
│  │ ✅ Uses Mirror to execute trades          │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ Vara.eth Executor Network                      │
│ (Off-chain, parallel execution)                │
│                                                 │
│ ✅ Runs your WASM code                         │
│ ✅ Processes messages                          │
│ ✅ Updates state                               │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Direct Answer

**Q: Where is the Rust contract deployed?**

**A: On the Vara.eth Router contract at `0xBC888a8B050B9B76a985d91c815d2c4f2131a58A` on Hoodi Testnet.**

- The WASM code is stored on the Router
- It's referenced by CODE_ID: `0x299a8cbc0fdfbdcfde684d1c53dcab740ec46a06641f9f679bbba13d8a76427b`
- The Mirror contract (`0x0034599835d4d7539c43721574d1d4f473f1ee6f`) is the program instance that lets you interact with it

**It's NOT on a separate blockchain - it's on Ethereum L1 (Hoodi Testnet) via the Router contract!**

---

## 🔗 Explorer Links

- **Router (where WASM is stored):** https://explorer.hoodi.io/address/0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
- **Mirror (program instance):** https://explorer.hoodi.io/address/0x0034599835d4d7539c43721574d1d4f473f1ee6f
- **Settlement Contract:** https://explorer.hoodi.io/address/0x42A77c17756f37da3Ec5A9008EcEC55f22dC6F6a

---

**Last Updated:** 2026-01-05  
**Status:** ✅ Rust program is deployed on Vara.eth Router

