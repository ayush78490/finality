# Testnet operations (FIN + markets)

## 1) Native gas token (TVARA)

Anyone interacting with programs needs **TVARA** on Vara testnet for gas.

In Gear IDEA: **Balance → Get Test Balance** (see [Quick token launch](https://wiki.vara.network/docs/vara-network/examples/Standards/vft/launch-vft)).

## 2) FIN utility token (collateral / fees)

Your FIN program ID is recorded in `config/deployed.token.json` (update if you redeploy).

Ways traders get FIN on testnet:

### A) Faucet server (recommended for many users)

1. Create a dedicated wallet that has **`VftAdmin.Mint`** on your FIN program (creator/admin usually has this).

2. Configure env:

```env
VARA_WS_ENDPOINT=wss://testnet.vara.network
FAUCET_MINTER_MNEMONIC=<admin mnemonic with mint rights>
FIN_TOKEN_PROGRAM_ID=0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a
FAUCET_PORT=8787
FAUCET_AMOUNT_BASE_UNITS=1000000000000
```

`FAUCET_AMOUNT_BASE_UNITS` uses **12** FIN decimals (default above ≈ **1000 FIN** per claim if you keep `1_000 * 10^12`).

3. Run:

```bash
cd services/testnet-faucet
npm install
npm start
```

4. Traders POST:

```http
POST http://localhost:8787/claim
Content-Type: application/json

{"address":"<their SS58 Vara address>"}
```

Rate limits are controlled by `FAUCET_WINDOW_MS` and `FAUCET_MAX_PER_WINDOW`.

**Security:** use a **low TVARA + dedicated mint key**, not your main treasury.

### B) Manual mint (IDEA)

`Send Message` → `VftAdmin` → `Mint` → `to` = recipient **actor id hex** (`0x` + 32 bytes), `value` = amount in base units.

## 3) Oracle relayer (DIA → market program)

1. Deploy the on-chain market program implementing `contracts/market/sails.idl`.
2. **Initialize + register feeds** (pick one):
   - **Script (recommended):** from `services/dia-relayer`, set `BOOTSTRAP_MNEMONIC`, `RELAYER_MNEMONIC`, `MARKET_PROGRAM_ID`, then `npm run bootstrap` (runs `Fin.init` and `register_asset` for each feed in `config/oracle.config.json`). See `services/dia-relayer/README.md`.
   - **Manual:** Call `Fin.init` with `oracle_authority` = the relayer wallet’s `ActorId`, then `register_asset` per feed with `feed_id` = **SHA256("DIA:"+diaSymbol)** (64 hex chars, see `config/oracle.config.json`).
3. Ensure `marketProgramId` in `config/oracle.config.json` matches the deployed program.
4. Run relayer:

```env
VARA_WS_ENDPOINT=wss://testnet.vara.network
RELAYER_MNEMONIC=<funded relayer, not treasury>
MARKET_PROGRAM_ID=0x...
DRY_RUN=false
```

```bash
cd services/dia-relayer
npm install
npm start
```

With empty `marketProgramId` and default `DRY_RUN`, the relayer only **logs** DIA ticks (safe for testing wiring).

References: [Vara Developers](https://vara.network/developers), [DIA API](https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints), [Oracle Playground](https://www.diadata.org/app/oracle-playground/).

## 4) `Fin.FaucetClaim` (Finality web app or Gear IDEA)

This is **not** the same as the HTTP minter in §2A. It calls the **market** program’s `Fin.FaucetClaim` handle; the market then asks the FIN token program to `Transfer` FIN **from the market’s treasury** to `msg::source()`.

### Why it fails (red message in Gear IDEA) while `Vft.Transfer` works

| Symptom | Cause |
|--------|--------|
| `not initialized` | `Fin.init` was never called on **this** program id. Run `npm run bootstrap` in `services/dia-relayer` (or call `Fin.init` manually). |
| `faucet transfer failed — treasury may be empty` | The **market program** has **no FIN** on the FIN VFT contract. Fund it: send FIN **to the market program’s ActorId** on the FIN token (same pattern as funding any program’s token balance). |
| Wrong / unknown program | **Program id must match exactly** the deployed market. Copy `marketProgramId` from `config/oracle.config.json`. Typos (e.g. `0xd3d154f73…` vs `0xd3d1541f73…`) send the message to the wrong address → execution fails. |
| Gear IDEA shows `Payload: {}` for `FaucetClaim` | No JSON args is normal; the runtime still uses Sails SCALE (`Fin` + `FaucetClaim`). If IDEA builds the wrong bytes, use the **Finality** app or scripts that encode like `apps/web/lib/sails-payload.ts`. |

### Why the wallet “doesn’t show” FIN

- SubWallet / most extensions show **native TVARA** (gas) in the main balance.
- **FIN** is a **custom VFT** — balance is on the FIN program. Use the **Finality** header, or query `Vft.BalanceOf` for your address on `config/deployed.token.json` → `finTokenProgramId`.

## 5) Full trade lifecycle (target state)

1. Relayer pushes `PushPrice` for each registered `feed_id`.
2. Admin opens `start_round` with FIN seed + fee bps.
3. Traders `approve` market + `buy_side`.
4. Anyone `settle_round` after window; winners `claim`.
