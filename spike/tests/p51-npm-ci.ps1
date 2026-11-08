# P5.1: npm ci for better-sqlite3 12.x and sharp 0.34.x; prebuilt packages must be used.
param(
    [Parameter(Mandatory)] [string]$Label,
    [Parameter(Mandatory)] [string]$ResultsDir
)
$ErrorActionPreference = 'Stop'
$appDir = (Resolve-Path (Join-Path $PSScriptRoot '..\proto\app')).Path
$outDir = Join-Path $ResultsDir 'p51'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$log = Join-Path $outDir "npm-ci-$Label.log"

if (Test-Path (Join-Path $appDir 'node_modules')) { Remove-Item -Recurse -Force (Join-Path $appDir 'node_modules') }

$nodeVersion = (& node --version).Trim()
$npmVersion = (& npm --version).Trim()
$sw = [Diagnostics.Stopwatch]::StartNew()
Push-Location $appDir
try {
    cmd.exe /d /s /c "npm ci --foreground-scripts --loglevel verbose > `"$log`" 2>&1"
    $exitCode = $LASTEXITCODE
}
finally { Pop-Location }
$durationMs = $sw.ElapsedMilliseconds

$lines = Get-Content -Path $log
$gypLines = @($lines | Where-Object { $_ -match '\bgyp (info|verb|WARN|ERR!)' })
# The echoed install script "prebuild-install || node-gyp rebuild --release" is not a rebuild.
$rebuildLines = @($lines | Where-Object { $_ -match 'node-gyp rebuild' -and $_ -notmatch 'prebuild-install \|\|' })
$prebuiltLines = @($lines | Where-Object { $_ -match 'prebuild-install info install Successfully installed prebuilt binary' })
$bsBinary = Join-Path $appDir 'node_modules\better-sqlite3\build\Release\better_sqlite3.node'
$sharpWin = Join-Path $appDir 'node_modules\@img\sharp-win32-x64'

function Get-PkgVersion([string]$name) {
    $pkg = Join-Path $appDir "node_modules\$name\package.json"
    if (Test-Path $pkg) { (Get-Content $pkg -Raw | ConvertFrom-Json).version } else { $null }
}

$passed = ($exitCode -eq 0) -and ($gypLines.Count -eq 0) -and ($rebuildLines.Count -eq 0) -and
    ($prebuiltLines.Count -ge 1) -and (Test-Path $bsBinary) -and (Test-Path $sharpWin)

$result = [ordered]@{
    label                 = $Label
    node                  = $nodeVersion
    npm                   = $npmVersion
    exitCode              = $exitCode
    durationMs            = $durationMs
    gypLineCount          = $gypLines.Count
    nodeGypRebuildLines   = $rebuildLines.Count
    prebuiltInstalledLine = ($prebuiltLines | Select-Object -First 1)
    betterSqlite3Binary   = (Test-Path $bsBinary)
    sharpWin32x64Present  = (Test-Path $sharpWin)
    versions              = [ordered]@{
        'better-sqlite3'     = Get-PkgVersion 'better-sqlite3'
        'sharp'              = Get-PkgVersion 'sharp'
        '@img/sharp-win32-x64' = Get-PkgVersion '@img/sharp-win32-x64'
    }
    passed                = $passed
    log                   = "p51/npm-ci-$Label.log"
}
$result | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $outDir "p51-$Label.json") -Encoding utf8
$result | ConvertTo-Json -Depth 5
if ($env:GITHUB_OUTPUT) { "passed=$($passed.ToString().ToLower())" | Add-Content -Path $env:GITHUB_OUTPUT }
