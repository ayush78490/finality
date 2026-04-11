# Finality Oracle (Vara)

## Runtime: `round-orchestrator`

`npm run round-orchestrator` is the production loop and uses:

- parallel read-only market intent detection,
- signer-serialized dispatch queues (`oracle`, `admin`),
- deduped action keys to avoid duplicate settle/start attempts.

Supported modes (from `config/oracle.config.json`):

- `roundMode: "legacy"` - settle + approve + start per epoch.
- `roundMode: "rolling"` - settle-and-roll per epoch (no per-round approve/start).

Optional optimization:

- `combinedSettleRoll: true` uses `SettleAndRollWithTick` (single tx path) and requires
	that contract entrypoint to be deployed.

Price source is Binance first, with DIA quote fallback when Binance is unavailable.

Safety guard:

- set `FINALITY_ORACLE_SEND_TXS=true` (preferred), or
- set `ROUND_MANAGER_SEND_TXS=true` (legacy alias still supported).

Without either flag, the process exits without sending chain messages.

```bash
cd backend/finality-oracle
npm install
cp .env.example .env
# set BOOTSTRAP_MNEMONIC, RELAYER_MNEMONIC, MARKET_PROGRAM_ID, FINALITY_ORACLE_SEND_TXS=true
npm run round-orchestrator
```

## Config

Repo root [`config/oracle.config.json`](../../config/oracle.config.json):

- `marketProgramId`
- `feeds[]` with `symbol`, `diaSymbol`, `assetId`, optional `binanceSymbol`
- `roundMode` (`legacy` | `rolling`)
- `roundSeconds` (must match on-chain round duration)
- `combinedSettleRoll` (rolling-mode optional single-tx path)

## Bootstrap (`Fin.init` + `register_asset`)

Run once per new market program id:

```bash
cd backend/finality-oracle
npm install
cp .env.example .env
npm run bootstrap
```

Required `.env` values:

- `BOOTSTRAP_MNEMONIC` admin signer
- `RELAYER_MNEMONIC` oracle signer
- `MARKET_PROGRAM_ID` (or from `config/oracle.config.json`)

If `Fin.init` was already executed, set `SKIP_INIT=1`. If assets are already registered, set `SKIP_REGISTER=1`.

## Fee Estimation

Estimate legacy vs rolling TVARA costs using current config and signer env:

```bash
cd backend/finality-oracle
npm run estimate-fees
```

The script prints per-transaction estimates and cycle totals for:

- legacy lifecycle,
- rolling two-tx lifecycle (`submit_round` + `SettleAndRoll`),
- rolling single-tx lifecycle (`SettleAndRollWithTick`).
