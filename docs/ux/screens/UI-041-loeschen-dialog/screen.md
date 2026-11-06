# UI-041 – Löschen bestätigen (Dialog)

- Zweck: Modell-Inserat oder Modellvorlage nach ausdrücklicher Bestätigung löschen (Geräte werden nie gelöscht).
- Flows: FLOW-08 · Anforderungen: REQ-095 (Should), REQ-103, REQ-072 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Objekt (Titel/Modellvorlage), Wirkung: „Mit dem Modell-Inserat werden seine Kanal-Inhalte gelöscht.“ Bei Ablehnungsgrund statt Bestätigung der Grund.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Bestätigung | Kontrollkästchen „Ich möchte <Objekt> endgültig löschen“ | ja | | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Löschen | destruktiver Button | Bestätigung gesetzt; Modell-Inserat: kein verfügbares/verkauftes Gerät zugeordnet und kein Kanal-Inhalt „Veröffentlicht“; Modellvorlage: kein Gerät (jeder Status) und kein Modell-Inserat | gelöscht, protokolliert, Banner „<Objekt> gelöscht“ | Ablehnung mit Grund: „Löschen nicht möglich: Dem Modell-Inserat sind noch Geräte zugeordnet“ / „… ein Kanal-Inhalt ist veröffentlicht“ / „… Geräte verweisen auf die Modellvorlage“ | UI-002 bzw. UI-006 |
| Abbrechen | Button, Esc | – | – | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Bestätigung | nur Text | – |
| disabled | „Löschen“ deaktiviert ohne Häkchen oder bei Ablehnungsgrund | nur Text | |
| error | Banner | nur Text | „Löschen fehlgeschlagen. Referenz: <Nr>“ |
| loading, empty, validation, success | n/a | – | – |

## Fenstergröße und Bedienung
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
