# LP-02 – „Start abgebrochen“ und „Start dauert länger als erwartet“

- Zweck: Meldung, wenn resellr nicht starten konnte (Baseline Ablauf 4b: fehlende/neuere/beschädigte Datenbank, gescheiterte Migration), und (Zustand `LP-02.zeitueberschreitung`, v0.6) wenn der Start nach 120 s noch kein Ergebnis hat.
- Flows: FLOW-10 (Neustart) · Anforderungen: REQ-073; Baseline Kap. 6.1 „Rückmeldungen ohne Server“, Kap. 9.6; X-4
- Rollen: Nutzer (Arbeitsplatzrechner; kein Server) · Gerät(e): PC, Fenster ab 480 px · Artefakte: nur Text (`screen.md`), kein Mockup
- Art: einfache statische HTML-Seite des `resellr-launcher` (`launcher-pages`), **ohne React, ohne Serverzugriff**, ohne Navigation und ohne Hinweis UI-044 (kein resellr-Server läuft). Tokens aus `DESIGN.md`: bg #F6F7F9, Karte surface mit 1 px border und 6 px Radius, Inter (mitgeliefert, REQ-079), Text 14/20, Titel 22/28 semibold. Zentrierte Karte, Breite 560 px, funktioniert ab 480 px. Deutsch, Anrede „Sie“, keine technischen Details (REQ-073). Nur Text, kein Mockup (Seiten sind schlicht genug).

## Angezeigte Daten
| Element | Inhalt |
|---|---|
| Titel | „resellr konnte nicht gestartet werden“ (Fehler-Stil: error auf #FEE4E2 nur für den Titelstreifen) |
| Text | „Der Start von resellr wurde abgebrochen. Bitte versuchen Sie es erneut: Öffnen Sie im Startmenü die Verknüpfung „resellr“. Besteht der Fehler weiter, informieren Sie den Betreiber und nennen Sie ihm diese Referenznummer:“ |
| Referenznummer | „<Nr>“ (aus dem Fehlerprotokoll, auswählbarer Text) |
Nach REQ-073: deutscher Text, Funktion (Start), nächster Schritt, Referenznummer; **keine** Fehlercodes, Dateipfade oder Tabellennamen.

## Eingaben und Validierung
Keine.

## Aktionen
Keine (kein „Erneut starten“-Button; die Seite hat keinen Server und keine Funktion). Navigationsziel: keines.

## Zustände
| Zustand | Auslöser | Darstellung |
|---|---|---|
| default (Start abgebrochen) | Ergebnis „abgebrochen“ oder „aufgegeben“ (Exit-Code 10, `gave_up`) | wie oben |
| `LP-02.zeitueberschreitung` (v0.6) | 120 s ohne Ergebnis (Betriebsereignis `start_timeout`, Spec Kap. 2.17) | siehe Abschnitt unten; derselbe Rahmen, keine neue Seite |

Alle anderen Zustände n/a.

## Zustand „Start dauert länger als erwartet“ (`LP-02.zeitueberschreitung`, v0.6, MAR-167, Entscheidung PO an MAR-163, DG-07)
Der Start ist **nicht abgebrochen** und kann noch gelingen. Der Zustand darf daher nicht „abgebrochen“ sagen.

| Element | Inhalt |
|---|---|
| Titel | „resellr startet länger als erwartet“ (Warnstil: warn-Farbe für den Titelstreifen, nicht der Fehlerstil von „Start abgebrochen“) |
| Text, Absatz 1 | „Der Start von resellr dauert länger als erwartet. Er kann noch gelingen. Lassen Sie dieses Fenster geöffnet und warten Sie einen Moment: resellr öffnet sich von selbst, sobald es bereit ist.“ |
| Text, Absatz 2 (nächste Schritte) | „Öffnet sich resellr nicht, laden Sie diese Seite neu (Browser-Aktualisierung, z. B. F5). Hilft das nicht, starten Sie resellr über die Verknüpfung „resellr“ im Startmenü.“ |
| Text, Absatz 3 (Referenz) | „Besteht das Problem weiter, informieren Sie den Betreiber und nennen Sie ihm diese Referenznummer. Sie steht im Betriebsprotokoll von resellr:“ |
| Referenznummer | „<Nr>“, auswählbarer Text. Es ist die **eigene** Nummer der Zeitüberschreitung (nicht die eines früheren Startversuchs). Sie steht im **Betriebsprotokoll** und zusätzlich im Fehlerprotokoll (Spec); der Text nennt nur das Betriebsprotokoll. |
| Fortschritt | Zeile „resellr wird gestartet …“ mit unbestimmter Leiste bleibt **sichtbar**, solange der Start läuft (dient als Hinweis, dass die Seite weiter wartet) |

**Entscheidung zur Weiterleitung:** Die Seite **leitet bei einem späteren Erfolg selbst weiter**, auf dieselbe Weise und mit demselben Mechanismus wie LP-01 (Ziel UI-002; bei Abbruch nach der Zeitüberschreitung wechselt der Zustand zu „Start abgebrochen“ mit der Nummer des Abbruchs). Begründung: Der Text sagt „kann noch gelingen“; müsste der Nutzer dann trotzdem selbst eingreifen, wäre die Aussage nutzlos. Es ist keine zusätzliche Funktion, sondern die Fortsetzung von LP-01. Ein Neuladen der Seite zeigt den dann aktuellen Zustand (weiter warten, Weiterleitung oder Ergebnis).
**Rückfall bei T-5** (Seite kann sich nicht selbst aktualisieren, Windows-Spike): in Absatz 1 entfällt der Satz „resellr öffnet sich von selbst, sobald es bereit ist.“ (er endet dann mit „… Lassen Sie dieses Fenster geöffnet.“); Absatz 2 beginnt dann „Öffnet sich resellr nicht in einem neuen Fenster, laden Sie …“. Die Kernaussagen, nächster Schritt und Referenznummer bleiben. Nach Spike-Ergebnis über den Product Owner bestätigen.
Keine Aktionen, keine Eingaben (wie default); Fenster ab 480 px, Tokens wie oben, keine technischen Details (REQ-073).

## Fenstergröße und Bedienung
Wie Kopf.

## Annahmen und offene Fragen
- Eine Wiederholung durch Klick wäre eine zusätzliche Funktion und ist nicht Teil des Designs.
- Vermerk T-5 (MAR-152, keine Änderung dieses Screens): Die Annahme, dass die Seite selbst wechselt (Seitenaktualisierung per Skript aus einer Zustandsdatei), ist ein Prüfpunkt im Windows-Spike. Rückfallweg bei Nichtbestätigung: Launcher öffnet Ziel- bzw. Ergebnisseite in einem neuen Tab, LP-01 bleibt stehen, LP-03 öffnet erst mit dem Ergebnis (höchstens etwa 12 s), `LP-03.loading` entfällt; kleine Designänderung über den Product Owner (uiux-design.md Kap. 8 Nr. 8).
