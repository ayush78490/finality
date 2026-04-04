# Finality Market Architecture (Phase 1: AMM)

## Product scope agreed

- Market type: Up/Down binary markets.
- Cadence: fixed 5-minute rounds.
- Creation: admin-only.
- Matching model: AMM (fast path), order book later.
- Settlement source: DIA Data API quotations (off-chain relayer → `PushPrice`).
- Assets first: BTC, ETH, SOL, BNB, AVAX, TON, HYPE.
- Restart behavior: automatic new round creation every 5 minutes.
- History: previous rounds remain queryable for resolution/audit.

References:

- [Vara Developers](https://vara.network/developers)
- [DIA Oracle Playground](https://www.diadata.org/app/oracle-playground/)
- [DIA token price APIs](https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints)
- [Polymarket example](https://polymarket.com/event/btc-updown-5m-1774340700)

## On-chain modules

### 1) `FinToken` (utility collateral token)

- Utility only, no governance power.
- `12` decimals, hard cap `100,000,000 FIN`.
- Mint permissions gated and auditable.

### 2) `MarketFactory`

- Admin-only market activation/deactivation per asset.
- Holds feed mapping: asset -> 32-byte feed id (aligned with relayer + `register_asset`).
- Spawns/rolls new 5-minute rounds.

### 3) `RoundMarket`

- State:
  - `asset`
  - `round_id`
  - `start_ts`, `end_ts`
  - `start_price`, `end_price`
  - pools: `up_pool`, `down_pool`
  - participant shares
  - status: `Open | Locked | Resolved | Cancelled`
- Trading:
  - buy `UP` shares with FIN
  - buy `DOWN` shares with FIN
  - quote via AMM pricing function
- Resolution:
  - `UP` wins when `end_price >= start_price`
  - otherwise `DOWN` wins

### 4) `TreasuryRisk`

- Initial liquidity provisioning per market.
- Fee accounting.
- Emergency pause.
- Guard rails:
  - max position size
  - max slippage
  - minimum pool depth

## 5-minute market lifecycle

1. `T0`: round opens, `start_price` snapshotted from oracle.
2. `T0..T+300s`: users trade UP/DOWN via AMM.
3. `T+300s`: round locks and fetches `end_price`.
4. Resolve with deterministic rule (`end >= start => UP`).
5. Claim window opens for winners.
6. Factory auto-opens next round for same asset.

## Oracle bridge (DIA on Vara)

DIA does not execute inside the Vara runtime. Production setup:

- **DIA Data API** provides quotations (e.g. `/v1/quotation/{SYMBOL}`) — see [docs](https://www.diadata.org/docs/reference/apis/token-prices/api-endpoints).
- **`services/dia-relayer`** polls DIA and sends `Fin.PushPrice` to the market program.
- The program enforces **staleness** and **authorized oracle** and drives **round open / settle / resolve**.

See `spec/oracle-bridge.md` and `config/oracle.config.json`.

## Testnet FIN distribution

Traders need FIN for collateral on testnet:

- Run **`services/testnet-faucet`** (rate-limited HTTP mint), or
- Keep a treasury hot wallet and mint manually via `VftAdmin.Mint`.

Documented in `docs/TESTNET.md`.

## Real-time requirements

- On-chain events for each trade, round state change, and settlement.
- Indexer streams events to frontend graph panels:
  - price-to-beat (`start_price`)
  - current indicative probability
  - pool depths
  - round countdown
  - previous round outcomes

## Initial liquidity and profit controls

- Bootstrap both sides (`UP`, `DOWN`) at round open.
- Dynamic fee:
  - base fee for normal flow
  - surge fee if imbalance exceeds threshold
- Treasury protection:
  - pause if oracle stale
  - pause if pool utilization exceeds safety bound
  - cap user position per round
