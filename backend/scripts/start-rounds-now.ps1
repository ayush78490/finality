# One-shot: settle expired rounds + approve FIN + start fresh rounds for all feeds.
# Usage (from repo root): .\scripts\start-rounds-now.ps1

param(
  [string]$LiquiditySeedFin = "",  # e.g. "50000000000000" for 50 FIN; default 100 FIN
  [string]$FeeBps = "100"          # 1% default
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) { throw "Missing $envPath" }

Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*DEPLOYER_MNEMONIC=(.+)$') {
    $env:BOOTSTRAP_MNEMONIC = $Matches[1].Trim()
  }
}
if (-not $env:BOOTSTRAP_MNEMONIC) { throw "DEPLOYER_MNEMONIC not found in .env" }

$env:MARKET_PROGRAM_ID = "0x591d0ba0f195b24f065347e7b666502680c447258b1fc78dc3667df6047b1a95"
$env:FIN_PROGRAM_ID    = "0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a"
$env:VARA_WS_ENDPOINT  = "wss://testnet.vara.network"
$env:FEE_BPS           = $FeeBps
if ($LiquiditySeedFin) { $env:LIQUIDITY_SEED_FIN = $LiquiditySeedFin }

Set-Location (Join-Path $root "services\dia-relayer")
npx tsx src/start-rounds.ts
