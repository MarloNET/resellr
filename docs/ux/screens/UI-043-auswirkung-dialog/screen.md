# UI-043 – Auswirkung der Änderung (Dialog)

- Zweck: Nach dem Speichern eines Textbausteins oder von GPSR-Herstellerangaben melden, wie viele Kanal-Inhalte betroffen sind.
- Flows: FLOW-04 (Schritt 2) · Anforderungen: REQ-053, REQ-043, REQ-045 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Mockup geplant)

## Angezeigte Daten
| Gruppe | Anzeige | Bedeutung |
|---|---|---|
| aktualisiert | Anzahl | Kanal-Inhalte im Status Entwurf und Änderungsentwürfe, deren Text automatisch gebildet ist |
| zur erneuten Freigabe | Anzahl | bisher Freigegeben, Veröffentlicht oder Beendet („geändert seit Freigabe“) |
| manuell angepasst, zur Prüfung | Anzahl | Titel/Beschreibung manuell angepasst, mit Hinweis „Daten geändert, manuell angepassten Text prüfen“ |
Je Gruppe Link „Anzeigen“ (öffnet UI-002 mit passendem Filter bzw. Liste der betroffenen Kanal-Inhalte).

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
| error | Banner | nur Text | „Auswirkung konnte nicht ermittelt werden. Referenz: <Nr>“ |
| loading, validation, success, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
