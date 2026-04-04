# Live DIA relayer: uses DEPLOYER_MNEMONIC from repo root .env as RELAYER_MNEMONIC.
$ErrorActionPreference = "Stop"
$repo = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $repo "services\dia-relayer")
. (Join-Path $repo "scripts\load-root-mnemonic.ps1")
$env:DRY_RUN = "false"
$env:VARA_WS_ENDPOINT = "wss://testnet.vara.network"
$env:MARKET_PROGRAM_ID = "0x591d0ba0f195b24f065347e7b666502680c447258b1fc78dc3667df6047b1a95"
npm start
