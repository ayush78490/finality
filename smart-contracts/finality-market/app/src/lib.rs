#![no_std]

extern crate alloc;

mod oracle;
mod vft;

pub use oracle::{AssetInfo, FeedState, Oracle, RoundData};

use alloc::collections::{BTreeMap, BTreeSet};
use spin::Mutex;
use alloc::string::String;
use alloc::vec::Vec;
use gstd::exec;
use gstd::msg;
use parity_scale_codec::{Decode, Encode};
use sails_rs::prelude::*;
use scale_info::TypeInfo;

/// Canonical FIN (extended VFT) on Vara testnet for this project — only this token is accepted.
pub const FIN_TOKEN_PROGRAM: ActorId = ActorId::new([
    0x5e, 0x5e, 0x61, 0x63, 0xbc, 0x51, 0x2f, 0x3f, 0x55, 0x2f, 0xad, 0x13, 0x82, 0x51, 0x76, 0x95,
    0xe2, 0x41, 0x3c, 0x2a, 0x95, 0x83, 0xd8, 0x5c, 0xf7, 0x19, 0xdc, 0xd3, 0x80, 0x7c, 0x10, 0x3a,
]);

const VFT_REPLY_DEPOSIT: u64 = 10_000_000_000;

#[derive(Clone, Default, Encode, Decode, TypeInfo)]
pub struct OracleTick {
    pub price: u128,
    pub conf: u128,
    pub expo: i32,
    pub publish_time: u64,
}

#[derive(Clone, Default, Encode, Decode, TypeInfo)]
pub struct AssetConfig {
    pub key: String,
    /// Embedded oracle feed id (`Oracle.add_asset`).
    pub asset_id: u32,
}

#[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo)]
pub enum RoundPhase {
    Open,
    Locked,
    Resolved,
}

impl Default for RoundPhase {
    fn default() -> Self {
        RoundPhase::Open
    }
}

#[derive(Clone, Default, Encode, Decode, TypeInfo)]
pub struct Round {
    pub id: u64,
    pub start_ts: u64,
    pub end_ts: u64,
    pub start_price: u128,
    pub start_expo: i32,
    pub end_price: Option<u128>,
    pub end_expo: Option<i32>,
    pub outcome_up: Option<bool>,
    pub phase: RoundPhase,
    pub reserve_up: u128,
    pub reserve_down: u128,
    pub fee_bps: u16,
    pub total_shares_up: u128,
    pub total_shares_down: u128,
    pub fee_acc: u128,
    /// Initial per-side seed the admin deposited via `start_round`.
    /// In rolling mode, seed stays in the contract and rolls forward each epoch.
    pub seed_per_side: u128,
    /// Track trader FIN deposited (excludes admin seed) for payout calculation.
    pub trader_fin_deposited: u128,
    /// Remaining FIN in the user-only payout pool for winners (snapshot at settlement).
    pub payout_fin_remaining: u128,
    pub winning_shares_remaining: u128,
    /// True when this round was created by `settle_and_roll` (seed stays in contract).
    /// False when created by legacy `start_round` (seed returned via `claim_seed`).
    pub is_rolling: bool,
}

#[derive(Clone, Default, Encode, Decode, TypeInfo)]
pub struct UserPosition {
    pub shares_up: u128,
    pub shares_down: u128,
}

/// 100 FIN in base units (12 decimals).
const FAUCET_DEFAULT_AMOUNT: u128 = 100_000_000_000_000;
/// 24 hours in milliseconds.
const FAUCET_DEFAULT_COOLDOWN_MS: u64 = 86_400_000;

#[derive(Clone, Default, Encode, Decode, TypeInfo)]
pub struct FaucetInfo {
    pub amount: u128,
    pub cooldown_ms: u64,
    pub last_claim_ms: u64,
    pub can_claim: bool,
    pub next_claim_ms: u64,
}

#[derive(Default, Encode, Decode, TypeInfo)]
pub struct State {
    pub admin: ActorId,
    pub paused: bool,
    pub initialized: bool,
    pub oracle_authority: ActorId,
    pub max_oracle_age_secs: u64,
    pub oracle_next_asset_id: u32,
    pub oracle_asset_id_by_symbol: BTreeMap<String, u32>,
    pub oracle_assets: BTreeMap<u32, AssetInfo>,
    pub oracle_feeds: BTreeMap<u32, FeedState>,
    pub assets: BTreeMap<String, AssetConfig>,
    /// Active round per asset (rolling or legacy).
    pub rounds: BTreeMap<String, Round>,
    /// Historical settled rounds per asset (rolling mode only).
    /// Keyed by asset_key; each Vec entry is an immutable finalized epoch.
    pub round_snapshots: BTreeMap<String, Vec<Round>>,
    pub next_round_id: u64,
    pub round_seconds: u64,
    pub positions: BTreeMap<(String, u64, ActorId), UserPosition>,
    pub claimed: BTreeSet<(String, u64, ActorId)>,
    pub faucet_amount: u128,
    pub faucet_cooldown_ms: u64,
    pub faucet_claims: BTreeMap<ActorId, u64>,
}

static STATE: Mutex<State> = Mutex::new(State {
    admin: ActorId::zero(),
    paused: false,
    initialized: false,
    oracle_authority: ActorId::zero(),
    max_oracle_age_secs: 0,
    oracle_next_asset_id: 0,
    oracle_asset_id_by_symbol: BTreeMap::new(),
    oracle_assets: BTreeMap::new(),
    oracle_feeds: BTreeMap::new(),
    assets: BTreeMap::new(),
    rounds: BTreeMap::new(),
    round_snapshots: BTreeMap::new(),
    next_round_id: 0,
    round_seconds: 300,
    positions: BTreeMap::new(),
    claimed: BTreeSet::new(),
    faucet_amount: 0,
    faucet_cooldown_ms: 0,
    faucet_claims: BTreeMap::new(),
});

#[inline]
fn with_state<R>(f: impl FnOnce(&State) -> R) -> R {
    let g = STATE.lock();
    f(&*g)
}

#[inline]
fn with_state_mut<R>(f: impl FnOnce(&mut State) -> R) -> R {
    let mut g = STATE.lock();
    f(&mut *g)
}

fn ensure_admin(st: &State) {
    if msg::source() != st.admin {
        panic!("not admin");
    }
}

fn ensure_not_paused(st: &State) {
    if st.paused {
        panic!("paused");
    }
}

fn ensure_initialized(st: &State) {
    if !st.initialized {
        panic!("not initialized");
    }
}

fn now_ms() -> u64 {
    exec::block_timestamp()
}

fn now_sec() -> u64 {
    now_ms() / 1000
}

fn program_id() -> ActorId {
    exec::program_id()
}

/// `U256` → `u128` when the value fits (AMM reserves are `u128`).
fn u256_to_u128(x: U256) -> Result<u128, String> {
    if x > U256::from(u128::MAX) {
        return Err(String::from("overflow"));
    }
    Ok(x.low_u128())
}

/// Constant-product AMM: add `fin_eff` to reserve `a`; counter-reserve `b` becomes `new_b = floor(k / new_a)` where `k = a * b`.
/// Mints `shares_out = b - new_b` to the buyer. Uses `U256` for `k` so `a * b` never overflows `u128`.
fn cpamm_shares_out(a: u128, b: u128, fin_eff: u128) -> Result<(u128, u128), String> {
    let new_a = a.checked_add(fin_eff).ok_or_else(|| String::from("overflow"))?;
    if new_a == 0 {
        return Err(String::from("overflow"));
    }
    let k = U256::from(a) * U256::from(b);
    let new_b = u256_to_u128(k / U256::from(new_a))?;
    let shares_out = b.checked_sub(new_b).ok_or_else(|| String::from("amm underflow"))?;
    if shares_out == 0 {
        return Err(String::from("zero shares"));
    }
    Ok((new_b, shares_out))
}

fn oracle_tick_for_asset(st: &State, asset_id: u32) -> Result<OracleTick, String> {
    let feed = st
        .oracle_feeds
        .get(&asset_id)
        .ok_or_else(|| String::from("unknown oracle feed"))?;
    let last = feed
        .rounds
        .last()
        .ok_or_else(|| String::from("no oracle rounds"))?;
    if last.answer < 0 {
        return Err(String::from("negative price"));
    }
    Ok(OracleTick {
        price: last.answer as u128,
        conf: 0,
        expo: -(feed.decimals as i32),
        publish_time: last.updated_at,
    })
}

#[derive(Default)]
pub struct Finality(());

impl Finality {
    pub fn create() -> Self {
        Self(())
    }
}

#[sails_rs::service]
impl Finality {
    /// One-time setup. `FIN_TOKEN_PROGRAM` is fixed — all collateral is this VFT only.
    #[export]
    pub fn init(
        &mut self,
        admin: ActorId,
        round_seconds: u64,
        oracle_authority: ActorId,
        max_oracle_age_secs: u64,
    ) {
        with_state_mut(|st| {
            if st.initialized {
                panic!("already initialized");
            }
            st.admin = admin;
            st.oracle_authority = oracle_authority;
            st.max_oracle_age_secs = max_oracle_age_secs;
            st.round_seconds = if round_seconds == 0 {
                300
            } else {
                round_seconds
            };
            st.initialized = true;
        });
    }

    #[export]
    pub fn set_paused(&mut self, paused: bool) {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            st.paused = paused;
        });
    }

    #[export]
    pub fn register_asset(&mut self, asset_key: String, asset_id: u32) {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            ensure_not_paused(st);
            if !st.oracle_assets.contains_key(&asset_id) {
                panic!("unknown oracle asset");
            }
            st.assets.insert(
                asset_key.clone(),
                AssetConfig {
                    key: asset_key,
                    asset_id,
                },
            );
        });
    }

    /// Admin seeds both sides; pulls `2 * liquidity_seed` FIN from admin via `transfer_from`.
    #[export]
    pub async fn start_round(
        &mut self,
        asset_key: String,
        liquidity_seed: u128,
        fee_bps: u16,
    ) -> Result<(), String> {
        with_state(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            ensure_not_paused(st);
        });
        if liquidity_seed == 0 {
            return Err(String::from("bad seed"));
        }
        let admin = msg::source();
        let market = program_id();
        let total = liquidity_seed
            .checked_mul(2)
            .ok_or_else(|| String::from("overflow"))?;

        let payload = vft::transfer_from_payload(
            admin,
            market,
            U256::from(total),
        );
        let reply = msg::send_bytes_for_reply(FIN_TOKEN_PROGRAM, payload, 0, VFT_REPLY_DEPOSIT)
            .map_err(|_| String::from("vft send"))?
            .await
            .map_err(|_| String::from("vft reply"))?;
        let ok = vft::decode_bool_reply(&reply, "TransferFrom").map_err(String::from)?;
        if !ok {
            return Err(String::from("transfer_from failed"));
        }

        with_state_mut(|st| {
            let cfg = st.assets.get(&asset_key).ok_or_else(|| String::from("unknown asset"))?;
            let tick = oracle_tick_for_asset(st, cfg.asset_id)?;
            if tick.publish_time == 0 {
                return Err(String::from("no oracle tick"));
            }
            let age = now_sec().saturating_sub(tick.publish_time);
            if age > st.max_oracle_age_secs {
                return Err(String::from("stale oracle at start"));
            }

            let t = now_ms();
            let dur_ms = st.round_seconds.saturating_mul(1000);
            let id = st.next_round_id;
            st.next_round_id = st.next_round_id.saturating_add(1);
            let round = Round {
                id,
                start_ts: t,
                end_ts: t.saturating_add(dur_ms),
                start_price: tick.price,
                start_expo: tick.expo,
                end_price: None,
                end_expo: None,
                outcome_up: None,
                phase: RoundPhase::Open,
                reserve_up: liquidity_seed,
                reserve_down: liquidity_seed,
                fee_bps,
                total_shares_up: 0,
                total_shares_down: 0,
                fee_acc: 0,
                seed_per_side: liquidity_seed,
                payout_fin_remaining: 0,
                winning_shares_remaining: 0,
                trader_fin_deposited: 0,
                is_rolling: false, // Legacy start_round; seed returned via claim_seed
            };
            st.rounds.insert(asset_key, round);
            Ok(())
        })?;
        Ok(())
    }

    #[export]
    pub async fn buy_side(
        &mut self,
        asset_key: String,
        side: u8,
        fin_in: u128,
        min_shares_out: u128,
    ) -> Result<(), String> {
        with_state(|st| {
            ensure_initialized(st);
            ensure_not_paused(st);
        });
        if fin_in == 0 {
            return Err(String::from("bad amount"));
        }
        let user = msg::source();
        let market = program_id();

        let payload = vft::transfer_from_payload(user, market, U256::from(fin_in));
        let reply = msg::send_bytes_for_reply(FIN_TOKEN_PROGRAM, payload, 0, VFT_REPLY_DEPOSIT)
            .map_err(|_| String::from("vft send"))?
            .await
            .map_err(|_| String::from("vft reply"))?;
        let ok = vft::decode_bool_reply(&reply, "TransferFrom").map_err(String::from)?;
        if !ok {
            return Err(String::from("transfer_from failed"));
        }

        with_state_mut(|st| {
            let round = st
            .rounds
            .get_mut(&asset_key)
            .ok_or_else(|| String::from("no round"))?;
        if round.phase != RoundPhase::Open {
            return Err(String::from("not open"));
        }
        let t = now_ms();
        if t >= round.end_ts {
            return Err(String::from("round ended"));
        }

        let (mut a, mut b) = if side == 1 {
            (round.reserve_up, round.reserve_down)
        } else if side == 0 {
            (round.reserve_down, round.reserve_up)
        } else {
            return Err(String::from("bad side"));
        };
        if a == 0 || b == 0 {
            return Err(String::from("no liquidity"));
        }

        let fee = fin_in.saturating_mul(round.fee_bps as u128) / 10_000u128;
        let fin_eff = fin_in.saturating_sub(fee);
        if fin_eff == 0 {
            return Err(String::from("fee eats input"));
        }
        let (new_b, shares_out) = cpamm_shares_out(a, b, fin_eff)?;
        let new_a = a.checked_add(fin_eff).ok_or_else(|| String::from("overflow"))?;
        if shares_out < min_shares_out {
            return Err(String::from("slippage"));
        }
        a = new_a;
        b = new_b;
        if side == 1 {
            round.reserve_up = a;
            round.reserve_down = b;
            round.total_shares_up = round.total_shares_up.saturating_add(shares_out);
        } else {
            round.reserve_down = a;
            round.reserve_up = b;
            round.total_shares_down = round.total_shares_down.saturating_add(shares_out);
        }
        round.fee_acc = round.fee_acc.saturating_add(fee);

        round.trader_fin_deposited = round.trader_fin_deposited.saturating_add(fin_eff);

        let rid = round.id;
        let pos = st
            .positions
            .entry((asset_key.clone(), rid, user))
            .or_default();
        if side == 1 {
            pos.shares_up = pos.shares_up.saturating_add(shares_out);
        } else {
            pos.shares_down = pos.shares_down.saturating_add(shares_out);
        }
            Ok(())
        })?;
        Ok(())
    }

    #[export]
    pub fn settle_round(&mut self, asset_key: String) {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_not_paused(st);
            let cfg = st.assets.get(&asset_key).expect("unknown asset").clone();
            let tick = match oracle_tick_for_asset(st, cfg.asset_id) {
                Ok(t) => t,
                Err(e) => panic!("{}", e),
            };
            let round = st.rounds.get_mut(&asset_key).expect("no round");
            let t = now_ms();
            if t < round.end_ts {
                panic!("too early");
            }
            if round.phase != RoundPhase::Open {
                panic!("not open");
            }
            if tick.publish_time == 0 {
                panic!("no oracle tick");
            }
            let age = now_sec().saturating_sub(tick.publish_time);
            if age > st.max_oracle_age_secs {
                panic!("stale oracle");
            }

            round.phase = RoundPhase::Locked;
            round.end_price = Some(tick.price);
            round.end_expo = Some(tick.expo);
            let up_wins = tick.price >= round.start_price;
            round.outcome_up = Some(up_wins);
            round.phase = RoundPhase::Resolved;

            let win_shares = if up_wins {
                round.total_shares_up
            } else {
                round.total_shares_down
            };
            round.payout_fin_remaining = round.trader_fin_deposited;
            round.winning_shares_remaining = win_shares;
        });
    }

    /// Rolling settle + immediate next epoch open in a single call.
    /// Replaces the legacy settle → approve → start cycle with one extrinsic.
    /// The admin seed is NOT returned — it rolls forward as the persistent treasury.
    #[export]
    pub fn settle_and_roll(&mut self, asset_key: String) -> Result<(), String> {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_not_paused(st);

            // ── 1. Validate oracle tick ──────────────────────────────
            let cfg = st.assets.get(&asset_key)
                .ok_or_else(|| String::from("unknown asset"))?.clone();
            let tick = oracle_tick_for_asset(st, cfg.asset_id)?;
            if tick.publish_time == 0 {
                return Err(String::from("no oracle tick"));
            }
            let age = now_sec().saturating_sub(tick.publish_time);
            if age > st.max_oracle_age_secs {
                return Err(String::from("stale oracle"));
            }

            // ── 2. Settle current round ──────────────────────────────
            {
                let round = st.rounds.get_mut(&asset_key)
                    .ok_or_else(|| String::from("no round"))?;
                if now_ms() < round.end_ts {
                    return Err(String::from("too early"));
                }
                if round.phase != RoundPhase::Open {
                    return Err(String::from("not open"));
                }
                round.phase = RoundPhase::Locked;
                round.end_price = Some(tick.price);
                round.end_expo  = Some(tick.expo);
                let up_wins = tick.price >= round.start_price;
                round.outcome_up = Some(up_wins);
                round.phase = RoundPhase::Resolved;
                let win_shares = if up_wins {
                    round.total_shares_up
                } else {
                    round.total_shares_down
                };
                round.payout_fin_remaining    = round.trader_fin_deposited;
                round.winning_shares_remaining = win_shares;
            }

            // ── 3. Snapshot settled round for historical claim access ─
            let seed;
            let fee_bps;
            {
                let settled = st.rounds.remove(&asset_key)
                    .expect("round vanished between settle and snapshot");
                seed    = settled.seed_per_side;
                fee_bps = settled.fee_bps;
                st.round_snapshots
                    .entry(asset_key.clone())
                    .or_insert_with(Vec::new)
                    .push(settled);
            }

            // ── 4. Open next epoch immediately ───────────────────────
            // Re-read oracle for fresh start_price of the new epoch.
            let new_tick = oracle_tick_for_asset(st, cfg.asset_id)?;
            let t       = now_ms();
            let dur_ms  = st.round_seconds.saturating_mul(1000);
            let id      = st.next_round_id;
            st.next_round_id = st.next_round_id.saturating_add(1);

            let new_round = Round {
                id,
                start_ts:  t,
                end_ts:    t.saturating_add(dur_ms),
                start_price: new_tick.price,
                start_expo:  new_tick.expo,
                end_price:   None,
                end_expo:    None,
                outcome_up:  None,
                phase:       RoundPhase::Open,
                reserve_up:   seed,
                reserve_down: seed,
                fee_bps,
                total_shares_up:   0,
                total_shares_down: 0,
                fee_acc:     0,
                seed_per_side: seed,
                payout_fin_remaining:     0,
                winning_shares_remaining: 0,
                trader_fin_deposited:     0,
                is_rolling: true,
            };
            st.rounds.insert(asset_key, new_round);
            Ok(())
        })
    }

    /// Winners redeem FIN pro-rata from the settled pool (one claim per user per round).
    /// Accounting is updated before the outbound VFT transfer so a failed send reverts the whole message.
    #[export]
    pub async fn claim(&mut self, asset_key: String) -> Result<(), String> {
        let rid = with_state(|st| {
            ensure_initialized(st);
            ensure_not_paused(st);
            st.rounds
                .get(&asset_key)
                .map(|r| r.id)
                .ok_or_else(|| String::from("no round"))
        })?;
        self.claim_for_round(asset_key, rid).await
    }

    /// Winners redeem FIN from a specific round id (current or historical snapshot).
    /// This allows claiming old winning rounds even when newer rounds are already open.
    #[export]
    pub async fn claim_for_round(&mut self, asset_key: String, round_id: u64) -> Result<(), String> {
        with_state(|st| {
            ensure_initialized(st);
            ensure_not_paused(st);
        });
        let user = msg::source();

        let (payout, rid) = with_state_mut(|st| {
            // 1) Try active round first (legacy flow or currently resolved round).
            if let Some(round) = st.rounds.get_mut(&asset_key) {
                if round.id == round_id {
                    if round.phase != RoundPhase::Resolved {
                        return Err(String::from("not resolved"));
                    }
                    let outcome = round.outcome_up.ok_or_else(|| String::from("no outcome"))?;
                    let rid = round.id;
                    let pos = st
                        .positions
                        .get(&(asset_key.clone(), rid, user))
                        .cloned()
                        .unwrap_or_default();
                    let user_win = if outcome { pos.shares_up } else { pos.shares_down };
                    if user_win == 0 {
                        return Err(String::from("no winning shares"));
                    }
                    if st.claimed.contains(&(asset_key.clone(), rid, user)) {
                        return Err(String::from("already claimed"));
                    }
                    if round.winning_shares_remaining == 0 || round.payout_fin_remaining == 0 {
                        return Err(String::from("nothing to claim"));
                    }
                    let payout = round
                        .payout_fin_remaining
                        .saturating_mul(user_win)
                        / round.winning_shares_remaining;
                    if payout == 0 {
                        return Err(String::from("payout zero"));
                    }
                    round.payout_fin_remaining = round.payout_fin_remaining.saturating_sub(payout);
                    round.winning_shares_remaining = round.winning_shares_remaining.saturating_sub(user_win);
                    return Ok((payout, rid));
                }
            }

            // 2) Fallback to rolling snapshot history for historical claims.
            let snapshots = st
                .round_snapshots
                .get_mut(&asset_key)
                .ok_or_else(|| String::from("snapshot not found"))?;
            let snap = snapshots
                .iter_mut()
                .find(|r| r.id == round_id)
                .ok_or_else(|| String::from("snapshot not found"))?;

            if snap.phase != RoundPhase::Resolved {
                return Err(String::from("not resolved"));
            }
            let outcome = snap.outcome_up.ok_or_else(|| String::from("no outcome"))?;
            let rid = snap.id;
            let pos = st
                .positions
                .get(&(asset_key.clone(), rid, user))
                .cloned()
                .unwrap_or_default();
            let user_win = if outcome { pos.shares_up } else { pos.shares_down };
            if user_win == 0 {
                return Err(String::from("no winning shares"));
            }
            if st.claimed.contains(&(asset_key.clone(), rid, user)) {
                return Err(String::from("already claimed"));
            }
            if snap.winning_shares_remaining == 0 || snap.payout_fin_remaining == 0 {
                return Err(String::from("nothing to claim"));
            }
            let payout = snap
                .payout_fin_remaining
                .saturating_mul(user_win)
                / snap.winning_shares_remaining;
            if payout == 0 {
                return Err(String::from("payout zero"));
            }
            snap.payout_fin_remaining = snap.payout_fin_remaining.saturating_sub(payout);
            snap.winning_shares_remaining = snap.winning_shares_remaining.saturating_sub(user_win);
            Ok((payout, rid))
        })?;

        with_state_mut(|st| {
            st.claimed.insert((asset_key.clone(), rid, user));
        });

        let payload = vft::transfer_payload(user, U256::from(payout));
        let reply = msg::send_bytes_for_reply(FIN_TOKEN_PROGRAM, payload, 0, VFT_REPLY_DEPOSIT)
            .map_err(|_| String::from("vft send"))?
            .await
            .map_err(|_| String::from("vft reply"))?;
        let ok = vft::decode_bool_reply(&reply, "Transfer").map_err(String::from)?;
        if !ok {
            panic!("vft transfer failed");
        }
        Ok(())
    }

    /// Admin claims back their seed liquidity after round is settled (legacy mode only).
    /// In rolling mode, the seed stays in-contract as the persistent treasury.
    /// Use `claim_seed_for_round` to withdraw seed from a specific historical snapshot.
    #[export]
    pub async fn claim_seed(&mut self, asset_key: String) -> Result<(), String> {
        with_state(|st| {
            ensure_initialized(st);
            ensure_admin(st);
        });
        let admin = msg::source();

        let (seed_amount, _rid) = with_state_mut(|st| {
            let round = st
                .rounds
                .get_mut(&asset_key)
                .ok_or_else(|| String::from("no round"))?;
            if round.phase != RoundPhase::Resolved {
                return Err(String::from("not resolved"));
            }
            if round.is_rolling {
                return Err(String::from("rolling mode: seed stays in treasury; use claim_seed_for_round"));
            }
            let rid = round.id;
            let seed_total = round.seed_per_side.saturating_mul(2);
            if seed_total == 0 {
                return Err(String::from("no seed to claim"));
            }
            round.seed_per_side = 0;
            Ok((seed_total, rid))
        })?;

        let payload = vft::transfer_payload(admin, U256::from(seed_amount));
        let reply = msg::send_bytes_for_reply(FIN_TOKEN_PROGRAM, payload, 0, VFT_REPLY_DEPOSIT)
            .map_err(|_| String::from("vft send"))?
            .await
            .map_err(|_| String::from("vft reply"))?;
        let ok = vft::decode_bool_reply(&reply, "Transfer").map_err(String::from)?;
        if !ok {
            panic!("vft transfer failed");
        }
        Ok(())
    }

    /// Admin withdraws seed from a specific historical rolling epoch snapshot.
    /// Call this to fully exit a rolling market (e.g. during decommission).
    #[export]
    pub async fn claim_seed_for_round(&mut self, asset_key: String, round_id: u64) -> Result<(), String> {
        with_state(|st| {
            ensure_initialized(st);
            ensure_admin(st);
        });
        let admin = msg::source();

        let seed_amount = with_state_mut(|st| {
            let snapshots = st.round_snapshots
                .get_mut(&asset_key)
                .ok_or_else(|| String::from("no snapshots for asset"))?;
            let snap = snapshots.iter_mut()
                .find(|r| r.id == round_id)
                .ok_or_else(|| String::from("snapshot not found"))?;
            if !snap.is_rolling {
                return Err(String::from("not a rolling round; use claim_seed instead"));
            }
            let seed_total = snap.seed_per_side.saturating_mul(2);
            if seed_total == 0 {
                return Err(String::from("seed already claimed"));
            }
            snap.seed_per_side = 0;
            Ok(seed_total)
        })?;

        let payload = vft::transfer_payload(admin, U256::from(seed_amount));
        let reply = msg::send_bytes_for_reply(FIN_TOKEN_PROGRAM, payload, 0, VFT_REPLY_DEPOSIT)
            .map_err(|_| String::from("vft send"))?
            .await
            .map_err(|_| String::from("vft reply"))?;
        let ok = vft::decode_bool_reply(&reply, "Transfer").map_err(String::from)?;
        if !ok {
            panic!("vft transfer failed");
        }
        Ok(())
    }

    #[export]
    pub fn get_tick(&self, asset_id: u32) -> OracleTick {
        with_state(|st| oracle_tick_for_asset(st, asset_id).unwrap_or_default())
    }

    #[export]
    pub fn get_round(&self, asset_key: String) -> Option<Round> {
        with_state(|st| st.rounds.get(&asset_key).cloned())
    }

    /// Return a historical settled epoch by asset key + round id.
    /// Used by the frontend and users to verify claims against old rolling epochs.
    #[export]
    pub fn get_round_snapshot(&self, asset_key: String, round_id: u64) -> Option<Round> {
        with_state(|st| {
            st.round_snapshots
                .get(&asset_key)?
                .iter()
                .find(|r| r.id == round_id)
                .cloned()
        })
    }

    /// Return all snapshot round ids for an asset (newest last).
    #[export]
    pub fn list_round_snapshots(&self, asset_key: String) -> Vec<u64> {
        with_state(|st| {
            st.round_snapshots
                .get(&asset_key)
                .map(|v| v.iter().map(|r| r.id).collect())
                .unwrap_or_default()
        })
    }

    #[export]
    pub fn list_assets(&self) -> Vec<String> {
        with_state(|st| st.assets.keys().cloned().collect())
    }

    #[export]
    pub fn fin_token(&self) -> ActorId {
        FIN_TOKEN_PROGRAM
    }

    #[export]
    pub fn get_position(&self, asset_key: String, round_id: u64, user: ActorId) -> UserPosition {
        with_state(|st| {
            st.positions
                .get(&(asset_key, round_id, user))
                .cloned()
                .unwrap_or_default()
        })
    }

    // ── Faucet ──────────────────────────────────────────────────────

    /// Admin sets the per-claim FIN amount and cooldown.  Passing 0 for either
    /// resets it to the compile-time default (100 FIN / 24 h).
    #[export]
    pub fn set_faucet_config(&mut self, amount: u128, cooldown_secs: u64) {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            st.faucet_amount = amount;
            st.faucet_cooldown_ms = cooldown_secs.saturating_mul(1000);
        });
    }

    /// Any user calls this to receive FIN from the program's treasury.
    /// Enforces a per-wallet cooldown (default 24 h).
    #[export]
    pub async fn faucet_claim(&mut self) -> Result<(), String> {
        let user = msg::source();
        let now = now_ms();

        let (amount, cooldown) = with_state(|st| {
            ensure_initialized(st);
            ensure_not_paused(st);
            let a = if st.faucet_amount == 0 { FAUCET_DEFAULT_AMOUNT } else { st.faucet_amount };
            let c = if st.faucet_cooldown_ms == 0 { FAUCET_DEFAULT_COOLDOWN_MS } else { st.faucet_cooldown_ms };
            (a, c)
        });

        if let Some(last) = with_state(|st| st.faucet_claims.get(&user).copied()) {
            let next = last.saturating_add(cooldown);
            if now < next {
                return Err(String::from("faucet cooldown active"));
            }
        }

        let payload = vft::transfer_payload(user, U256::from(amount));
        let reply = msg::send_bytes_for_reply(FIN_TOKEN_PROGRAM, payload, 0, VFT_REPLY_DEPOSIT)
            .map_err(|_| String::from("vft send"))?
            .await
            .map_err(|_| String::from("vft reply"))?;
        let ok = vft::decode_bool_reply(&reply, "Transfer").map_err(String::from)?;
        if !ok {
            return Err(String::from("faucet transfer failed — treasury may be empty"));
        }

        with_state_mut(|st| {
            st.faucet_claims.insert(user, now);
        });
        Ok(())
    }

    #[export]
    pub fn get_faucet_info(&self, user: ActorId) -> FaucetInfo {
        with_state(|st| {
            let amount = if st.faucet_amount == 0 { FAUCET_DEFAULT_AMOUNT } else { st.faucet_amount };
            let cooldown = if st.faucet_cooldown_ms == 0 { FAUCET_DEFAULT_COOLDOWN_MS } else { st.faucet_cooldown_ms };
            let last = st.faucet_claims.get(&user).copied().unwrap_or(0);
            let now = now_ms();
            let next = if last == 0 { 0 } else { last.saturating_add(cooldown) };
            let can_claim = now >= next;
            FaucetInfo {
                amount,
                cooldown_ms: cooldown,
                last_claim_ms: last,
                can_claim,
                next_claim_ms: if can_claim { 0 } else { next },
            }
        })
    }
}

#[derive(Default)]
pub struct Program(());

#[sails_rs::program]
impl Program {
    pub fn create() -> Self {
        Self(())
    }

    pub fn fin(&self) -> Finality {
        Finality::create()
    }

    pub fn oracle(&self) -> Oracle {
        Oracle::create()
    }
}
