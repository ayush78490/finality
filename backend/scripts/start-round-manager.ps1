# Starts the round-manager (auto-settle + restart rounds for all feeds).
# Run ONCE per session; it loops forever, checking every 15 seconds.
# Usage (from repo root): .\scripts\start-round-manager.ps1

param(
  [string]$LiquiditySeedFin = "",   # e.g. "50000000000000" for 50 FIN
  [string]$FeeBps = "100",          # 1% default
  [string]$RoundCheckMs = "15000"   # check every 15 s
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) { throw "Missing $envPath — run .\scripts\generate-wallet.ts first" }

# Load deployer mnemonic
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*DEPLOYER_MNEMONIC=(.+)$') {
    $env:BOOTSTRAP_MNEMONIC = $Matches[1].Trim()
  }
}
if (-not $env:BOOTSTRAP_MNEMONIC) { throw "DEPLOYER_MNEMONIC not found in .env" }

$env:MARKET_PROGRAM_ID  = "0x591d0ba0f195b24f065347e7b666502680c447258b1fc78dc3667df6047b1a95"
$env:FIN_PROGRAM_ID     = "0x5e5e6163bc512f3f552fad1382517695e2413c2a9583d85cf719dcd3807c103a"
$env:VARA_WS_ENDPOINT   = "wss://testnet.vara.network"
$env:FEE_BPS            = $FeeBps
$env:ROUND_CHECK_MS     = $RoundCheckMs
if ($LiquiditySeedFin) { $env:LIQUIDITY_SEED_FIN = $LiquiditySeedFin }

Write-Host "Starting round-manager (Ctrl+C to stop)..." -ForegroundColor Cyan
Set-Location (Join-Path $root "services\dia-relayer")
npx tsx src/round-manager.ts
