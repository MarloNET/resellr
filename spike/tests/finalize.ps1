# Aggregates all check outputs (run-spike checks, P5.1 npm-ci, Z-1 Playwright) into results.json,
# writes the GitHub job summary and a German results document. Test tooling only, not product code.
param(
    [Parameter(Mandatory)] [string]$ResultsDir
)
$ErrorActionPreference = 'Stop'
$checksDir = Join-Path $ResultsDir 'checks'
$p51Dir = Join-Path $ResultsDir 'p51'
$z1Dir = Join-Path $ResultsDir 'z1-results'

$statusDe = @{ passed = 'bestanden'; failed = 'nicht bestanden'; inconclusive = 'nicht aussagekräftig'; not_triggered = 'nicht ausgelöst' }
function De([string]$code) { if ($statusDe.ContainsKey([string]$code)) { $statusDe[$code] } else { [string]$code } }

$checks = [ordered]@{}

# run-spike checks
if (Test-Path $checksDir) {
    foreach ($f in Get-ChildItem $checksDir -Filter '*.json') {
        $c = Get-Content $f.FullName -Raw | ConvertFrom-Json
        $checks[[string]$c.id] = [ordered]@{ id = $c.id; statusCode = $c.statusCode; status = (De $c.statusCode); summary = $c.summary; reason = $c.reason; durationMs = $c.durationMs }
    }
}

# P5.1 (one entry; prefer Node 26, note the Node 24 fallback when present)
$p51 = @{}
if (Test-Path $p51Dir) {
    foreach ($f in Get-ChildItem $p51Dir -Filter 'p51-*.json') {
        $r = Get-Content $f.FullName -Raw | ConvertFrom-Json
        $p51[[string]$r.label] = $r
    }
}
if ($p51.Count) {
    $node26 = $p51['node26']
    $node24 = $p51['node24']
    $statusCode = if ($node26 -and $node26.passed) { 'passed' } elseif ($node24 -and $node24.passed) { 'passed' }
        elseif (($node26 -and $node26.inconclusive) -or ($node24 -and $node24.inconclusive)) { 'inconclusive' } else { 'failed' }
    $parts = @()
    foreach ($k in @('node26', 'node24')) {
        if ($p51[$k]) {
            $state = if ($p51[$k].passed) { 'vorkompiliert' } elseif ($p51[$k].inconclusive) { 'Download des vorkompilierten Pakets nicht erreichbar' } else { 'nicht vorkompiliert' }
            $parts += "$($p51[$k].node): $state ($(@($p51[$k].attempts).Count) Versuch(e))"
        }
    }
    $reason = if ($statusCode -eq 'inconclusive') { 'GitHub-Release-Download aus dem Runner nach allen Versuchen nicht erreichbar (Zeitüberschreitung/5xx); Voraussetzung im Runner nicht gegeben.' } else { '' }
    $checks['P5.1'] = [ordered]@{ id = 'P5.1'; statusCode = $statusCode; status = (De $statusCode); summary = ($parts -join '; '); reason = $reason; durationMs = ($node26.durationMs) }
}

# Z-1
if (Test-Path $z1Dir) {
    foreach ($id in @('Z1.1', 'Z1.2', 'Z1.3')) {
        $f = Join-Path $z1Dir "$id.json"
        if (Test-Path $f) {
            $z = Get-Content $f -Raw | ConvertFrom-Json
            $checks[$id] = [ordered]@{ id = $id; statusCode = $z.status; status = (De $z.status); summary = $z.summary; reason = $z.reason; durationMs = $null }
        }
        else {
            $checks[$id] = [ordered]@{ id = $id; statusCode = 'failed'; status = (De 'failed'); summary = 'kein Ergebnis'; reason = 'Z-1-Ergebnisdatei fehlt'; durationMs = $null }
        }
    }
}

# order
$order = @('P1.1', 'P1.2', 'P1.3', 'P1.4', 'P1.5', 'P2.1', 'P2.2', 'P2.3', 'P2.4', 'P2.R', 'P3.1', 'P3.2', 'P3.3', 'P3.4', 'P3.5', 'P3.6', 'P3.7', 'P3.8', 'P5.1', 'P5.2', 'Z1.1', 'Z1.2', 'Z1.3')
$ordered = [System.Collections.Generic.List[object]]::new()
foreach ($id in $order) { if ($checks.Contains($id)) { $ordered.Add($checks[$id]) } }
foreach ($id in $checks.Keys) { if ($order -notcontains $id) { $ordered.Add($checks[$id]) } }

$env = $null
$envFile = Join-Path $ResultsDir 'environment.json'
if (Test-Path $envFile) { $env = Get-Content $envFile -Raw | ConvertFrom-Json }

function Code([string]$id) { if ($checks.Contains($id)) { [string]$checks[$id].statusCode } else { 'missing' } }
function All([string[]]$ids) { ($ids | Where-Object { (Code $_) -ne 'passed' }).Count -eq 0 }

# S-x mapping
$s1 = if (All @('P1.1', 'P1.2', 'P1.3')) { 'bestätigt' } else { 'Rückfallweg nötig' }
$p23 = Code 'P2.3'
$s2console = if ((All @('P2.1', 'P2.2')) -and $p23 -eq 'passed') { 'bestätigt' } elseif ($p23 -eq 'inconclusive') { 'nicht aussagekräftig (Konsolenfenster-Prüfung -> Abnahme)' } else { 'Rückfallweg nötig (P2.R)' }
$p24 = Code 'P2.4'
$s2defender = switch ($p24) { 'passed' { 'bestätigt' } 'inconclusive' { 'nicht aussagekräftig (Defender-Scan -> Abnahme)' } default { 'Befund -> Eskalation/P2.R' } }
$s2 = "$s2console; Defender: $s2defender"
$s3 = if (All @('P3.1', 'P3.2', 'P3.3', 'P3.4', 'P3.5', 'P3.6', 'P3.7', 'P3.8')) { 'bestätigt' } else { 'Rückfallweg nötig' }
$s5 = if (All @('P5.1', 'P5.2')) { 'bestätigt' } else { 'Rückfallweg nötig' }
$s7 = if (All @('Z1.1', 'Z1.2')) { 'bestätigt' } else { 'Rückfallweg nötig' }
$sx = [ordered]@{ 'S-1' = $s1; 'S-2' = $s2; 'S-3' = $s3; 'S-5' = $s5; 'S-7' = $s7 }

$runUrl = if ($env:GITHUB_SERVER_URL -and $env:GITHUB_REPOSITORY -and $env:GITHUB_RUN_ID) { "$($env:GITHUB_SERVER_URL)/$($env:GITHUB_REPOSITORY)/actions/runs/$($env:GITHUB_RUN_ID)" } else { $null }

$results = [ordered]@{
    schema = 'resellr.windows-spike.results.v1'
    commit = $env:GITHUB_SHA
    runId = $env:GITHUB_RUN_ID
    runUrl = $runUrl
    environment = $env
    checks = $ordered
    assumptions = $sx
    generatedAt = (Get-Date).ToString('o')
}
$results | ConvertTo-Json -Depth 12 | Set-Content -Path (Join-Path $ResultsDir 'results.json') -Encoding utf8

# --- job summary --------------------------------------------------------------------------------
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('# Windows-Spike (Schnitt 0) — Ergebnis')
[void]$sb.AppendLine('')
if ($env) { [void]$sb.AppendLine("Image: $($env.imageOs) $($env.imageVersion); Windows-Build $($env.windowsBuild); Node $($env.node); Chrome $($env.chrome)") }
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Prüfung | Status | Wichtigster Messwert |')
[void]$sb.AppendLine('| --- | --- | --- |')
foreach ($c in $ordered) { [void]$sb.AppendLine("| $($c.id) | $($c.status) | $($c.summary) |") }
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Annahme | Ergebnis |')
[void]$sb.AppendLine('| --- | --- |')
foreach ($k in $sx.Keys) { [void]$sb.AppendLine("| $k | $($sx[$k]) |") }
$summaryText = $sb.ToString()
if ($env:GITHUB_STEP_SUMMARY) { $summaryText | Add-Content -Path $env:GITHUB_STEP_SUMMARY -Encoding utf8 }

# --- results document ---------------------------------------------------------------------------
$md = [System.Text.StringBuilder]::new()
[void]$md.AppendLine('# Windows-Spike (Schnitt 0) — Ergebnis')
[void]$md.AppendLine('')
[void]$md.AppendLine('Wegwerf-Prototyp zum Nachweis der Windows-Annahmen S-1, S-2, S-3, S-5 und S-7 (GitHub-Issue #2, Spike-Auftrag v1.2). Kein Produktcode, kein Merge nach `main`.')
[void]$md.AppendLine('')
[void]$md.AppendLine('## Maßgeblicher Lauf')
[void]$md.AppendLine('')
[void]$md.AppendLine("- Commit: ``$($env:GITHUB_SHA)``")
if ($runUrl) { [void]$md.AppendLine("- Lauf: $runUrl") }
[void]$md.AppendLine('- Artefakt: `windows-spike-results` (30 Tage) am maßgeblichen Lauf')
if ($env) {
    [void]$md.AppendLine("- Umgebung: Image $($env.imageOs) $($env.imageVersion), $($env.osCaption), Windows-Build $($env.windowsBuild), Node $($env.node), npm $($env.npm), Chrome $($env.chrome)")
    [void]$md.AppendLine("- spikeuser: Administrator=$($env.spikeuser.isAdmin) (E-1: kein Administrator erwartet)")
    [void]$md.AppendLine("- Defender: AMServiceEnabled=$($env.defender.amServiceEnabled), Signaturversion $($env.defender.antivirusSignatureVersion)")
}
[void]$md.AppendLine('- Verbrauchte Windows-Minuten: <!-- bitte aus der Abrechnung des maßgeblichen Laufs eintragen (Windows zählt doppelt) -->')
[void]$md.AppendLine('')
[void]$md.AppendLine('## Prüfungen')
[void]$md.AppendLine('')
[void]$md.AppendLine('| Prüfung | Status | Messwert | Hinweis |')
[void]$md.AppendLine('| --- | --- | --- | --- |')
foreach ($c in $ordered) { [void]$md.AppendLine("| $($c.id) | $($c.status) | $($c.summary) | $($c.reason) |") }
[void]$md.AppendLine('')
[void]$md.AppendLine('## Annahmen')
[void]$md.AppendLine('')
[void]$md.AppendLine('| Annahme | Ergebnis |')
[void]$md.AppendLine('| --- | --- |')
foreach ($k in $sx.Keys) { [void]$md.AppendLine("| $k | $($sx[$k]) |") }
[void]$md.AppendLine('')
[void]$md.AppendLine('Die Einzelwerte je Prüfung (Versätze, Exit-Codes, Scan-Ausgaben, Zeitstempel) stehen in `results.json` und `checks/<ID>.json` im Artefakt.')
$md.ToString() | Set-Content -Path (Join-Path $ResultsDir 'ergebnis-generated.md') -Encoding utf8

Write-Host $summaryText
