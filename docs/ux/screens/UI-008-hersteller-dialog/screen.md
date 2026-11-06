# UI-008 – Hersteller anlegen (Dialog)

- Zweck: Neuen Hersteller aus der Modellvorlage heraus anlegen.
- Flows: FLOW-01 · Anforderungen: REQ-100 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Feld „Name des Herstellers“. Hinweis nach Anlegen: „Hersteller angelegt. GPSR-Herstellerangaben fehlen noch; ohne sie ist keine Freigabe möglich.“ mit Link zu UI-031.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Name | Text | ja | 1–50 Zeichen, Leerzeichen am Rand entfernt, eindeutig ohne Groß-/Kleinschreibung | „Name: 1 bis 50 Zeichen“; bei vorhandenem Namen Hinweis „<Name> gibt es bereits und wird verwendet“; bei deaktiviertem: „Hersteller <Name> ist deaktiviert“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Hersteller anlegen | Primärbutton, Enter | gültig | Hersteller aktiv und in UI-007 gewählt | Feldfehler | zurück zu UI-007 |
| Abbrechen | Button, Esc | – | – | – | UI-007 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, error, success | wie Eingaben/Aktionen | nur Text | error: „Hersteller konnte nicht angelegt werden. Referenz: <Nr>“ |
| loading, empty, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Dialogbreite 480 px, Fokus im Feld.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
