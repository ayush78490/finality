//! Sails-encoded calls to the extended VFT program (service `Vft` on [gear-foundation/standards extended-vft](https://github.com/gear-foundation/standards/tree/master/extended-vft)).
//! Wire format matches Sails 0.10: `Encode(service_name) || Encode(method_name) || Encode(params)`.

use alloc::vec::Vec;
use parity_scale_codec::{Decode, Encode};
use sails_rs::prelude::{ActorId, U256};

const VFT_SERVICE: &str = "Vft";

fn scale_string(s: &str) -> Vec<u8> {
    let mut v = Vec::new();
    s.encode_to(&mut v);
    v
}

fn encode_vft_call(method: &str, params: impl Encode) -> Vec<u8> {
    let mut out = scale_string(VFT_SERVICE);
    out.extend_from_slice(&scale_string(method));
    params.encode_to(&mut out);
    out
}

pub fn transfer_from_payload(from: ActorId, to: ActorId, value: U256) -> Vec<u8> {
    encode_vft_call("TransferFrom", (from, to, value))
}

pub fn transfer_payload(to: ActorId, value: U256) -> Vec<u8> {
    encode_vft_call("Transfer", (to, value))
}

/// Decode a bool reply from `Transfer` / `TransferFrom` (reply is `service || method || bool`).
pub fn decode_bool_reply(payload: &[u8], method: &str) -> Result<bool, &'static str> {
    let mut expected = scale_string(VFT_SERVICE);
    expected.extend_from_slice(&scale_string(method));
    if !payload.starts_with(&expected) {
        return Err("reply: bad prefix");
    }
    let mut rest = &payload[expected.len()..];
    bool::decode(&mut rest).map_err(|_| "reply: bad body")
}
