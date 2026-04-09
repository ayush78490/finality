# Round Manager Parallelization

## A. Orchestrator
Single control process responsible for:
- loading feeds
- starting reader workers
- owning tx dispatch queues
- exposing health and metrics

## B. Reader Workers (parallel, read-only)
One worker per market (or small shard), read-only only:
- read round detail/state
- compute desired action (`none`, `settle`, `start`)
- emit intent to orchestrator

Reader workers do **not** sign txs.

## C. Tx Dispatchers (serialized per signer)
Two independent queues:

1. Oracle queue (oracle signer)
- `Oracle.SubmitRound`

2. Admin queue (admin signer)
- `Fin.SettleRound`
- `Fin.ClaimSeed`
- `Vft.Approve`
- `Fin.StartRound`

Each queue is strictly serialized to eliminate nonce races.

## D. Idempotency and dedupe
Action key format:
- `marketProgramId + symbol + roundId + action`

Prevent duplicate settle/start from concurrent readers.

---

## High-Level Flow

1. Reader detects expired `Open` round for symbol X.
2. Reader emits `settle_intent(X, roundId)`.
3. Orchestrator dedupes and enqueues tx plan:
   - oracle queue: submit round price
   - admin queue: settle
   - admin queue: claim seed (best effort)
   - oracle queue: submit round price (fresh)
   - admin queue: approve
   - admin queue: start round
4. Orchestrator confirms visibility (`waitForRoundVisible`).
5. Reader sees fresh `Open` round and emits no-op.

---

## Expected Performance

With 30 markets:
- detection latency: typically 1-2s (depends on reader poll)
- tx pipeline: per signer queue, usually a few seconds per action sequence
- practical end-to-end: low single-digit to tens of seconds depending on chain load

This is still a major improvement over a full sequential scan loop.

---

## Faster Market Creation Plan

Round resolution and market creation should be separated.

## Creation pipeline
1. Validate market input and symbol mapping in parallel.
2. Pre-fetch oracle quote concurrently.
3. Build payloads up front.
4. Submit txs through signer queue in dependency order.
5. Persist state checkpoints for resume/retry.

## Required ordered tx sequence (per market)
- `Oracle.AddAsset`
- `Oracle.SubmitRound`
- `Fin.RegisterAsset`
- `Vft.Approve`
- `Fin.StartRound`

## Optimization ideas
- run many market creation jobs concurrently, but serialize txs per signer
- cache symbol metadata and quote preflight
- apply bounded retries with jitter

---

## Config and Secrets

## Keep in `config/oracle.config.json`
- market ids
- feed metadata (`symbol`, `diaSymbol`, `assetId`, optional `binanceSymbol`)
- non-secret behavior config

## Keep out of config file
- mnemonics/private keys

## Secrets source
- env vars
- CI/CD secret store
- container runtime secrets

---

## Implementation Roadmap

## Phase 1 (safe uplift)
- keep current `round-manager.ts` as fallback
- introduce reader abstraction + dispatcher queues in same process
- enable shorter polling and nearest-expiry prioritization

## Phase 2 (process split)
- add `round-orchestrator.ts`
- add read-only `round-reader-worker.ts`
- move dispatchers to orchestrator only

## Phase 3 (production hardening)
- PM2/K8s supervision
- structured metrics and alerts
- dead-letter queue for repeated failures

---

## Required Reliability Defaults

Keep these protections enabled:
- tx timeout in `send-gear-message.ts`
- HTTP timeouts in `binance.ts` and `dia.ts`
- per-symbol cooldown on repeated start failures
- explicit `ROUND_MANAGER_SEND_TXS=true` guard

Recommended env defaults:
- `ROUND_CHECK_MS=2000` to `3000`
- `GEAR_TX_TIMEOUT_MS=90000`
- `BINANCE_HTTP_TIMEOUT_MS=8000`
- `DIA_HTTP_TIMEOUT_MS=8000`

Tune based on RPC stability and chain congestion.

---

## Observability and SLOs

Track at minimum:
- `round_detect_to_settle_ms`
- `settle_to_start_ms`
- queue depth per signer
- tx success/failure rate by action
- retry count and cooldown hits per symbol

Alert when:
- expired round not settled within SLO window
- queue depth exceeds threshold
- repeated tx timeout/dispatch failures

---

## Rollback Strategy

1. Stop orchestrator/readers.
2. Restart legacy `npm run round-manager`.
3. Replay unresolved intents if needed.
4. Keep feature flag to switch modes quickly.

---

## Proposed File Plan (No New Doc)

Planned code files for this approach:
- `backend/dia-relayer/src/round-manager.ts` (fallback kept)
- `backend/dia-relayer/src/round-orchestrator.ts` (new)
- `backend/dia-relayer/src/round-reader-worker.ts` (new, read-only)
- `backend/dia-relayer/src/tx-dispatcher.ts` (new)
- `backend/dia-relayer/src/config.ts` (optional schema extension, non-secret only)

---

## Decision

Proceed with **hybrid parallel detection + signer-serialized dispatch**.

Do **not** proceed with "one tx-capable worker per market mnemonic" unless contract roles and key management are redesigned first.
