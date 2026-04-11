/**
 * Step 5: read-only `Fin.GetFaucetInfo` via calculateReply (relayer account).
 * Usage: npm run verify-faucet
 */
import "dotenv/config";
import { GearApi, ReplyCode } from "@gear-js/api";
import { createVaraKeyring } from "./keyring-vara.js";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { encodeFinGetFaucetInfo, finGetFaucetInfoReplyPrefixLen } from "./sails-scale.js";

async function main() {
  await cryptoWaitReady();
  const marketId = process.env.MARKET_PROGRAM_ID?.trim();
  if (!marketId) throw new Error("MARKET_PROGRAM_ID missing");
  const mnemonic = process.env.RELAYER_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("RELAYER_MNEMONIC required");

  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const relayer = keyring.addFromMnemonic(mnemonic);

  const payload = encodeFinGetFaucetInfo(api, relayer.address);
  const reply = await api.message.calculateReply(
    {
      origin: relayer.address,
      destination: marketId,
      payload,
      value: 0
    },
    undefined,
    undefined
  );

  const code = new ReplyCode(reply.code.toU8a(), api.specVersion);
  const prefixLen = finGetFaucetInfoReplyPrefixLen();
  const raw = new Uint8Array(reply.payload as unknown as Uint8Array);
  const body = raw.subarray(prefixLen);

  if (!code.isSuccess) {
    console.log(
      JSON.stringify({
        step: 5,
        msg: "get_faucet_info_failed",
        code: code.asString,
        marketProgramId: marketId
      })
    );
    await api.disconnect();
    process.exit(2);
    return;
  }

  const amount = api.registry.createType("u128", body.subarray(0, 16));
  const cooldownMs = api.registry.createType("u64", body.subarray(16, 24));
  const lastClaimMs = api.registry.createType("u64", body.subarray(24, 32));
  const canClaim = api.registry.createType("bool", body.subarray(32, 33));
  const nextClaimMs = api.registry.createType("u64", body.subarray(33, 41));

  console.log(
    JSON.stringify({
      step: 5,
      msg: "get_faucet_info_ok",
      marketProgramId: marketId,
      user: relayer.address,
      amount: amount.toString(),
      cooldown_ms: cooldownMs.toString(),
      last_claim_ms: lastClaimMs.toString(),
      can_claim: canClaim.toHuman(),
      next_claim_ms: nextClaimMs.toString()
    })
  );

  await api.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
