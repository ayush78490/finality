/**
 * Windows: warn if the project lives on exFAT — `next build` / webpack often fails with
 * EISDIR: illegal operation on a directory, readlink
 */
const { execSync } = require("child_process");

if (process.platform !== "win32") {
  process.exit(0);
}

const cwd = process.cwd();
const m = /^([A-Za-z]):/.exec(cwd);
if (!m) {
  process.exit(0);
}
const letter = m[1].toUpperCase();

try {
  const out = execSync(`fsutil fsinfo volumeinfo ${letter}:`, { encoding: "utf8" });
  if (out.includes("exFAT")) {
    console.warn(
      "\n[finality-web] This drive is exFAT. Next.js production builds often fail with EISDIR/readlink.\n" +
        "  Options: (1) Clone or copy the repo to an NTFS volume (e.g. C:\\) and run `npm run build` there.\n" +
        "  (2) From repo root: `npm run build:web:docker` (requires Docker), then copy `.next` out of the image — see apps/web/Dockerfile.\n"
    );
  }
} catch {
  // ignore
}
