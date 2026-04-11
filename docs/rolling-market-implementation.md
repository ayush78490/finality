# Rolling 5-Minute Market Implementation Guide

_Last reviewed: 2026-04-11 — Updated to reflect actual codebase state_

---

## 1. Objective

Reduce TVARA gas usage by switching from "recreate/start every round" to a rolling market model:

- Register each asset market once.
- Run fixed 5-minute epochs continuously.
- Settle and roll to the next epoch in one transition.
- Reuse the same market treasury across epochs.

This removes repeated round bootstrapping overhead and avoids the current per-round
`Oracle.SubmitRound → Vft.Approve → Fin.StartRound` cycle that burns TVARA on every epoch.

---

## 2. Current Pain Points

The current round lifecycle in `round-orchestrator.ts` performs **5–6 extrinsics per round**:

| Step | Signer | Queue |
|------|--------|-------|
| `Oracle.SubmitRound` (pre-settle) | oracle | oracleQueue |
| `Fin.SettleRound` | admin | adminQueue |
| `Oracle.SubmitRound` (pre-start) | oracle | oracleQueue |
| `Vft.Approve` (seed × 2) | admin | adminQueue |
| `Fin.StartRound` | admin | adminQueue |
| `Fin.ClaimSeed` (best-effort) | admin | adminQueue |

This multiplies TVARA spend by ~5–6× versus a single `SettleAndRoll` call and creates 5–6
independent failure surfaces per epoch.

**Current intent model** (`round-reader-worker.ts`, `ReaderAction`):

```
"none" | "settle" | "start" | "settle_roll"
```

Rolling mode emits `"settle_roll"` for expired rounds and dispatches through `queueSettleRollPlan`.

---

## 3. Target Rolling Design

Per asset, maintain a single perpetual market timeline with epoch snapshots.

### 3.1 Core Behavior

1. Asset is registered once (`Oracle.AddAsset` + `Fin.RegisterAsset`).
2. Market treasury is seeded once (single `Vft.Approve` + `Fin.StartRound`).
3. Every 5 minutes:
   - finalize current epoch,
   - settle outcomes and accounting,
   - open next epoch immediately.

No repeated market recreation. No per-epoch `Approve`.

### 3.2 Epoch Rules

- `round_seconds` = 300 seconds (fixed; **distinct** from `ROUND_CHECK_MS` which is the poll interval, default 2500 ms).
- Epoch boundary based on on-chain timestamp (`endTs` field in round state).
- Next epoch starts immediately after settlement transition via `SettleAndRoll`.
- All user positions are `round_id`-scoped.

---

## 4. Contract Changes (Smart Contracts)

Primary work is in the market contract logic. Backend encoders and runtime plumbing are integrated.

### 4.1 Data Model Additions

For each asset key, track:

- `current_round_id`
- `current_start_ts_ms`
- `current_end_ts_ms`
- `phase` (`Open`, `Locked`, `Resolved`)
- `rolling_treasury` (persistent reserve — **replaces** per-round seed movement)
- `fee_accumulator`
- `round_snapshots[round_id]` (immutable finalized data)

### 4.2 New Contract Entrypoints

Keep current methods for compatibility; add rolling path:

**`Fin.SettleAndRoll(asset_key)`** _(required)_
- Validates round expiry.
- Finalizes payout state.
- Increments `round_id`.
- Creates next epoch with new timestamps.
- Sets phase to `Open` in the same transaction.
- Does **not** require a separate `Approve` call.

**`Fin.SettleAndRollWithTick(asset_key, oracle_tick)`** _(optional optimization)_
- Combines oracle price submission and settle-roll in one call.
- Reduces extrinsics from 2 to 1 per epoch transition.
- Gated by `combinedSettleRoll` config flag (see §7.1).

`sails-scale.ts` now includes:

- `encodeFinSettleAndRoll`
- `encodeFinSettleAndRollWithTick`

The remaining dependency is contract-side deployment/availability of the target entrypoints.

### 4.3 Treasury Model

- Seed once during bootstrap/init.
- Do **not** require per-round `Vft.Approve` + `StartRound` seed movement.
- Keep payout obligations separated by round snapshot accounting.

### 4.4 Backward Compatibility

- Keep `StartRound` / `SettleRound` temporarily.
- Add a mode flag per asset or globally (see §7.1).

---

## 5. Oracle Runtime Changes

Source file: `backend/finality-oracle/src/round-orchestrator.ts`
Intent detection: `backend/finality-oracle/src/round-reader-worker.ts`

### 5.1 Intent Detection

Current (`round-reader-worker.ts` line 7):
```ts
export type ReaderAction = "none" | "settle" | "start";
```

Target (rolling mode):
```ts
export type ReaderAction = "none" | "settle" | "start" | "settle_roll";
```

Logic change:
- In `rolling` mode: if `now >= endTs`, emit `settle_roll` instead of `settle`.
- The `start` action is only needed during initial bootstrap or legacy mode.

### 5.2 Dispatch Pipeline

**Current (legacy)**:
```
oracleQueue: submit_round_pre_settle
adminQueue:  settle_round
oracleQueue: submit_round_pre_start
adminQueue:  approve_seed
adminQueue:  start_round
adminQueue:  claim_seed (best-effort)
```

**Target (rolling mode, 2 extrinsics)**:
```
oracleQueue: submit_round_pre_settle          ← only if not using combined tick+roll
adminQueue:  settle_and_roll
```

**Target (rolling mode, 1 extrinsic, if `combinedSettleRoll: true`)**:
```
adminQueue:  settle_and_roll_with_tick(price)
```

### 5.3 Cooldowns and Retries

Keep cooldowns per the existing pattern in `markStartCooldown`. In rolling mode, simplify
the reason taxonomy to:

| Reason pattern | Cooldown bucket |
|----------------|-----------------|
| `InsufficientBalance` | `insufficientBalanceCooldownMs` (default 900 s) |
| `too early` / `stale oracle` / `not resolved` | `tooEarlyCooldownMs` (default 5 s) |
| `pool_priority` / transient dispatch error | `tooEarlyCooldownMs` (short retry) |
| All other errors | `startRetryCooldownMs` (default 180 s) |

> **Note**: "transient pool priority issue" is not currently a recognized pattern in
> `markStartCooldown`. If this error surface manifests, add a regex match for it.

### 5.4 Queue and Scheduling

- Continue signer-serialized `SerializedTxDispatcher` queues to avoid nonce races.
- In rolling mode, `minStartActionsPerScan` reserve is only used during bootstrap
  (initial seed). Once markets are rolling, `settle_roll` replaces both settle + start slots.
- Keep start-slot reservation logic only for legacy mode.

---

## 6. Frontend Changes

Source file: `frontend/components/MarketGrid.tsx`, `frontend/components/TradePanel.tsx`

### 6.1 Status Semantics

- `"Open"`: actively tradable current epoch.
- `"Settling"`: short transition state if chain has not yet processed `SettleAndRoll`.
- Immediately return to `"Open"` for next epoch after roll — no manual recreate gap.

### 6.2 Countdown

- Always render countdown to current epoch `endTs`.
- Remove assumptions that a new round requires separate start/recreate delay.
- After `endTs`, show "Settling…" briefly; once new epoch is visible, reset timer.

### 6.3 Round History

- Continue to show historical rounds by `round_id` snapshots.
- Claims remain tied to finalized round ids.

---

## 7. Config and Environment

### 7.1 New Config Flags

Configured in both `config/oracle.config.json` and validated by `config.ts`:

```json
{
  "roundMode": "legacy",
  "roundSeconds": 300,
  "combinedSettleRoll": false
}
```

Update **`config.ts`** Zod schema:
```ts
const fileSchema = z.object({
  // ...existing fields...
  roundMode: z.enum(["legacy", "rolling"]).default("legacy"),
  roundSeconds: z.number().int().positive().default(300),
  combinedSettleRoll: z.boolean().default(false),
});
```

These fields are now parsed and used by orchestrator intent detection/dispatch branches.

### 7.2 Oracle Runtime Env

In `backend/finality-oracle/.env.example`:

```
# Rolling mode (set roundMode in oracle.config.json)
# ROUND_CHECK_MS is the orchestrator poll interval (ms), NOT round duration
ROUND_CHECK_MS=2500

# Keep existing controls
START_RETRY_COOLDOWN_MS=180000
START_RETRY_COOLDOWN_TOO_EARLY_MS=5000
START_RETRY_COOLDOWN_INSUFFICIENT_MS=900000
ORCHESTRATOR_ACTIONS_PER_SCAN=12
ORCHESTRATOR_MIN_START_ACTIONS_PER_SCAN=2
```

---

## 8. Implementation Gap Matrix

| Area | Status | What's Missing |
|------|--------|----------------|
| Contract `SettleAndRoll` | ✅ Built | Implemented `settle_and_roll` in `lib.rs` |
| Contract `SettleAndRollWithTick` | ❌ Not built | Optional combined entrypoint |
| `sails-scale.ts` encoders | ✅ Built | Added `encodeFinSettleAndRoll`, `encodeFinSettleAndRollWithTick` |
| `ReaderAction` type | ✅ Built | Added `settle_roll` to `round-reader-worker.ts` |
| `readIntentForFeed` rolling branch | ✅ Built | Emits `settle_roll` when `roundMode === "rolling"` |
| `queueSettleRollPlan` dispatcher | ✅ Built | Added new function in `round-orchestrator.ts` |
| `config.ts` schema | ✅ Built | Added `roundMode`, `roundSeconds`, `combinedSettleRoll` |
| `oracle.config.json` | ✅ Built | Added the three fields |
| Per-round `Vft.Approve` removal | ✅ Built | Eliminated in rolling dispatch pipeline |
| Frontend "Settling" state | ✅ Built | Removed recreate-gap assumptions, added transient state |

---

## 9. Migration Plan

### Phase A: Contract + Encoder Foundation

- [x] 1. Implement `SettleAndRoll` (and optionally `SettleAndRollWithTick`) in the market contract.
- [x] 2. Add `encodeFinSettleAndRoll` / `encodeFinSettleAndRollWithTick` to `sails-scale.ts`.
- [ ] 3. Deploy to testnet with new program id.
- [ ] 4. Bootstrap once (init + register + one-time seed).

### Phase B: Backend Integration

- [x] 1. Add `roundMode` / `combinedSettleRoll` to `config.ts` Zod schema and `oracle.config.json`.
- [x] 2. Add `"settle_roll"` to `ReaderAction` in `round-reader-worker.ts`.
- [x] 3. Add rolling branch to `readIntentForFeed` (emit `settle_roll` when `roundMode === "rolling"` and `now >= endTs`).
- [x] 4. Add `queueSettleRollPlan` to `round-orchestrator.ts`.
- [x] 5. Add frontend handling for continuous epochs.
- [ ] 6. Run 24-hour soak test with `roundMode: "legacy"` as fallback.

### Phase C: Cutover

1. Switch backend and frontend to new program id.
2. Set `roundMode: "rolling"` in config.
3. Monitor fee spend, latency, and settlement success.

### Phase D: Decommission

1. Keep legacy path for rollback window.
2. Remove legacy `queueStartPlan` / `queueSettlePlan` logic after stability period.

---

## 10. Rollback Plan

If any critical issue appears:

1. Set `roundMode: "legacy"` in `oracle.config.json`.
2. Restart orchestrator — legacy `queueSettlePlan` + `queueStartPlan` paths resume automatically.
3. Point frontend to legacy-compatible program id if contract was also swapped.
4. Replay pending settlement operations manually if needed.

---

## 11. Testing Strategy

### 11.1 Contract Tests

- `SettleAndRoll` opens next epoch immediately without separate `StartRound`.
- No treasury leakage across rounds.
- Payout correctness for up/down outcomes.
- Claims for old rounds work after many rollovers.
- One-time seed is never overdrawn across concurrent rounds.

### 11.2 Backend Tests

- In legacy mode: intent detector emits `settle` / `start` (no change).
- In rolling mode: intent detector emits `settle_roll` only when `now >= endTs`.
- No `start_round` enqueues in rolling mode after initial seeding.
- Retries and cooldowns behave correctly around epoch boundaries.
- `inflightActionKeys` deduplication works for `settle_roll` action key.

### 11.3 Frontend Tests

- Countdown resets cleanly at each 5-minute boundary.
- No persistent "ended but not active" state between epochs.
- History and positions remain round-accurate.

### 11.4 Gas Benchmarks

Benchmark TVARA before/after on identical market set:

| Metric | Legacy baseline | Rolling target |
|--------|----------------|----------------|
| Extrinsics per epoch | ~6 | 1–2 |
| TVARA per epoch | TBD (measure) | expect ~70–80% reduction |
| p95 epoch transition latency | TBD | target < 10 s |
| Failed tx rate per epoch | TBD | target < 2% |

> **Note**: Capture legacy baseline **before** migration so the comparison is meaningful.

---

## 12. Acceptance Criteria

Rolling implementation is complete when:

1. Market is registered and seeded **once** per asset (no per-epoch `Approve`).
2. Every 5 minutes, a single `SettleAndRoll` extrinsic transitions to the new epoch.
3. Frontend never remains stuck in ended state after settlement window.
4. TVARA per epoch is materially lower than legacy baseline (target ≥ 70% reduction).
5. No regression in claim correctness or payout accounting.
6. Round history and `round_id`-scoped positions remain accurate after ≥ 100 rollovers.

---

## 13. Suggested Task Breakdown

| # | Task | Owner area | Status |
|---|------|------------|--------|
| 1 | Contract: add rolling treasury state + `SettleAndRoll` | Smart contract | ✅ Done |
| 2 | Contract: add optional `SettleAndRollWithTick` entrypoint | Smart contract | ❌ Skipped for now |
| 3 | `sails-scale.ts`: add SCALE encoders for new entrypoints | Backend | ✅ Done |
| 4 | `config.ts`: extend Zod schema with `roundMode` / `roundSeconds` / `combinedSettleRoll` | Backend | ✅ Done |
| 5 | `round-reader-worker.ts`: add `settle_roll` action + rolling branch | Backend | ✅ Done |
| 6 | `round-orchestrator.ts`: add `queueSettleRollPlan`, gate `queueStartPlan` to legacy mode | Backend | ✅ Done |
| 7 | Frontend: remove recreate-gap assumptions, add "Settling" micro-state | Frontend | ✅ Done |
| 8 | Testnet soak and fee benchmark report (capture legacy baseline first) | QA/Ops | ⏳ Pending |
| 9 | Production cutover and monitoring | Ops | ⏳ Pending |
