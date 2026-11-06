# LP-02 – „Start abgebrochen“

- Zweck: Meldung, wenn resellr nicht starten konnte (Baseline Ablauf 4b: fehlende/neuere/beschädigte Datenbank, gescheiterte Migration).
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
default (einziger Zustand); alle anderen n/a.

## Fenstergröße und Bedienung
Wie Kopf.

## Annahmen und offene Fragen
- Eine Wiederholung durch Klick wäre eine zusätzliche Funktion und ist nicht Teil des Designs.
- Vermerk T-5 (MAR-152, keine Änderung dieses Screens): Die Annahme, dass die Seite selbst wechselt (Seitenaktualisierung per Skript aus einer Zustandsdatei), ist ein Prüfpunkt im Windows-Spike. Rückfallweg bei Nichtbestätigung: Launcher öffnet Ziel- bzw. Ergebnisseite in einem neuen Tab, LP-01 bleibt stehen, LP-03 öffnet erst mit dem Ergebnis (höchstens etwa 12 s), `LP-03.loading` entfällt; kleine Designänderung über den Product Owner (uiux-design.md Kap. 8 Nr. 8).
