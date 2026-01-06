# WASM Upload Instructions

## Manual Upload Required

The `ethexe` CLI needs to be downloaded manually. Here's how:

### Option 1: Download Pre-built (Recommended)

1. Visit: https://get.gear.rs
2. Download `ethexe` for Linux
3. Make executable: `chmod +x ethexe`
4. Move to project: `mv ethexe /home/yuvraj/Downloads/Projects/Finalitymain/finality/FINALITY-main/tools/`

### Option 2: Build from Source

```bash
git clone https://github.com/gear-tech/gear.git
cd gear
cargo build -p ethexe-cli -r
# Binary at: target/release/ethexe
```

### Upload Command

Once you have ethexe:

```bash
# Insert key
./ethexe key insert 0xd8c3d48dc76e3df5c2a90e4fcb8e774a450fae6b66c7c8a6a331ede54523f092

# Upload WASM
./ethexe --cfg none tx \
  --ethereum-rpc "wss://hoodi-reth-rpc.gear-tech.io/ws" \
  --ethereum-router "0xBC888a8B050B9B76a985d91c815d2c4f2131a58A" \
  --sender "0x25fC28bD6Ff088566B9d194226b958106031d441" \
  upload /home/yuvraj/Downloads/Projects/Finalitymain/finality/FINALITY-main/backend/vara/target/wasm32-gear/release/prediction_market_vara.opt.wasm -w
```

**Save the CODE_ID from output!**

