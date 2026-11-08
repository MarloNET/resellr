# Builds the spike prototype: Node runtime, resellr-node.exe, staged app, installer.
param(
    [Parameter(Mandatory)] [string]$BuildDir,
    [Parameter(Mandatory)] [string]$ResultsDir
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$proto = Join-Path $repo 'spike\proto'
$appSrc = Join-Path $proto 'app'
$runtimeDir = Join-Path $BuildDir 'runtime'
$stageDir = Join-Path $BuildDir 'stage'
$setupDir = Join-Path $BuildDir 'setup'
$buildResults = Join-Path $ResultsDir 'build'
foreach ($d in @($runtimeDir, $stageDir, (Join-Path $stageDir 'app\assets'), $setupDir, $buildResults)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

$info = [ordered]@{}
$nodeVersion = (& node --version).Trim()
$info.node = $nodeVersion
$info.npm = (& npm --version).Trim()

# Node runtime from nodejs.org, verified against SHASUMS256.txt
& node (Join-Path $proto 'node-runtime.mjs') $nodeVersion $runtimeDir
if ($LASTEXITCODE -ne 0) { throw "node-runtime.mjs failed ($LASTEXITCODE)" }
$info.runtime = Get-Content (Join-Path $runtimeDir 'node-runtime.json') -Raw | ConvertFrom-Json

# resellr-node.exe: subsystem 2, signature removed, checksum recomputed
& node (Join-Path $proto 'patch-pe-subsystem.mjs') (Join-Path $runtimeDir 'node.exe') (Join-Path $stageDir 'resellr-node.exe') (Join-Path $buildResults 'patch-report.json')
if ($LASTEXITCODE -ne 0) { throw "patch-pe-subsystem.mjs failed ($LASTEXITCODE)" }

# App files
foreach ($f in @('launcher.mjs', 'server.mjs', 'package.json')) { Copy-Item (Join-Path $appSrc $f) (Join-Path $stageDir 'app') }
Copy-Item -Recurse -Force (Join-Path $appSrc 'node_modules') (Join-Path $stageDir 'app\node_modules')
& node (Join-Path $proto 'make-test-image.mjs') $appSrc (Join-Path $stageDir 'app\assets\test-4000x3000.jpg')
if ($LASTEXITCODE -ne 0) { throw "make-test-image.mjs failed ($LASTEXITCODE)" }

# Inno Setup 6
function Find-Iscc {
    foreach ($p in @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe")) {
        if (Test-Path $p) { return $p }
    }
    $cmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}
$iscc = Find-Iscc
$inno = [ordered]@{ preinstalled = [bool]$iscc; chocoInstallMs = $null }
if ($iscc -and ((Get-Item $iscc).VersionInfo.FileMajorPart -ne 6)) {
    $inno.preinstalledVersion = (Get-Item $iscc).VersionInfo.ProductVersion
    $iscc = $null
}
if (-not $iscc) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    choco install innosetup --version 6.7.1 -y --no-progress | Out-Host
    $inno.chocoInstallMs = $sw.ElapsedMilliseconds
    $iscc = Find-Iscc
    if (-not $iscc) { throw 'Inno Setup 6 not found after choco install' }
}
$inno.path = $iscc
$inno.version = (Get-Item $iscc).VersionInfo.ProductVersion
$info.innoSetup = $inno

$sw = [Diagnostics.Stopwatch]::StartNew()
& $iscc /Qp "/DStageDir=$stageDir" "/DOutDir=$setupDir" (Join-Path $proto 'installer\resellr-spike.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }
$info.innoCompileMs = $sw.ElapsedMilliseconds
$info.setup = Join-Path $setupDir 'resellr-spike-setup.exe'
$info.setupSize = (Get-Item $info.setup).Length

$info | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $buildResults 'build-info.json') -Encoding utf8
$info | ConvertTo-Json -Depth 6
