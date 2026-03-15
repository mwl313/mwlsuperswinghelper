$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$apiDir = Join-Path $root "services\\api"
$webDir = Join-Path $root "apps\\web"
$venvDir = Join-Path $apiDir ".venv"
$venvPython = Join-Path $venvDir "Scripts\\python.exe"
$requirements = Join-Path $apiDir "requirements.txt"
$depsStamp = Join-Path $venvDir ".deps_stamp"
$rootEnv = Join-Path $root ".env.example"
$apiEnv = Join-Path $apiDir ".env"
$webEnv = Join-Path $webDir ".env.local"

Write-Host "[setup] root: $root"

if (!(Test-Path $venvPython)) {
  Write-Host "[setup] creating python venv..."
  Push-Location $apiDir
  try {
    python -m venv .venv
  } finally {
    Pop-Location
  }
}

$needPipInstall = $true
if ((Test-Path $depsStamp) -and (Test-Path $requirements)) {
  $reqTime = (Get-Item $requirements).LastWriteTimeUtc
  $stampTime = (Get-Item $depsStamp).LastWriteTimeUtc
  if ($stampTime -ge $reqTime) {
    $needPipInstall = $false
  }
}

if ($needPipInstall) {
  Write-Host "[setup] installing backend requirements..."
  & $venvPython -m pip install -r $requirements
  Set-Content -Path $depsStamp -Value (Get-Date).ToString("o")
} else {
  Write-Host "[setup] backend requirements already up to date."
}

if (!(Test-Path $apiEnv)) {
  Write-Host "[setup] creating services/api/.env"
  Copy-Item $rootEnv $apiEnv
}

if (!(Test-Path $webEnv)) {
  Write-Host "[setup] creating apps/web/.env.local"
  Copy-Item $rootEnv $webEnv
}

if (!(Test-Path (Join-Path $webDir "node_modules"))) {
  Write-Host "[setup] installing frontend dependencies..."
  Push-Location $root
  try {
    npm --prefix apps/web install
  } finally {
    Pop-Location
  }
} else {
  Write-Host "[setup] frontend dependencies already installed."
}

Write-Host "[setup] done."
