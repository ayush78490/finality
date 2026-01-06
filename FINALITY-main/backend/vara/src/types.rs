use parity_scale_codec::{Decode, Encode};
use scale_info::TypeInfo;
use gstd::prelude::*;

pub type MarketId = u64;
pub type ActorId = [u8; 32];
pub type Hash = [u8; 32];

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub enum MarketEngineAction {
    /// Initialize a new market with pools
    InitializeMarket {
        market_id: MarketId,
        initial_yes: u128,
        initial_no: u128,
        ethereum_block: u64,
    },
    /// Execute a trade (deposit from Ethereum)
    ExecuteTrade {
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        amount: u128,
    },
    /// Create a stop-loss or take-profit order
    CreateOrder {
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        token_amount: u128,
        trigger_price: u128,
        is_stop_loss: bool,
    },
    /// Cancel an order
    CancelOrder {
        order_id: u64,
        user: ActorId,
    },
    /// Check and execute triggered orders
    CheckOrders {
        market_id: MarketId,
    },
    /// Request withdrawal calculation
    CalculateWithdrawal {
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        token_amount: u128,
    },
    /// Get current market state
    GetMarketState {
        market_id: MarketId,
    },
    /// Get current multipliers
    GetMultipliers {
        market_id: MarketId,
    },
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub enum MarketEngineEvent {
    /// Market initialized successfully
    MarketInitialized {
        market_id: MarketId,
        yes_pool: u128,
        no_pool: u128,
        state_hash: Hash,
    },
    /// Trade executed with result
    TradeExecuted {
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        amount_in: u128,
        tokens_out: u128,
        creator_fee: u128,
        platform_fee: u128,
        new_yes_pool: u128,
        new_no_pool: u128,
        state_hash: Hash,
    },
    /// Order created
    OrderCreated {
        order_id: u64,
        market_id: MarketId,
        user: ActorId,
        is_yes: bool,
        token_amount: u128,
        trigger_price: u128,
        is_stop_loss: bool,
    },
    /// Order executed
    OrderExecuted {
        order_id: u64,
        market_id: MarketId,
        user: ActorId,
        tokens_out: u128,
        state_hash: Hash,
    },
    /// Order cancelled
    OrderCancelled {
        order_id: u64,
    },
    /// Withdrawal calculated
    WithdrawalCalculated {
        market_id: MarketId,
        user: ActorId,
        eth_out: u128,
        creator_fee: u128,
        platform_fee: u128,
        state_hash: Hash,
    },
    /// Current market state
    MarketState {
        market_id: MarketId,
        yes_pool: u128,
        no_pool: u128,
        total_orders: u64,
        state_hash: Hash,
    },
    /// Current multipliers
    Multipliers {
        market_id: MarketId,
        yes_multiplier: u128,
        no_multiplier: u128,
        yes_price: u128,
        no_price: u128,
    },
    /// Error occurred
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub struct Order {
    pub order_id: u64,
    pub market_id: MarketId,
    pub user: ActorId,
    pub is_yes: bool,
    pub token_amount: u128,
    pub trigger_price: u128,
    pub is_stop_loss: bool,
    pub is_active: bool,
    pub created_at: u64,
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub struct MarketState {
    pub market_id: MarketId,
    pub yes_pool: u128,
    pub no_pool: u128,
    pub orders: Vec<Order>,
    pub last_ethereum_block: u64,
}

// Trading bot types
#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub enum TradingBotAction {
    /// Monitor market for opportunities
    MonitorMarket {
        market_id: MarketId,
    },
    /// Execute automated trade
    ExecuteAutoTrade {
        market_id: MarketId,
        is_yes: bool,
        amount: u128,
        beneficiary: ActorId,
    },
    /// Batch check orders
    BatchCheckOrders {
        order_ids: Vec<u64>,
    },
    /// Set trading strategy
    SetStrategy {
        market_id: MarketId,
        strategy: TradingStrategy,
    },
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub enum TradingBotEvent {
    /// Market monitored
    MarketMonitored {
        market_id: MarketId,
        yes_price: u128,
        no_price: u128,
        recommendation: String,
    },
    /// Auto trade executed
    AutoTradeExecuted {
        market_id: MarketId,
        is_yes: bool,
        amount: u128,
        tokens_received: u128,
    },
    /// Orders checked
    OrdersChecked {
        triggered_orders: Vec<u64>,
    },
    /// Strategy set
    StrategySet {
        market_id: MarketId,
    },
    /// Error
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Encode, Decode, TypeInfo)]
pub enum TradingStrategy {
    Conservative,
    Moderate,
    Aggressive,
    Custom {
        max_position_size: u128,
        stop_loss_pct: u128,
        take_profit_pct: u128,
    },
}

// Fee constants (in basis points)
pub const CREATOR_FEE_BPS: u128 = 200; // 2%
pub const PLATFORM_FEE_BPS: u128 = 100; // 1%
pub const TOTAL_FEE_BPS: u128 = 300; // 3%
pub const BPS_DIVISOR: u128 = 10000;

// Price precision (for multipliers)
pub const PRICE_PRECISION: u128 = 10000; // 100.00%
pub const MULTIPLIER_PRECISION: u128 = 1_000_000; // 1.000000x
pub const MAX_MULTIPLIER: u128 = 999_000_000; // 999.000000x
