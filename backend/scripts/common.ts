import "dotenv/config";
import { readFileSync } from "node:fs";
import { GearApi } from "@gear-js/api";
import { cryptoWaitReady, decodeAddress } from "@polkadot/util-crypto";
import { createVaraKeyring } from "./vara-keyring.js";
import { u8aToHex } from "@polkadot/util";

export const VFT_EXTENDED_PUBLIC_CODE_ID =
  "0x81663df58f48684923777cd8cf281bfd2e4ee427926abc52a1fcf4ecd41be7ad";

export type TokenConfig = {
  network: string;
  token: {
    name: string;
    symbol: string;
    decimals: number;
    tokenId: string;
    maxSupplyBaseUnits: string;
  };
  initialDistribution: {
    treasuryPercent: number;
    liquidityBootstrapPercent: number;
    rewardsPercent: number;
  };
};

export function readConfig(): TokenConfig {
  return JSON.parse(readFileSync("config/token.config.json", "utf8")) as TokenConfig;
}

export async function createApi(): Promise<GearApi> {
  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  return GearApi.create({ providerAddress: endpoint });
}

export async function getSigner() {
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("DEPLOYER_MNEMONIC is required in .env");
  }

  await cryptoWaitReady();
  const keyring = createVaraKeyring();
  return keyring.addFromMnemonic(mnemonic);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
  return value;
}

export function toActorId(value: string): string {
  if (value.startsWith("0x") && value.length === 66) {
    return value;
  }
  const bytes = decodeAddress(value);
  return u8aToHex(bytes);
}

export async function sendAndWait(tx: any, signer: any, api?: GearApi): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }: any) => {
      if (dispatchError) {
        if (dispatchError.isModule && api) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          reject(`${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`);
          return;
        }
        reject(dispatchError.toString());
        return;
      }
      if (status?.isInBlock || status?.isFinalized) {
        resolve();
      }
    }).catch(reject);
  });
}

export function splitInitialDistribution(maxSupplyBaseUnits: bigint, distribution: TokenConfig["initialDistribution"]) {
  const sum =
    distribution.treasuryPercent +
    distribution.liquidityBootstrapPercent +
    distribution.rewardsPercent;
  if (sum !== 100) {
    throw new Error(`Initial distribution percent must equal 100, got ${sum}`);
  }

  const treasury = (maxSupplyBaseUnits * BigInt(distribution.treasuryPercent)) / 100n;
  const lp = (maxSupplyBaseUnits * BigInt(distribution.liquidityBootstrapPercent)) / 100n;
  const rewards = maxSupplyBaseUnits - treasury - lp;

  return { treasury, lp, rewards };
}
