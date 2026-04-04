import { mnemonicGenerate } from "@polkadot/util-crypto";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { createVaraKeyring } from "./vara-keyring.js";

async function main() {
  await cryptoWaitReady();
  const mnemonic = mnemonicGenerate();
  const keyring = createVaraKeyring();
  const pair = keyring.addFromMnemonic(mnemonic);

  console.log("Generated new deployer wallet:");
  console.log(`Address: ${pair.address}`);
  console.log(`Mnemonic: ${mnemonic}`);
  console.log("Save mnemonic to .env as DEPLOYER_MNEMONIC and fund this address on Vara testnet.");
}

main().catch((error) => {
  console.error("Wallet generation failed:", error);
  process.exit(1);
});
