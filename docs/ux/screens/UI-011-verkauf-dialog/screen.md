# UI-011 – Verkauf markieren (Dialog)

- Zweck: Verkauf eines Geräts mit Kanal und Datum erfassen.
- Flows: FLOW-03 · Anforderungen: REQ-021, REQ-084, REQ-072 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
WI-Nr, Titel des Modell-Inserats, aktuelle Stückzahl; Hinweis „Stückzahl sinkt auf n“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Kanal | Auswahl der Kanäle | ja | | „Kanal fehlt“ |
| Verkaufsdatum | Datum TT.MM.JJJJ | ja | vorbelegt mit heute; nicht in der Zukunft | „Verkaufsdatum darf nicht in der Zukunft liegen“; „Datum im Format TT.MM.JJJJ“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Als verkauft markieren | Primärbutton, Enter | gültig | Status verkauft, Stückzahl −1, Banner „Verkauf erfasst. Stückzahl: n“; bei Veröffentlichung „Bestand auf Kanal anpassen“-Hinweis; bei Stückzahl 0 Hinweis „ausverkauft: Inserate auf den Kanälen beenden“ mit Link UI-014 | „Gerät keinem Modell-Inserat zugeordnet“; „Gerät ist bereits verkauft oder storniert“ | UI-010 |
| Abbrechen | Button, Esc | – | – | – | UI-010 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, error, success | wie oben; error „Verkauf konnte nicht erfasst werden. Referenz: <Nr>“ | nur Text | |
| loading, empty, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
