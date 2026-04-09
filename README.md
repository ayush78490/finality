# Finality on Vara

Finality is a full-stack prediction market system on Vara/Gear with:

- a Rust smart contract for round lifecycle, settlement, and payouts,
- FIN token operations and treasury tooling,
- backend automation for market rounds and oracle submission,
- a Next.js frontend for trading, faucet, profile, and admin workflows.

This repository is a monorepo and is organized for testnet-first operations.

## Production Oracle Reality

Important: backend production flow uses your custom oracle path on Vara network. It does not rely on DIA as the production data source.

- The folder name `backend/dia-relayer` is historical.
- The active operational path is the round manager plus custom oracle integration (`ORACLE_KEEPER_URL`, optional keeper-only mode).
- The old DIA polling loop exists only as a legacy compatibility path and is disabled unless explicitly turned on.

If you are operating this system in production, treat DIA-related logic as legacy tooling only, not an active oracle source.

## System Overview

Finality has four major runtime areas:

1. Smart contract layer (`smart-contracts/finality-market`)
2. Backend automation and ops scripts (`backend`, `backend/scripts`)
3. Frontend application (`frontend`)
4. Optional faucet service (`backend/testnet-faucet`)

High-level lifecycle:

1. Oracle data is submitted to the market program.
2. Rounds are settled when expired.
3. New rounds are started with configured seed liquidity and fee settings.
4. Traders interact through the web app.
5. Claims and treasury checks are performed through script/tooling workflows.

## Repository Structure

- `smart-contracts/finality-market`: Rust/Sails contract workspace (app + wasm + artifacts)
- `backend`: backend round engine, bootstrap, verification, oracle integration
- `backend/scripts`: deployment, config validation, faucet diagnosis, treasury checks, utility scripts
- `backend/testnet-faucet`: Express service for FIN distribution in test environments
- `frontend`: Next.js application (market UI, faucet UI, profile, admin, wallet integration)
- `config`: source-of-truth deployment/config JSON files
- `docs`: architecture and operational notes

## Core Components

### Smart Contracts

`smart-contracts/finality-market` contains the on-chain market logic:

- initialization and admin configuration,
- oracle tick handling,
- per-asset round state,
- AMM-style side trading,
- settlement and claim logic,
- FIN token integration for collateral.

Artifacts and metadata in this package are used for Gear IDEA uploads and client interoperability.

### Backend Round and Oracle Operations

`backend/dia-relayer` is the main backend runtime package.

Key scripts:

- `round-manager`: primary operational loop for settle/start orchestration
- `bootstrap`: one-time initialization (`Fin.init`, asset registration)
- `verify-market`: read-only checks for market initialization and registered assets
- `verify-faucet`: read-only faucet capability verification
- `start-rounds` and `settle-expired`: targeted ops flows

Legacy script:

- `start` (`src/index.ts`) contains legacy DIA continuous polling and is disabled unless explicitly enabled.

Custom oracle integration:

- `src/oracle-keeper.ts` integrates with an external keeper service (`GET /health`, `POST /resolve`).
- This is the intended integration point for your custom Vara oracle automation.

### Backend Utility Scripts

`backend/scripts` provides task-focused operations, including:

- token deploy and mint support,
- market bootstrap wrappers,
- faucet readiness and diagnostics,
- treasury checks,
- config validation,
- utility wallet generation.

These scripts are designed for operators and deployment workflows.

### Frontend Application

`frontend` is a Next.js app with:

- market listing and per-market consoles,
- wallet connection and on-chain action wiring,
- faucet claim UI,
- profile/position views,
- admin-oriented fixture and market management surfaces.

Primary user routes include `/`, `/market/[asset]`, `/faucet`, `/profile`, and `/admin`.

### Testnet Faucet Service

`backend/testnet-faucet` is an optional HTTP minter service for controlled FIN distribution in test setups.

- endpoint: `POST /claim`
- supports SS58 and hex-format addresses
- includes rate limiting and configurable mint amount

## Configuration and Source-of-Truth Files

Configuration is centralized in `config`:

- `config/oracle.config.json`: market program id, feed list, polling/age settings, oracle notes
- `config/deployed.market.json`: deployed market program id per environment block
- `config/deployed.token.json`: deployed FIN token program id per environment block
- `config/token.config.json`: token-level metadata and supply configuration

For production safety, keep these files aligned before running frontend/backend services.

## Prerequisites

Required tooling:

- Node.js 18 to 22
- npm
- Rust toolchain with wasm target support for Gear/Vara builds
- access to Vara testnet endpoints
- funded operator accounts for gas where applicable

## Setup Flow

Recommended bring-up flow:

1. Install root dependencies with npm in repository root.
2. Build and deploy smart contracts from `smart-contracts/finality-market`.
3. Update program ids in `config/deployed.market.json`, `config/deployed.token.json`, and `config/oracle.config.json`.
4. Provide environment values in root `.env` and backend package `.env` where required.
5. Run market bootstrap via `npm run bootstrap:market`.
6. Validate readiness via `npm run faucet:ready` and backend verification scripts.
7. Start backend round automation using round manager.
8. Start frontend with `npm run dev` from repository root.

## Script Catalog

### Root Scripts

- `npm run idl:market`: generate market IDL from contract workspace
- `npm run check:gear-idea-idl`: validate expected IDL path/availability
- `npm run deploy:fin`: deploy FIN token program
- `npm run mint:fin`: mint FIN supply according to configured flow
- `npm run check:config`: validate oracle config schema and structure
- `npm run step1:all`: one-shot setup helper flow
- `npm run wallet:new`: generate a new wallet
- `npm run faucet:to`: manual faucet transfer helper
- `npm run treasury:check`: inspect market treasury balance
- `npm run faucet:diagnose`: diagnose faucet claim failures
- `npm run faucet:ready`: simulate/verify faucet readiness
- `npm run dev`: run frontend development server
- `npm run build:web`: build frontend production bundle
- `npm run build:web:docker`: build frontend docker image
- `npm run build:web:docker:sync`: sync frontend build output from docker flow
- `npm run build:web:ntfs`: Windows-friendly web build helper
- `npm run bootstrap:market`: execute backend bootstrap from root
- `npm run emergency:init`: emergency initialization helper

### Backend Round Package Scripts (`backend/dia-relayer`)

- `npm run bootstrap`: initialize market and register assets
- `npm run emergency-init`: emergency init routine
- `npm run round-manager`: main settle/start automation loop
- `npm run start-rounds`: targeted start-round automation
- `npm run settle-expired`: settle-only routine for expired rounds
- `npm run verify-market`: read-only initialization and registration checks
- `npm run verify-faucet`: read-only faucet state checks
- `npm run start`: legacy DIA polling loop (non-production, opt-in only)

### Frontend Scripts (`frontend`)

- `npm run dev`: start local Next.js app on port 3000
- `npm run build`: production build
- `npm run start`: run built app
- `npm run lint`: lint frontend

### Faucet Scripts (`backend/testnet-faucet`)

- `npm run start`: run HTTP faucet server

## Environment Variables

Operationally important environment values include:

- network and endpoint values (`VARA_WS_ENDPOINT`)
- signer mnemonics for deploy/admin/oracle/faucet roles
- market and token program ids
- round manager safety toggles and behavior flags
- optional custom oracle keeper URL and keeper fallback controls

Do not commit real mnemonics, API tokens, or private credentials.

## Oracle and Round Management Notes

Current production policy for this repository:

- custom Vara oracle flow is primary,
- round manager orchestrates settle/start actions,
- DIA logic is legacy and should remain disabled in production.

If you use keeper-only operation, confirm your keeper health endpoint and resolve endpoint are reachable before enabling transaction sending.

## Troubleshooting Pointers

Common issues and checks:

- Faucet claim fails: verify `Fin.init` completed, market treasury has FIN balance, and market program id is correct.
- Missing market behavior: run `verify-market` and inspect asset registration coverage.
- Wrong balance display: ensure frontend and backend are pointed to the same deployed ids in `config`.
- Round loop appears idle: verify round manager send toggle and oracle/keeper connectivity.

## Documentation Status

Some historical docs still reference DIA-first flows and older path names. This root README reflects the current repository structure and operational direction.

## Technology Stack

- Vara / Gear
- Rust + Sails
- TypeScript + Node.js
- Next.js + React + Tailwind CSS
- Gear JS and Polkadot ecosystem libraries

## External References

- Vara developers: https://vara.network/developers
- Gear ecosystem: https://gear-tech.io
- DIA docs (legacy reference only): https://www.diadata.org/docs/home
