# Process watcher (spike assignment chapter 4): Win32_ProcessStartTrace via WMI events,
# every new process with name, PID, parent PID and session ID. Output CSV.
param(
    [Parameter(Mandatory)] [string]$OutCsv,
    [Parameter(Mandatory)] [string]$StopFile,
    [Parameter(Mandatory)] [string]$ReadyFile
)
$ErrorActionPreference = 'Stop'

function Get-NowMs { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

$writer = [System.IO.StreamWriter]::new($OutCsv, $false, [System.Text.UTF8Encoding]::new($false))
$writer.AutoFlush = $true
$writer.WriteLine('ts,event,name,pid,ppid,session,createdMs')
Register-CimIndicationEvent -ClassName Win32_ProcessStartTrace -SourceIdentifier spikeProcessStart | Out-Null
$writer.WriteLine("$(Get-NowMs),start,process-watch,$PID,,$((Get-Process -Id $PID).SessionId),")
Set-Content -Path $ReadyFile -Value 'ready'

try {
    while (-not (Test-Path $StopFile)) {
        $evt = Wait-Event -SourceIdentifier spikeProcessStart -Timeout 1
        if ($null -eq $evt) { continue }
        $n = $evt.SourceEventArgs.NewEvent
        $createdMs = [long]([UInt64]$n.TIME_CREATED / 10000) - 11644473600000
        $writer.WriteLine("$(Get-NowMs),process,$($n.ProcessName),$($n.ProcessID),$($n.ParentProcessID),$($n.SessionID),$createdMs")
        Remove-Event -EventIdentifier $evt.EventIdentifier
    }
}
finally {
    $writer.WriteLine("$(Get-NowMs),stop,process-watch,$PID,,,")
    Unregister-Event -SourceIdentifier spikeProcessStart -ErrorAction SilentlyContinue
    $writer.Dispose()
}
