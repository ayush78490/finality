/**
 * Verifies the Sails IDL file exists for Gear IDEA "Add metadata / Sails".
 * Run: npm run check:gear-idea-idl
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const idlPath = path.join(repoRoot, "programs", "finality-market", "artifacts", "finality-market-app.idl");

function main() {
  if (!existsSync(idlPath)) {
    console.error(`Missing IDL: ${idlPath}`);
    console.error("Generate with: npm run idl:market (from repo root)");
    process.exit(1);
  }
  const text = readFileSync(idlPath, "utf8");
  if (!text.includes("service Fin")) {
    console.error(`IDL at ${idlPath} does not look like finality-market (no 'service Fin').`);
    process.exit(1);
  }
  console.log("Gear IDEA — attach this file under Codes → your WASM → Add metadata / Sails:\n");
  console.log(idlPath);
  console.log(
    "\nIf IDEA still shows 'decodePayload' with metadata attached, the message payload may be invalid/too short, or an IDEA UI bug — see programs/finality-market/README.md (Gear IDEA section)."
  );
  process.exit(0);
}

main();
