# LP-03 – Ergebnis von „resellr beenden“ (Startmenü-Verknüpfung)

- Zweck: Ergebnis des Betreiberwerkzeugs „resellr beenden“ im Startmenü zeigen; zugleich sicherer Weg, den Ausgang zu klären (UI-046 `.unknown`).
- Flows: FLOW-10 · Anforderungen: REQ-105, REQ-073; Baseline Kap. 6.1 „Aktion resellr beenden“ und „Rückmeldungen ohne Server“, Kap. 13.3.1; X-4
- Rollen: Nutzer (Arbeitsplatzrechner; kein Server) · Gerät(e): PC, Fenster ab 480 px · Artefakte: nur Text (`screen.md`), kein Mockup
- Art: einfache statische HTML-Seite des `resellr-launcher` (`launcher-pages`), **ohne React, ohne Serverzugriff**, ohne Navigation und ohne Hinweis UI-044 (kein resellr-Server läuft). Tokens aus `DESIGN.md`: bg #F6F7F9, Karte surface mit 1 px border und 6 px Radius, Inter (mitgeliefert, REQ-079), Text 14/20, Titel 22/28 semibold. Zentrierte Karte, Breite 560 px, funktioniert ab 480 px. Deutsch, Anrede „Sie“, keine technischen Details (REQ-073). Nur Text, kein Mockup (Seiten sind schlicht genug).

## Angezeigte Daten
Drei Zustände derselben Seite:
| Zustand | Titel | Text |
|---|---|---|
| `.success` | „resellr ist beendet.“ | „Sie können den Datenordner jetzt kopieren.“ plus „Der Datenordner liegt hier:“ und Speicherort (auswählbarer Text; **Annahme**: der Launcher kennt den Speicherort, vom Software Architect zu bestätigen). Wortlaut des Satzes aus REQ-105 |
| `.error` | „resellr konnte nicht beendet werden“ | „resellr läuft weiter. Bitte versuchen Sie es erneut. Besteht der Fehler weiter, informieren Sie den Betreiber und nennen Sie ihm diese Referenznummer: <Nr>“ (REQ-073) |
| `.nicht-aktiv` | „resellr läuft nicht“ | „Es gibt nichts zu beenden. Zum Starten öffnen Sie im Startmenü die Verknüpfung „resellr“.“ |

## Eingaben und Validierung
Keine. Das Werkzeug fragt nicht zurück; das Aufrufen der Verknüpfung ist die Absicht des Betreibers.

## Aktionen
Keine. Navigationsziel: keines.

## Zustände
success, error, nicht-aktiv (siehe oben); loading: Kurzzeile „resellr wird beendet …“ bis zum Ergebnis (bis etwa 10 s); alle anderen n/a.

## Fenstergröße und Bedienung
Wie Kopf.

## Annahmen und offene Fragen
- Die Verknüpfung „resellr beenden“ ist ein Betreiber-/PC-Werkzeug außerhalb der Funktionen der Oberfläche (Baseline 13.3.1), keine Designfunktion mit eigenem REQ. Das Design beschreibt nur ihre Ergebnisseite.
- Bei `.nicht-aktiv` wird bewusst nicht behauptet, dass der Datenordner kopierbar sei (Ende ungewiss, z. B. nach Absturz).
- Vermerk T-5 (MAR-152, keine Änderung dieses Screens): Die Annahme, dass die Seite selbst wechselt (Seitenaktualisierung per Skript aus einer Zustandsdatei), ist ein Prüfpunkt im Windows-Spike. Rückfallweg bei Nichtbestätigung: Launcher öffnet Ziel- bzw. Ergebnisseite in einem neuen Tab, LP-01 bleibt stehen, LP-03 öffnet erst mit dem Ergebnis (höchstens etwa 12 s), `LP-03.loading` entfällt; kleine Designänderung über den Product Owner (uiux-design.md Kap. 8 Nr. 8).
