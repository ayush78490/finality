# Loads DEPLOYER_MNEMONIC from repo root .env into RELAYER_MNEMONIC / BOOTSTRAP_MNEMONIC.
# Usage (from repo root): . .\scripts\load-root-mnemonic.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) { throw "Missing $envPath" }
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*DEPLOYER_MNEMONIC=(.+)$') {
    $m = $Matches[1].Trim()
    $env:RELAYER_MNEMONIC = $m
    $env:BOOTSTRAP_MNEMONIC = $m
  }
}
if (-not $env:RELAYER_MNEMONIC) { throw "DEPLOYER_MNEMONIC not found in .env" }
