# UI-020 – Kanal-Status setzen (Dialog)

- Zweck: Kanal-Inhalt als „Veröffentlicht“ oder „Beendet“ melden.
- Flows: FLOW-01 (Schritt 7), FLOW-03 (Schritt 3), FLOW-09 · Anforderungen: REQ-046, REQ-089; AC-REQ-046-01 bis -08 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Kanal, Titel, aktueller Status. Erlaubte Aktionen je Status: Freigegeben → „Als veröffentlicht melden“; Veröffentlicht → „Als beendet melden“; Beendet → „Wieder als veröffentlicht melden“. Hinweis bei Veröffentlicht → Beendet: „Die Kennzeichnungen ‚Bestand auf Kanal anpassen‘ und ‚Änderung auf Kanal übertragen‘ entfallen.“

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Inseratsnummer oder Internetadresse | Text | nein (nur bei Veröffentlicht) | max. 500 Zeichen | „Höchstens 500 Zeichen“ |
| Veröffentlichungsdatum | Datum | ja (nur bei Veröffentlicht) | vorbelegt mit heute, nicht in der Zukunft | „Datum darf nicht in der Zukunft liegen“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Status setzen | Primärbutton | zulässiger Übergang | Status geändert, Banner „Kanal-Inhalt ist jetzt veröffentlicht“ bzw. „… beendet“ | „Erst freigeben“ (Entwurf); „Erst Änderung freigeben“ (Beendet → Veröffentlicht mit „geändert seit Freigabe“); „Freigegeben kann nicht beendet werden“ | Aufrufseite |
| Abbrechen | Button, Esc | – | – | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, validation, error, success | wie oben; error „Status konnte nicht geändert werden. Referenz: <Nr>“ | nur Text | |
| loading, empty, disabled, permission | n/a; unzulässige Übergänge werden nicht angeboten | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px; Dialogbreite 480 px, Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
