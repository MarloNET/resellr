# UI-020 – Kanal-Status setzen (Dialog)

- Zweck: Kanal-Inhalt als „Veröffentlicht“ oder „Beendet“ melden.
- Flows: FLOW-01 (Schritt 7), FLOW-03 (Schritt 3), FLOW-09 · Anforderungen: REQ-046, REQ-089; AC-REQ-046-01 bis -08 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Kanal, Titel, aktueller Status. Erlaubte Aktionen je Status: Freigegeben → „Als veröffentlicht melden“; Veröffentlicht → „Als beendet melden“; Beendet → „Wieder als veröffentlicht melden“. Hinweis bei Veröffentlicht → Beendet: „Die Kennzeichnungen ‚Bestand auf Kanal anpassen‘ und ‚Änderung auf Kanal übertragen‘ entfallen.“

**Einstiege (v0.6.2, O-11):** Freigegeben → „Als veröffentlicht melden“ aus UI-014 (Kanal-Karte) und UI-019; Veröffentlicht → „Als beendet melden“ aus **UI-014 (Kanal-Karte) und UI-019** (neu, siehe dort); Beendet → „Wieder als veröffentlicht melden“ aus UI-019. Aus UI-014 und UI-019 öffnet der Knopf „Als beendet melden“ diesen Dialog mit dem Übergang Veröffentlicht → Beendet; der Dialog dient dabei als Rückfrage (Hinweis und Primärbutton „Als beendet melden“, Abbrechen links). Titel des Dialogs bei diesem Übergang: „Als beendet melden“. Es gibt keine Eingabefelder (die Felder der Tabelle gelten nur bei Veröffentlicht). Fokus beim Öffnen auf „Abbrechen“ (die Aktion lässt sich nur über „Wieder als veröffentlicht melden“ zurücknehmen).

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
| loading, empty, disabled | n/a; unzulässige Übergänge werden nicht angeboten | – | – |
| ausgang-unbekannt (K-6) | Schreibende Aktion ohne Antwort (Verbindungsverlust): Aktion bleibt bis zum Neuladen der Seite gesperrt, Banner „Ausgang unbekannt, bitte neu laden“ (Muster P-08, uiux-design.md Kap. 5), Eingaben bleiben sichtbar, **kein „Erneut versuchen“**; es wird nicht von „noch nicht gespeichert“ ausgegangen. Ablehnung „resellr wird beendet“: P-07 (nicht gespeichert) | nur Text | „Ausgang unbekannt, bitte neu laden.“ |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077); Dialogbreite 480 px (bei schmalerem Fenster Fensterbreite abzüglich 16 px Rand), Dialoghöhe nie größer als die Fensterhöhe (Titel und Aktionsleiste bleiben sichtbar, der Inhalt scrollt), Esc schließt, Enter löst die Primäraktion aus.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
keine.
