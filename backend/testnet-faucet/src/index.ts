import "dotenv/config";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GearApi } from "@gear-js/api";
import { createVaraKeyring } from "./vara-keyring.js";
import { u8aToHex } from "@polkadot/util";
import { cryptoWaitReady, decodeAddress } from "@polkadot/util-crypto";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bodySchema = z.object({
  address: z
    .string()
    .min(1)
    .describe("SS58 Vara address or 0x-prefixed 32-byte public key")
});

const TIP_STEP = 1_000_000n;
let _faucetTipSeq = 0n;

async function sendExtrinsic(api: GearApi, tx: any, signer: any) {
  const nonce = await (api.rpc as any).system.accountNextIndex(signer.address);
  let tip: bigint;
  try {
    const pf = BigInt((await tx.paymentInfo(signer.address)).partialFee.toString());
    _faucetTipSeq += 1n;
    tip = pf + _faucetTipSeq * TIP_STEP;
  } catch {
    _faucetTipSeq += 1n;
    tip = _faucetTipSeq * TIP_STEP;
  }

  await new Promise<void>((resolve, reject) => {
    tx.signAndSend(signer, { nonce, tip } as any, ({ status, dispatchError }: any) => {
      if (dispatchError) {
        if (dispatchError.isModule) {
          const meta = api.registry.findMetaError(dispatchError.asModule);
          reject(new Error(`${meta.section}.${meta.name}`));
        } else {
          reject(new Error(dispatchError.toString()));
        }
        return;
      }
      if (status?.isInBlock || status?.isFinalized) resolve();
    }).catch(reject);
  });
}

function loadFinProgramId(): string {
  const fromEnv = process.env.FIN_TOKEN_PROGRAM_ID?.trim();
  if (fromEnv) return fromEnv;
  const p = path.resolve(__dirname, "../../..", "config", "deployed.token.json");
  const j = JSON.parse(readFileSync(p, "utf8")) as {
    varaTestnet: { finTokenProgramId: string };
  };
  return j.varaTestnet.finTokenProgramId;
}

async function main() {
  const port = Number(process.env.FAUCET_PORT ?? "8787");
  const endpoint = process.env.VARA_WS_ENDPOINT ?? "wss://testnet.vara.network";
  const mnemonic = process.env.FAUCET_MINTER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("FAUCET_MINTER_MNEMONIC must be set (wallet with VftAdmin.Mint)");
  }

  const amount = BigInt(
    process.env.FAUCET_AMOUNT_BASE_UNITS ?? String(1_000n * 10n ** 12n)
  );
  const gasLimit = BigInt(process.env.FAUCET_GAS_LIMIT ?? "150000000000");

  await cryptoWaitReady();
  const api = await GearApi.create({ providerAddress: endpoint });
  const keyring = createVaraKeyring();
  const signer = keyring.addFromMnemonic(mnemonic);

  const programId = loadFinProgramId();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "32kb" }));

  const limiter = rateLimit({
    windowMs: Number(process.env.FAUCET_WINDOW_MS ?? 86_400_000),
    max: Number(process.env.FAUCET_MAX_PER_WINDOW ?? 5),
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use("/claim", limiter);

  app.post("/claim", async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }

    const recipient = parsed.data.address.trim();
    let actorHex: string;
    try {
      if (recipient.startsWith("0x") && recipient.length === 66) {
        actorHex = recipient;
      } else {
        actorHex = u8aToHex(decodeAddress(recipient));
      }
    } catch {
      res.status(400).json({ error: "invalid_address" });
      return;
    }

    try {
      const payload = {
        VftAdmin: {
          Mint: [actorHex, amount.toString()]
        }
      };

      const tx = api.message.send(
        {
          destination: programId as `0x${string}`,
          payload,
          gasLimit,
          value: 0
        },
        undefined,
        undefined
      );

      await sendExtrinsic(api, tx, signer);
      res.json({ ok: true, amount: amount.toString(), to: actorHex, programId });
    } catch (error: any) {
      res.status(500).json({ error: error?.message ?? String(error) });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, programId, amount: amount.toString() });
  });

  app.listen(port, () => {
    console.log(`Faucet listening on :${port} program=${programId}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
