# 🦊 How to Connect Hoodi Testnet to MetaMask

## Quick Setup (Automatic)

### Option 1: Use Chainlist (Easiest)

1. Visit: https://chainlist.org/
2. Search for "Hoodi" or "560048"
3. Click "Connect Wallet"
4. Approve the connection
5. Click "Add to MetaMask"
6. Approve the network addition

---

## Manual Setup

### Step 1: Open MetaMask

1. Click the MetaMask extension icon in your browser
2. Make sure you're logged in

### Step 2: Add Custom Network

1. Click the network dropdown (usually shows "Ethereum Mainnet" or another network)
2. Scroll down and click **"Add network"** or **"Add a network manually"**

### Step 3: Enter Network Details

Fill in the following information:

**Network Name:**
```
Hoodi Testnet
```

**New RPC URL:**
```
https://hoodi-reth-rpc.gear-tech.io
```

**Chain ID:**
```
560048
```

**Currency Symbol:**
```
ETH
```

**Block Explorer URL (Optional):**
```
https://explorer.hoodi.io
```

### Step 4: Save

1. Click **"Save"** or **"Add"**
2. MetaMask will automatically switch to Hoodi Testnet

---

## Verify Connection

After adding the network, you should see:
- Network name: **"Hoodi Testnet"** in the MetaMask dropdown
- Your wallet address (same as on other networks)
- Balance: **0 ETH** (initially)

---

## Get Test ETH

### Option 1: Hoodi Faucet

1. Visit: **https://hoodifaucet.io**
2. Enter your wallet address: `0x25fC28bD6Ff088566B9d194226b958106031d441`
3. Click "Get Test ETH"
4. Wait 1-2 minutes for the transaction to complete
5. Refresh MetaMask to see your balance

### Option 2: Check Balance

```bash
cd backend/ethereum
npm run check-balance
```

---

## Switch Between Networks

1. Click the network dropdown in MetaMask
2. Select **"Hoodi Testnet"** from the list
3. Your wallet will switch to that network

---

## Troubleshooting

### Network Not Appearing

- Make sure you entered all fields correctly
- Try refreshing MetaMask
- Check that Chain ID is exactly: `560048`

### Can't See Test ETH

- Wait a few minutes after requesting from faucet
- Check the transaction on explorer: https://explorer.hoodi.io
- Make sure you're on Hoodi Testnet (not mainnet)

### Transaction Fails

- Ensure you have enough ETH for gas fees
- Check that you're on the correct network
- Verify the contract address is correct

---

## Network Details Summary

| Field | Value |
|-------|-------|
| **Network Name** | Hoodi Testnet |
| **RPC URL** | https://hoodi-reth-rpc.gear-tech.io |
| **WebSocket URL** | wss://hoodi-reth-rpc.gear-tech.io/ws |
| **Chain ID** | 560048 |
| **Currency** | ETH |
| **Block Explorer** | https://explorer.hoodi.io |
| **Faucet** | https://hoodifaucet.io |

---

## Next Steps

After connecting to Hoodi Testnet:

1. ✅ Get test ETH from the faucet
2. ✅ Open the frontend: `npm run dev`
3. ✅ Connect your wallet in the app
4. ✅ Start testing the prediction market!

---

## Quick Reference

**Your Wallet Address:**
```
0x25fC28bD6Ff088566B9d194226b958106031d441
```

**Contract Address:**
```
0x3DCCf4eb75cC46FFE353C696aceCF6ccA8D91902
```

**View on Explorer:**
- Wallet: https://explorer.hoodi.io/address/0x25fC28bD6Ff088566B9d194226b958106031d441
- Contract: https://explorer.hoodi.io/address/0x3DCCf4eb75cC46FFE353C696aceCF6ccA8D91902

