# Betriebshandbuch resellr (Release 0.1)

Dieses Handbuch beschreibt den Betrieb von resellr auf Ihrem Arbeitsplatzrechner mit Windows 11: Installation, Start, Beenden, Handsicherung, Wiederherstellung, Update, Fehlermeldung und Verfügbarkeitsbericht. Es liegt nach der Installation als `Betriebshandbuch.pdf` im Programmordner.

Am Ende jedes Abschnitts steht, auf welche freigegebenen Quellen er sich stützt: Technical Specification v0.5.1 (TS), Requirements v0.3.3 (REQ), Architecture Baseline (Baseline) und Architecture Decision Records (ADR).

## Inhalt

1. Überblick: Ordner und Verknüpfungen
2. Installation
3. Start
4. Beenden
5. Handsicherung
6. Wiederherstellung
7. Update
8. Fehlermeldung
9. Verfügbarkeitsbericht

## 1. Überblick: Ordner und Verknüpfungen

resellr läuft vollständig in Ihrem Windows-Benutzerkonto. Es ist nur von diesem PC aus erreichbar, unter der lokalen Adresse `http://127.0.0.1:4310/` in Google Chrome.

| Ordner | Speicherort | Inhalt | Gehört in die Sicherung? |
| --- | --- | --- | --- |
| Programmordner | `%LOCALAPPDATA%\Programs\resellr` | Programmdateien, `Verfügbarkeitsbericht.cmd`, `Betriebshandbuch.pdf`, `THIRD-PARTY-NOTICES.txt` | nein |
| **Datenordner** | `%LOCALAPPDATA%\resellr\Daten` | alle Daten: Datenbank `resellr.db`, Fotos und Logo im Ordner `media`, Einstellungsdatei `config.json` | **ja, als Ganzes** |
| Protokollordner | `%LOCALAPPDATA%\resellr\Protokolle` | Fehler-, Betriebs- und Verfügbarkeitsprotokoll, Verfügbarkeitsberichte | nein |
| Übergabeordner | `%LOCALAPPDATA%\resellr\Fotoübergabe` | Foto-Übergaben und ZIP-Dateien, werden nach 7 Tagen gelöscht | nein |
| Kopien vor Updates | `%LOCALAPPDATA%\resellr\Update-Kopien` | je Update eine Kopie von Datenbank und `config.json`, die letzten 3 bleiben erhalten | nein |

`%LOCALAPPDATA%` steht für den Ordner `AppData\Local` in Ihrem Benutzerprofil. Den vollständigen Speicherort des Datenordners zeigt resellr im Hinweis „Sicherung einrichten“ links in der Navigationsspalte.

Der Datenordner liegt bewusst nicht unter „Dokumente“ oder „Desktop“: Windows synchronisiert diese Ordner oft mit OneDrive, und eine Synchronisierung der laufenden Datenbank kann sie beschädigen.

Die Installation legt diese Verknüpfungen an:

| Verknüpfung | Ort | Wirkung |
| --- | --- | --- |
| „resellr“ | Startmenü und Desktop | startet resellr, falls nötig, und öffnet es in Chrome |
| „resellr beenden“ | Startmenü | beendet resellr geordnet und zeigt das Ergebnis |
| Autostart-Eintrag „resellr“ | Windows-Anmeldung | startet resellr bei jeder Anmeldung im Hintergrund, ohne Chrome zu öffnen |

*Quellen: TS 2.19 (Ordner, `config.json`, Installationspaket), TS 2.18 (Befehle des Launchers), Baseline 10.1, 10.2, REQ-106, ADR-006, ADR-008.*

## 2. Installation

### Voraussetzungen

- Windows 11 x64 und Google Chrome. Findet resellr Chrome nicht, öffnet es die Adresse im Standardbrowser.
- Keine Adminrechte nötig: resellr installiert sich nur für Ihr Benutzerkonto.
- Smart App Control (Intelligente App-Steuerung) steht in „Windows-Sicherheit“ auf „Aus“. Ist sie bei Ihnen eingeschaltet, installieren Sie resellr nicht und informieren Sie MarloNET: Das Paket ist nicht code-signiert und läuft dann nicht.

### Ablauf

1. Laden Sie das Installationspaket `resellr-setup-<Version>.exe` aus den GitHub Releases von `MarloNET/resellr` herunter.
2. Starten Sie die heruntergeladene Datei.
3. **SmartScreen-Warnung:** Weil das Paket nicht code-signiert ist, zeigt Windows SmartScreen eine Warnung. Bestätigen Sie, dass Sie das Paket ausführen möchten. Die Warnung erscheint bei jedem Ausführen eines heruntergeladenen Pakets, also bei der Installation und bei jedem Update.
4. Die Installation legt Programmordner, Autostart-Eintrag und Verknüpfungen an und öffnet resellr am Ende in Chrome.

Beim ersten Start legt resellr die Datenbank an und spielt die Startbelegung ein. Die Einstellungsdatei `config.json` entsteht dabei mit dem Port 4310.

### Empfehlung: BitLocker einschalten

Alle Daten liegen nur auf diesem PC. Gegen Diebstahl des PCs schützt die Laufwerksverschlüsselung von Windows 11. **Schalten Sie BitLocker ein.** Gegen Defekt, Verlust und Ransomware hilft nur Ihre Handsicherung (Abschnitt 5).

### Deinstallation

Entfernen Sie resellr über die Liste der installierten Apps in Windows (Eintrag „resellr“). Die Deinstallation beendet ein laufendes resellr zuerst geordnet. Gelingt das nicht, bricht sie ohne Änderung ab mit der Meldung „resellr konnte nicht beendet werden. Bitte später erneut versuchen.“

Die Deinstallation entfernt Programmordner, Autostart-Eintrag und Verknüpfungen. **Datenordner, Protokolle und Kopien vor Updates bleiben erhalten.** Löschen Sie sie bei Bedarf selbst unter `%LOCALAPPDATA%\resellr`, nachdem Sie eine Sicherung angelegt haben.

*Quellen: TS 2.19 (Installationspaket, Build des Pakets), TS 2.18 („Chrome finden“), TS 5 (TH-05 BitLocker-Empfehlung im Betriebshandbuch), TS 6.4, Baseline 8.3 (TH-05), Baseline 10.2 (Unsigniertes Paket, Erster Start), Baseline 10.6, ADR-008, OD-09 Aus.*

## 3. Start

### Automatisch bei der Anmeldung

Bei jeder Anmeldung an Windows startet resellr im Hintergrund, ohne Fenster und ohne Chrome zu öffnen. Eine Überwachung startet resellr nach einem Absturz selbst neu.

### Öffnen über die Verknüpfung „resellr“

Öffnen Sie im Startmenü oder auf dem Desktop die Verknüpfung „resellr“. Läuft resellr schon, öffnet sich sofort ein Tab in Chrome. Sonst startet resellr zuerst.

| Was Sie sehen | Bedeutung | Was Sie tun |
| --- | --- | --- |
| Seite „resellr startet“ | Der Start dauert länger als 3 Sekunden, z. B. weil resellr nach einem Update oder einer Wiederherstellung die Daten prüft | Fenster geöffnet lassen; resellr öffnet sich von selbst |
| Seite „resellr startet länger als erwartet“ mit Referenznummer | nach 2 Minuten noch kein Ergebnis; der Start kann noch gelingen | weiter warten; öffnet sich resellr nicht, Seite neu laden (F5), danach die Verknüpfung „resellr“ erneut öffnen; besteht das Problem weiter, Abschnitt 8 |
| Seite „resellr konnte nicht gestartet werden“ mit Referenznummer | Start abgebrochen, z. B. Datenbank beschädigt, Datenbank aus einer neueren Version, fehlende Datenbank bei vorhandenen Fotos oder gescheiterte Migration | Verknüpfung „resellr“ erneut öffnen; besteht der Fehler weiter, Abschnitt 8 |

Ein Start, der nach 10 Minuten noch nicht fertig ist, gilt als hängend und wird abgebrochen.

### Neustart nach Absturz

Nach einem Absturz wartet die Überwachung 5 Sekunden und startet resellr neu, höchstens 3-mal in 10 Minuten. Stürzt resellr danach noch einmal ab, gibt die Überwachung auf. Öffnen Sie dann die Verknüpfung „resellr“; sie startet eine neue Überwachung.

### Port ändern

resellr nutzt den Port 4310. Ist er auf Ihrem PC belegt, bricht der Start ab. Den Port legt der Eintrag `port` in `config.json` im Datenordner fest, eine ganze Zahl von 1 bis 65535. **Beenden Sie resellr, bevor Sie den Port ändern** (Abschnitt 4). Die Änderung wirkt ab dem nächsten Start. Ein ungültiger Wert führt zum Standardwert 4310.

*Quellen: TS 2.18 (Befehle `supervise` und `open`, Ablauf `open` Schritte 1 bis 6, Überwachung, Exit-Codes, Absturz und Neustartgrenze, Zustände LP-01 und LP-02), TS 2.19 (Startprüfung, Lesen von `config.json`), Baseline 9.6, 10.2, REQ-073.*

## 4. Beenden

Beenden Sie resellr immer geordnet, bevor Sie den Datenordner kopieren oder `config.json` ändern. Nach dem geordneten Beenden besteht die Datenbank aus der einzigen Datei `resellr.db`, und im Datenordner liegt die Ende-Markierung `shutdown-marker.json`. Erst dann ist eine Kopie vollständig und brauchbar.

### In der Oberfläche

1. Wählen Sie im Hinweis „Sicherung einrichten“ in der Navigationsspalte „resellr beenden“.
2. Bestätigen Sie die Rückfrage. Nicht gespeicherte Eingaben gehen dabei verloren.
3. resellr zeigt „resellr ist beendet. Sie können den Datenordner jetzt kopieren.“ und den Speicherort des Datenordners.

Gelingt das Beenden nicht, zeigt resellr eine Meldung mit Referenznummer und läuft weiter. Versuchen Sie es erneut; besteht der Fehler weiter, Abschnitt 8.

### Über das Startmenü

Öffnen Sie im Startmenü die Verknüpfung „resellr beenden“. Es gibt keine Rückfrage. Eine Seite zeigt das Ergebnis:

| Ergebnis | Bedeutung |
| --- | --- |
| „resellr ist beendet.“ mit Speicherort des Datenordners | geordnet beendet; Sie können den Datenordner kopieren |
| „resellr konnte nicht beendet werden“ mit Referenznummer | resellr läuft weiter; erneut versuchen, sonst Abschnitt 8 |
| „resellr läuft nicht“ | es gab nichts zu beenden |

Nach dem Beenden startet resellr erst wieder über die Verknüpfung „resellr“ oder bei der nächsten Anmeldung. Chrome bleibt offen.

### Abmelden und Herunterfahren

Abmelden und Herunterfahren beenden resellr ohne geordnetes Beenden. Das schadet den Daten nicht: Die Datenbank stellt beim nächsten Start einen konsistenten Stand her. Für eine Sicherung reicht das aber nicht, weil die Ende-Markierung fehlt. Beenden Sie resellr vor einer Sicherung deshalb immer wie oben beschrieben.

*Quellen: TS 2.17 (Hinweis UI-044, Rückfrage und Beenden, Geordnetes Beenden im Server, Startmenü „resellr beenden“), TS 2.18 (Befehl `stop`, LP-03), TS 2.19 (`config.json`), Baseline 9.6 (Geordnetes Beenden, Art des letzten Endes), Baseline 10.4, REQ-105.*

## 5. Handsicherung

resellr sichert Ihre Daten **nicht** selbst und kann nicht erkennen, ob und wann Sie gesichert haben. Bitte sichern Sie regelmäßig selbst, zum Beispiel in OneDrive. Datenverlust und Dauer einer Wiederherstellung hängen allein davon ab, wie oft Sie sichern.

### So sichern Sie

1. **resellr beenden** (Abschnitt 4), in der Oberfläche oder über das Startmenü.
2. Den **Datenordner im Explorer öffnen** (Speicherort im Hinweis „Sicherung einrichten“ bzw. auf der Seite nach dem Beenden) und **als Ganzes** in einen Ordner in Ihrem OneDrive kopieren, z. B. mit dem Datum im Namen.
3. **resellr wieder starten** über die Verknüpfung „resellr“.

### Regeln

- **Kopieren Sie nur bei beendetem resellr.** Eine Kopie, die bei laufendem resellr entsteht, kann unbrauchbar oder unbemerkt veraltet sein.
- **Kopieren Sie immer den ganzen Datenordner**, nicht einzelne Dateien. Protokolle, Übergabeordner und Programmdateien gehören nicht in die Sicherung.
- **Verschieben Sie den Datenordner nicht selbst nach OneDrive** und lassen Sie ihn nicht von OneDrive synchronisieren. Nach OneDrive gehören nur Kopien.
- **Behalten Sie ältere Kopien eine Weile** und überschreiben Sie sie nicht sofort. So bleibt eine Kopie von vor einem Ransomware-Befall erhalten; der Versionsverlauf von OneDrive hilft dabei.
- Die Kopien vor Updates (Abschnitt 7) liegen auf demselben PC und **ersetzen keine Sicherung**.

*Quellen: Baseline 10.3, 10.4 (Anleitung zur Handsicherung, Regeln), Baseline 8.3 (TH-05), Baseline 10.6 (Zweck der Kopie), TS 2.19 (Ordner), REQ-104, REQ-105, REQ-106.*

## 6. Wiederherstellung

resellr hat keine eigene Wiederherstellungsfunktion. Sie stellen den Stand aus Ihrer Handsicherung so wieder her:

1. **resellr installieren** (Abschnitt 2), falls es nicht installiert ist, z. B. auf einem neuen PC.
2. **resellr beenden** (Abschnitt 4).
3. Den **Inhalt des Datenordners** `%LOCALAPPDATA%\resellr\Daten` **vollständig durch den Inhalt Ihrer Kopie ersetzen**.
4. **resellr starten** über die Verknüpfung „resellr“.

Beim ersten Start nach dem Ersetzen erkennt resellr den neuen Datenordner und prüft ihn vollständig. Das kann je nach Fotobestand Minuten bis Stunden dauern; währenddessen sehen Sie die Seite „resellr startet“.

| Lage | Folge |
| --- | --- |
| Kopie beschädigt | Start abgebrochen mit Referenznummer; eine andere Kopie verwenden |
| Kopie aus einer neueren Programmversion | Start abgebrochen; installieren Sie eine Version, die mindestens so neu ist wie die, mit der die Kopie entstand |
| Kopie aus einer älteren Programmversion | wird beim Start automatisch auf die installierte Version umgestellt |
| Datenbank fehlt, aber Fotos sind vorhanden | Start abgebrochen; die Kopie ist unvollständig |
| Fotos fehlen in der Kopie oder Kopie entstand bei laufendem resellr | resellr startet, vermerkt den Befund im Betriebsprotokoll; welche Änderungen fehlen, ist nicht erkennbar |

Bei diesem ersten Start löscht resellr keine Dateien, auf die die Datenbank nicht verweist.

*Quellen: Baseline 10.3, 10.4 (Wiederherstellung), Baseline 9.6 (Startprüfung, Tabelle „Was die Startprüfung erkennt und was nicht“), TS 2.19 (Startprüfung Schritte 1 bis 4, Housekeeping), REQ-106.*

## 7. Update

MarloNET veröffentlicht neue Versionen als Installationspaket in den GitHub Releases von `MarloNET/resellr`. resellr prüft nicht selbst auf Updates, weil es keine Verbindungen ins Internet aufbaut. Lesen Sie die Release-Notizen: Ändert ein Update, wie resellr Kanal-Inhalte bildet, entstehen bei freigegebenen Kanal-Inhalten Änderungsentwürfe, die Sie erneut freigeben.

### Ablauf

1. Legen Sie vorher eine Handsicherung an (Abschnitt 5). Installieren Sie Updates möglichst außerhalb der Geschäftszeiten.
2. Laden Sie das neue Installationspaket herunter und starten Sie es. **Die SmartScreen-Warnung erscheint auch bei jedem Update**; bestätigen Sie sie wie bei der Installation.
3. Das Paket beendet resellr geordnet, ersetzt die Programmdateien und öffnet resellr danach.
4. Gelingt das Beenden nicht, bricht das Paket ab, ohne etwas zu ändern: „resellr konnte nicht beendet werden. Bitte später erneut versuchen.“ Versuchen Sie es später erneut.

Beim ersten Start nach dem Update legt resellr automatisch eine Kopie von Datenbank und `config.json` im Ordner `%LOCALAPPDATA%\resellr\Update-Kopien\<Zeit>-v<alte Version>-v<neue Version>` an und stellt die Datenbank danach auf die neue Version um (Migration). Die letzten 3 Kopien bleiben erhalten.

### Wenn das Update scheitert

Scheitert die Migration, bleibt die Datenbank auf dem alten Stand, und resellr zeigt „resellr konnte nicht gestartet werden“ mit Referenznummer. Dann:

1. Melden Sie die Referenznummer (Abschnitt 8).
2. Installieren Sie die vorige Version aus den GitHub Releases.
3. Beenden Sie resellr (Abschnitt 4).
4. Kopieren Sie `resellr.db` aus dem passenden Ordner unter `Update-Kopien` in den Datenordner zurück und ersetzen Sie die vorhandene Datei.
5. Starten Sie resellr über die Verknüpfung „resellr“.

*Quellen: Baseline 10.6 (Ablauf, Zweck der Kopie, Fehlschlag, Änderung der Kanal-Engine), TS 2.19 (Startprüfung Schritt 5 und Migrationen, Installationspaket, Ordner), Baseline 10.2 (Unsigniertes Paket), ADR-008.*

## 8. Fehlermeldung

Kann resellr eine Aktion nicht ausführen, zeigt es eine deutsche Meldung mit der betroffenen Funktion, einem nächsten Schritt und einer **Referenznummer** im Format `R-XXXX-XXXX`, z. B. `R-7K2M-9QX4`. Das gilt in der Oberfläche und auf den Seiten beim Starten und Beenden.

### Was Sie tun

1. Versuchen Sie es erneut, wie es die Meldung vorschlägt.
2. Besteht der Fehler weiter, notieren Sie die **Referenznummer** (sie ist als Text auswählbar), dazu Datum, Uhrzeit und was Sie gerade getan haben.
3. Melden Sie das MarloNET. Ein Entwickler sucht die Referenznummer im Protokollordner `%LOCALAPPDATA%\resellr\Protokolle` und liest dort Ursache und Ablauf nach.

Melden Sie Fehler zeitnah: Fehler- und Betriebsprotokoll bleiben 30 Tage erhalten, danach werden sie gelöscht.

### Was die Protokolle enthalten

| Datei | Inhalt |
| --- | --- |
| `errors-<Datum>.jsonl` | Fehlerprotokoll: Zeitpunkt, Funktion, Fehlerbeschreibung, Referenznummer, Programmversion |
| `operations-<Datum>.jsonl` | Betriebsprotokoll: Start, Beenden, Absturz und Neustart, abgebrochener Start, Befunde der Startprüfung, Warnungen wie wenig freier Speicher (unter 10 GB) |
| `availability-<Datum>.jsonl` | Verfügbarkeitsprüfungen alle 5 Minuten |

Die Protokolle enthalten keine Feldwerte und keine Eingaben aus der Oberfläche. Es gibt keine Überwachung von außen und keine Alarme: Fehler werden nur über Ihre Meldung mit Referenznummer sichtbar.

*Quellen: REQ-073, TS 2.0.5 (Referenznummer), TS 2.18 (Referenznummern in beiden Protokollen), TS 2.19 (Protokolle, Housekeeping), Baseline 10.3 (Fehleranalyse), Baseline 10.5, 10.7.*

## 9. Verfügbarkeitsbericht

resellr misst, ob es während der Geschäftszeiten nutzbar ist. Die Überwachung prüft dafür alle 5 Minuten, ob resellr antwortet, und fasst die Ergebnisse einmal täglich je Tag zusammen. Ziel sind mindestens 99 % je Kalendermonat.

### Bericht erstellen

Erstellen Sie den Bericht einmal im Monat für den Vormonat: Öffnen Sie im Programmordner `%LOCALAPPDATA%\Programs\resellr` die Datei `Verfügbarkeitsbericht.cmd` per Doppelklick. Sie schreibt den Bericht als Textdatei `Verfügbarkeitsbericht-<JJJJ-MM>.txt` in den Protokollordner `%LOCALAPPDATA%\resellr\Protokolle`.

Die Tageszusammenfassungen bleiben 24 Monate erhalten.

### Inhalt des Berichts

Der Bericht zählt nur die **Geschäftszeit: Montag bis Samstag, 8 bis 18 Uhr** (Zeitzone Europe/Berlin). Die Zeile „Tage mit Tageszusammenfassung“ zeigt, für wie viele Tage des Monats Messwerte vorliegen.

| Spalte | Bedeutung | zählt für die Verfügbarkeit? |
| --- | --- | --- |
| **verfügbar** | resellr hat auf die Prüfung geantwortet | ja, als verfügbare Zeit |
| **nicht verfügbar** | resellr hat nicht geantwortet, ist abgestürzt, sein Start wurde abgebrochen oder die Überwachung hat aufgegeben | ja, als Ausfall |
| **vom Nutzer beendet** | Zeit nach „resellr beenden“ bis zum nächsten Startversuch | nein |
| **PC aus** | Lücke ohne Messung, in die ein Windows-Start fällt | nein |
| **ohne Messung** | alle übrigen Lücken ohne Messung | nein |

**Verfügbarkeit = verfügbar ÷ (verfügbar + nicht verfügbar).** „vom Nutzer beendet“, „PC aus“ und „ohne Messung“ werden getrennt ausgewiesen, zählen aber weder als Ausfall noch als Geschäftszeit.

### Die Spalte „ohne Messung“

„ohne Messung“ ist die Zeit, in der keine Prüfung stattfand und die resellr keiner anderen Spalte zuordnen kann. Dazu gehören:

- Zeiten, in denen Sie abgemeldet waren, ohne den PC neu zu starten,
- Zeiten, in denen die Überwachung selbst nicht lief,
- Zeiten, in denen der PC aus war, die resellr wegen des Windows-Schnellstarts nicht als „PC aus“ erkennt (siehe unten).

Die Spalte ist deshalb eine **Obergrenze** für Ausfälle der Überwachung: Ausfälle der Überwachung selbst können höchstens so lang gewesen sein. Die Verfügbarkeit ändert sie nicht.

### Grenze beim Windows-Schnellstart

Windows 11 nutzt standardmäßig den **Schnellstart**. resellr erkennt „PC aus“ an einem Windows-Start in der Lücke und liest dafür die Zeit seit dem letzten Windows-Start. Mit Schnellstart setzt das Herunterfahren diese Zeit nicht zurück; resellr sieht dann keinen Windows-Start. **„PC aus“ wird dann nur nach einem Neustart erkannt; sonst erscheint die Zeit unter „ohne Messung“.** Die Verfügbarkeit ändert das nicht, weil beide Spalten nicht zählen.

*Quellen: REQ-065, TS 2.18 (Befehl `availability-report`, Verfügbarkeitsprüfung, Verfügbarkeitsauswertung mit Grenze FIND-222), TS 2.19 (Ordner, Housekeeping), TS 9 (TR-09), Baseline 7.3, 10.3 (Verfügbarkeitsauswertung), OD-05 (a).*
