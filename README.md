# Vara Network — Finality market

Monorepo for a **Vara / Gear** prediction-style market program, **FIN** token ops, **DIA** oracle relayer, and a **Next.js** UI.

## Layout

- `programs/finality-market` - Rust / Sails on-chain market (FIN collateral, oracle ticks, rounds, claims).
- `contracts/market` - IDL sketch for clients.
- `config/oracle.config.json` - DIA API base URL + feed rows (`diaSymbol`, `feedIdHex`) for the relayer.
- `apps/web` - **Next.js UI** (layout + DIA live feed + wallet stub for on-chain txs).
- `services/dia-relayer` - **production bridge**: [DIA Data API](https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints) → `Fin.PushPrice` on Vara.
- `services/testnet-faucet` - optional FIN faucet for testnet.
- `scripts` - token mint / deploy helpers.

## Oracle + testnet distribution (no native oracle inside Vara)

DIA does not execute inside the Vara runtime. Use **`services/dia-relayer`** to read [DIA quotations](https://api.diadata.org/v1/quotation/) (see [Oracle Playground](https://www.diadata.org/app/oracle-playground/)) and push `Fin.PushPrice` to your deployed market program.

1. Deploy `programs/finality-market` and upload `*.opt.wasm`.
2. Call `Fin.init(...)` with `oracle_authority` = relayer account.
3. `register_asset` using each `feedIdHex` from `config/oracle.config.json` (must match `SHA256("DIA:"+diaSymbol)`).
4. Set `marketProgramId` in `config/oracle.config.json`.
5. Run `dia-relayer` with `DRY_RUN=false` and a funded `RELAYER_MNEMONIC`.

See `docs/TESTNET.md` for faucet + relayer env.

### FIN faucet (`Fin.FaucetClaim`)

The market program must be **initialized** (`Fin.init`) and hold FIN on its actor as treasury. Read-only check:

`npm run faucet:ready` — exit 0 means a simulated claim can succeed.

If it fails, run **`npm run bootstrap:market`** once (set `BOOTSTRAP_MNEMONIC` and `RELAYER_MNEMONIC` in `services/dia-relayer/.env`). The script loads that `.env` even when you run it from the repo root.

## Quick links

- [Vara Network](https://vara.network/)
- [DIA docs](https://www.diadata.org/docs/home)
- [DIA Oracle Playground](https://www.diadata.org/app/oracle-playground/)
