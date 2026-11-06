# UI-043 – Auswirkung der Änderung (Dialog)

- Zweck: Nach dem Speichern eines Textbausteins, von GPSR-Herstellerangaben oder einer Einstellung, die Kanal-Inhalte neu bildet (Titelmuster, Zustands-, Merkmalszuordnung, Beschreibungsvorlage), melden, wie viele Kanal-Inhalte je Gruppe betroffen sind (Zahlen aus der Speicherantwort).
- Flows: FLOW-04 (Schritt 2) · Anforderungen: REQ-053, REQ-043, REQ-045 · Rollen: Nutzer · Gerät(e): PC · Artefakte: default.png (Stitch 98c649544899484faefeb3430e5dddca, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Gruppe | Anzeige | Bedeutung |
|---|---|---|
| aktualisiert | Anzahl | Kanal-Inhalte im Status Entwurf und Änderungsentwürfe, deren Text automatisch gebildet ist |
| zur erneuten Freigabe | Anzahl | bisher Freigegeben, Veröffentlicht oder Beendet („geändert seit Freigabe“) |
| manuell angepasst, zur Prüfung | Anzahl | Titel/Beschreibung manuell angepasst, mit Hinweis „Daten geändert, manuell angepassten Text prüfen“ |
Die Zahlen stammen aus der Antwort des Speicherns (Baseline Ä-32); der Dialog rechnet nichts selbst und hat keinen eigenen Ladevorgang. Vor dem Speichern gibt es die Gruppenzahlen nicht (dort nur „gilt für n Kanal-Inhalte im Geltungsbereich“, REQ-053).
**„Anzeigen“ (K-5):** nur bei der Gruppe „zur erneuten Freigabe“: Link „Anzeigen“ öffnet UI-002 mit Filter „Geändert seit Freigabe“ (REQ-052). Die Gruppen „aktualisiert“ und „manuell angepasst, zur Prüfung“ haben **keinen** Link und es gibt **keinen** Filter „manuell angepasst“ (REQ-052 kennt ihn nicht); die Gruppe „manuell angepasst“ ist ein reiner Hinweis. Einzelne Zeilen mit manuell angepasstem Text trägt UI-002 mit der Kennzeichnung „Daten geändert, manuell angepassten Text prüfen“ (REQ-052, Kap. 9.4).

## Eingaben und Validierung
Keine.

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Zu den betroffenen Inseraten | Primärbutton | Anzahl „zur erneuten Freigabe“ > 0 | – | – | UI-002 mit Filter „Geändert seit Freigabe“ |
| Schließen | Button, Esc | – | – | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | drei Zähler | nur Text | – |
| empty | alle Zähler 0 | nur Text | „Keine Kanal-Inhalte betroffen“ |
| loading, error, validation, success, disabled | n/a. **Kein `.error`** (K-5): Der Dialog zeigt nur die Zahlen der Speicherantwort; Fehler beim Speichern (Ablehnung, Verbindungsverlust, „Ausgang unbekannt, bitte neu laden“) gehören zum aufrufenden Screen (Zustand „wird gespeichert“, Muster P-08). Technische Fehler stehen für den Betreiber im Protokoll (REQ-073), der Dialog zeigt keine Referenznummer. | – | – |

## Fenstergröße und Bedienung
Fenster ab 1366 px (nutzbar etwa 1350 × 630 px); Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
Der Dialog ist im Mockup breiter als die 480 px laut Spezifikation; maßgeblich sind 480 px. Im unscharfen Hintergrund unten links steht ein kleiner Versionstext (von Stitch erzeugt, nicht Teil des Designs). Der Hinweis „Keine Kanal-Inhalte betroffen“ (Zustand empty) ist nicht gestaltet. Die Kennzeichnung „geändert seit Freigabe“ beim zweiten Zähler ist Darstellung von Kap. 9.4.

**Nach K-5 (v0.5):** Das Mockup zeigt „Anzeigen“ bei jeder Gruppe; verbindlich ist nur der Link bei „zur erneuten Freigabe“ (siehe Angezeigte Daten). Das Mockup wurde nicht neu erzeugt (Stitch-Budget).

## Annahmen und offene Fragen
- Annahme (Product Owner bitte bestätigen): UI-043 erscheint nach dem Speichern aller Einstellungen mit Wirkung auf Kanal-Inhalte (UI-029, 030, 031, 034, 036, 037, 007), nicht nur nach UI-030/031; die bisherigen Screens (UI-029, 034, 036, 037) zeigten bereits einen Hinweis „n betroffen“. Der Auslöserkreis folgt REQ-053.
