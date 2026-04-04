# Oracle + round automation (Vara)

## Recommended: `round-manager` (Binance, push only when needed)

[`npm run round-manager`](./src/round-manager.ts) polls the chain on `ROUND_CHECK_MS` (default 15s). It **does not** poll DIA or push prices on a short interval.

- **Price source**: [Binance](https://binance-docs.github.io/apidocs/spot/en/#symbol-price-ticker) `GET /api/v3/ticker/price` (no API key).
- **On-chain**: `Fin.PushPrice` is sent **only** when (1) settling an expired round (after gas sim says settle is possible), or (2) starting a new round — so end/start prices come from Binance at those moments.
- **Signers**: `BOOTSTRAP_MNEMONIC` (admin: settle, start, approve) and `RELAYER_MNEMONIC` (oracle authority for `push_price`, must match `Fin.init`).
- **Safety**: **`ROUND_MANAGER_SEND_TXS=true`** is required or the process exits immediately with **no** extrinsics. Prevents accidental gas spend when you only wanted the UI or other services.

```bash
cd services/dia-relayer
npm install
cp .env.example .env
# set BOOTSTRAP_MNEMONIC, RELAYER_MNEMONIC, MARKET_PROGRAM_ID, ROUND_MANAGER_SEND_TXS=true
npm run round-manager
```

## Config

Repo root [`config/oracle.config.json`](../../config/oracle.config.json): `marketProgramId`, `feeds[]` with `symbol`, `diaSymbol` (for `feedIdHex` / registration), `feedIdHex`, and optional `binanceSymbol` (defaults to `{diaSymbol}USDT`).

## Legacy: `npm start` (DIA continuous push)

`npm start` **exits immediately** unless `ORACLE_ENABLE_PUSH=true`. When enabled, it runs the old loop: DIA REST + `push_price` every `pollIntervalMs`.

## Bootstrap (`Fin.init` + `register_asset`)

Run **once** per new program id (requires TVARA on the admin account):

```bash
cd services/dia-relayer
npm install
cp .env.example .env
```

Set in `.env`:

- `BOOTSTRAP_MNEMONIC` — admin (must sign `register_asset`).
- `RELAYER_MNEMONIC` — oracle wallet; its `ActorId` is `oracle_authority` in `Fin.init` and must sign `PushPrice`.
- `MARKET_PROGRAM_ID` — deployed market program id (or use `oracle.config.json` → `marketProgramId`).

Then:

```bash
npm run bootstrap
```

If you already called `Fin.init` in Gear IDEA, set `SKIP_INIT=1`. If assets are registered, set `SKIP_REGISTER=1`.
