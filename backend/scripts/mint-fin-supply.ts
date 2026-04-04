import {
  createApi,
  getSigner,
  readConfig,
  requireEnv,
  sendAndWait,
  splitInitialDistribution,
  toActorId
} from "./common.js";

async function main() {
  const cfg = readConfig();
  const api = await createApi();
  const signer = await getSigner();

  const programId = requireEnv("FIN_TOKEN_PROGRAM_ID");
  const treasuryId = toActorId(requireEnv("TREASURY_ACTOR_ID"));
  const lpId = toActorId(requireEnv("LP_BOOTSTRAP_ACTOR_ID"));
  const rewardsId = toActorId(requireEnv("REWARDS_VAULT_ACTOR_ID"));

  const maxSupply = BigInt(cfg.token.maxSupplyBaseUnits);
  const { treasury, lp, rewards } = splitInitialDistribution(maxSupply, cfg.initialDistribution);
  const mint = (to: string, amount: bigint) => ({
    destination: programId,
    payload: { Vft: { Mint: [to, amount.toString()] } },
    gasLimit: 120_000_000_000n,
    value: 0
  });

  const messageSend = (params: any) => (api as any).message.send(params);

  console.log("=== Mint FIN Hard Cap Supply ===");
  console.log(`Program: ${programId}`);
  console.log(`Treasury: ${treasury.toString()}`);
  console.log(`Liquidity: ${lp.toString()}`);
  console.log(`Rewards: ${rewards.toString()}`);

  await sendAndWait(messageSend(mint(treasuryId, treasury)), signer, api);
  await sendAndWait(messageSend(mint(lpId, lp)), signer, api);
  await sendAndWait(messageSend(mint(rewardsId, rewards)), signer, api);

  console.log("Mint distribution finalized.");
  console.log("Recommended next tx: revoke minter role from all non-admin actors.");
}

main().catch((error) => {
  console.error("Mint failed:", error);
  process.exit(1);
});
