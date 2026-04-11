import { Keyring } from "@polkadot/keyring";

/** Vara Network SS58 prefix (see ss58-registry / Polkadot docs). */
export const VARA_SS58_FORMAT = 137;

/** Keyring configured for Vara testnet/mainnet address encoding (`kG…`). */
export function createVaraKeyring(): Keyring {
  return new Keyring({ type: "sr25519", ss58Format: VARA_SS58_FORMAT });
}
