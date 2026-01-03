use crate::types::*;
use gstd::{msg, prelude::*, ActorId as GActorId};
use parity_scale_codec::{Decode, Encode};

#[derive(Debug, Default, Encode, Decode)]
pub struct TradingBot {
    pub market_engine: GActorId,
    pub strategies: BTreeMap<MarketId, TradingStrategy>,
    pub owner: GActorId,
}

impl TradingBot {
    pub fn new(owner: GActorId, market_engine: GActorId) -> Self {
        Self {
            market_engine,
            strategies: BTreeMap::new(),
            owner,
        }
    }

    pub fn handle_action(&mut self, action: TradingBotAction) -> TradingBotEvent {
        match action {
            TradingBotAction::MonitorMarket { market_id } => self.monitor_market(market_id),

            TradingBotAction::ExecuteAutoTrade {
                market_id,
                is_yes,
                amount,
                beneficiary,
            } => self.execute_auto_trade(market_id, is_yes, amount, beneficiary),

            TradingBotAction::BatchCheckOrders { order_ids } => {
                self.batch_check_orders(order_ids)
            }

            TradingBotAction::SetStrategy {
                market_id,
                strategy,
            } => self.set_strategy(market_id, strategy),
        }
    }

    fn monitor_market(&self, market_id: MarketId) -> TradingBotEvent {
        // In production, this would query the market engine
        // For now, return a placeholder
        TradingBotEvent::MarketMonitored {
            market_id,
            yes_price: 5000,
            no_price: 5000,
            recommendation: "Market balanced".to_string(),
        }
    }

    fn execute_auto_trade(
        &self,
        market_id: MarketId,
        is_yes: bool,
        amount: u128,
        beneficiary: ActorId,
    ) -> TradingBotEvent {
        // In production, this would send a message to the market engine
        // and wait for the response
        TradingBotEvent::AutoTradeExecuted {
            market_id,
            is_yes,
            amount,
            tokens_received: amount, // Simplified
        }
    }

    fn batch_check_orders(&self, order_ids: Vec<u64>) -> TradingBotEvent {
        // In production, this would check each order against current prices
        let triggered_orders = Vec::new(); // Placeholder

        TradingBotEvent::OrdersChecked { triggered_orders }
    }

    fn set_strategy(&mut self, market_id: MarketId, strategy: TradingStrategy) -> TradingBotEvent {
        self.strategies.insert(market_id, strategy);

        TradingBotEvent::StrategySet { market_id }
    }

    fn should_execute_trade(&self, market_id: MarketId, yes_price: u128) -> bool {
        match self.strategies.get(&market_id) {
            Some(TradingStrategy::Conservative) => {
                // Only trade when price is very favorable
                yes_price < 3000 || yes_price > 7000
            }
            Some(TradingStrategy::Moderate) => {
                // Trade on moderate price movements
                yes_price < 4000 || yes_price > 6000
            }
            Some(TradingStrategy::Aggressive) => {
                // Trade frequently
                yes_price < 4500 || yes_price > 5500
            }
            Some(TradingStrategy::Custom {
                max_position_size: _,
                stop_loss_pct,
                take_profit_pct,
            }) => {
                // Custom logic based on stop loss and take profit
                let deviation = if yes_price > 5000 {
                    yes_price - 5000
                } else {
                    5000 - yes_price
                };
                deviation > *stop_loss_pct || deviation > *take_profit_pct
            }
            None => false,
        }
    }
}
