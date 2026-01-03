# 🌐 Finality: Hybrid Prediction Market Platform

Finality is a next-generation decentralized prediction market that leverages a **hybrid blockchain architecture**. It combines the security and settlement of **Ethereum** with the high-performance computation of the **Vara Network**.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)
![Vara](https://img.shields.io/badge/Vara_Network-000000?style=for-the-badge&logo=rust&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

---

## 🚀 Live on Testnet

The core settlement contracts are currently deployed and active on the **Ethereum Sepolia Testnet**:
- **Settlement Contract**: `0x52Ca4B7673646B8b922ea00ccef6DD0375B14619`
- **Vara Program ID**: `0x0097e078e6e666d5be98c4839ee4d83c6c3e34a9e508bc84e10bee65ead06ba1`

---

## ✨ Overview

Finality transforms prediction markets by separating **settlement** from **computation**:
- **Settlement (Ethereum)**: Handles user funds (ETH/Tokens), market lifecycles, and secure payouts.
- **Computation (Vara Network)**: Executes real-time AMM (Automated Market Maker) calculations for instant price discovery using the constant product formula ($x \cdot y = k$).
- **Bridge (Relayer)**: Synchronizes cross-chain events between Ethereum and Vara.

---

## 💻 Quickstart (Developer Setup)

Follow these steps to run the frontend and relayer locally, connected to the live Sepolia testnet.

### 1. Prerequisites
- **Node.js** (v18.x+)
- **NPM** or **Yarn**
- **MetaMask** (configured for Sepolia)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/ayush78490/finality.git
cd finality

# Install all dependencies
npm install
cd backend/ethereum && npm install
cd ../relayer && npm install
```

### 3. Running Locally (Connected to Sepolia)

You will need two terminal windows:

**Terminal 1: Relayer Service**
```bash
cd backend/relayer
npm run build
node dist/relayer/src/index.js
```
*Note: Ensure your `.env` in the relayer directory has a Sepolia RPC URL and a valid private key.*

**Terminal 2: Frontend Web App**
```bash
# From the root directory
npm run dev
```
Accessible at [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Optional: Local Blockchain Development

If you wish to modify the smart contracts or run a completely isolated environment:

1. **Start Hardhat Node**:
   ```bash
   cd backend/ethereum
   npx hardhat node
   ```
2. **Deploy Contracts**:
   ```bash
   npx hardhat run scripts/deploy.ts --network localhost
   ```
3. **Update Env**: Update `NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS` to the newly deployed local address.

---

## 🤝 Contributing

We welcome contributions!
1. **Fork** the repo.
2. **Branch** (`feature/your-feature`).
3. **Commit** and **Push**.
4. **Pull Request**.

---

<p align="center">
  Built with ❤️ by the Finality Team
</p>
