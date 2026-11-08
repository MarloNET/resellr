# Window watcher (spike assignment chapter 4): every 10 ms EnumWindows, visible top-level windows
# of resellr-node.exe, node.exe, conhost.exe, OpenConsole.exe, WindowsTerminal.exe. Output CSV.
param(
    [Parameter(Mandatory)] [string]$OutCsv,
    [Parameter(Mandatory)] [string]$StopFile,
    [Parameter(Mandatory)] [string]$ReadyFile
)
$ErrorActionPreference = 'Stop'
# Progress lines go to the log written by the batch wrapper (see Start-Observers).
Write-Output "$(Get-Date -Format o) window-watch started as $env:USERNAME, PS $($PSVersionTable.PSVersion), TEMP=$env:TEMP"
Add-Type -Path (Join-Path $PSScriptRoot 'SpikeNative.cs')
Write-Output "$(Get-Date -Format o) SpikeNative compiled"
[SpikeNative]::WindowWatch($OutCsv, $StopFile, $ReadyFile, 10,
    [string[]]@('resellr-node.exe', 'node.exe', 'conhost.exe', 'OpenConsole.exe', 'WindowsTerminal.exe'))
