//! Chainlink AggregatorV3-style feeds embedded in the market program (operator-submitted rounds).

use alloc::string::String;
use alloc::vec::Vec;
use gstd::exec;
use gstd::msg;
use parity_scale_codec::{Decode, Encode};
use sails_rs::prelude::*;
use scale_info::TypeInfo;

use crate::{
    ensure_admin, ensure_initialized, with_state, with_state_mut,
};

const MAX_ROUNDS_PER_FEED: usize = 128;

/// On-chain mirror of AggregatorV3 `getRoundData` fields (price in `answer`).
#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, Hash)]
pub struct RoundData {
    pub round_id: u64,
    pub answer: i128,
    pub started_at: u64,
    pub updated_at: u64,
    pub answered_in_round: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, Hash)]
pub struct AssetInfo {
    pub id: u32,
    pub symbol: String,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Encode, Decode, TypeInfo, Hash)]
pub struct FeedState {
    pub decimals: u8,
    pub description: String,
    pub latest_round_id: u64,
    pub rounds: Vec<RoundData>,
}

#[derive(Default)]
pub struct Oracle(());

impl Oracle {
    pub fn create() -> Self {
        Self(())
    }
}

fn now_unix_secs() -> u64 {
    exec::block_timestamp() / 1000
}

#[sails_rs::service]
impl Oracle {
    /// Register a new feed (e.g. `BTC` quoted in USDT). Returns `asset_id`.
    #[export]
    pub fn add_asset(
        &mut self,
        symbol: String,
        decimals: u8,
        description: String,
    ) -> Result<u32, String> {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            let sym = symbol.clone();
            if st.oracle_asset_id_by_symbol.contains_key(&sym) {
                return Err(String::from("symbol exists"));
            }
            let id = st.oracle_next_asset_id;
            st.oracle_next_asset_id = st.oracle_next_asset_id.saturating_add(1);
            st.oracle_asset_id_by_symbol.insert(sym.clone(), id);
            st.oracle_assets.insert(
                id,
                AssetInfo {
                    id,
                    symbol: sym,
                    active: true,
                },
            );
            st.oracle_feeds.insert(
                id,
                FeedState {
                    decimals,
                    description,
                    latest_round_id: 0,
                    rounds: Vec::new(),
                },
            );
            Ok(id)
        })
    }

    #[export]
    pub fn remove_asset(&mut self, asset_id: u32) -> Result<(), String> {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            let Some(info) = st.oracle_assets.get_mut(&asset_id) else {
                return Err(String::from("unknown asset"));
            };
            let sym = info.symbol.clone();
            info.active = false;
            st.oracle_asset_id_by_symbol.remove(&sym);
            Ok(())
        })
    }

    #[export]
    pub fn set_operator(&mut self, new_operator: ActorId) -> Result<(), String> {
        with_state_mut(|st| {
            ensure_initialized(st);
            ensure_admin(st);
            st.oracle_authority = new_operator;
            Ok(())
        })
    }

    /// Operator pushes a new round (call once per market expiry / resolution event).
    #[export]
    pub fn submit_round(&mut self, asset_id: u32, answer: i128) -> Result<u64, String> {
        with_state_mut(|st| {
            ensure_initialized(st);
            if msg::source() != st.oracle_authority {
                return Err(String::from("not oracle"));
            }
            let ts = now_unix_secs();
            let Some(info) = st.oracle_assets.get(&asset_id) else {
                return Err(String::from("unknown asset"));
            };
            if !info.active {
                return Err(String::from("asset inactive"));
            }
            let feed = st
                .oracle_feeds
                .get_mut(&asset_id)
                .ok_or_else(|| String::from("no feed"))?;
            let new_round_id = feed.latest_round_id.saturating_add(1);
            let rd = RoundData {
                round_id: new_round_id,
                answer,
                started_at: ts,
                updated_at: ts,
                answered_in_round: new_round_id,
            };
            feed.latest_round_id = new_round_id;
            feed.rounds.push(rd);
            if feed.rounds.len() > MAX_ROUNDS_PER_FEED {
                let excess = feed.rounds.len() - MAX_ROUNDS_PER_FEED;
                feed.rounds.drain(0..excess);
            }
            Ok(new_round_id)
        })
    }

    #[export]
    pub fn decimals(&self, asset_id: u32) -> Result<u8, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            Ok(feed.decimals)
        })
    }

    #[export]
    pub fn description(&self, asset_id: u32) -> Result<String, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            Ok(feed.description.clone())
        })
    }

    #[export]
    pub fn latest_round_id(&self, asset_id: u32) -> Result<u64, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            Ok(feed.latest_round_id)
        })
    }

    #[export]
    pub fn latest_answer(&self, asset_id: u32) -> Result<i128, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            let last = feed
                .rounds
                .last()
                .ok_or_else(|| String::from("no rounds"))?;
            Ok(last.answer)
        })
    }

    #[export]
    pub fn latest_round_data(&self, asset_id: u32) -> Result<RoundData, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            feed.rounds
                .last()
                .cloned()
                .ok_or_else(|| String::from("no rounds"))
        })
    }

    #[export]
    pub fn get_round_data(&self, asset_id: u32, round_id: u64) -> Result<RoundData, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            feed.rounds
                .iter()
                .find(|r| r.round_id == round_id)
                .cloned()
                .ok_or_else(|| String::from("round not found"))
        })
    }

    #[export]
    pub fn is_fresh(
        &self,
        asset_id: u32,
        now_unix_secs: u64,
        max_age_secs: u64,
    ) -> Result<bool, String> {
        with_state(|st| {
            let feed = st
                .oracle_feeds
                .get(&asset_id)
                .ok_or_else(|| String::from("unknown asset"))?;
            let Some(last) = feed.rounds.last() else {
                return Ok(false);
            };
            let age = now_unix_secs.saturating_sub(last.updated_at);
            Ok(age <= max_age_secs)
        })
    }

    #[export]
    pub fn is_fresh_now(&self, asset_id: u32, max_age_secs: u64) -> Result<bool, String> {
        self.is_fresh(asset_id, now_unix_secs(), max_age_secs)
    }

    #[export]
    pub fn get_asset_info(&self, asset_id: u32) -> Result<AssetInfo, String> {
        with_state(|st| {
            st.oracle_assets
                .get(&asset_id)
                .cloned()
                .ok_or_else(|| String::from("unknown asset"))
        })
    }

    #[export]
    pub fn owner(&self) -> ActorId {
        with_state(|st| st.admin)
    }

    #[export]
    pub fn operator(&self) -> ActorId {
        with_state(|st| st.oracle_authority)
    }
}
