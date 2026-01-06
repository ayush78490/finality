# Vara.eth Implementation Plan - Testnet Production Grade

## 🎯 Overview

Complete migration to Vara.eth architecture for Finality prediction market on **Hoodi testnet** (Ethereum testnet for Vara.eth).

---

## 📋 Prerequisites Checklist

### What You Need to Provide:

1. **Wallet Address** (for faucet)
   - Ethereum address (0x...) for receiving test ETH and wVARA
   - Can use MetaMask or any Ethereum wallet

2. **Private Key** (for deployment)
   - Private key for deploying contracts and programs
   - **NEVER commit to git** - use `.env` files

3. **Environment Setup**
   - Node.js 18+
   - Rust toolchain (latest stable)
   - Git

4. **Faucet Access**
   - Get test ETH from: https://hoodifaucet.io
   - Get test wVARA from: Vara.eth faucet (once deployed)

---

## 🏗️ Architecture Changes

### Current → Vara.eth

| Component | Current | Vara.eth |
|-----------|---------|----------|
| **Relayer** | ❌ Required (trusted) | ✅ Eliminated |
| **Vara Network** | Separate chain | ✅ Runs on Ethereum |
| **State Verification** | Manual (not verified) | ✅ Automatic on Mirror |
| **User Interaction** | Events → Relayer | ✅ Direct Mirror calls |
| **Gas Costs** | User pays | ✅ Program pays (wVARA) |

---

## 📁 File Structure

```
backend/
├── ethereum/
│   ├── contracts/
│   │   ├── PredictionMarketSettlement.sol  # UPDATED: Uses Mirror
│   │   ├── OutcomeToken.sol                 # UNCHANGED
│   │   └── IMarketEngine.sol                # NEW: Generated from IDL
│   ├── scripts/
│   │   ├── deploy.ts                        # UPDATED: Hoodi testnet
│   │   ├── deploy-vara-eth.ts               # NEW: Deploy Vara.eth program
│   │   └── fund-program.ts                 # NEW: Fund with wVARA
│   └── hardhat.config.ts                    # UPDATED: Hoodi network
│
├── vara/
│   ├── src/
│   │   ├── lib.rs                           # UPDATED: Sails compatible
│   │   ├── market_engine.rs                 # UPDATED: Sails annotations
│   │   └── types.rs                         # UPDATED: Sails types
│   └── Cargo.toml                           # UPDATED: Add Sails
│
└── scripts/
    ├── setup-testnet.sh                     # NEW: Complete setup
    ├── get-faucet.sh                        # NEW: Get test tokens
    └── deploy-all.sh                        # NEW: Full deployment
```

---

## 🚀 Step-by-Step Implementation

### Phase 1: Environment Setup (Day 1)

#### 1.1 Install Dependencies

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Foundry (for Solidity interface deployment)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Vara.eth CLI
# Download from: https://get.gear.rs
# Or build from source:
git clone https://github.com/gear-tech/gear.git
cd gear
cargo build -p ethexe-cli -r
```

#### 1.2 Get Test Tokens

**Get Test ETH:**
```bash
# Visit: https://hoodifaucet.io
# Enter your wallet address
# Receive test ETH (for gas)
```

**Get Test wVARA:**
```bash
# After deploying program, use Vara.eth faucet
# Visit: https://eth.vara.network/faucet
# Enter your wallet address
# Receive test wVARA (for program execution)
```

#### 1.3 Configure Environment

Create `.env` files:

**`backend/ethereum/.env`:**
```env
# Hoodi Testnet Configuration
HOODI_RPC_URL=https://hoodi-reth-rpc.gear-tech.io
HOODI_WS_URL=wss://hoodi-reth-rpc.gear-tech.io/ws
HOODI_CHAIN_ID=560048

# Deployment
DEPLOYER_PRIVATE_KEY=0x...  # YOUR PRIVATE KEY
DEPLOYER_ADDRESS=0x...      # YOUR ADDRESS

# Vara.eth Router (Hoodi testnet)
VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A

# Contract Addresses (will be set after deployment)
SETTLEMENT_CONTRACT_ADDRESS=
MARKET_ENGINE_MIRROR_ADDRESS=
```

**`backend/vara/.env`:**
```env
# Vara.eth Configuration
VARA_ETH_WS=wss://hoodi-reth-rpc.gear-tech.io/ws
VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A
```

---

### Phase 2: Update Vara Program for Sails (Day 1-2)

#### 2.1 Add Sails Framework

**Update `backend/vara/Cargo.toml`:**
```toml
[package]
name = "prediction-market-vara"
version = "0.1.0"
edition = "2021"

[dependencies]
gstd = "1.6.1"
sails = "0.1.0"  # ADD THIS
parity-scale-codec = { version = "3.6", default-features = false, features = ["derive"] }
scale-info = { version = "2.11", default-features = false, features = ["derive"] }

[build-dependencies]
gear-wasm-builder = "1.6.1"
sails-build = "0.1.0"  # ADD THIS

[profile.release]
opt-level = "s"
lto = true
panic = "abort"

[lib]
crate-type = ["cdylib", "rlib"]
```

#### 2.2 Update Program Structure

The current program structure is compatible, but we'll add Sails annotations for IDL generation.

**Note:** Current program works, but Sails makes ABI generation easier. We can proceed with current structure and generate IDL manually if needed.

---

### Phase 3: Deploy Vara.eth Program (Day 2)

#### 3.1 Build WASM

```bash
cd backend/vara
cargo build --release
# Output: target/wasm32-unknown-unknown/release/prediction_market_vara.opt.wasm
```

#### 3.2 Upload to Ethereum

```bash
# Insert your key
./ethexe key insert $DEPLOYER_PRIVATE_KEY

# Upload WASM
./ethexe --cfg none tx \
  --ethereum-rpc "$HOODI_WS_URL" \
  --ethereum-router "$VARA_ETH_ROUTER" \
  --sender "$DEPLOYER_ADDRESS" \
  upload target/wasm32-unknown-unknown/release/prediction_market_vara.opt.wasm -w
```

**Output:**
```
Transaction: 0x...
Code ID: 0x...  # SAVE THIS!
```

#### 3.3 Create Program Instance (Mirror Contract)

```bash
cd backend/ethereum
npm install @vara-eth/api viem
npm run create-program
```

**Output:**
```
Program ID (Mirror Address): 0x...  # SAVE THIS!
```

#### 3.4 Generate Solidity Interface

```bash
cd backend/vara
# If using Sails:
cargo sails sol --idl-path ./target/wasm32-unknown-unknown/release/prediction_market_vara.idl

# Or generate manually from types.rs
# (We'll create a script for this)
```

---

### Phase 4: Update Smart Contract (Day 3-4)

#### 4.1 New Contract Structure

The contract will:
- Remove `onlyRelayer` modifier
- Remove `finalizeTradeFromVara()` function
- Add Mirror contract integration
- Fix claim redemption bug
- Add state verification

**Key Changes:**
```solidity
// OLD:
function deposit(...) external payable {
    emit DepositMade(...);  // Relayer listens
}

// NEW:
function deposit(...) external payable {
    // Direct call to Vara.eth Mirror
    (uint256 tokensOut, uint256 fees) = 
        marketEngine.executeTrade(marketId, msg.sender, isYes, msg.value);
    // State automatically updated
}
```

---

### Phase 5: Deploy & Test (Day 5-7)

#### 5.1 Deploy Settlement Contract

```bash
cd backend/ethereum
npx hardhat run scripts/deploy.ts --network hoodi
```

#### 5.2 Fund Program

```bash
npm run fund-program
# Approves and tops up wVARA for program execution
```

#### 5.3 End-to-End Testing

1. Create market
2. Deposit ETH (buy tokens)
3. Withdraw tokens
4. Resolve market
5. Claim winnings

---

## 🔒 Security Fixes

### 1. Claim Redemption Fix

**Current (BUGGY):**
```solidity
_transferETH(msg.sender, yesTokens); // 1:1 assumption - WRONG!
```

**Fixed:**
```solidity
uint256 totalPool = market.totalBacking;
uint256 totalTokens = market.yesToken.totalSupply() + market.noToken.totalSupply();
uint256 ethValue = (yesTokens * totalPool) / totalTokens;
_transferETH(msg.sender, ethValue);
```

### 2. State Verification

**Before:** State hash stored but not verified  
**After:** State hash automatically verified via Mirror contract

### 3. Relayer Elimination

**Before:** Trusted relayer can manipulate  
**After:** Direct Mirror calls, no relayer needed

---

## 📝 Deployment Scripts

All scripts will be created in the implementation. Key scripts:

1. **`scripts/setup-testnet.sh`** - Complete environment setup
2. **`scripts/get-faucet.sh`** - Automated faucet requests
3. **`scripts/deploy-all.sh`** - Full deployment pipeline
4. **`backend/ethereum/scripts/deploy-vara-eth.ts`** - Vara.eth program deployment
5. **`backend/ethereum/scripts/fund-program.ts`** - Program funding

---

## ✅ Testing Checklist

### Pre-Deployment:
- [ ] Build WASM successfully
- [ ] Upload to Hoodi testnet
- [ ] Create Mirror contract
- [ ] Generate Solidity interface
- [ ] Deploy Settlement contract
- [ ] Fund program with wVARA

### Post-Deployment:
- [ ] Create test market
- [ ] Deposit ETH (buy tokens)
- [ ] Verify token minting
- [ ] Withdraw tokens
- [ ] Verify state hash updates
- [ ] Resolve market
- [ ] Claim winnings
- [ ] Verify fee distribution

---

## 🎯 Next Steps

1. **Review this plan** - Confirm approach
2. **Provide wallet address** - For faucet
3. **Provide private key** - For deployment (securely)
4. **Start implementation** - I'll create all files

---

## 📚 Resources

- **Hoodi Faucet:** https://hoodifaucet.io
- **Vara.eth Docs:** https://eth.vara.network/getting-started
- **Vara.eth Faucet:** https://eth.vara.network/faucet
- **Hoodi Explorer:** https://explorer.hoodi.io

---

**Ready to proceed?** Let me know and I'll create all the implementation files!

