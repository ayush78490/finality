#![no_std]

use gstd::{msg, prelude::*, ActorId};
use parity_scale_codec::{Decode, Encode};

mod market_engine;
mod trading_bot;
mod types;

use market_engine::MarketEngine;
use trading_bot::TradingBot;
use types::*;

static mut MARKET_ENGINE: Option<MarketEngine> = None;
static mut TRADING_BOT: Option<TradingBot> = None;

#[no_mangle]
extern "C" fn init() {
    let owner = msg::source();
    
    unsafe {
        MARKET_ENGINE = Some(MarketEngine::new(owner));
        TRADING_BOT = Some(TradingBot::new(owner, msg::source()));
    }
}

#[no_mangle]
extern "C" fn handle() {
    let payload = msg::load_bytes().expect("Failed to load payload");
    
    // Try to decode as MarketEngineAction first
    if let Ok(action) = MarketEngineAction::decode(&mut &payload[..]) {
        let engine = unsafe { MARKET_ENGINE.as_mut().expect("Engine not initialized") };
        let event = engine.handle_action(action);
        msg::reply(event, 0).expect("Failed to send reply");
        return;
    }
    
    // Try to decode as TradingBotAction
    if let Ok(action) = TradingBotAction::decode(&mut &payload[..]) {
        let bot = unsafe { TRADING_BOT.as_mut().expect("Bot not initialized") };
        let event = bot.handle_action(action);
        msg::reply(event, 0).expect("Failed to send reply");
        return;
    }
    
    // Unknown action type
    msg::reply(
        MarketEngineEvent::Error {
            message: "Unknown action type".to_string(),
        },
        0,
    )
    .expect("Failed to send error reply");
}

#[no_mangle]
extern "C" fn state() {
    let engine = unsafe { MARKET_ENGINE.as_ref().expect("Engine not initialized") };
    msg::reply(engine, 0).expect("Failed to send state");
}
