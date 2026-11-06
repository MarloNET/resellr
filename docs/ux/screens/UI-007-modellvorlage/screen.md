# UI-007 – Modellvorlage anlegen/ändern

- Zweck: Modelldaten, Werte der Modell-Merkmale und Vorbelegungen der Gerät-Merkmale pflegen.
- Flows: FLOW-01 (Schritt 1), FLOW-06 (Schritt 1)
- Anforderungen: REQ-008, REQ-010, REQ-011, REQ-058 (Could), REQ-100
- Rollen: Nutzer · Gerät(e): PC
- Artefakte: default.png (Stitch 69e6f51ff7de415ca4632aca7d171b60, DESKTOP, 06.11.2026)

## Angezeigte Daten
Formular nach Geräteart: Felder aus Merkmalsdefinitionen; Bereich „Vorbelegungswerte für Geräte“ (optional). Beim Ändern Hinweis „Änderungen an Modelldaten wirken auf alle Modell-Inserate und Datenblätter dieser Modellvorlage.“ und Anzahl betroffener Modell-Inserate.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Geräteart | Auswahl | ja | aktive Geräteart; bei Modellvorlage mit Geräten gesperrt | „Geräteart kann nicht geändert werden, weil Geräte erfasst sind“ |
| Hersteller | Auswahl, Link „Neuen Hersteller anlegen“ | ja | aktive Hersteller | „Hersteller fehlt“ |
| Modellbezeichnung | Text | ja | max. 100 | „Modellbezeichnung: 1 bis 100 Zeichen“ |
| Typbezeichnung | Text | nein | max. 50 | „Typbezeichnung: höchstens 50 Zeichen“ |
| Herstellernummer | Text oder Kontrollkästchen „unbekannt“ | ja | 1–40 Zeichen, Buchstaben, Ziffern, „-“, „/“, „.“ | „Herstellernummer: Wert oder „unbekannt“ angeben“ |
| Original-EAN | Text | nein | 8 oder 13 Ziffern, gültige Prüfziffer | „EAN: 8 oder 13 Ziffern mit gültiger Prüfziffer“ |
| Merkmale Ebene Modell | je Datentyp | je Definition | Typ/Wertebereich | „<Merkmal>: <Regel>“ |
| Vorbelegungswerte Ebene Gerät | je Datentyp | nein | | wie oben |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Modellvorlage speichern | Primärbutton, Strg+S | gültig | Banner „Modellvorlage gespeichert“ | Feldfehler, fehlende Felder benannt | Aufrufseite (UI-003 oder UI-006) |
| Hinweis „mögliche Dublette“ | beim Speichern bei gleichem Hersteller + Modellbezeichnung | – | Dialog mit Treffern: „Vorhandene verwenden“ / „Trotzdem anlegen“ (REQ-011) | – | |
| Warnung gleiche Herstellernummer (Could, REQ-058) | beim Speichern | – | Hinweis, Speichern möglich | – | |
| Löschen | Textbutton | | UI-041 | | UI-041 |
| Abbrechen | Button | – | verwerfen | – | Aufrufseite |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | leeres bzw. gefülltes Formular | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Modellvorlage …“ |
| empty | n/a | – | – |
| error | Banner | nur Text | „Modellvorlage konnte nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe oben |
| success | Banner | nur Text | |
| disabled | Geräteart gesperrt | nur Text | |

## Fenstergröße und Bedienung
Zweispaltiges Formular ab 1366 px, Modell- und Vorbelegungsbereich getrennt.

## Bekannte Abweichungen im Mockup
Das Mockup zeigt den Zustand „ändern“ mit gesperrter Geräteart. „Betroffene Modell-Inserate: 3“ steht im Hinweisbanner (Anzahl laut `screen.md`). Die Beispielwerte der Merkmale (Bildschirmdiagonale, Auflösung) sind fiktiv und hängen von den Merkmalsdefinitionen der Geräteart ab. Bereich unterhalb „Auflösung“ liegt hinter der Sticky-Leiste (Scrollbereich).

## Annahmen und offene Fragen
- REQ-058 ist Could; Darstellung nur als Hinweis.
