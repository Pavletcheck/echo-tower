# Builds the game and publishes it to GitHub Pages (gh-pages branch).
# Usage: powershell -ExecutionPolicy Bypass -File .\deploy.ps1
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$remote = (git -C $PSScriptRoot remote get-url origin 2>$null)
if (-not $remote) { throw 'origin remote is not configured' }
$remote = $remote.Trim()

$env:NODE_OPTIONS = '--max-old-space-size=2048'
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed with exit code $LASTEXITCODE" }

$stage = Join-Path $env:TEMP 'echo-tower-pages'
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot 'dist\*') -Destination $stage -Recurse
New-Item -ItemType File -Path (Join-Path $stage '.nojekyll') -Force | Out-Null

git -C $stage init -q -b gh-pages
git -C $stage add -A
git -C $stage -c user.name='echo-tower-deploy' -c user.email='deploy@users.noreply.github.com' commit -q -m 'Deploy web build'
git -C $stage remote add origin $remote
git -C $stage push -f origin gh-pages
if ($LASTEXITCODE -ne 0) { throw "push failed with exit code $LASTEXITCODE" }

Write-Host 'Deployed: https://pavletcheck.github.io/echo-tower/'
