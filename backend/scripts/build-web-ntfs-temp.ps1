# Build apps/web on NTFS (system temp on C:) to avoid exFAT EISDIR/webpack readlink on D:.
# Run from repo root: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-web-ntfs-temp.ps1
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dest = Join-Path ([System.IO.Path]::GetTempPath()) ("finality-web-build-" + [Guid]::NewGuid().ToString("n").Substring(0, 8))
Write-Host "Staging build in: $dest"

New-Item -ItemType Directory -Path $dest -Force | Out-Null
try {
  robocopy (Join-Path $root "config") (Join-Path $dest "config") /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -gt 8) { throw "robocopy config failed: $LASTEXITCODE" }
  robocopy (Join-Path $root "apps\web") (Join-Path $dest "apps\web") /E /XD node_modules .next /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  if ($LASTEXITCODE -gt 8) { throw "robocopy apps/web failed: $LASTEXITCODE" }

  $web = Join-Path $dest "apps\web"
  Push-Location $web
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  Pop-Location

  $nextSrc = Join-Path $web ".next"
  $nextDst = Join-Path $root "apps\web\.next"
  if (Test-Path $nextDst) { Remove-Item -Recurse -Force $nextDst }
  Copy-Item -Path $nextSrc -Destination $nextDst -Recurse -Force
  Write-Host "OK: copied .next to $nextDst"
} finally {
  Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
}
