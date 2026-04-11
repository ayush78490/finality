# `finality-market` (Rust / Gear Sails)

On-chain program: **FIN-only collateral** (fixed extended VFT program id), **oracle ticks** from an authorized relayer, **rounds**, **CPMM-style** side shares, **settlement**, and **claim** payouts.

## Build WASM (testnet upload)

```bash
cd programs/finality-market
rustup target add wasm32v1-none
cargo build -p finality-market --release --target wasm32v1-none
```

Artifacts:

- **Optimized:** `target/wasm32v1-none/wasm32-gear/release/finality_market.opt.wasm`
- **Raw:** `target/wasm32v1-none/release/finality_market.wasm`

Upload **`*.opt.wasm`** in Gear IDEA.

### Gear IDEA — Sails metadata (recommended)

After upload, IDEA shows **“There is no metadata yet”** until you attach the interface. Without it, the UI cannot build correct **SCALE** payloads for `Fin.*` calls (you may see **`Unexpected service: …`** panics).

**On-chain panic `Unexpected service: 0x46696e`:** `0x46696e` is only the ASCII bytes for `"Fin"` (no SCALE length prefix, no method name). That is **not** how Sails encodes the `Fin` service — valid bytes are much longer (see `sails-scale.ts` / `apps/web/lib/sails-payload.ts`). This usually comes from **pasting wrong hex** or a **bad manual send** in IDEA, **not** from the web app or relayer. **Fix:** send messages via **Send message** with metadata, or use this repo’s UI / `npm run bootstrap` / relayer — do **not** use `0x46696e` as a payload.

#### `Cannot read properties of undefined (reading 'decodePayload')`

That string is thrown **inside Gear IDEA’s** frontend (`idea.gear-tech.io`), not by your Rust program. It usually means the UI’s decoder hit an **undefined** object (a bug or an edge case in their `@gear-js`/Sails integration).

**Metadata can be attached and this error can still appear** — for example on a **specific message** whose payload is **not** valid Sails SCALE for this program (too short, wrong bytes, or from another tool), or when IDEA’s **Messages** tab uses a different code path than **Metadata/Sails**. Your screenshot showing **Types** under Metadata/Sails only proves the IDL is stored for the program; it does not guarantee every message row decodes cleanly.

**What to try:**

1. Open the **same** message and note the **payload hex**. If it is only a few bytes (e.g. **`0x46696e`** = ASCII `"Fin"`), it is **not** a full `Fin.*` handle — the UI may crash instead of showing a friendly error. Use **Send message** from IDEA (with metadata) or payloads from this repo’s `encodeFin*` helpers / relayer logs.
2. Hard refresh (Ctrl+F5) or another browser; update Gear IDEA if a newer **version** is available (bottom-left in the app).
3. If it persists on **valid** long payloads, treat it as an **IDEA bug** — report to [Gear](https://github.com/gear-tech) with program id, message id, payload hex, and IDEA version. On-chain execution is unaffected; use block explorer raw payload if needed.

**If metadata was never attached:** open **Codes** → your WASM → **Add metadata / Sails** → **`artifacts/finality-market-app.idl`**. From repo root: `npm run check:gear-idea-idl` prints the file path.

1. From this folder, generate the IDL (or use the committed `artifacts/finality-market-app.idl`):

   ```bash
   cargo sails idl --manifest-path wasm/Cargo.toml
   ```

   From repo root you can also run: `npm run idl:market` (the CLI prints where the `.idl` was written — often under a temp directory on Windows; the repo keeps a copy at **`artifacts/finality-market-app.idl`** for uploads).

2. On the **Codes** page for your upload, click **Add metadata/sails** and attach the **`.idl`** file (use the committed **`artifacts/finality-market-app.idl`** unless you regenerated after changing the API).

*(On Windows, if the command fails with “Access is denied” under `target\`, close other builds and retry, or use a clean terminal.)*

### Gear IDEA — initial payload (important)

The program constructor is **`create()`** (Sails route **`Create`**). If you leave **Initial payload** as **`0x`**, upload fails with:

`Unexpected ctor: 0x`

Set **Initial payload type** to **Bytes** and use this **hex** (Scale-encoded string `"Create"`):

```text
0x18437265617465
```

(Also saved under `artifacts/gear-constructor-payload.hex`.)

Set a **non-zero gas limit** if the UI allows (use **Calculate** or a safe default for your network). **Initial value** can stay `0` unless you need to fund the program on upload.

##### “Message ran out of gas” and “Code already exists”

Uploading WASM and creating the program are **separate**: the chain stores your **code once** (by hash). If **UploadProgram** succeeded but **initialization** failed with **“Message ran out of gas while executing”**, the bytecode is **already** stored. Uploading the **same** file again shows **“Code already exists”** — that is expected; **do not** rely on re-uploading to fix gas.

**What to do:** In Gear IDEA, use the **existing uploaded code** (same code id / hash as in the error) and **create a new program** (or retry initialization) with the **same** constructor payload `0x18437265617465` and a **higher gas limit** (use **Calculate**, then bump with **+10%** several times, or enter a larger limit if the UI allows). You can create **multiple program instances** from the same uploaded code; each gets its own program id.

After the program is created, run **`npm run bootstrap`** from `backend/finality-oracle` (with `MARKET_PROGRAM_ID`, `BOOTSTRAP_MNEMONIC`, `RELAYER_MNEMONIC` in `.env`). That sends **`Fin.init`** and **`Fin.register_asset`** for every feed in `config/oracle.config.json` using correct Sails SCALE encoding, and **waits** until `Fin.init` is processed before registering assets. Bootstrap applies a **minimum handle gas** (`BOOTSTRAP_HANDLE_MIN_GAS`, default `250000000000`) because RPC `calculateGas` can return a `min_limit` far below what execution actually needs — raising the limit avoids **`Fin.init` running out of gas** while the extrinsic still lands. If **`npm run verify-market`** stays **`initialized: false`** after bootstrap, open the **`Fin.init`** message in the explorer or Gear IDEA and confirm it **succeeded** (not failed / out of gas); the program id must match the uploaded **finality-market** WASM.

Manual **`Fin.init`** parameters (if not using bootstrap):

- `admin`, `round_seconds` (e.g. `300`), `oracle_authority` (must match `RELAYER_MNEMONIC`), `max_oracle_age_secs`

Collateral is **always** the FIN program `FIN_TOKEN_PROGRAM` in `app/src/lib.rs` (testnet id `0x5e5e…103a`).

## IDL (for clients)

```bash
cargo sails idl --manifest-path wasm/Cargo.toml
```

This emits the authoritative `*.idl` for `@gear-js` / TypeScript clients (run from this folder).

**Gear IDEA:** On **Codes** → your uploaded WASM → **Add metadata / Sails**, attach `artifacts/finality-market-app.idl` (or the file produced by the command above). Without it, the UI cannot decode payloads and may show **`Cannot read properties of undefined (reading 'decodePayload')`** when opening a message.

**Wrong manual payload:** A handle message must be full **Sails SCALE** bytes (compact service name + method + args), not the raw ASCII for `"Fin"`. For example `0x46696e` is only three bytes (`F` `i` `n`) and is **invalid** — use **Send message** built from metadata after attaching the IDL, or copy the hex from `backend/finality-oracle` logs / `encodeFin*` helpers in `sails-scale.ts`.

## Service shape

- `Program::create` (constructor)
- Service **`Fin`**: `init`, `push_price` (oracle only), `register_asset`, `start_round`, `buy_side`, `settle_round`, `claim`, queries `get_tick`, `get_round`, `get_position`, `fin_token`, etc.

The TypeScript oracle runtime encodes handle messages as **Sails SCALE**: `Fin` + `PushPrice` + args (see `backend/finality-oracle/src/sails-scale.ts`). Do **not** pass plain `{ Fin: { … } }` objects to `api.message.send` without metadata — that encoding does not match on-chain dispatch.

Traders must **approve** the market program on FIN before `buy_side` / admins before `start_round` (seed liquidity).

## Production follow-ups

- Replace `static mut` state with Sails-native program storage when you refactor.
- Emit **events** for indexers; add **admin fee withdrawal** from per-round `fee_acc`.
- Harden oracle (**confidence** bounds, multi-sig, etc.) and add **tests** / audit before mainnet.
