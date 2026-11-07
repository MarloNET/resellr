# UI-028 – Auswahllisten

- Zweck: Werte der Auswahllisten (Zustand, Tastaturlayout, Netzteil, Akku, Speichertyp, Display-Oberfläche, Betriebssystem, Anschlusstyp, Anschlussposition) pflegen.
- Flows: – · Anforderungen: REQ-007, Kap. 9.2 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Muster P-01)

## Angezeigte Daten
Links Liste der Auswahllisten, rechts Tabelle der Werte: Reihenfolge, Wert, Status (aktiv/deaktiviert), bei Liste Akku zusätzlich „Akku vorhanden“ (Ja/Nein). Leerzustand: „Noch keine Werte“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Wert | Text | ja | eindeutig je Liste ohne Groß-/Kleinschreibung | „Wert gibt es in dieser Liste bereits“ |
| Akku vorhanden | Ja/Nein | ja (nur Liste Akku) | maßgeblich für die Pflicht der Akkukapazität | „Kennzeichen ‚Akku vorhanden‘ fehlt“ |
| Status | Umschalter | ja | deaktivierter Wert nicht mehr wählbar, gespeicherte bleiben | – |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Wert anlegen/umbenennen | Button, Inline-Bearbeitung | gültig | Umbenennung wirkt auf alle Datensätze (Hinweis vor Speichern) | Feldfehler | bleibt |
| Wert deaktivieren, Reihenfolge ändern | Zeilenaktion, Ziehen/Buttons | – | gespeichert | – | bleibt |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | wie oben | nur Text | – |
| loading | Platzhalter | nur Text | „Lade Einstellungen …“ |
| empty | Hinweistext mittig im Listenbereich, darunter Button „Wert anlegen“ (Primärbutton) | nur Text | „Noch keine Werte in dieser Liste“ |
| `UI-028.speichert` (wird gespeichert) | Speicherknopf und alle Eingaben gesperrt bis zur Antwort, Anzeige „Speichern …“, **kein festes Timeout** (Muster P-08); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ | nur Text | „Speichern …“ |
| error | Banner | nur Text | „Einstellungen konnten nicht gespeichert werden. Referenz: <Nr>“ |
| validation | Feldfehler | nur Text | siehe Eingaben |
| success | Banner | nur Text | „Gespeichert“ |
| disabled | Speichern deaktiviert ohne Änderung | nur Text | |

## Fenstergröße und Bedienung
Ab 1366 px; Einstellungs-Liste (240 px) links, Inhalt rechts; Tastaturalternativen zum Ziehen.

## Bekannte Abweichungen im Mockup
keine (kein Mockup; Muster siehe uiux-design.md Kap. 5).

## Annahmen und offene Fragen
keine.
