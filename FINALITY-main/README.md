# 🌐 Finality: Hybrid Prediction Market Platform

Finality is a next-generation decentralized prediction market that leverages a **hybrid blockchain architecture**. It combines the security and settlement of **Ethereum** with the high-performance computation of the **Vara Network**.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)
![Vara](https://img.shields.io/badge/Vara_Network-000000?style=for-the-badge&logo=rust&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

---

## 🚀 Overview

Finality transforms prediction markets by separating **settlement** from **computation**:
- **Settlement (Ethereum)**: Securely handles user funds (ETH/Tokens), market finality, and payouts.
- **Computation (Vara Network)**: Executes real-time AMM (Automated Market Maker) calculations using the constant product formula ($x \cdot y = k$) for instant price discovery and order processing.
- **Bridge (Relayer)**: A dedicated service that synchronizes events between Ethereum and Vara, ensuring a seamless cross-chain experience.

## ✨ Key Features

- 🗳️ **Permissionless Market Creation**: Create markets with custom questions, categories, and initial liquidity.
- 💹 **Real-time Trading**: Trade YES/NO tokens with instant price updates powered by Vara's high-speed computation.
- 💰 **AMM Liquidity**: Automated pricing using a sophisticated bonding curve.
- 💸 **Dual Fee System**: Integrated 3% fee structure (2% for market creators, 1% for the platform).
- 🦊 **Web3 Native**: Seamless wallet integration using RainbowKit and Wagmi v2.
- 🎨 **Premium UI**: Modern, responsive interface with fluid animations and real-time data feeds.

---

## 🛠️ Technical Architecture

Finality uses a multi-layered stack designed for scalability and security:

### 1. Smart Contracts (`/backend/ethereum`)
- **PredictionMarketSettlement.sol**: The core engine on Ethereum. Handles market lifecycles, deposits, and redemptions.
- **OutcomeToken.sol**: ERC20 tokens representing YES/NO outcomes.

### 2. Computation Engine (`/backend/vara`)
- Rust-based programs running on the Vara Network (Gear Protocol) for high-performance order matching and price calculations.

### 3. Relayer Service (`/backend/relayer`)
- A TypeScript-based backend that listens for Ethereum events and coordinates actions on the Vara Network.

### 4. Frontend Application (`/src`)
- Built with **Next.js 16**, **React 19**, and **Tailwind CSS**.
- **Wagmi & Viem**: For robust blockchain interactions.
- **Framer Motion**: For a premium, interactive user experience.

---

## 💻 Local Quickstart

Follow these steps to get a full development environment running locally.

### 1. Prerequisites
- **Node.js** (v18.x or higher)
- **NPM** or **Yarn**
- **MetaMask** (or any EIP-1193 wallet)

### 2. Clone and Install
```bash
# Clone the repository
git clone https://github.com/ayush78490/finality.git
cd finality

# Install Root dependencies (Frontend)
npm install

# Install Ethereum dependencies
cd backend/ethereum && npm install

# Install Relayer dependencies
cd ../relayer && npm install
```

### 3. Start Local Services

You will need three terminal windows:

**Terminal 1: Local Ethereum Node**
```bash
cd backend/ethereum
npx hardhat node
```

**Terminal 2: Relayer Service**
```bash
cd backend/relayer
npm run build
node dist/relayer/src/index.js
```

**Terminal 3: Frontend Web App**
```bash
# From the root directory
npm run dev
```

### 4. Setup Wallet
1. Open http://localhost:3000.
2. Add a custom network to MetaMask:
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
3. Import one of the private keys provided by the `hardhat node` output to get test ETH.

---

## 🤝 Contributing

We welcome contributions from developers, designers, and blockchain enthusiasts!

1. **Fork** the repository.
2. **Create a Feature Branch** (`git checkout -b feature/AmazingFeature`).
3. **Commit Your Changes** (`git commit -m 'Add some AmazingFeature'`).
4. **Push to the Branch** (`git push origin feature/AmazingFeature`).
5. **Open a Pull Request**.

Please ensure your code follows the existing style and includes proper TypeScript types.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` (if available) for more information.

---

<p align="center">
  Built with ❤️ by the Finality Team
</p>
