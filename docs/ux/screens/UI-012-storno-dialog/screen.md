# UI-012 – Gerät stornieren (Dialog)

- Zweck: Falsch erfasstes Gerät stornieren (kein Löschen).
- Flows: FLOW-08 · Anforderungen: REQ-093, REQ-103, REQ-072 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
WI-Nr, Modell-Inserat; Warntext „Ein Storno kann nicht zurückgenommen werden. Die WI-Nr wird für eine Neuerfassung frei; das Gerät bleibt nachvollziehbar.“

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Grund | Text | ja | 1–200 Zeichen | „Grund: 1 bis 200 Zeichen“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Gerät stornieren | destruktiver Button | Status verfügbar | Status storniert, Stückzahl −1 (falls zugeordnet), Banner „Gerät storniert. WI-Nr ist wieder frei.“ | „Verkaufte Geräte können nicht storniert werden. Erst Verkauf zurücknehmen.“ | UI-010 |
| Abbrechen | Button, Esc | – | – | – | UI-010 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, error, success | wie oben; error „Storno fehlgeschlagen. Referenz: <Nr>“ | nur Text | |
| loading, empty, disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
