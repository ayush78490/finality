# Finality - Hybrid Ethereum-Vara Prediction Market

A next-generation prediction market platform leveraging Ethereum for settlement and Vara Network for high-performance computation.

## 🎯 Overview

Finality is a decentralized prediction market that splits responsibilities between two blockchain layers:

- **Ethereum (Sepolia)**: Handles settlement, token custody, and final state
- **Vara Network**: Executes AMM calculations, order matching, and trading bot logic

This hybrid architecture provides:
- ✅ **Security**: Ethereum's battle-tested settlement layer
- ✅ **Performance**: Vara's high-speed computation
- ✅ **Scalability**: Off-chain computation with on-chain verification
- ✅ **Cost Efficiency**: Expensive calculations done on Vara, only results settled on Ethereum

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ETHEREUM SETTLEMENT LAYER                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PredictionMarketSettlement.sol                          │  │
│  │  • Market creation & metadata                            │  │
│  │  • User deposits (ETH → tokens)                          │  │
│  │  • Token minting authority                               │  │
│  │  • Final settlement verification                         │  │
│  │  • Fee collection (2% creator + 1% platform)             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RELAYER SERVICE                          │
│  • Listens to Ethereum events                                  │
│  • Forwards to Vara for computation                            │
│  • Receives Vara results                                       │
│  • Submits back to Ethereum                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VARA COMPUTATION LAYER                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MarketEngine (Rust/WASM)                                │  │
│  │  • Pool state mirror (yesPool, noPool)                   │  │
│  │  • AMM swap calculations                                 │  │
│  │  • Order book management                                 │  │
│  │  • Stop-loss/take-profit triggers                        │  │
│  │  • Odds & multiplier calculations                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TradingBot (Rust/WASM)                                  │  │
│  │  • Automated trading strategies                          │  │
│  │  • Batch order monitoring                                │  │
│  │  • Market condition analysis                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 How It Works

### 1. Market Creation

```
User → Ethereum: createMarket(question, endTime, initialYes, initialNo)
Ethereum → Relayer: MarketCreated event
Relayer → Vara: InitializeMarket message
Vara: Initializes pool state (yesPool, noPool)
```

### 2. Trading Flow (Buy YES/NO Tokens)

```
User → Ethereum: deposit(marketId, isYes) + ETH
Ethereum: Emits DepositMade event
Relayer: Catches event → forwards to Vara
Vara: Executes AMM calculation
  - Calculates fees (3%: 2% creator + 1% platform)
  - Computes swap output using x*y=k formula
  - Returns: tokensOut, fees, newPoolState, stateHash
Relayer: Submits result to Ethereum
Ethereum: finalizeTradeFromVara()
  - Verifies relayer signature
  - Mints tokens to user
  - Transfers creator fee
  - Accumulates platform fee
```

### 3. Advanced Trading (Stop-Loss/Take-Profit)

```
User → Ethereum: Creates order with trigger price
Ethereum → Vara: CreateOrder message
Vara: Stores order in order book
Vara: Continuously monitors prices
When triggered:
  Vara → Relayer: OrderTriggered event
  Relayer → Ethereum: Execute swap
  Ethereum: Mints swapped tokens to user
```

### 4. Market Resolution

```
After endTime:
User → Ethereum: requestResolution()
Ethereum → Relayer: ResolutionRequested event
Relayer → Vara: Calculate final outcome
Vara: Returns outcome + confidence score
Relayer → Ethereum: resolveMarket(outcome)
Ethereum: Sets market as Resolved
Winners: claimRedemption() to get ETH back
```

---

## 📁 Project Structure

```
backend/
├── ethereum/                    # Sepolia settlement contracts
│   ├── contracts/
│   │   ├── PredictionMarketSettlement.sol
│   │   └── OutcomeToken.sol
│   ├── scripts/
│   │   └── deploy.ts
│   ├── hardhat.config.ts
│   └── package.json
│
├── vara/                        # Vara computation programs
│   ├── src/
│   │   ├── lib.rs              # Program entry point
│   │   ├── market_engine.rs    # AMM & order logic
│   │   ├── trading_bot.rs      # Automated trading
│   │   └── types.rs            # Message definitions
│   ├── Cargo.toml
│   └── build.rs
│
├── relayer/                     # Bridge service
│   ├── src/
│   │   ├── index.ts            # Main orchestrator
│   │   ├── ethereum-listener.ts
│   │   └── vara-client.ts
│   ├── package.json
│   └── tsconfig.json
│
└── shared/
    └── schemas/
        └── events.ts           # Shared TypeScript types
```

---

## 🚀 Deployment

### Prerequisites

- Node.js 18+
- Rust nightly toolchain
- Sepolia ETH for deployment
- Vara testnet account (for production)

### Step 1: Deploy Ethereum Contracts

```bash
cd backend/ethereum
npm install

# Configure .env
echo "SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com" > .env
echo "DEPLOYER_PRIVATE_KEY=0x..." >> .env
echo "RELAYER_ADDRESS=0x..." >> .env

# Deploy
npm run deploy
```

**Output:** Settlement contract address

### Step 2: Deploy Vara Program (Production)

**Option A: Gear IDE (Recommended)**
1. Visit https://idea.gear-tech.io/
2. Create new program
3. Upload `vara/src/*.rs` files
4. Build in cloud
5. Deploy to testnet
6. Copy Program ID

**Option B: Mock Mode (Testing)**
- Skip Vara deployment
- Use mock calculations in relayer
- Perfect for testing Ethereum layer

### Step 3: Configure Relayer

```bash
cd backend/relayer
npm install

# Create .env
cat > .env << EOF
# Ethereum
ETHEREUM_RPC_URL=https://ethereum-sepolia.publicnode.com
SETTLEMENT_CONTRACT_ADDRESS=0x...  # From step 1
RELAYER_PRIVATE_KEY=0x...

# Vara
VARA_NODE_URL=wss://testnet.vara.network
VARA_PROGRAM_ID=0x...              # From step 2
VARA_USE_MOCK=false                # true for testing

# Optional
LOG_LEVEL=info
EOF
```

### Step 4: Start Relayer

```bash
npm run build
npm start
```

---

## 🎮 Usage

### Create a Market

```solidity
predictionMarket.createMarket{value: 0.02 ether}(
    "Will Bitcoin reach $100k by end of 2025?",
    "Crypto",
    1735689600,  // endTime (Unix timestamp)
    0.01 ether,  // initialYes
    0.01 ether   // initialNo
);
```

### Buy YES Tokens

```solidity
predictionMarket.deposit{value: 1 ether}(
    marketId,
    true  // isYes
);
```

### Create Stop-Loss Order

```solidity
// First approve tokens
yesToken.approve(address(predictionMarket), tokenAmount);

// Create order (trigger at 30% price)
predictionMarket.createStopLossOrder(
    marketId,
    true,        // isYes
    tokenAmount,
    3000         // trigger at 30% (out of 10000)
);
```

### Claim Winnings

```solidity
// After market resolves
predictionMarket.claimRedemption(marketId);
```

---

## 💰 Fee Structure

- **3% total fee** on all trades
  - **2%** to market creator (immediate transfer)
  - **1%** to platform (accumulated for withdrawal)
- Fees calculated on Vara, collected on Ethereum
- Creator fees sent directly on settlement
- Platform fees withdrawable by owner

---

## 🔐 Security Model

### Trust Assumptions

1. **Ethereum Settlement**: Trustless, secured by Ethereum consensus
2. **Relayer**: Trusted intermediary (can be decentralized with multi-sig)
3. **Vara Computation**: Deterministic, verifiable via state hashes

### Verification

- Relayer must be authorized on Ethereum contract
- All Vara results include state hash for verification
- Only authorized relayer can call `finalizeTradeFromVara()`
- State hashes ensure computation integrity

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|-----------|
| Malicious relayer | Only authorized address can submit results |
| Front-running | Orders executed at trigger price, not market price |
| State manipulation | State hashes verified on-chain |
| Relayer downtime | Users can still interact with Ethereum directly |

---

## 🧪 Testing

### Mock Mode (No Vara Required)

```bash
# In relayer/.env
VARA_USE_MOCK=true

# Start relayer
npm start
```

Relayer will:
- Listen to Ethereum events
- Calculate trades locally (simple AMM mock)
- Submit results back to Ethereum
- Perfect for testing settlement layer

### Integration Testing

1. Deploy to Sepolia + Vara testnet
2. Create test market
3. Execute test trades
4. Verify token balances
5. Test order execution
6. Verify market resolution

---

## 📊 Current Deployment

**Network:** Sepolia Testnet  
**Settlement Contract:** `0xe0c0FE9614ca3391D74B29d56E741ffa3AA5d549`  
**Relayer:** `0xd84fdA5439152A51fBc11C2a5838F3aFF57ce02e`  
**Vara Program:** TBD (use mock mode for now)

**View on Etherscan:**  
https://sepolia.etherscan.io/address/0xe0c0FE9614ca3391D74B29d56E741ffa3AA5d549

---

## 🛠️ Development

### Run Relayer Locally

```bash
cd backend/relayer
npm run dev
```

### Test Ethereum Contracts

```bash
cd backend/ethereum
npx hardhat test
```

### Build Vara Program

```bash
cd backend/vara
cargo build --release --target wasm32-unknown-unknown
```

Note: Vara programs require Gear IDE or Docker for proper compilation.

---

## 🔮 Future Enhancements

- [ ] Multi-sig relayer for decentralization
- [ ] Liquidity provider rewards
- [ ] Advanced order types (limit orders, trailing stops)
- [ ] Cross-chain settlement (Polygon, Arbitrum)
- [ ] Governance token for platform decisions
- [ ] Oracle integration for automated resolution
- [ ] Mobile app for trading on the go

---

## 📚 Resources

- **Vara Documentation**: https://wiki.vara.network/
- **Gear Protocol**: https://www.gear-tech.io/
- **Ethers.js**: https://docs.ethers.org/
- **Hardhat**: https://hardhat.org/

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🆘 Support

- **Discord**: Join Vara Discord for technical support
- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check this README and inline code comments

---

**Built with ❤️ using Ethereum, Vara Network, and TypeScript**
