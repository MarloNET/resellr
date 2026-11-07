# LP-01 – „resellr startet“

- Zweck: Rückmeldung, wenn der Start länger dauert (z. B. Migration oder vollständige Prüfung des Datenordners).
- Flows: FLOW-10 (Neustart), alle Starts über die Verknüpfung „resellr“ · Anforderungen: REQ-073; Baseline Kap. 6.1 „Rückmeldungen ohne Server“ (Quelle für die Rückmeldung beim Start), Ablauf 4b; X-4
- Rollen: Nutzer (Arbeitsplatzrechner; kein Server) · Gerät(e): PC, Fenster ab 480 px · Artefakte: nur Text (`screen.md`), kein Mockup
- Art: einfache statische HTML-Seite des `resellr-launcher` (`launcher-pages`), **ohne React, ohne Serverzugriff**, ohne Navigation und ohne Hinweis UI-044 (kein resellr-Server läuft). Tokens aus `DESIGN.md`: bg #F6F7F9, Karte surface mit 1 px border und 6 px Radius, Inter (mitgeliefert, REQ-079), Text 14/20, Titel 22/28 semibold. Zentrierte Karte, Breite 560 px, funktioniert ab 480 px. Deutsch, Anrede „Sie“, keine technischen Details (REQ-073). Nur Text, kein Mockup (Seiten sind schlicht genug).

## Angezeigte Daten
| Element | Inhalt |
|---|---|
| Titel | „resellr startet“ |
| Text | „Bitte haben Sie einen Moment Geduld. Der Start dauert diesmal länger als sonst, zum Beispiel weil resellr Ihre Daten prüft. Lassen Sie dieses Fenster geöffnet. resellr öffnet sich von selbst, sobald es bereit ist.“ |
| Fortschritt | Zeile „resellr wird gestartet …“ mit unbestimmter Fortschrittsleiste (ohne Prozent) |
Die Seite zeigt **keinen Befund** der Startprüfung (X-5: bewusst nicht gestaltet).

## Eingaben und Validierung
Keine.

## Aktionen
Keine. Navigationsziel: sobald der Server bereit ist, wechselt die Seite zur Oberfläche (UI-002); bei Abbruch zu LP-02. Der Wechselmechanismus ist Sache der Technical Specification.

## Zustände
default (einziger Zustand); alle anderen n/a.

## Fenstergröße und Bedienung
Wie Kopf. Keine Tastaturbedienung nötig.

## Annahmen und offene Fragen
- Der automatische Wechsel zur Oberfläche ist Designannahme (kein Klick nötig); Umsetzung offen.
- Vermerk T-5 (MAR-152, keine Änderung dieses Screens): Die Annahme, dass die Seite selbst wechselt (Seitenaktualisierung per Skript aus einer Zustandsdatei), ist ein Prüfpunkt im Windows-Spike. Rückfallweg bei Nichtbestätigung: Launcher öffnet Ziel- bzw. Ergebnisseite in einem neuen Tab, LP-01 bleibt stehen, LP-03 öffnet erst mit dem Ergebnis (höchstens etwa 12 s), `LP-03.loading` entfällt; kleine Designänderung über den Product Owner (uiux-design.md Kap. 8 Nr. 8).
