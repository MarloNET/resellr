# Shared helpers for run-spike.ps1 (dot-sourced). Test tooling only, not product code.

Add-Type -Path (Join-Path $PSScriptRoot 'SpikeNative.cs')

$script:SpikeUser = 'spikeuser'
$script:SpikeProfile = 'C:\Users\spikeuser'
$script:SpikeLocal = 'C:\Users\spikeuser\AppData\Local'
$script:ProgDir = 'C:\Users\spikeuser\AppData\Local\Programs\resellr-spike'
$script:InstalledNode = Join-Path $script:ProgDir 'resellr-node.exe'
$script:LauncherPath = Join-Path $script:ProgDir 'app\launcher.mjs'
$script:ServerPath = Join-Path $script:ProgDir 'app\server.mjs'
$script:DataDir = 'C:\Users\spikeuser\AppData\Local\resellr-spike\Daten'
$script:LogDir = 'C:\Users\spikeuser\AppData\Local\resellr-spike\Protokolle'
$script:OpsLog = Join-Path $script:LogDir 'operations.jsonl'
$script:StartResultFile = Join-Path $script:LogDir 'start-result.json'
$script:HealthUrl = 'http://127.0.0.1:4310/api/ops/health'
$script:ShutdownUrl = 'http://127.0.0.1:4310/api/ops/shutdown'
$script:Checks = [ordered]@{}
$script:Intervals = [System.Collections.Generic.List[object]]::new()
$script:Notes = [System.Collections.Generic.List[string]]::new()

$script:StatusText = @{ passed = 'bestanden'; failed = 'nicht bestanden'; inconclusive = 'nicht aussagekräftig'; not_triggered = 'nicht ausgelöst' }

function Get-NowMs { [SpikeNative]::NowMs() }

function Write-Json($Value, [string]$Path) {
    $dir = Split-Path -Parent $Path
    if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Value | ConvertTo-Json -Depth 12 | Set-Content -Path $Path -Encoding utf8
}

# Runs a check body; the body returns @{ status; summary; values; reason }. Exceptions count as "failed"
# with the script error recorded, so a harness problem is never reported as a pass.
function Invoke-Check([string]$Id, [scriptblock]$Body) {
    Write-Host "::group::$Id"
    $startedMs = Get-NowMs
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $result = $null
    try {
        $result = @(& $Body) | Where-Object { $_ -is [System.Collections.IDictionary] -and $_.Contains('status') } | Select-Object -Last 1
        if (-not $result) { throw 'check body returned no result' }
    }
    catch {
        $result = @{
            status  = 'failed'
            summary = 'Prüfskriptfehler'
            reason  = "Prüfskriptfehler: $($_.Exception.Message)"
            values  = [ordered]@{ error = ($_ | Out-String); scriptStackTrace = $_.ScriptStackTrace }
        }
    }
    Save-Check -Id $Id -Result $result -StartedMs $startedMs -DurationMs $sw.ElapsedMilliseconds
    Write-Host "$Id -> $($result.status): $($result.summary)"
    Write-Host '::endgroup::'
}

function Save-Check([string]$Id, $Result, [long]$StartedMs, [long]$DurationMs) {
    $entry = [ordered]@{
        id         = $Id
        status     = $script:StatusText[$Result.status]
        statusCode = $Result.status
        summary    = $Result.summary
        reason     = $Result.reason
        startedMs  = $StartedMs
        durationMs = $DurationMs
        values     = $Result.values
    }
    $script:Checks[$Id] = $entry
    Write-Json $entry (Join-Path $script:ResultsDir "checks\$Id.json")
}

function New-Result([bool]$Passed, [string]$Summary, $Values, [string]$Reason = '') {
    @{ status = $(if ($Passed) { 'passed' } else { 'failed' }); summary = $Summary; values = $Values; reason = $Reason }
}

function New-Inconclusive([string]$Summary, $Values, [string]$Reason) {
    @{ status = 'inconclusive'; summary = $Summary; values = $Values; reason = $Reason }
}

function New-NotTriggered([string]$Summary, $Values = $null, [string]$Reason = '') {
    @{ status = 'not_triggered'; summary = $Summary; values = $Values; reason = $Reason }
}

function Add-Interval([string]$Action, [long]$FromMs, [long]$ToMs) {
    $script:Intervals.Add([ordered]@{ action = $Action; fromMs = $FromMs; toMs = $ToMs })
}

function Wait-UntilMs([long]$TargetMs) {
    $wait = $TargetMs - (Get-NowMs)
    if ($wait -gt 0) { Start-Sleep -Milliseconds $wait }
}

# Polls $Condition until it returns a truthy value or the timeout expires; returns the value or $null.
function Wait-For([scriptblock]$Condition, [int]$TimeoutMs, [int]$PollMs = 50) {
    $deadline = (Get-NowMs) + $TimeoutMs
    do {
        $value = & $Condition
        if ($value) { return $value }
        Start-Sleep -Milliseconds $PollMs
    } while ((Get-NowMs) -lt $deadline)
    return $null
}

# --- processes as spikeuser -------------------------------------------------------------------

function Start-AsSpike([string]$CommandLine, [uint32]$Flags = 0, [string]$WorkingDirectory = $script:WorkDir) {
    [SpikeNative]::StartAsUser($script:SpikeUser, $script:SpikePassword, $CommandLine, $WorkingDirectory, $Flags)
}

function Get-LauncherCommandLine([string]$Command) {
    "`"$script:InstalledNode`" `"$script:LauncherPath`" $Command"
}

# Runs cmd.exe as spikeuser without a window (helper commands only, never the prototype).
function Invoke-SpikeCmd([string]$CmdLine, [int]$TimeoutMs = 60000) {
    $p = Start-AsSpike -CommandLine "cmd.exe /d /s /c `"$CmdLine`"" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    $code = $p.WaitExit($TimeoutMs)
    if ($null -eq $code) { throw "spikeuser command timed out: $CmdLine" }
    return $code
}

# Runs a command line as spikeuser via a throwaway batch file and returns @{ Code; Out }.
# Output is redirected inside the batch to a file the runner reads, so quoting stays robust and
# registry reads (P1.2, P1.5) are performed in the spikeuser context as the criteria require.
function Invoke-SpikeCapture([string]$CommandLine, [int]$TimeoutMs = 60000) {
    $id = [guid]::NewGuid().ToString('N')
    $bat = Join-Path $script:WorkDir "cap-$id.cmd"
    $outFile = Join-Path $script:WorkDir "cap-$id.out"
    Set-Content -Path $bat -Value "@echo off`r`n$CommandLine > `"$outFile`" 2>&1`r`nexit /b %ERRORLEVEL%" -Encoding ascii
    $p = Start-AsSpike -CommandLine "cmd.exe /d /s /c `"$bat`"" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    $code = $p.WaitExit($TimeoutMs)
    $out = if (Test-Path $outFile) { Get-Content -Raw -Path $outFile -ErrorAction SilentlyContinue } else { '' }
    Remove-Item -Force -ErrorAction SilentlyContinue -Path $bat, $outFile
    return @{ Code = $code; Out = $out }
}

function Get-SpikeProcesses {
    $filter = "Name='resellr-node.exe' OR Name='node.exe' OR Name='resellr-start.exe'"
    @(Get-CimInstance Win32_Process -Filter $filter |
        Where-Object { [string]$_.CommandLine -match 'launcher\.mjs|server\.mjs|spawn-set\.mjs' } | ForEach-Object {
            $cl = [string]$_.CommandLine
            $role = 'other'
            if ($_.Name -eq 'resellr-start.exe') { $role = 'stub' }
            elseif ($cl -match 'server\.mjs') { $role = 'server' }
            elseif ($cl -match 'spawn-set\.mjs') { $role = 'helper' }
            elseif ($cl -match 'launcher\.mjs"?\s+(\w+)') { $role = $Matches[1] }
            [pscustomobject]@{
                Name       = [string]$_.Name
                Pid        = [int]$_.ProcessId
                ParentPid  = [int]$_.ParentProcessId
                SessionId  = [int]$_.SessionId
                Role       = $role
                CommandLine = $cl
                Cim        = $_
            }
        })
}

function Get-ProductProcesses { @(Get-SpikeProcesses | Where-Object { $_.Role -ne 'helper' }) }

function Get-ProcessOwner($Proc) {
    $o = Invoke-CimMethod -InputObject $Proc.Cim -MethodName GetOwner
    if ($o.ReturnValue -ne 0) { return $null }
    return $o.User
}

# Every check in Spike-Punkt 3 starts without a running resellr-node.exe.
function Clear-SpikeProcesses {
    $procs = Get-ProductProcesses
    if ($procs.Count -eq 0) { return 0 }
    $procs | ForEach-Object { Stop-Process -Id $_.Pid -Force -ErrorAction SilentlyContinue }
    Wait-For { (Get-ProductProcesses).Count -eq 0 } 10000 | Out-Null
    return $procs.Count
}

# --- HTTP ---------------------------------------------------------------------------------------

function Get-Health {
    try { Invoke-RestMethod -Uri $script:HealthUrl -TimeoutSec 1 -NoProxy } catch { $null }
}

function Wait-HealthReady([int]$TimeoutMs, [string]$NotStartId = '') {
    Wait-For {
        $h = Get-Health
        if ($h -and $h.status -eq 'ready' -and $h.startId -ne $NotStartId) { $h } else { $null }
    } $TimeoutMs 100
}

function Invoke-Shutdown {
    try {
        $r = Invoke-WebRequest -Uri $script:ShutdownUrl -Method Post -TimeoutSec 10 -NoProxy -SkipHttpErrorCheck
        return [int]$r.StatusCode
    }
    catch { return $null }
}

# Ends a running supervised server cleanly and waits until no resellr-node.exe remains.
function Stop-SpikeCleanly {
    if (Get-Health) { Invoke-Shutdown | Out-Null }
    Wait-For { (Get-ProductProcesses).Count -eq 0 } 15000 | Out-Null
    return (Clear-SpikeProcesses)
}

# --- logs ---------------------------------------------------------------------------------------

function Read-SharedText([string]$Path) {
    if (-not (Test-Path $Path)) { return '' }
    $fs = [System.IO.FileStream]::new($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete)
    try { [System.IO.StreamReader]::new($fs).ReadToEnd() } finally { $fs.Dispose() }
}

function Get-OpsEvents([long]$SinceMs = 0) {
    $events = foreach ($line in ((Read-SharedText $script:OpsLog) -split "`n")) {
        $t = $line.Trim()
        if (-not $t) { continue }
        try { $e = $t | ConvertFrom-Json } catch { continue }
        if ([long]$e.ts -ge $SinceMs) { $e }
    }
    @($events)
}

# Returns the parsed JSON file, or $null while it is missing or still being written.
function Read-JsonOrNull([string]$Path) {
    try {
        $text = Read-SharedText $Path
        if (-not $text) { return $null }
        return ($text | ConvertFrom-Json)
    }
    catch { return $null }
}

function Get-StartResult {
    $text = Read-SharedText $script:StartResultFile
    if (-not $text) { return $null }
    $text | ConvertFrom-Json
}

function Wait-OpsEvent([long]$SinceMs, [scriptblock]$Filter, [int]$TimeoutMs) {
    Wait-For { Get-OpsEvents $SinceMs | Where-Object $Filter | Select-Object -First 1 } $TimeoutMs 50
}

function Get-EventsBy([object[]]$Events, [string]$Name, [int]$ProcessId = 0) {
    @($Events | Where-Object { $_.event -eq $Name -and ($ProcessId -eq 0 -or [int]$_.pid -eq $ProcessId) })
}

# Copies a file the runner reads from the spikeuser profile into the results folder.
function Save-Evidence([string]$Path, [string]$Name) {
    if (Test-Path $Path) { Copy-Item $Path (Join-Path $script:ResultsDir $Name) -Force }
}

# Runs the spawn-set helper as spikeuser and returns its result object.
function Invoke-SpawnSet([string]$Name, [object[]]$Items, [int]$WaitMs) {
    $cfgPath = Join-Path $script:WorkDir "spawn\$Name.json"
    $outPath = Join-Path $script:WorkDir "spawn\$Name.out.json"
    Remove-Item -Force -ErrorAction SilentlyContinue $outPath, "$outPath.spawned.json"
    Write-Json ([ordered]@{ exe = $script:InstalledNode; out = $outPath; waitMs = $WaitMs; items = $Items }) $cfgPath
    $helper = Start-AsSpike -CommandLine "`"$script:InstalledNode`" `"$script:WorkDir\spawn-set.mjs`" `"$cfgPath`""
    $spawned = Wait-For { Read-JsonOrNull "$outPath.spawned.json" } 15000
    return [pscustomobject]@{ Helper = $helper; Spawned = $spawned; OutPath = $outPath }
}

function Get-SpawnSetResult($SpawnSet, [int]$TimeoutMs) {
    Wait-For { Read-JsonOrNull $SpawnSet.OutPath } $TimeoutMs 100
}
