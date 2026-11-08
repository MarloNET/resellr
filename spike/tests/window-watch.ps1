# Window watcher (spike assignment chapter 4): every 10 ms EnumWindows, visible top-level windows
# of resellr-node.exe, node.exe, conhost.exe, OpenConsole.exe, WindowsTerminal.exe. Output CSV.
param(
    [Parameter(Mandatory)] [string]$OutCsv,
    [Parameter(Mandatory)] [string]$StopFile,
    [Parameter(Mandatory)] [string]$ReadyFile
)
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'SpikeNative.cs')
[SpikeNative]::WindowWatch($OutCsv, $StopFile, $ReadyFile, 10,
    [string[]]@('resellr-node.exe', 'node.exe', 'conhost.exe', 'OpenConsole.exe', 'WindowsTerminal.exe'))
