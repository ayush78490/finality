import { Keyring } from "@polkadot/keyring";

/** Vara Network SS58 prefix — matches Subwallet / Gear on Vara. */
export const VARA_SS58_FORMAT = 137;

export function createVaraKeyring(): Keyring {
  return new Keyring({ type: "sr25519", ss58Format: VARA_SS58_FORMAT });
}
