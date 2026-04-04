# Run from repo root. Requires Docker Desktop. Builds Next.js in Linux and copies .next into apps/web.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker build -f apps/web/Dockerfile -t finality-web-build .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$cid = docker create finality-web-build
if (-not $cid) { throw "docker create failed" }
try {
  if (Test-Path "apps/web/.next") { Remove-Item -Recurse -Force "apps/web/.next" }
  docker cp "${cid}:/build/apps/web/.next" "apps/web/.next"
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed" }
  Write-Host "OK: apps/web/.next synced from Docker image."
} finally {
  docker rm $cid 2>$null
}
