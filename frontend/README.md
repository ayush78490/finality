# Finality web (Next.js)

Production-oriented UI **inspired by** short-horizon prediction terminals — **not** a visual clone of any third-party product.

## What it does today

- **Markets hub** at `/` with asymmetric cards, typography, and calm motion-free layout.
- **Room** at `/market/[asset]` with:
  - **live DIA** price from the public REST API (poll every ~2.5s),
  - manual **price-to-beat** field (until wired to `get_round` read-state),
  - wallet connect via Polkadot extension,
  - trade panel **stub** ready for `Fin.buy_side` extrinsic + FIN approval flow.

## Env

Copy `.env.example` → `.env.local`.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Page looks like plain HTML (no dark theme / blue links)

Tailwind CSS did not apply. From `apps/web`: delete `.next`, run `npm run dev` again, hard-refresh the browser (Ctrl+Shift+R). Confirm you started the dev server **in this folder** (`cd apps/web`). If styles are still missing, check the terminal for PostCSS/Tailwind errors.

### Windows path note

Avoid project roots like `D:\vara ...` where `D:\v` produces an accidental **`\v` escape** inside tool-generated strings during `next build`. Prefer `D:\varanetwork` or `C:\dev\vara-network`.

## Next wiring (short list)

1. Deploy `programs/finality-market` → set `NEXT_PUBLIC_MARKET_PROGRAM_ID`.
2. Read `Fin.getRound` / `Fin.getTick` via `@gear-js/api` state RPC for authoritative numbers.
3. Replace trade stub with signed `message.send` using program metadata from `cargo sails idl`.
4. Add indexer subscription for filled trades / pool ratios when you emit events.
