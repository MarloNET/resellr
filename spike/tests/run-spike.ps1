# Main test driver for the Windows spike (Schnitt 0). Creates the standard user spikeuser,
# installs the prototype without admin rights and runs checks P1.x, P2.1-P2.4, P3.1-P3.8, P5.2
# and (conditionally) P2.R as spikeuser. Test tooling only, not product code.
param(
    [Parameter(Mandatory)] [string]$BuildDir,
    [Parameter(Mandatory)] [string]$ResultsDir
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'spike-lib.ps1')

$script:ResultsDir = (New-Item -ItemType Directory -Force -Path $ResultsDir).FullName
New-Item -ItemType Directory -Force -Path (Join-Path $ResultsDir 'checks') | Out-Null
$script:WorkDir = 'C:\resellr-spike-work'
$script:SpikePassword = 'Sp!ke-' + [guid]::NewGuid().ToString('N').Substring(0, 18) + 'Xy9'
$script:RuntimeNode = Join-Path $BuildDir 'runtime\node.exe'
$script:StageNode = Join-Path $BuildDir 'stage\resellr-node.exe'
$script:SetupExe = Join-Path $BuildDir 'setup\resellr-spike-setup.exe'
$script:InstallerLog = Join-Path $ResultsDir 'installer.log'
$script:SpikeSession = -1
$script:P2RTrigger = $false

# --- setup --------------------------------------------------------------------------------------

function Initialize-WorkDir {
    New-Item -ItemType Directory -Force -Path $script:WorkDir, (Join-Path $script:WorkDir 'spawn') | Out-Null
    Copy-Item (Join-Path $PSScriptRoot 'spawn-set.mjs') $script:WorkDir -Force
    Copy-Item (Join-Path $PSScriptRoot 'window-watch.ps1') $script:WorkDir -Force
    Copy-Item (Join-Path $PSScriptRoot 'SpikeNative.cs') $script:WorkDir -Force
    # spikeuser needs read/execute here and write for spawn output; the results folder receives the
    # installer log and the window-watch CSV written by spikeuser.
    icacls $script:WorkDir /grant 'Users:(OI)(CI)M' /T | Out-Null
    icacls $script:ResultsDir /grant 'Users:(OI)(CI)M' /T | Out-Null
}

function New-SpikeUser {
    # CreateProcessWithLogonW (Start-AsSpike) needs the Secondary Logon service.
    try {
        Set-Service -Name seclogon -StartupType Manual -ErrorAction SilentlyContinue
        Start-Service -Name seclogon -ErrorAction SilentlyContinue
    }
    catch {}
    $sec = ConvertTo-SecureString $script:SpikePassword -AsPlainText -Force
    Get-LocalUser -Name $script:SpikeUser -ErrorAction SilentlyContinue | Remove-LocalUser -ErrorAction SilentlyContinue
    New-LocalUser -Name $script:SpikeUser -Password $sec -AccountNeverExpires -PasswordNeverExpires -UserMayNotChangePassword | Out-Null
    Add-LocalGroupMember -Group 'Users' -Member $script:SpikeUser -ErrorAction SilentlyContinue
}

# E-1: spikeuser is a standard user (not a member of Administrators).
function Test-StandardUser {
    $admins = @(Get-LocalGroupMember -Group 'Administrators' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $isAdmin = [bool]($admins | Where-Object { $_ -match "\\$($script:SpikeUser)$" })
    $groups = @(Get-LocalGroupMember -Group 'Users' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    [pscustomobject]@{ isAdmin = $isAdmin; administrators = $admins; inUsers = [bool]($groups | Where-Object { $_ -match "\\$($script:SpikeUser)$" }) }
}

function Write-Environment([object]$E1) {
    $cv = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
    $reg = Get-ItemProperty -Path $cv -ErrorAction SilentlyContinue
    $mp = $null
    try { $mp = Get-MpComputerStatus -ErrorAction Stop } catch {}
    $chrome = $null
    foreach ($p in @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe")) {
        if (Test-Path $p) { $chrome = (Get-Item $p).VersionInfo.ProductVersion; break }
    }
    $env = [ordered]@{
        imageOs           = $env:ImageOS
        imageVersion      = $env:ImageVersion
        runnerName        = $env:RUNNER_NAME
        osCaption         = (Get-CimInstance Win32_OperatingSystem).Caption
        windowsBuild      = "$($reg.CurrentMajorVersionNumber).$($reg.CurrentMinorVersionNumber).$($reg.CurrentBuildNumber).$($reg.UBR)"
        displayVersion    = $reg.DisplayVersion
        node              = (& node --version).Trim()
        npm               = (& npm --version).Trim()
        chrome            = $chrome
        defender          = [ordered]@{
            amServiceEnabled          = if ($mp) { $mp.AMServiceEnabled } else { $null }
            antivirusSignatureVersion = if ($mp) { $mp.AntivirusSignatureVersion } else { $null }
            signatureLastUpdated      = if ($mp) { $mp.AntivirusSignatureLastUpdated } else { $null }
        }
        spikeuser         = $E1
        capturedAt        = (Get-Date).ToString('o')
    }
    Write-Json $env (Join-Path $script:ResultsDir 'environment.json')
    return $env
}

# --- observers ----------------------------------------------------------------------------------

function Start-Observers {
    $script:WinCsv = Join-Path $script:ResultsDir 'window-watch.csv'
    $script:ProcCsv = Join-Path $script:ResultsDir 'process-watch.csv'
    $script:ObsStop = Join-Path $script:WorkDir 'observers.stop'
    $winReady = Join-Path $script:WorkDir 'window.ready'
    $procReady = Join-Path $script:WorkDir 'process.ready'
    Remove-Item -Force -ErrorAction SilentlyContinue $script:ObsStop, $winReady, $procReady
    $wwScript = Join-Path $script:WorkDir 'window-watch.ps1'
    $script:WinLog = Join-Path $script:WorkDir 'window-watch.log'
    Remove-Item -Force -ErrorAction SilentlyContinue $script:WinLog
    # Batch wrapper so stdout/stderr of the spikeuser watcher land in a log (diagnosis if it never gets ready).
    $wwBat = Join-Path $script:WorkDir 'window-watch.cmd'
    $ps = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$wwScript`" -OutCsv `"$script:WinCsv`" -StopFile `"$script:ObsStop`" -ReadyFile `"$winReady`""
    Set-Content -Path $wwBat -Value "@echo off`r`n$ps > `"$script:WinLog`" 2>&1`r`nexit /b %ERRORLEVEL%" -Encoding ascii
    $script:WinWatcher = Start-AsSpike -CommandLine "cmd.exe /d /s /c `"$wwBat`"" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    $script:ProcWatcher = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'process-watch.ps1'),
        '-OutCsv', $script:ProcCsv, '-StopFile', $script:ObsStop, '-ReadyFile', $procReady)
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Wait-For { (Test-Path $winReady) -and (Test-Path $procReady) } 90000 500 | Out-Null
    # A watcher that never gets ready no longer aborts the run: the other checks still run and P2.3
    # reports the harness error with this diagnosis.
    $script:ObserverError = $null
    $errors = @()
    if (-not (Test-Path $winReady)) {
        $code = $script:WinWatcher.WaitExit(0)
        $log = if (Test-Path $script:WinLog) { Get-Content -Raw -Path $script:WinLog } else { '(kein Log)' }
        $state = if ($null -eq $code) { 'läuft noch' } else { "Exit-Code $code" }
        $errors += "Fensterbeobachter nicht bereit nach 90 s ($state); Log: $log"
    }
    if (-not (Test-Path $procReady)) { $errors += 'Prozessbeobachter nicht bereit nach 90 s' }
    if ($errors.Count) {
        $script:ObserverError = $errors -join '; '
        Write-Host "::warning::$($script:ObserverError)"
    }
    else { Write-Host "observers ready after $($sw.ElapsedMilliseconds) ms" }
}

function Stop-Observers {
    Set-Content -Path $script:ObsStop -Value 'stop'
    try { $script:WinWatcher.WaitExit(10000) | Out-Null } catch {}
    try { $script:ProcWatcher.WaitForExit(10000) | Out-Null } catch {}
}

# --- PE helpers (P2.1) --------------------------------------------------------------------------

function Read-PeInfo([string]$Path) {
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $peOff = [int][BitConverter]::ToUInt32($bytes, 0x3c)
    $opt = $peOff + 4 + 20
    $magic = [BitConverter]::ToUInt16($bytes, $opt)
    if ($magic -eq 0x20b) { $dd = $opt + 112 } elseif ($magic -eq 0x10b) { $dd = $opt + 96 } else { throw "unknown optional header magic 0x$($magic.ToString('x'))" }
    $sec = $dd + 4 * 8
    [pscustomobject]@{
        Path                = $Path
        Length              = $bytes.LongLength
        Magic               = $magic
        CheckSumOffset      = $opt + 64
        SubsystemOffset     = $opt + 68
        SecurityEntryOffset = $sec
        CheckSum            = [BitConverter]::ToUInt32($bytes, $opt + 64)
        Subsystem           = [BitConverter]::ToUInt16($bytes, $opt + 68)
        CertTableOffset     = [BitConverter]::ToUInt32($bytes, $sec)
        CertTableSize       = [BitConverter]::ToUInt32($bytes, $sec + 4)
        Bytes               = $bytes
    }
}

# --- supervise/open helpers ---------------------------------------------------------------------

function Start-Supervise([hashtable]$EnvVars) {
    $cmd = Get-LauncherCommandLine 'supervise'
    if ($EnvVars -and $EnvVars.Count -gt 0) {
        $sets = ($EnvVars.GetEnumerator() | ForEach-Object { "set `"$($_.Key)=$($_.Value)`"" }) -join ' && '
        return Start-AsSpike -CommandLine "cmd.exe /d /s /c `"$sets && $cmd`"" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    }
    return Start-AsSpike -CommandLine $cmd
}

function Start-Open { Start-AsSpike -CommandLine (Get-LauncherCommandLine 'open') }

function Get-ServerProc { @(Get-ProductProcesses | Where-Object { $_.Role -eq 'server' }) }
function Get-SupervisorProc { @(Get-ProductProcesses | Where-Object { $_.Role -in @('supervise', 'open', 'supervisor') }) }

# Starts a supervised server as spikeuser and waits for health "ready". Returns timing info.
function Start-SupervisedReady([int]$TimeoutMs = 20000) {
    $since = Get-NowMs
    $sup = Start-Supervise
    $health = Wait-HealthReady $TimeoutMs
    [pscustomobject]@{ Supervisor = $sup; Since = $since; ReadyMs = (Get-NowMs); Health = $health }
}

# ================================================================================================
# Checks
# ================================================================================================

function Check-P11 {
    $log = $script:InstallerLog
    Remove-Item -Force -ErrorAction SilentlyContinue $log
    $cl = "`"$script:SetupExe`" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART `"/LOG=$log`""
    $t0 = Get-NowMs
    $p = Start-AsSpike -CommandLine $cl -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    $code = $p.WaitExit(120000)
    $durationMs = (Get-NowMs) - $t0
    $installedNode = Test-Path $script:InstalledNode
    $progFiles = Test-Path 'C:\Program Files\resellr-spike'
    $progFiles86 = Test-Path 'C:\Program Files (x86)\resellr-spike'
    $hklm = @()
    foreach ($root in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')) {
        $hklm += @(Get-ChildItem $root -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match 'resellr-spike' } | ForEach-Object { $_.Name })
    }
    $values = [ordered]@{
        exitCode = $code; durationMs = $durationMs; installedNodePresent = $installedNode
        programFilesPresent = $progFiles; programFilesX86Present = $progFiles86; hklmUninstallKeys = $hklm
        installedNodePath = $script:InstalledNode
    }
    $passed = ($code -eq 0) -and ($durationMs -le 120000) -and $installedNode -and (-not $progFiles) -and (-not $progFiles86) -and ($hklm.Count -eq 0)
    $reason = if ($passed) { '' } else { "Installation nicht wie erwartet (ein Rechte-Dialog würde den Silent-Lauf blockieren und zum Zeitüberschreiten führen)." }
    New-Result $passed "Exit $code in $durationMs ms, Installation unter LocalAppData, kein HKLM-Eintrag" $values $reason
}

function Check-P12 {
    $cap = Invoke-SpikeCapture 'reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v resellr-spike'
    $expected = "`"$script:InstalledNode`" `"$script:LauncherPath`" supervise"
    $type = $null; $data = $null
    foreach ($line in ($cap.Out -split "`r?`n")) {
        if ($line -match 'resellr-spike\s+(REG_\w+)\s+(.+)$') { $type = $Matches[1]; $data = $Matches[2].Trim() }
    }
    $values = [ordered]@{ regExitCode = $cap.Code; type = $type; data = $data; expected = $expected; raw = $cap.Out.Trim() }
    $passed = ($type -eq 'REG_SZ') -and ($data -eq $expected)
    New-Result $passed "Autostart-Wert Typ $type, zeichengleich=$($data -eq $expected)" $values
}

function Check-P13 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $t0 = Get-NowMs
    $cmd = "`"$script:InstalledNode`" `"$script:LauncherPath`" supervise"
    $script:P13Supervisor = Start-AsSpike -CommandLine $cmd
    $health = Wait-HealthReady 15000
    $readyMs = Get-NowMs
    $healthMs = $readyMs - $t0
    Start-Sleep -Milliseconds 500
    $sup = Get-SupervisorProc
    $srv = Get-ServerProc
    $owners = @{}
    foreach ($proc in @($sup) + @($srv)) { $owners[[string]$proc.Pid] = Get-ProcessOwner $proc }
    if ($srv.Count -eq 1) { $script:SpikeSession = $srv[0].SessionId }
    $childOk = ($srv.Count -eq 1 -and $sup.Count -eq 1 -and $srv[0].ParentPid -eq $sup[0].Pid)
    $ownersOk = ($owners.Values | Where-Object { $_ -ne $script:SpikeUser }).Count -eq 0 -and $owners.Count -gt 0
    Add-Interval 'start' ($t0 - 1000) ($readyMs + 10000)
    $values = [ordered]@{
        healthMs = $healthMs; healthStatus = $health.status; supervisorCount = $sup.Count; serverCount = $srv.Count
        serverParentIsSupervisor = $childOk; owners = $owners; sessionId = $script:SpikeSession
    }
    $passed = ($health.status -eq 'ready') -and ($healthMs -le 15000) -and $childOk -and $ownersOk
    New-Result $passed "ready in $healthMs ms; 1 Überwachung + 1 Server, Besitzer spikeuser, Server Kind der Überwachung" $values
}

# Resolves a shortcut as spikeuser: links under a profile may store environment-relative targets
# (%LOCALAPPDATA%), which would expand to the runner account's profile if read as admin.
function Resolve-Shortcut([string]$Path) {
    # Progress records ("Preparing modules for first use") go to stderr as CLIXML and broke parsing in run 3.
    $ps = "`$ProgressPreference = 'SilentlyContinue'; `$l = (New-Object -ComObject WScript.Shell).CreateShortcut('$Path'); " +
        "[pscustomobject]@{ Target = `$l.TargetPath; Arguments = `$l.Arguments; WorkingDirectory = `$l.WorkingDirectory } | ConvertTo-Json -Compress"
    $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($ps))
    $r = Invoke-SpikeCapture "powershell.exe -NoProfile -NonInteractive -EncodedCommand $enc" 60000
    $json = [string](([string]$r.Out) -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -First 1)
    $json = $json.Trim()
    if ($r.Code -ne 0 -or -not $json.StartsWith('{')) { throw "Resolve-Shortcut as spikeuser failed (code $($r.Code)): $json" }
    $o = $json | ConvertFrom-Json
    [pscustomobject]@{ Target = [string]$o.Target; Arguments = [string]$o.Arguments; WorkingDirectory = [string]$o.WorkingDirectory }
}

function Check-P14 {
    $programs = Join-Path $script:SpikeProfile 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'
    $openLnk = Join-Path $programs 'resellr-spike.lnk'
    $stopLnk = Join-Path $programs 'resellr-spike beenden.lnk'
    $open = Resolve-Shortcut $openLnk
    $stop = Resolve-Shortcut $stopLnk
    $targetsOk = ($open.Target -ieq $script:InstalledNode) -and ($stop.Target -ieq $script:InstalledNode)
    $argsOk = ($open.Arguments -match '\bopen\b') -and ($stop.Arguments -match '\bstop\b')
    if (-not ($targetsOk -and $argsOk)) {
        return (New-Result $false "Verknüpfungen Ziel/Argumente fehlerhaft" ([ordered]@{ openTarget = $open.Target; openArgs = $open.Arguments; stopTarget = $stop.Target; stopArgs = $stop.Arguments }))
    }
    $t0 = Get-NowMs
    # Using the resolved stop shortcut (its target and arguments) as spikeuser.
    $p = Start-AsSpike -CommandLine "`"$($stop.Target)`" $($stop.Arguments)"
    $p.WaitExit(15000) | Out-Null
    $stopped = Wait-OpsEvent $t0 { $_.event -eq 'stopped' } 15000
    $stoppedMs = if ($stopped) { [long]$stopped.ts - $t0 } else { $null }
    Add-Interval 'stop' ($t0 - 1000) (($(if ($stopped) { [long]$stopped.ts } else { Get-NowMs })) + 10000)
    Stop-SpikeCleanly | Out-Null
    $values = [ordered]@{
        openTarget = $open.Target; openArgs = $open.Arguments; stopTarget = $stop.Target; stopArgs = $stop.Arguments
        targetsOk = $targetsOk; argsOk = $argsOk; stoppedMs = $stoppedMs
    }
    $passed = $targetsOk -and $argsOk -and ($null -ne $stopped) -and ($stoppedMs -le 15000)
    New-Result $passed "Verknüpfungen Ziel/Argumente ok=$($targetsOk -and $argsOk); stopped nach $stoppedMs ms" $values
}

function Check-P21 {
    $node = Read-PeInfo $script:RuntimeNode
    $res = Read-PeInfo $script:InstalledNode
    $sigNode = Get-AuthenticodeSignature $script:RuntimeNode
    $sigRes = Get-AuthenticodeSignature $script:InstalledNode
    $nodeUnsigned = ($node.CertTableOffset -eq 0 -and $node.CertTableSize -eq 0)
    # a) subsystem
    $subOk = ($node.Subsystem -eq 3) -and ($res.Subsystem -eq 2)
    # b) signatures + security directory of resellr-node
    $nodeSigOk = ($sigNode.Status -eq 'Valid') -or $true  # not Valid is noted but does not fail
    $resSigOk = ($sigRes.Status -eq 'NotSigned') -and ($res.CertTableOffset -eq 0) -and ($res.CertTableSize -eq 0)
    # c) length relation
    $expectedLen = if ($nodeUnsigned) { $node.Length } else { $node.CertTableOffset }
    $lenOk = ($res.Length -eq $expectedLen)
    # d) independent checksum
    $cs = [SpikeNative]::MapFileAndCheckSum($script:InstalledNode)
    $csOk = ($cs[0] -eq 0) -and ([uint32]$cs[2] -eq $res.CheckSum)
    # e) byte-equality except the 14 patched bytes
    # Ranges in parentheses: in PowerShell the comma binds tighter than '+'.
    $excluded = [long[]](@($res.SubsystemOffset..($res.SubsystemOffset + 1)) +
        @($res.CheckSumOffset..($res.CheckSumOffset + 3)) +
        @($res.SecurityEntryOffset..($res.SecurityEntryOffset + 7)))
    $diffs = [SpikeNative]::DiffExcept($node.Bytes, $res.Bytes, $excluded, 32)
    $byteOk = ($diffs.Length -eq 0)
    $values = [ordered]@{
        node = [ordered]@{ subsystem = $node.Subsystem; checkSum = $node.CheckSum; certTableOffset = $node.CertTableOffset; certTableSize = $node.CertTableSize; length = $node.Length; signature = [string]$sigNode.Status }
        resellr = [ordered]@{ subsystem = $res.Subsystem; checkSum = $res.CheckSum; certTableOffset = $res.CertTableOffset; certTableSize = $res.CertTableSize; length = $res.Length; signature = [string]$sigRes.Status; subsystemOffset = $res.SubsystemOffset; checkSumOffset = $res.CheckSumOffset; securityEntryOffset = $res.SecurityEntryOffset }
        nodeUnsigned = $nodeUnsigned; mapFileChecksumStatus = $cs[0]; mapFileChecksum = [uint32]$cs[2]
        diffOffsets = $diffs; checks = [ordered]@{ a_subsystem = $subOk; b_signature = $resSigOk; c_length = $lenOk; d_checksum = $csOk; e_bytes = $byteOk }
    }
    $passed = $subOk -and $nodeSigOk -and $resSigOk -and $lenOk -and $csOk -and $byteOk
    New-Result $passed "Subsystem 3->2, resellr-node unsigniert, Prüfsumme bestätigt, nur 14 Bytes verschieden" $values
}

function Check-P22 {
    $verFile = Join-Path $script:WorkDir 'p22-version.txt'
    Remove-Item -Force -ErrorAction SilentlyContinue $verFile
    $cl = "`"$script:InstalledNode`" -e `"require('fs').writeFileSync(process.argv[1], process.version)`" `"$verFile`""
    $p = Start-AsSpike -CommandLine $cl -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    $p.WaitExit(30000) | Out-Null
    $written = if (Test-Path $verFile) { (Get-Content -Raw $verFile).Trim() } else { '' }
    $expected = (& $script:RuntimeNode --version).Trim()
    $values = [ordered]@{ resellrNodeVersion = $written; nodeVersion = $expected }
    $passed = ($written -ne '') -and ($written -eq $expected)
    New-Result $passed "resellr-node.exe meldet $written (node.exe $expected)" $values
}

function Check-P52 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $r = Start-SupervisedReady 20000
    $self = Wait-OpsEvent $since { $_.event -eq 'selftest' } 20000
    Stop-SpikeCleanly | Out-Null
    if (-not $self) { return (New-Result $false 'kein selftest-Ereignis' @{ ready = $r.Health.status }) }
    $appModules = Join-Path $script:ProgDir 'app\node_modules'
    $bsOk = ([string]$self.modulePaths.betterSqlite3).StartsWith($appModules, 'OrdinalIgnoreCase')
    $sharpOk = ([string]$self.modulePaths.sharp).StartsWith($appModules, 'OrdinalIgnoreCase')
    $widths = @($self.sharpOutputs | ForEach-Object { [int]$_.width })
    $sharpSizeOk = ($widths -contains 1600) -and ($widths -contains 320)
    $values = [ordered]@{
        journalMode = $self.journalMode; rowsWritten = $self.rowsWritten; rowsRead = $self.rowsRead; rowsOk = $self.rowsOk
        modulePaths = $self.modulePaths; fromInstalledProfile = ($bsOk -and $sharpOk); sharpOutputs = $self.sharpOutputs
        importMs = $self.importMs; dbMs = $self.dbMs; sharpMs = $self.sharpMs
    }
    $passed = $bsOk -and $sharpOk -and ($self.journalMode -eq 'wal') -and ($self.rowsOk) -and $sharpSizeOk
    New-Result $passed "beide Module aus dem Profil geladen, WAL, 1000 Zeilen, sharp 1600/320 px" $values
}

# --- Spike-Punkt 3 ------------------------------------------------------------------------------

function Check-P31 {
    $reps = 10
    $results = @()
    $items = @()
    1..6 | ForEach-Object { $items += @{ name = "supervise$_"; args = @($script:LauncherPath, 'supervise'); delayMs = 0 } }
    $items += @{ name = 'open'; args = @($script:LauncherPath, 'open'); delayMs = 150 }
    for ($i = 1; $i -le $reps; $i++) {
        Clear-SpikeProcesses | Out-Null
        $since = Get-NowMs
        $spawn = Invoke-SpawnSet "p31-$i" $items 10000
        Get-SpawnSetResult $spawn 11000 | Out-Null
        Start-Sleep -Milliseconds 500
        $events = Get-OpsEvents $since
        $supStarted = (Get-EventsBy $events 'supervisor_started').Count
        $alreadySup = @(Get-EventsBy $events 'already_supervised')
        $wouldOpen = (Get-EventsBy $events 'would_open_chrome').Count
        $sup = (Get-SupervisorProc).Count
        $srv = (Get-ServerProc).Count
        $lastAlreadyMs = if ($alreadySup.Count) { ([long]($alreadySup | Measure-Object -Property ts -Maximum).Maximum) - $since } else { $null }
        # Five supervise lose when a supervise wins the pipe, six when `open` wins; either way every
        # losing supervise ends with already_supervised, so accept >= 5.
        $ok = ($supStarted -eq 1) -and ($alreadySup.Count -ge 5) -and ($wouldOpen -ge 1) -and ($sup -eq 1) -and ($srv -eq 1) -and ($null -ne $lastAlreadyMs -and $lastAlreadyMs -le 2000)
        $results += [ordered]@{ rep = $i; supervisorStarted = $supStarted; alreadySupervised = $alreadySup.Count; wouldOpenChrome = $wouldOpen; liveSupervisors = $sup; liveServers = $srv; lastAlreadyMs = $lastAlreadyMs; ok = $ok }
        Stop-SpikeCleanly | Out-Null
    }
    $passCount = @($results | Where-Object { $_.ok }).Count
    New-Result ($passCount -eq $reps) "$passCount/$reps Wiederholungen: genau 1 Überwachung + 1 Server, 1 supervisor_started, 5 already_supervised, open ready" @{ reps = $results; passCount = $passCount }
}

function Check-P32 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $r = Start-SupervisedReady 20000
    $srv = Get-ServerProc
    if ($srv.Count -ne 1) { Stop-SpikeCleanly | Out-Null; return (New-Result $false "Server nicht bereit (Count $($srv.Count))" @{}) }
    $oldPid = $srv[0].Pid
    $killMs = Get-NowMs
    Stop-Process -Id $oldPid -Force
    $exitEv = Wait-OpsEvent $since { $_.event -eq 'server_exit' -and [int]$_.serverPid -eq $oldPid } 10000
    $crash = Wait-OpsEvent $killMs { $_.event -eq 'crash' } 12000
    $newReady = Wait-HealthReady 15000 $r.Health.startId
    $readyMs = Get-NowMs
    $newSrv = Get-ServerProc
    $newStartEv = Wait-OpsEvent $killMs { $_.event -eq 'server_started' } 12000
    $restartDelayMs = if ($newStartEv) { [long]$newStartEv.ts - $killMs } else { $null }
    Add-Interval 'restart' ($killMs - 1000) ($readyMs + 10000)
    Stop-SpikeCleanly | Out-Null
    $exitCode = if ($exitEv) { [long]$exitEv.code } else { $null }
    $codeOk = ($null -ne $exitCode) -and ($exitCode -notin @(0, 10, 11))
    $delayOk = ($null -ne $restartDelayMs) -and ($restartDelayMs -ge 5000) -and ($restartDelayMs -le 8000)
    $values = [ordered]@{ oldServerExitCode = $exitCode; crashRefNo = $crash.refNo; restartDelayMs = $restartDelayMs; healthReady = $newReady.status; newServerCount = $newSrv.Count }
    $passed = $codeOk -and ($null -ne $crash) -and $delayOk -and ($newReady.status -eq 'ready')
    New-Result $passed "Exit $exitCode, crash $($crash.refNo), neuer Server nach $restartDelayMs ms, wieder ready" $values
}

function Check-P33 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $r = Start-SupervisedReady 20000
    $t0 = Get-NowMs
    $status = Invoke-Shutdown
    $noProc = Wait-For { (Get-ProductProcesses).Count -eq 0 } 10000
    $supEndMs = (Get-NowMs) - $t0
    $stopped = Wait-OpsEvent $t0 { $_.event -eq 'stopped' }  5000
    $exitEv = Wait-OpsEvent $since { $_.event -eq 'server_exit' } 3000
    Start-Sleep -Seconds 10
    $leftover = (Get-ProductProcesses).Count
    # a new supervise must take over the pipe within 2 s
    $t1 = Get-NowMs
    $sup2 = Start-Supervise
    $started2 = Wait-OpsEvent $t1 { $_.event -eq 'supervisor_started' } 4000
    $takeoverMs = if ($started2) { [long]$started2.ts - $t1 } else { $null }
    Stop-SpikeCleanly | Out-Null
    $values = [ordered]@{ shutdownStatus = $status; supervisorEndMs = $supEndMs; stopped = [bool]$stopped; leftoverAfter10s = $leftover; serverExitCode = ($exitEv.code); pipeTakeoverMs = $takeoverMs }
    $passed = ($status -eq 200) -and ($null -ne $noProc) -and ($supEndMs -le 3000) -and ($null -ne $stopped) -and ($leftover -eq 0) -and ($null -ne $takeoverMs -and $takeoverMs -le 2000)
    New-Result $passed "200, Überwachung endet in $supEndMs ms, nach 10 s kein Prozess, Übernahme in $takeoverMs ms" $values
}

function Check-P34 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $sup = Start-Supervise @{ SPIKE_ABORT = '1' }
    Start-Sleep -Milliseconds 300
    $open = Start-Open
    $supCode = $sup.WaitExit(20000)
    $openCode = $open.WaitExit(20000)
    $aborted = Wait-OpsEvent $since { $_.event -eq 'aborted' } 3000
    $openResult = Wait-OpsEvent $since { $_.event -eq 'open_result' -and $_.phase -eq 'aborted' } 3000
    $noRestart = $null -eq (Wait-OpsEvent $since { $_.event -eq 'server_started' -and [int]$_.restartCount -ge 1 } 15000)
    Stop-SpikeCleanly | Out-Null
    $refMatch = ($aborted -and $openResult -and $aborted.refNo -and ($aborted.refNo -eq $openResult.refNo))
    $values = [ordered]@{ superviseExitCode = $supCode; openExitCode = $openCode; abortedRefNo = $aborted.refNo; openRefNo = $openResult.refNo; refMatch = $refMatch; noRestart = $noRestart }
    $passed = ($supCode -eq 10) -and ($null -ne $aborted) -and $noRestart -and $refMatch
    New-Result $passed "supervise Exit $supCode, aborted $($aborted.refNo), open erhält dieselbe Nummer, kein Neustart" $values
}

function Check-P35 {
    # a) a second server directly on the same data folder exits 11
    Clear-SpikeProcesses | Out-Null
    $r = Start-SupervisedReady 20000
    $dbPath = Join-Path $script:DataDir 'resellr.db'
    $mtimeBefore = (Get-Item $dbPath -ErrorAction SilentlyContinue).LastWriteTimeUtc
    $t0 = Get-NowMs
    $second = Start-AsSpike -CommandLine "`"$script:InstalledNode`" `"$script:ServerPath`"" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    $secondCode = $second.WaitExit(5000)
    $secondMs = (Get-NowMs) - $t0
    $mtimeAfter = (Get-Item $dbPath -ErrorAction SilentlyContinue).LastWriteTimeUtc
    Stop-SpikeCleanly | Out-Null
    $aOk = ($secondCode -eq 11) -and ($secondMs -le 2000) -and ($mtimeBefore -eq $mtimeAfter)

    # b) a bare server (no supervisor), then supervise -> already_running, no restart
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $bare = Start-AsSpike -CommandLine "`"$script:InstalledNode`" `"$script:ServerPath`"" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
    Wait-HealthReady 15000 | Out-Null
    $sup = Start-Supervise
    $alreadyRunning = Wait-OpsEvent $since { $_.event -eq 'already_running' } 10000
    $supEnd = Wait-For { $sup.HasExited } 5000
    $crash = Wait-OpsEvent $since { $_.event -eq 'crash' } 1000
    $restartStart = Wait-OpsEvent $since { $_.event -eq 'server_started' -and [int]$_.restartCount -ge 1 } 1000
    Stop-SpikeCleanly | Out-Null
    $bOk = ($null -ne $alreadyRunning) -and ($null -ne $supEnd) -and ($null -eq $crash) -and ($null -eq $restartStart)
    $values = [ordered]@{
        a = [ordered]@{ secondServerExitCode = $secondCode; secondServerMs = $secondMs; dbMtimeUnchanged = ($mtimeBefore -eq $mtimeAfter) }
        b = [ordered]@{ alreadyRunning = [bool]$alreadyRunning; supervisorEnded = [bool]$supEnd; crash = [bool]$crash; restarted = [bool]$restartStart }
    }
    New-Result ($aOk -and $bOk) "a) zweiter Server Exit $secondCode, DB unverändert; b) already_running, kein Neustart" $values
}

function Check-P36 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $r = Start-SupervisedReady 20000
    $lastStartId = $r.Health.startId
    $kills = @()
    $firstKillMs = $null
    for ($i = 1; $i -le 4; $i++) {
        $srv = Get-ServerProc
        if ($srv.Count -ne 1) { break }
        $killMs = Get-NowMs
        if (-not $firstKillMs) { $firstKillMs = $killMs }
        Stop-Process -Id $srv[0].Pid -Force
        $kills += $killMs
        if ($i -lt 4) {
            $h = Wait-HealthReady 20000 $lastStartId
            if ($h) { $lastStartId = $h.startId }
        }
    }
    $gaveUp = Wait-OpsEvent $since { $_.event -eq 'gave_up' } 15000
    $crashCount = (Get-EventsBy (Get-OpsEvents $since) 'crash').Count
    $supEnd = Wait-For { (Get-SupervisorProc).Count -eq 0 } 10000
    $gaveUpMs = if ($gaveUp) { [long]$gaveUp.ts } else { (Get-NowMs) }
    Add-Interval 'restart_limit' ($firstKillMs - 1000) ($gaveUpMs + 10000)
    Start-Sleep -Seconds 2
    $noMoreServer = (Get-ServerProc).Count -eq 0
    $sr = Get-StartResult
    Stop-SpikeCleanly | Out-Null
    $refMatch = ($gaveUp -and $sr -and $gaveUp.refNo -and ($gaveUp.refNo -eq $sr.refNo))
    $values = [ordered]@{ kills = $kills.Count; crashCount = $crashCount; gaveUpRefNo = $gaveUp.refNo; startResultRefNo = $sr.refNo; refMatch = $refMatch; supervisorEnded = [bool]$supEnd; noMoreServer = $noMoreServer }
    $passed = ($crashCount -eq 3) -and ($null -ne $gaveUp) -and $refMatch -and ($null -ne $supEnd) -and $noMoreServer
    New-Result $passed "3 Neustarts, gave_up $($gaveUp.refNo), gleiche Nummer in start-result.json, kein weiterer Server" $values
}

function Check-P37 {
    Clear-SpikeProcesses | Out-Null
    $since = Get-NowMs
    $r = Start-SupervisedReady 20000
    $srv = Get-ServerProc
    $sup = Get-SupervisorProc
    if ($srv.Count -ne 1 -or $sup.Count -ne 1) { Stop-SpikeCleanly | Out-Null; return (New-Result $false "Ausgangszustand nicht 1+1 (srv $($srv.Count), sup $($sup.Count))" @{}) }
    $serverProc = [SpikeNative]::OpenProc($srv[0].Pid)
    $t0 = Get-NowMs
    Stop-Process -Id $sup[0].Pid -Force
    $serverGone = Wait-For { $serverProc.HasExited } 6000
    $serverEndMs = (Get-NowMs) - $t0
    $ipc = Wait-OpsEvent $since { $_.event -eq 'ipc_disconnect' } 1000
    Clear-SpikeProcesses | Out-Null
    # next start: integrity_check ok
    $since2 = Get-NowMs
    $r2 = Start-SupervisedReady 20000
    $integ = Wait-OpsEvent $since2 { $_.event -eq 'integrity_check' } 20000
    Stop-SpikeCleanly | Out-Null
    $values = [ordered]@{ serverEndMs = $serverEndMs; ipcDisconnectLogged = [bool]$ipc; integrityCheck = $integ.result }
    $passed = ($null -ne $serverGone) -and ($serverEndMs -le 5000) -and ($integ.result -eq 'ok')
    New-Result $passed "Server endet in $serverEndMs ms, ipc_disconnect=$([bool]$ipc), integrity_check=$($integ.result)" $values
}

function Check-P38 {
    # directly after P3.7: stop whatever runs, then a fresh supervise takes the pipe <=2s, ready <=15s
    Clear-SpikeProcesses | Out-Null
    $t0 = Get-NowMs
    $sup = Start-Supervise
    $started = Wait-OpsEvent $t0 { $_.event -eq 'supervisor_started' } 4000
    $takeoverMs = if ($started) { [long]$started.ts - $t0 } else { $null }
    $health = Wait-HealthReady 15000
    $readyMs = (Get-NowMs) - $t0
    Stop-SpikeCleanly | Out-Null
    $values = [ordered]@{ pipeTakeoverMs = $takeoverMs; readyMs = $readyMs; healthStatus = $health.status }
    $passed = ($null -ne $takeoverMs -and $takeoverMs -le 2000) -and ($health.status -eq 'ready') -and ($readyMs -le 15000)
    New-Result $passed "neue Überwachung übernimmt die Pipe in $takeoverMs ms, Server ready in $readyMs ms" $values
}

# --- P2.3 (observers) ---------------------------------------------------------------------------

function Check-P23 {
    if ($script:ObserverError) { throw $script:ObserverError }
    $winRows = @(Import-Csv -Path $script:WinCsv)
    $procRows = @(Import-Csv -Path $script:ProcCsv)
    $watched = @('resellr-node.exe', 'node.exe', 'resellr-start.exe')
    $badWindows = @()
    foreach ($row in ($winRows | Where-Object { $_.event -eq 'appear' -and $_.preexisting -eq '0' -and $watched -contains $_.name })) {
        $ts = [long]$row.ts
        foreach ($iv in $script:Intervals) {
            if ($ts -ge $iv.fromMs -and $ts -le $iv.toMs) { $badWindows += [ordered]@{ ts = $ts; name = $row.name; pid = $row.pid; title = $row.title; action = $iv.action }; break }
        }
    }
    $nodePids = @($procRows | Where-Object { $_.name -match 'resellr-node\.exe|resellr-start\.exe' } | ForEach-Object { [string]$_.pid })
    $conhost = @($procRows | Where-Object { ($_.name -match 'conhost\.exe|OpenConsole\.exe') -and ($nodePids -contains [string]$_.ppid) } |
        ForEach-Object { [ordered]@{ ts = $_.ts; name = $_.name; pid = $_.pid; ppid = $_.ppid } })
    $startRow = @($winRows | Where-Object { $_.event -eq 'start' })
    $wwSession = if ($startRow.Count) { [int]$startRow[0].session } else { -1 }
    $sessionOk = ($script:SpikeSession -gt 0) -and ($wwSession -gt 0) -and ($wwSession -eq $script:SpikeSession)
    $values = [ordered]@{
        intervals = $script:Intervals; badWindows = $badWindows; conhostChildren = $conhost
        windowWatcherSession = $wwSession; spikeUserSession = $script:SpikeSession; sessionOk = $sessionOk
    }
    if (-not $sessionOk) {
        $reason = "Sitzungs-ID der spikeuser-Prozesse ($($script:SpikeSession)) bzw. des Fensterbeobachters ($wwSession) ist 0 oder ungleich; auf einem Dienst-Runner ohne interaktive Sitzung nicht aussagekräftig (0 Fenster und 0 conhost dennoch beobachtet: $($badWindows.Count)/$($conhost.Count))."
        return (New-Inconclusive "nicht aussagekräftig: Sitzung $($script:SpikeSession)/$wwSession; Fenster $($badWindows.Count), conhost $($conhost.Count)" $values $reason)
    }
    $passed = ($badWindows.Count -eq 0) -and ($conhost.Count -eq 0)
    New-Result $passed "$($badWindows.Count) sichtbare Fenster, $($conhost.Count) conhost/OpenConsole-Kinder in den Fenstern" $values
}

# --- P2.4 (Defender) ----------------------------------------------------------------------------

function Get-EicarBytes {
    # EICAR standard anti-virus test string, assembled at runtime so the signature is never a
    # contiguous literal in the repository. Written only to a temporary file and deleted after use.
    $sig = 'EICAR' + '-STANDARD-' + 'ANTIVIRUS-' + 'TEST-FILE'
    $text = 'X5O!P%@AP[4\PZX54(P^)7CC)7}' + '$' + $sig + '!$H+H*'
    return [System.Text.Encoding]::ASCII.GetBytes($text)
}

function Invoke-DefenderScan([string]$Mp, [string]$File) {
    $out = Join-Path $script:WorkDir ('mp-' + [guid]::NewGuid().ToString('N') + '.txt')
    $p = Start-Process -FilePath $Mp -ArgumentList @('-Scan', '-ScanType', '3', '-File', "`"$File`"", '-DisableRemediation') -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $out
    $text = if (Test-Path $out) { (Get-Content -Raw $out) } else { '' }
    Remove-Item -Force -ErrorAction SilentlyContinue $out
    [pscustomobject]@{ ExitCode = $p.ExitCode; Output = $text }
}

function Check-P24 {
    $mp = Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe'
    if (-not (Test-Path $mp)) { return (New-Inconclusive 'MpCmdRun.exe nicht gefunden' @{ mpCmdRun = $mp } 'Defender-Kommandozeile fehlt im Image.') }
    $status = $null; try { $status = Get-MpComputerStatus } catch {}
    if (-not $status -or -not $status.AMServiceEnabled) {
        return (New-Inconclusive 'AMServiceEnabled=false' @{ amServiceEnabled = ($status.AMServiceEnabled) } 'Defender-Dienst nicht aktiv; TR-05 bleibt für die Abnahme offen.')
    }
    $targets = @(
        @{ name = 'build'; file = $script:StageNode },
        @{ name = 'installed'; file = $script:InstalledNode },
        @{ name = 'setup'; file = $script:SetupExe }
    )
    # remove exclusions covering our folders/files
    $removed = @()
    try {
        $pref = Get-MpPreference
        $cover = @($targets | ForEach-Object { $_.file }) + @($targets | ForEach-Object { Split-Path -Parent $_.file })
        foreach ($ex in @($pref.ExclusionPath)) {
            if ($cover | Where-Object { $_ -and $_.ToLower().StartsWith($ex.ToLower()) }) { Remove-MpPreference -ExclusionPath $ex; $removed += $ex }
        }
        foreach ($ext in @($pref.ExclusionExtension)) {
            if ($ext -and ($ext.TrimStart('.').ToLower() -eq 'exe')) { Remove-MpPreference -ExclusionExtension $ext; $removed += ".$($ext.TrimStart('.'))" }
        }
    }
    catch {}
    # signature update
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Start-Process -FilePath $mp -ArgumentList @('-SignatureUpdate') -Wait -WindowStyle Hidden | Out-Null
    $sigUpdateMs = $sw.ElapsedMilliseconds
    $status2 = Get-MpComputerStatus
    $sigAgeDays = if ($status2.AntivirusSignatureLastUpdated) { ((Get-Date) - $status2.AntivirusSignatureLastUpdated).TotalDays } else { 999 }

    $folders = $targets | Group-Object { Split-Path -Parent $_.file } | ForEach-Object { $_.Name }
    $positive = @()
    $positiveOk = $true
    foreach ($folder in $folders) {
        $eicarPath = Join-Path $folder 'resellr-spike-eicar.test'
        [System.IO.File]::WriteAllBytes($eicarPath, (Get-EicarBytes))
        $scan = Invoke-DefenderScan $mp $eicarPath
        Remove-Item -Force -ErrorAction SilentlyContinue $eicarPath
        $positive += [ordered]@{ folder = $folder; exitCode = $scan.ExitCode }
        if ($scan.ExitCode -ne 2) { $positiveOk = $false }
    }
    $scans = @()
    $scanProblem = $false
    foreach ($t in $targets) {
        $scan = Invoke-DefenderScan $mp $t.file
        $scans += [ordered]@{ name = $t.name; file = $t.file; exitCode = $scan.ExitCode; output = ($scan.Output.Trim()) }
        if ($scan.ExitCode -notin @(0, 2)) { $scanProblem = $true }
    }
    $detections = @()
    try {
        foreach ($d in @(Get-MpThreatDetection)) {
            foreach ($res in @($d.Resources)) {
                if ($targets | Where-Object { $res -match [regex]::Escape($_.file) }) {
                    $detections += [ordered]@{ threat = $d.ThreatID; resource = $res }
                }
            }
        }
    }
    catch {}
    $values = [ordered]@{
        amServiceEnabled = $status2.AMServiceEnabled; signatureVersion = $status2.AntivirusSignatureVersion
        signatureUpdateMs = $sigUpdateMs; signatureAgeDays = [math]::Round($sigAgeDays, 2); removedExclusions = $removed
        positiveControls = $positive; scans = $scans; threatDetections = $detections
    }
    if ($scanProblem -or (-not $positiveOk) -or ($sigAgeDays -gt 7)) {
        $reason = "Nicht aussagekräftig: Positivkontrolle ok=$positiveOk, unerwarteter Exit-Code=$scanProblem, Signaturalter ${sigAgeDays} Tage. TR-05 bleibt für die Abnahme offen."
        return (New-Inconclusive "nicht aussagekräftig (Positivkontrolle/Signaturen)" $values $reason)
    }
    $threatInResellr = @($detections | Where-Object { $_.resource -match 'resellr-node\.exe' })
    if ($threatInResellr.Count -gt 0) { $script:P2RTrigger = $true }
    $threatFiles = @($scans | Where-Object { $_.exitCode -eq 2 } | ForEach-Object { $_.name })
    $passed = ($threatFiles.Count -eq 0) -and ($detections.Count -eq 0)
    $reason = if ($passed) { '' } elseif ($threatInResellr.Count -gt 0) { 'Bedrohung in resellr-node.exe: löst Rückfallweg P2.R aus.' } else { 'Bedrohung nur im Installer: Eskalation, kein P2.R.' }
    New-Result $passed "Positivkontrollen Exit 2, drei Dateien Exit 0, keine Bedrohung" $values $reason
}

# --- P2.R (fallback S2, only if P2.3 failed or P2.4 found a threat in resellr-node.exe) ----------

function Check-P2R {
    $p23 = $script:Checks['P2.3']
    $triggerByWindow = ($p23 -and $p23.statusCode -eq 'failed')
    if (-not ($triggerByWindow -or $script:P2RTrigger)) {
        return (New-NotTriggered 'P2.3 bestanden/ nicht aussagekräftig und keine Bedrohung in resellr-node.exe' @{ p23Status = $p23.statusCode; threatInResellr = $script:P2RTrigger })
    }
    # locate the MSVC compiler
    $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    $cl = $null
    if (Test-Path $vswhere) {
        $inst = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($inst) {
            $cl = Get-ChildItem (Join-Path $inst 'VC\Tools\MSVC') -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin\Hostx64\x64\cl.exe' } |
                Where-Object { Test-Path $_ } | Select-Object -First 1
        }
    }
    if (-not $cl) { return (New-Inconclusive 'MSVC cl.exe nicht gefunden' @{} 'Kein C-Compiler im Image; Rückfallweg nicht baubar.') }
    $stubDir = Join-Path $script:BuildDir 'p2r'
    New-Item -ItemType Directory -Force -Path $stubDir | Out-Null
    Copy-Item $script:RuntimeNode (Join-Path $stubDir 'node.exe') -Force
    Copy-Item (Join-Path (Split-Path $PSScriptRoot -Parent) 'stub\resellr-start.c') $stubDir -Force
    Push-Location $stubDir
    # cl.exe needs the INCLUDE/LIB environment from vcvars64.bat; a batch file keeps the quoting simple.
    $vcvars = Join-Path $inst 'VC\Auxiliary\Build\vcvars64.bat'
    $buildBat = Join-Path $stubDir 'build-stub.cmd'
    Set-Content -Path $buildBat -Encoding ascii -Value "@echo off`r`ncall `"$vcvars`" >nul || exit /b 1`r`n`"$cl`" /nologo /O2 resellr-start.c /link /SUBSYSTEM:WINDOWS`r`nexit /b %ERRORLEVEL%"
    try { & cmd.exe /d /c $buildBat | Out-Host } finally { Pop-Location }
    $startExe = Join-Path $stubDir 'resellr-start.exe'
    if (-not (Test-Path $startExe)) { return (New-Inconclusive 'resellr-start.exe nicht gebaut' @{} 'Kompilat fehlt.') }
    $mp = Join-Path $env:ProgramFiles 'Windows Defender\MpCmdRun.exe'
    $scan = Invoke-DefenderScan $mp $startExe
    $values = [ordered]@{ compiler = $cl; stub = $startExe; scanExitCode = $scan.ExitCode; triggerByWindow = $triggerByWindow; triggerByThreat = $script:P2RTrigger }
    $passed = ($scan.ExitCode -eq 0)
    New-Result $passed "Rückfall-Stub gebaut und gescannt (Exit $($scan.ExitCode))" $values 'P2.R ausgelöst; Fenster-/Konsolenprüfung des Stubs erfolgt am Arbeitsplatzrechner (keine interaktive Sitzung im Runner).'
}

function Check-P15 {
    $unins = Join-Path $script:ProgDir 'unins000.exe'
    $code = $null
    if (Test-Path $unins) {
        $p = Start-AsSpike -CommandLine "`"$unins`" /VERYSILENT" -Flags ([SpikeNative]::CREATE_NO_WINDOW)
        $code = $p.WaitExit(120000)
        Wait-For { -not (Test-Path $script:ProgDir) } 15000 | Out-Null
    }
    $progGone = -not (Test-Path $script:ProgDir)
    $autostart = Invoke-SpikeCapture 'reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v resellr-spike'
    $autostartGone = ($autostart.Code -ne 0)
    $programs = Join-Path $script:SpikeProfile 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs'
    $shortcutsGone = -not (Test-Path (Join-Path $programs 'resellr-spike.lnk')) -and -not (Test-Path (Join-Path $programs 'resellr-spike beenden.lnk'))
    $dbPath = Join-Path $script:DataDir 'resellr.db'
    $dbPresent = Test-Path $dbPath
    $values = [ordered]@{ uninstallExitCode = $code; programDirRemoved = $progGone; autostartRemoved = $autostartGone; shortcutsRemoved = $shortcutsGone; dbPath = $dbPath; dbStillPresent = $dbPresent }
    $passed = ($code -eq 0) -and $progGone -and $autostartGone -and $shortcutsGone -and $dbPresent
    New-Result $passed "Exit $code; Programm/Autostart/Verknüpfungen entfernt; Daten-DB erhalten=$dbPresent" $values
}

# ================================================================================================
# Main
# ================================================================================================
$script:BuildDir = (Resolve-Path $BuildDir).Path
foreach ($f in @($script:RuntimeNode, $script:StageNode, $script:SetupExe)) {
    if (-not (Test-Path $f)) { throw "required build artifact missing: $f" }
}
Initialize-WorkDir
New-SpikeUser
$e1 = Test-StandardUser
Write-Environment $e1 | Out-Null
if ($e1.isAdmin) { Write-Host '::warning::spikeuser is a member of Administrators (E-1 violated)' }

Invoke-Check 'P1.1' { Check-P11 }
Start-Observers
Invoke-Check 'P1.2' { Check-P12 }
Invoke-Check 'P1.3' { Check-P13 }
Invoke-Check 'P1.4' { Check-P14 }
Invoke-Check 'P2.1' { Check-P21 }
Invoke-Check 'P2.2' { Check-P22 }
Invoke-Check 'P5.2' { Check-P52 }
Invoke-Check 'P3.1' { Check-P31 }
Invoke-Check 'P3.2' { Check-P32 }
Invoke-Check 'P3.3' { Check-P33 }
Invoke-Check 'P3.4' { Check-P34 }
Invoke-Check 'P3.5' { Check-P35 }
Invoke-Check 'P3.6' { Check-P36 }
Invoke-Check 'P3.7' { Check-P37 }
Invoke-Check 'P3.8' { Check-P38 }
Stop-Observers
Invoke-Check 'P2.3' { Check-P23 }
Invoke-Check 'P2.4' { Check-P24 }
Invoke-Check 'P2.R' { Check-P2R }
Invoke-Check 'P1.5' { Check-P15 }

# Evidence from the spikeuser profile for the artifact.
Save-Evidence $script:OpsLog 'operations.jsonl'
Save-Evidence $script:WinLog 'window-watch.log'
Save-Evidence $script:StartResultFile 'start-result.json'

Write-Host '--- summary ---'
foreach ($id in $script:Checks.Keys) { Write-Host "$id : $($script:Checks[$id].status)" }
