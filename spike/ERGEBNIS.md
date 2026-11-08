# Windows-Spike (Schnitt 0) — Ergebnis

Wegwerf-Prototyp zum Nachweis der Windows-Annahmen S-1, S-2, S-3, S-5 und S-7 (GitHub-Issue #2, Spike-Auftrag v1.2). Kein Produktcode, kein Merge nach `main`.

## Maßgeblicher Lauf

- Commit: `9428f22722e7872e9ff8adde013d179ae7b190f4`
- Lauf: https://github.com/MarloNET/resellr/actions/runs/42475377911
- Artefakt: `windows-spike-results` (30 Tage) am maßgeblichen Lauf
- Umgebung: Image win25-vs2026 20261103.298.1, Microsoft Windows Server 2025 Datacenter, Windows-Build 10.0.26100.33674, Node v26.13.0, npm 11.20.0, Chrome 156.0.8078.80
- spikeuser: Administrator=False (E-1: kein Administrator erwartet)
- Defender: AMServiceEnabled=True, Signaturversion 1.463.189.0
- Dauer des maßgeblichen Laufs: 5 min 57 s (Job), Budgetgrenze 18 min eingehalten
- Verbrauchte Windows-Minuten: insgesamt 4 von höchstens 10 Läufen, 27 min 7 s Job-Laufzeit; abgerechnet (je Job auf volle Minuten aufgerundet, Windows zählt doppelt) 29 × 2 = **58 Windows-Minuten**. Die Timing-API von GitHub weist für die Läufe 0 abgerechnete Millisekunden aus, die Zahl oben ist die Obergrenze nach der Abrechnungsregel.

## Prüfungen

| Prüfung | Status | Messwert | Hinweis |
| --- | --- | --- | --- |
| P1.1 | bestanden | Exit 0 in 38498 ms, Installation unter LocalAppData, kein HKLM-Eintrag |  |
| P1.2 | bestanden | Autostart-Wert Typ REG_SZ, zeichengleich=True |  |
| P1.3 | bestanden | ready in 879 ms; 1 Überwachung + 1 Server, Besitzer spikeuser, Server Kind der Überwachung |  |
| P1.4 | bestanden | Verknüpfungen Ziel/Argumente ok=True; stopped nach 235 ms |  |
| P1.5 | bestanden | Exit 0; Programm/Autostart/Verknüpfungen entfernt; Daten-DB erhalten=True |  |
| P2.1 | bestanden | Subsystem 3->2, resellr-node unsigniert, Prüfsumme bestätigt, nur 14 Bytes verschieden |  |
| P2.2 | bestanden | resellr-node.exe meldet v26.13.0 (node.exe v26.13.0) |  |
| P2.3 | bestanden | 0 sichtbare Fenster, 0 conhost/OpenConsole-Kinder in den Fenstern |  |
| P2.4 | bestanden | Positivkontrollen Exit 2, drei Dateien Exit 0, keine Bedrohung |  |
| P2.R | nicht ausgelöst | Auslösebedingung nicht erfüllt: P2.3 bestanden und keine Bedrohung in resellr-node.exe | Rückfallweg Start-Baustein nicht nötig |
| P3.1 | bestanden | 10/10 Wiederholungen: genau 1 Überwachung + 1 Server, 1 supervisor_started, 5 already_supervised, open ready |  |
| P3.2 | bestanden | Exit 4294967295, crash R-F8EE-90E6, neuer Server nach 5028 ms, wieder ready |  |
| P3.3 | bestanden | 200, Überwachung endet in 261 ms, nach 10 s kein Prozess, Übernahme in 94 ms |  |
| P3.4 | bestanden | supervise Exit 10, aborted R-43C7-EVFC, open erhält dieselbe Nummer, kein Neustart |  |
| P3.5 | bestanden | a) zweiter Server Exit 11, DB unverändert; b) already_running, kein Neustart |  |
| P3.6 | bestanden | 3 Neustarts, gave_up R-39XQ-6AHS, gleiche Nummer in start-result.json, kein weiterer Server |  |
| P3.7 | bestanden | Server endet in 54 ms, ipc_disconnect=True, integrity_check=ok |  |
| P3.8 | bestanden | neue Überwachung übernimmt die Pipe in 116 ms, Server ready in 711 ms |  |
| P5.1 | bestanden | v26.13.0: vorkompiliert (1 Versuch(e)) |  |
| P5.2 | bestanden | beide Module aus dem Profil geladen, WAL, 1000 Zeilen, sharp 1600/320 px |  |
| Z1.1 | bestanden | Wechsel nach 1148 ms, 0 Konsolenfehler |  |
| Z1.2 | bestanden | Wechsel nach 959 ms, Referenznummer R-Z1T2-ABCD |  |
| Z1.3 | bestanden | data:-URL check=true; relative Datei check=true (notiert) |  |

## Annahmen

| Annahme | Ergebnis |
| --- | --- |
| S-1 | bestätigt |
| S-2 | bestätigt; Defender: bestätigt |
| S-3 | bestätigt |
| S-5 | bestätigt |
| S-7 | bestätigt |

Die Einzelwerte je Prüfung (Versätze, Exit-Codes, Scan-Ausgaben, Zeitstempel) stehen in `results.json` und `checks/<ID>.json` im Artefakt.

## Verlauf der Läufe

Nur Lauf 4 ist maßgeblich. Die Läufe 1 bis 3 scheiterten an Fehlern im Prüfskript, nicht am Prototyp; der Prototyp selbst wurde zwischen Lauf 1 und Lauf 4 nicht geändert.

| Lauf | Commit | Job-Dauer | Ergebnis |
| --- | --- | --- | --- |
| [1](https://github.com/MarloNET/resellr/actions/runs/42471043035) | `7705172` | 6 min 19 s | Abbruch nach P1.1: Fensterbeobachter als `spikeuser` startete nicht (Prüfskript) |
| [2](https://github.com/MarloNET/resellr/actions/runs/42472749209) | `51b4843` | 9 min 32 s | vollständig, Prüfskriptfehler in P1.4, P2.1, P2.3, P3.2, P2.R; P5.1-Download aus dem Runner mit Zeitüberschreitung/504 |
| [3](https://github.com/MarloNET/resellr/actions/runs/42474323981) | `885bab1` | 5 min 19 s | alles bestanden außer P1.4 (Prüfskript: Fortschrittsausgabe von `powershell.exe` störte das Einlesen) |
| [4](https://github.com/MarloNET/resellr/actions/runs/42475377911) | `9428f22` | 5 min 57 s | **maßgeblich**: alle Prüfungen mit Status, alle bestanden, P2.R nicht ausgelöst |

## Grenzen der Aussage

- Prüfumgebung ist Windows Server 2025 im GitHub-Runner, nicht Windows 11. Der Runner läuft in einer interaktiven Sitzung (Sitzung 2), in der der Fensterbeobachter für P2.3 als `spikeuser` lief.
- Nicht im Umfang dieses Spikes (Issue #2, Abschnitt „Nicht im Umfang“): Abmelden/Herunterfahren (S-4, Abnahme), Fläche 1366 × 768 (S-6, entfallen), S-8 und `stop` über die Pipe (CU-278), SmartScreen und Smart App Control, Start durch echte Anmeldung (Abnahme, Specification Kap. 6.4).
