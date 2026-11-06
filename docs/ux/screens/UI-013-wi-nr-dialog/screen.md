# UI-013 – WI-Nr korrigieren (Dialog)

- Zweck: WI-Nr eines verfügbaren oder verkauften Geräts korrigieren.
- Flows: FLOW-08 · Anforderungen: REQ-092 (Should), REQ-072, REQ-091 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Bisherige WI-Nr; Hinweis „Die Artikelnummer des Modell-Inserats ändert sich nicht.“

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Neue WI-Nr | Text | ja | wie UI-003 | „WI-Nr bereits vergeben: Gerät <WI-Nr> in <Modell-Inserat>“; „WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| WI-Nr ändern | Primärbutton | gültig | neue WI-Nr, `{WI-Nr}` in Kanal-Inhalten aktualisiert, ggf. „Bestand auf Kanal anpassen“; Banner „WI-Nr geändert“ | Feldfehler | UI-010 |
| Abbrechen | Button, Esc | – | – | – | UI-010 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, error, success | wie oben; error „WI-Nr konnte nicht geändert werden. Referenz: <Nr>“ | nur Text | |
| loading, empty, disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
