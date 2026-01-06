# Deployment Checklist - Finality Vara.eth

## ✅ Pre-Deployment

- [ ] **Environment Setup**
  - [ ] Node.js 18+ installed
  - [ ] Rust toolchain installed
  - [ ] Foundry installed
  - [ ] ethexe CLI downloaded/built

- [ ] **Wallet Configuration**
  - [ ] Private key in `.env` (already provided)
  - [ ] Address derived (run `npm run get-address`)
  - [ ] Address added to `.env`

- [ ] **Test Tokens**
  - [ ] Test ETH received from Hoodi faucet
  - [ ] Test wVARA received from Vara.eth faucet (after program deployment)

---

## 🚀 Deployment Steps

### Phase 1: Vara Program

- [ ] **Build WASM**
  ```bash
  cd backend/vara
  cargo build --release
  ```
  - [ ] WASM file exists: `target/wasm32-unknown-unknown/release/*.opt.wasm`

- [ ] **Upload WASM**
  ```bash
  ./ethexe upload target/.../prediction_market_vara.opt.wasm
  ```
  - [ ] CODE_ID received
  - [ ] CODE_ID added to `.env` as `MARKET_ENGINE_CODE_ID`

- [ ] **Create Program**
  ```bash
  cd backend/ethereum
  npm run create-program
  ```
  - [ ] Mirror address received
  - [ ] Mirror address added to `.env` as `MARKET_ENGINE_MIRROR_ADDRESS`

- [ ] **Fund Program**
  ```bash
  npm run fund-program
  ```
  - [ ] wVARA approved
  - [ ] Executable balance topped up
  - [ ] Program ready to execute

### Phase 2: Settlement Contract

- [ ] **Deploy Contract**
  ```bash
  npm run deploy
  ```
  - [ ] Contract deployed
  - [ ] Contract address received
  - [ ] Contract address added to `.env` as `SETTLEMENT_CONTRACT_ADDRESS`

### Phase 3: Testing

- [ ] **Run Test Script**
  ```bash
  npm run test-contract
  ```
  - [ ] Contract info retrievable
  - [ ] Market creation works
  - [ ] State hash retrievable
  - [ ] Market info readable

- [ ] **Manual Testing**
  - [ ] Create market via contract
  - [ ] Verify market on explorer
  - [ ] Check state hash updates
  - [ ] Verify token creation

---

## 🔍 Verification

- [ ] **On Hoodi Explorer**
  - [ ] Mirror contract visible: https://explorer.hoodi.io/address/{MIRROR_ADDRESS}
  - [ ] Settlement contract visible: https://explorer.hoodi.io/address/{SETTLEMENT_ADDRESS}
  - [ ] Transactions confirmed

- [ ] **Contract Functions**
  - [ ] `owner()` returns correct address
  - [ ] `marketEngineMirror()` returns Mirror address
  - [ ] `nextMarketId()` returns 0 (or incremented after market creation)
  - [ ] `getStateHash()` returns valid hash

---

## 📝 Environment File Checklist

Your `.env` file should have:

```env
# ✅ Required
DEPLOYER_PRIVATE_KEY=0x...
DEPLOYER_ADDRESS=0x...
HOODI_RPC_URL=https://hoodi-reth-rpc.gear-tech.io
VARA_ETH_ROUTER=0xBC888a8B050B9B76a985d91c815d2c4f2131a58A

# ✅ Set after deployment
MARKET_ENGINE_CODE_ID=0x...
MARKET_ENGINE_MIRROR_ADDRESS=0x...
SETTLEMENT_CONTRACT_ADDRESS=0x...
```

---

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ All contracts deployed on Hoodi
2. ✅ All addresses in `.env`
3. ✅ Program funded with wVARA
4. ✅ Test script runs without errors
5. ✅ Market creation works
6. ✅ State hash retrievable

---

## 🆘 If Something Fails

1. **Check Error Message** - Read carefully
2. **Verify .env** - All addresses correct?
3. **Check Balances** - Have test ETH/wVARA?
4. **Check Network** - Connected to Hoodi?
5. **Review Logs** - Check transaction hashes on explorer

---

## 📚 Quick Reference

**Get Address:**
```bash
npm run get-address
```

**Create Program:**
```bash
npm run create-program
```

**Fund Program:**
```bash
npm run fund-program
```

**Deploy Contract:**
```bash
npm run deploy
```

**Test Contract:**
```bash
npm run test-contract
```

---

**Ready to deploy?** Follow `COMPLETE_TESTING_GUIDE.md` step by step!

