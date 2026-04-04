import { readFileSync } from "node:fs";
import { z } from "zod";

const tokenSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(18),
  tokenId: z.string().min(1),
  maxSupplyWholeTokens: z.string().regex(/^\d+$/),
  maxSupplyBaseUnits: z.string().regex(/^\d+$/),
  mintable: z.boolean(),
  governanceEnabled: z.boolean()
});

const rootSchema = z.object({
  network: z.string().min(1),
  token: tokenSchema
});

function main() {
  const raw = readFileSync("config/token.config.json", "utf8");
  const parsed = rootSchema.parse(JSON.parse(raw));

  const maxWhole = BigInt(parsed.token.maxSupplyWholeTokens);
  const maxBase = BigInt(parsed.token.maxSupplyBaseUnits);
  const expectedBase = maxWhole * (10n ** BigInt(parsed.token.decimals));

  if (maxBase !== expectedBase) {
    throw new Error(
      `maxSupplyBaseUnits mismatch. Expected ${expectedBase}, got ${maxBase}`
    );
  }

  console.log("Config is valid.");
  console.log(`Network: ${parsed.network}`);
  console.log(
    `Token: ${parsed.token.name} (${parsed.token.symbol}), decimals=${parsed.token.decimals}`
  );
  console.log(`Hard cap base units: ${parsed.token.maxSupplyBaseUnits}`);
}

main();
