# UI-042 – Excel-Übernahme (Could)

- Zweck: Datenblatt-Excel im Format `Datenblatt.xlsx` einlesen, um Modellvorlagen anzulegen.
- Flows: – · Anforderungen: REQ-056 (Could) · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Dateiauswahl; nach dem Einlesen Einlesebericht: Liste erkannter Modellvorlagen (alle Werte mit Prüfmarkierung) und Liste „nicht zuordenbare Labels“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Excel-Datei | Datei | ja | Excel (.xlsx) im Format Datenblatt | „Nur Excel-Dateien (.xlsx) im Format des Datenblatts“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Einlesen | Primärbutton | Datei gewählt | Modellvorlagen angelegt (nicht nutzbar bis Bestätigung durch Nutzer), Bericht | „Datei konnte nicht gelesen werden. Referenz: <Nr>“ | Bericht |
| Modellvorlage prüfen | Link im Bericht | – | – | – | UI-007 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, loading („Lese Datei …“), error, success („n Modellvorlagen angelegt“) | wie oben | nur Text | |
| empty, validation, disabled, permission | n/a | – | – |

## Responsive und Barrierefreiheit
Ab 1366 px.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Could-Funktion; Einstieg über Einstellungen-Liste (nicht als 16. Bereich geführt, sondern Zusatzlink in UI-006); Platzierung offen, Entscheidung PO.
