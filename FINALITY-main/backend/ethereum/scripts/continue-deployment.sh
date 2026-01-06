#!/bin/bash
# Continue deployment after getting test ETH

set -e

# Get the script directory and navigate to backend/ethereum directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."
ETHEREUM_DIR="$(pwd)"
# Get project root (two levels up from scripts: scripts -> ethereum -> backend -> root)
cd ../..
PROJECT_ROOT="$(pwd)"
# Go back to backend/ethereum
cd "$ETHEREUM_DIR"

echo "🚀 === Continuing Deployment ==="
echo ""

# Check balance
echo "1️⃣ Checking balance..."
BALANCE=$(npx ts-node scripts/status.ts 2>&1 | grep "Balance:" | awk '{print $2}' | sed 's/ETH//')
BALANCE_NUM=$(echo "$BALANCE" | xargs)

# Compare balance using awk (bc not always available)
# Allow slightly less than 0.01 to account for gas usage
BALANCE_CHECK=$(echo "$BALANCE_NUM" | awk '{if ($1 < 0.009) print "1"; else print "0"}')
if [ "$BALANCE_CHECK" = "1" ]; then
    echo "   ❌ Balance too low: $BALANCE ETH"
    echo "   Get test ETH: https://hoodifaucet.io"
    echo "   Address: 0x25fC28bD6Ff088566B9d194226b958106031d441"
    exit 1
fi

echo "   ✅ Balance: $BALANCE ETH"
echo ""

# Step 2: Upload WASM
# Check if CODE_ID is already set in .env file (non-empty)
EXISTING_CODE_ID=$(grep "^MARKET_ENGINE_CODE_ID=" .env 2>/dev/null | cut -d'=' -f2 | head -1)
if [ ! -f .env ] || [ -z "$EXISTING_CODE_ID" ] || [ "$EXISTING_CODE_ID" = "" ]; then
    echo "2️⃣ Uploading WASM..."
    WASM_PATH="$PROJECT_ROOT/backend/vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm"
    
    if [ ! -f "$WASM_PATH" ]; then
        echo "   ❌ WASM file not found: $WASM_PATH"
        exit 1
    fi
    
    OUTPUT=$(~/Downloads/ethexe --cfg none tx \
        --ethereum-rpc "wss://hoodi-reth-rpc.gear-tech.io/ws" \
        --ethereum-router "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A" \
        --sender "0x25fC28bD6Ff088566B9d194226b958106031d441" \
        upload "$WASM_PATH" -w 2>&1)
    
    CODE_ID=$(echo "$OUTPUT" | grep -i "code id" | grep -oE "0x[a-fA-F0-9]{64}" | head -1)
    
    if [ -z "$CODE_ID" ]; then
        echo "   ❌ Failed to get CODE_ID"
        echo "$OUTPUT"
        exit 1
    fi
    
    echo "   ✅ CODE_ID: $CODE_ID"
    echo "MARKET_ENGINE_CODE_ID=$CODE_ID" >> .env
    echo ""
else
    CODE_ID=$(grep "MARKET_ENGINE_CODE_ID=" .env | cut -d'=' -f2)
    echo "2️⃣ CODE_ID already set: $CODE_ID"
    echo ""
fi

# Step 3: Create program
EXISTING_MIRROR=$(grep "^MARKET_ENGINE_MIRROR_ADDRESS=" .env 2>/dev/null | cut -d'=' -f2 | head -1)
if [ ! -f .env ] || [ -z "$EXISTING_MIRROR" ] || [ "$EXISTING_MIRROR" = "" ]; then
    echo "3️⃣ Creating Vara.eth program..."
    npm run create-program
    echo ""
else
    echo "3️⃣ Mirror already created"
    echo ""
fi

# Step 4: Fund program (optional - can be done later)
echo "4️⃣ Funding program..."
echo "   ⚠️  Make sure you have wVARA!"
echo "   Get from: https://eth.vara.network/faucet"
echo "   Attempting to fund (this may fail if you don't have wVARA yet)..."
echo ""
if npm run fund-program 2>&1; then
    echo "   ✅ Program funded successfully"
else
    echo "   ⚠️  Funding failed or skipped (you can fund later with: npm run fund-program)"
fi
echo ""

# Step 5: Deploy contract
EXISTING_CONTRACT=$(grep "^SETTLEMENT_CONTRACT_ADDRESS=" .env 2>/dev/null | cut -d'=' -f2 | head -1)
if [ ! -f .env ] || [ -z "$EXISTING_CONTRACT" ] || [ "$EXISTING_CONTRACT" = "" ]; then
    echo "5️⃣ Deploying contract..."
    npm run deploy
    echo ""
else
    echo "5️⃣ Contract already deployed"
    echo ""
fi

echo "✅ === Deployment Complete ==="
echo ""
echo "📊 Final status:"
npm run status

