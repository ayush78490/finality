# Finality market program (on-chain)

This folder defines the **Sails IDL** that the:

- **DIA relayer** (`services/dia-relayer`) targets for `Fin.PushPrice`.
- **Frontend / indexer** use for queries and user transactions.

## Deploy flow

1. Implement `sails.idl` in a Rust Gear project (see [Sails](https://wiki.vara.network/docs/developing/build/sails)).
2. Build WASM + upload/instantiate on Vara testnet via Gear IDEA.
3. Copy `Program ID` into `config/oracle.config.json` → `marketProgramId`.
4. Start relayer with `RELAYER_MNEMONIC` + same `VARA_WS_ENDPOINT`.
5. Register assets and open rounds via admin account (`Fin` service).

## FIN token

Collateral is your deployed FIN VFT. Traders need FIN on testnet:

- Run **testnet faucet** (`services/testnet-faucet`) *or* manual `VftAdmin.Mint` from treasury.

See root `README.md` and `docs/TESTNET.md`.
