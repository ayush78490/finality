import { readFileSync, writeFileSync } from "node:fs";
import { createApi, getSigner, readConfig, sendAndWait, VFT_EXTENDED_PUBLIC_CODE_ID } from "./common.js";

async function main() {
  const config = readConfig();
  const api = await createApi();
  const signer = await getSigner();

  const constructorPayload = {
    New: [config.token.name, config.token.symbol, config.token.decimals]
  };

  console.log("=== Deploy FIN Token (Vara Testnet) ===");
  console.log(`Network: ${config.network}`);
  console.log(`Deployer: ${signer.address}`);
  console.log(`Public CodeId: ${VFT_EXTENDED_PUBLIC_CODE_ID}`);
  console.log(`Payload: ${JSON.stringify(constructorPayload)}`);

  const gasLimit = 200_000_000_000n;
  const value = 0;

  const { programId, extrinsic } = (api as any).program.create(
    {
      codeId: VFT_EXTENDED_PUBLIC_CODE_ID,
      // VFT constructor: New(name, symbol, decimals)
      initPayload: constructorPayload,
      gasLimit,
      value
    }
  );

  await sendAndWait(extrinsic, signer, api);
  const programIdHex =
    typeof programId === "string"
      ? programId
      : programId?.toHex?.() ?? String(programId);

  // Persist ProgramId into .env so mint step can run.
  const envRaw = readFileSync(".env", "utf8");
  const updated = envRaw.match(/^FIN_TOKEN_PROGRAM_ID=/m)
    ? envRaw.replace(/^FIN_TOKEN_PROGRAM_ID=.*$/m, `FIN_TOKEN_PROGRAM_ID=${programIdHex}`)
    : `${envRaw}\nFIN_TOKEN_PROGRAM_ID=${programIdHex}\n`;
  writeFileSync(".env", updated, "utf8");

  console.log("Deployment extrinsic finalized.");
  console.log(`FIN_TOKEN_PROGRAM_ID=${programIdHex}`);
}

main().catch((error) => {
  console.error("Deploy failed:", error);
  process.exit(1);
});
