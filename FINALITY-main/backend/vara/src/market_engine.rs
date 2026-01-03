use crate::types::*;
use gstd::{msg, prelude::*, ActorId as GActorId};
use parity_scale_codec::{Decode, Encode};

#[derive(Debug, Default, Encode, Decode)]
pub struct MarketEngine {
    pub markets: BTreeMap<MarketId, MarketState>,
    pub next_order_id: u64,
    pub owner: GActorId,
}

impl MarketEngine {
    pub fn new(owner: GActorId) -> Self {
        Self {
            markets: BTreeMap::new(),
            next_order_id: 0,
            owner,
        }
    }

    pub fn handle_action(&mut self, action: MarketEngineAction) -> MarketEngineEvent {
        match action {
            MarketEngineAction::InitializeMarket {
                market_id,
                initial_yes,
                initial_no,
                ethereum_block,
            } => self.initialize_market(market_id, initial_yes, initial_no, ethereum_block),

            MarketEngineAction::ExecuteTrade {
                market_id,
                user,
                is_yes,
                amount,
            } => self.execute_trade(market_id, user, is_yes, amount),

            MarketEngineAction::CreateOrder {
                market_id,
                user,
                is_yes,
                token_amount,
                trigger_price,
                is_stop_loss,
            } => self.create_order(
                market_id,
                user,
                is_yes,
                token_amount,
                trigger_price,
                is_stop_loss,
            ),

            MarketEngineAction::CancelOrder { order_id, user } => {
                self.cancel_order(order_id, user)
            }

            MarketEngineAction::CheckOrders { market_id } => self.check_orders(market_id),

            MarketEngineAction::CalculateWithdrawal {
                market_id,
                user,
                is_yes,
                token_amount,
            } => self.calculate_withdrawal(market_id, user, is_yes, token_amount),

            MarketEngineAction::GetMarketState { market_id } => self.get_market_state(market_id),

            MarketEngineAction::GetMultipliers { market_id } => self.get_multipliers(market_id),
        }
    }

    fn initialize_market(
        &mut self,
        market_id: MarketId,
        initial_yes: u128,
        initial_no: u128,
        ethereum_block: u64,
    ) -> MarketEngineEvent {
        if self.markets.contains_key(&market_id) {
            return MarketEngineEvent::Error {
                message: "Market already exists".to_string(),
            };
        }

        let market_state = MarketState {
            market_id,
            yes_pool: initial_yes,
            no_pool: initial_no,
            orders: Vec::new(),
            last_ethereum_block: ethereum_block,
        };

        let state_hash = self.compute_state_hash(&market_state);
        self.markets.insert(market_id, market_state);

        MarketEngineEvent::MarketInitialized {
            market_id,
            yes_pool: initial_yes,
            no_pool: initial_no,
            state_hash,
        }
    }

    fn execute_trade(
        &mut self,
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        amount: u128,
    ) -> MarketEngineEvent {
        let market = match self.markets.get_mut(&market_id) {
            Some(m) => m,
            None => {
                return MarketEngineEvent::Error {
                    message: "Market not found".to_string(),
                }
            }
        };

        if amount == 0 {
            return MarketEngineEvent::Error {
                message: "Zero amount".to_string(),
            };
        }

        // Calculate fees (3% total: 2% creator + 1% platform)
        let total_fee = (amount * TOTAL_FEE_BPS) / BPS_DIVISOR;
        let creator_fee = (amount * CREATOR_FEE_BPS) / BPS_DIVISOR;
        let platform_fee = (amount * PLATFORM_FEE_BPS) / BPS_DIVISOR;
        let amount_to_pool = amount - total_fee;

        // Execute AMM swap
        let (tokens_out, new_yes_pool, new_no_pool) = if is_yes {
            let swap_out = self.get_amount_out(amount_to_pool, market.no_pool, market.yes_pool);
            let total_out = swap_out + amount;
            (
                total_out,
                market.yes_pool + amount_to_pool,
                market.no_pool - swap_out,
            )
        } else {
            let swap_out = self.get_amount_out(amount_to_pool, market.yes_pool, market.no_pool);
            let total_out = swap_out + amount;
            (
                total_out,
                market.yes_pool - swap_out,
                market.no_pool + amount_to_pool,
            )
        };

        // Update pools
        market.yes_pool = new_yes_pool;
        market.no_pool = new_no_pool;

        let state_hash = self.compute_state_hash(market);

        MarketEngineEvent::TradeExecuted {
            market_id,
            user,
            is_yes,
            amount_in: amount,
            tokens_out,
            creator_fee,
            platform_fee,
            new_yes_pool,
            new_no_pool,
            state_hash,
        }
    }

    fn create_order(
        &mut self,
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        token_amount: u128,
        trigger_price: u128,
        is_stop_loss: bool,
    ) -> MarketEngineEvent {
        let market = match self.markets.get_mut(&market_id) {
            Some(m) => m,
            None => {
                return MarketEngineEvent::Error {
                    message: "Market not found".to_string(),
                }
            }
        };

        let order_id = self.next_order_id;
        self.next_order_id += 1;

        let order = Order {
            order_id,
            market_id,
            user,
            is_yes,
            token_amount,
            trigger_price,
            is_stop_loss,
            is_active: true,
            created_at: 0, // Would use block timestamp in production
        };

        market.orders.push(order.clone());

        MarketEngineEvent::OrderCreated {
            order_id,
            market_id,
            user,
            is_yes,
            token_amount,
            trigger_price,
            is_stop_loss,
        }
    }

    fn cancel_order(&mut self, order_id: u64, user: ActorId) -> MarketEngineEvent {
        for market in self.markets.values_mut() {
            if let Some(order) = market.orders.iter_mut().find(|o| o.order_id == order_id) {
                if order.user != user {
                    return MarketEngineEvent::Error {
                        message: "Not order owner".to_string(),
                    };
                }
                order.is_active = false;
                return MarketEngineEvent::OrderCancelled { order_id };
            }
        }

        MarketEngineEvent::Error {
            message: "Order not found".to_string(),
        }
    }

    fn check_orders(&mut self, market_id: MarketId) -> MarketEngineEvent {
        let market = match self.markets.get_mut(&market_id) {
            Some(m) => m,
            None => {
                return MarketEngineEvent::Error {
                    message: "Market not found".to_string(),
                }
            }
        };

        let total_pool = market.yes_pool + market.no_pool;
        if total_pool == 0 {
            return MarketEngineEvent::Error {
                message: "Empty pools".to_string(),
            };
        }

        // Check each active order
        for order in market.orders.iter_mut().filter(|o| o.is_active) {
            let current_price = if order.is_yes {
                (market.yes_pool * PRICE_PRECISION) / total_pool
            } else {
                (market.no_pool * PRICE_PRECISION) / total_pool
            };

            let is_triggered = if order.is_stop_loss {
                current_price <= order.trigger_price
            } else {
                current_price >= order.trigger_price
            };

            if is_triggered {
                // Execute order (simplified - would need full swap logic)
                order.is_active = false;
                // In production, emit OrderExecuted event
            }
        }

        MarketEngineEvent::MarketState {
            market_id,
            yes_pool: market.yes_pool,
            no_pool: market.no_pool,
            total_orders: market.orders.len() as u64,
            state_hash: self.compute_state_hash(market),
        }
    }

    fn calculate_withdrawal(
        &mut self,
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        token_amount: u128,
    ) -> MarketEngineEvent {
        let market = match self.markets.get_mut(&market_id) {
            Some(m) => m,
            None => {
                return MarketEngineEvent::Error {
                    message: "Market not found".to_string(),
                }
            }
        };

        let eth_out = if is_yes {
            self.get_amount_out(token_amount, market.yes_pool, market.no_pool)
        } else {
            self.get_amount_out(token_amount, market.no_pool, market.yes_pool)
        };

        // Calculate fees
        let total_fee = (eth_out * TOTAL_FEE_BPS) / BPS_DIVISOR;
        let creator_fee = (eth_out * CREATOR_FEE_BPS) / BPS_DIVISOR;
        let platform_fee = (eth_out * PLATFORM_FEE_BPS) / BPS_DIVISOR;

        // Update pools
        if is_yes {
            market.no_pool += token_amount;
            market.yes_pool -= eth_out;
        } else {
            market.yes_pool += token_amount;
            market.no_pool -= eth_out;
        }

        let state_hash = self.compute_state_hash(market);

        MarketEngineEvent::WithdrawalCalculated {
            market_id,
            user,
            eth_out,
            creator_fee,
            platform_fee,
            state_hash,
        }
    }

    fn get_market_state(&self, market_id: MarketId) -> MarketEngineEvent {
        match self.markets.get(&market_id) {
            Some(market) => MarketEngineEvent::MarketState {
                market_id,
                yes_pool: market.yes_pool,
                no_pool: market.no_pool,
                total_orders: market.orders.len() as u64,
                state_hash: self.compute_state_hash(market),
            },
            None => MarketEngineEvent::Error {
                message: "Market not found".to_string(),
            },
        }
    }

    fn get_multipliers(&self, market_id: MarketId) -> MarketEngineEvent {
        match self.markets.get(&market_id) {
            Some(market) => {
                let total_pool = market.yes_pool + market.no_pool;
                if total_pool == 0 {
                    return MarketEngineEvent::Multipliers {
                        market_id,
                        yes_multiplier: 2_000_000,
                        no_multiplier: 2_000_000,
                        yes_price: 5000,
                        no_price: 5000,
                    };
                }

                let yes_price = (market.yes_pool * PRICE_PRECISION) / total_pool;
                let no_price = PRICE_PRECISION - yes_price;

                let yes_multiplier = if no_price > 0 {
                    let mult = (PRICE_PRECISION * MULTIPLIER_PRECISION) / no_price;
                    mult.min(MAX_MULTIPLIER)
                } else {
                    MAX_MULTIPLIER
                };

                let no_multiplier = if yes_price > 0 {
                    let mult = (PRICE_PRECISION * MULTIPLIER_PRECISION) / yes_price;
                    mult.min(MAX_MULTIPLIER)
                } else {
                    MAX_MULTIPLIER
                };

                MarketEngineEvent::Multipliers {
                    market_id,
                    yes_multiplier,
                    no_multiplier,
                    yes_price,
                    no_price,
                }
            }
            None => MarketEngineEvent::Error {
                message: "Market not found".to_string(),
            },
        }
    }

    // AMM formula: x * y = k
    fn get_amount_out(&self, amount_in: u128, reserve_in: u128, reserve_out: u128) -> u128 {
        if amount_in == 0 || reserve_in == 0 || reserve_out == 0 {
            return 0;
        }
        (amount_in * reserve_out) / (reserve_in + amount_in)
    }

    fn compute_state_hash(&self, market: &MarketState) -> Hash {
        // Simple hash computation (in production, use proper cryptographic hash)
        let mut hash = [0u8; 32];
        let yes_bytes = market.yes_pool.to_le_bytes();
        let no_bytes = market.no_pool.to_le_bytes();
        
        for i in 0..16 {
            hash[i] = yes_bytes[i % yes_bytes.len()];
            hash[i + 16] = no_bytes[i % no_bytes.len()];
        }
        
        hash
    }
}
