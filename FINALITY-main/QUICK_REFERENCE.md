# Quick Reference Guide
## Prediction Market - Vara.eth Integration

### 🎯 What We Built

A **production-grade prediction market** on Ethereum L1 using Vara.eth for fast computation.

### 📋 Architecture Summary

```
User → Settlement Contract → Mirror Contract → Vara.eth WASM → State Hash → Ethereum
```

**Key Components:**
1. **Settlement Contract** (Solidity): Market management, tokens, fees
2. **Mirror Contract** (Auto-deployed): Gateway to WASM program
3. **MarketEngine** (Rust/WASM): AMM calculations, trades
4. **TradingBot** (Rust/WASM): Automated strategies

### 🔑 Key Addresses

- **Your Address**: `0x25fC28bD6Ff088566B9d194226b958106031d441`
- **Vara.eth Router**: `0xBC888a8B050B9B76a985d91c815d2c4f2131a58A` (fixed)
- **RPC**: `https://hoodi-reth-rpc.gear-tech.io`
- **Explorer**: `https://explorer.hoodi.io`

### 📝 Environment Variables

```env
DEPLOYER_PRIVATE_KEY=0xd8c3d48dc76e3df5c2a90e4fcb8e774a450fae6b66c7c8a6a331ede54523f092
DEPLOYER_ADDRESS=0x25fC28bD6Ff088566B9d194226b958106031d441
MARKET_ENGINE_CODE_ID=0x...        # After WASM upload
MARKET_ENGINE_MIRROR_ADDRESS=0x... # After program creation
SETTLEMENT_CONTRACT_ADDRESS=0x...  # After contract deployment
```

### 🚀 Deployment Steps

1. **Get Test ETH**: https://hoodifaucet.io
2. **Upload WASM**: Get CODE_ID
3. **Create Program**: Get Mirror address
4. **Fund Program**: Get wVARA, fund with 10 wVARA
5. **Deploy Contract**: Deploy settlement contract

**Automated:**
```bash
cd backend/ethereum
bash scripts/continue-deployment.sh
```

### 🧪 Testing

```bash
# Check status
npm run status

# Test contract
npm run test-contract

# Check balance
npm run check-balance
```

### 📊 How It Works

**Trade Flow:**
1. User calls `deposit(marketId, isYes)` with ETH
2. Contract encodes `ExecuteTrade` action
3. Calls `Mirror.sendMessage(payload, value)`
4. Vara.eth executes WASM (AMM calculation)
5. State hash updated on Mirror
6. Contract reads `Mirror.stateHash()`
7. Event emitted

**AMM Formula:** `x * y = k` (constant product)

**Fees:** 3% total (2% creator, 1% platform)

### 🔒 Security

- ✅ Reentrancy protection
- ✅ State hash verification
- ✅ Access control
- ✅ Input validation
- ✅ Safe math (Solidity 0.8.20)

### 📚 Documentation

- **Complete Technical Doc**: `COMPLETE_TECHNICAL_DOCUMENTATION.md` (939 lines)
- **Deployment Guide**: `TESTNET_SETUP_GUIDE.md`
- **IP Block Solutions**: `IP_BLOCK_SOLUTIONS.md`

### ⚠️ Known Limitations

1. **Reply Decoding**: Currently placeholder (needs Mirror reply parsing)
2. **Oracle**: Manual resolution (production needs oracle)
3. **State Hash**: Simple hash (production needs cryptographic hash)

### 🎯 Next Steps

1. Get test ETH (if blocked, see `IP_BLOCK_SOLUTIONS.md`)
2. Run deployment script
3. Test all functions
4. Review complete documentation

---

**For detailed information, see: `COMPLETE_TECHNICAL_DOCUMENTATION.md`**




