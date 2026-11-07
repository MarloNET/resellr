# UI-042 – Excel-Übernahme (Could)

- Zweck: Datenblatt-Excel im Format `Datenblatt.xlsx` einlesen, um Modellvorlagen anzulegen.
- Flows: – · Anforderungen: REQ-056 (Could) · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text

## Angezeigte Daten
Dateiauswahl; nach dem Einlesen Einlesebericht: Liste erkannter Modellvorlagen (alle Werte mit Prüfmarkierung) und Liste „nicht zuordenbare Labels“.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Excel-Datei | Datei | ja | Excel (.xlsx) im Format Datenblatt, höchstens 10 MB | „Nur Excel-Dateien (.xlsx) im Format des Datenblatts“; „Excel-Datei: höchstens 10 MB“ (v0.6, M-22) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Einlesen | Primärbutton | Datei gewählt | Modellvorlagen angelegt (nicht nutzbar bis Bestätigung durch Nutzer), Bericht | „Datei konnte nicht gelesen werden. Referenz: <Nr>“ | Bericht |
| Modellvorlage prüfen | Link im Bericht | – | – | – | UI-007 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default, loading („Lese Datei …“), error, success („n Modellvorlagen angelegt“) | wie oben | nur Text | |
| empty, validation, disabled | n/a | – | – |

## Fenstergröße und Bedienung
Fenster frei in der Größe, Untergrenze 1366 px (REQ-077).

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Could-Funktion; Einstieg über Einstellungen-Liste (nicht als 16. Bereich geführt, sondern Zusatzlink in UI-006).
- Design-Annahme, keine Anforderung (Platzierung ist Designentscheidung, PO bestätigt): Der Einstieg liegt als Textlink „Excel-Datei übernehmen“ im Kopf der Modell-Bibliothek (UI-006), weil die Übernahme Modellvorlagen und Geräte betrifft und selten genutzt wird; sie erscheint nicht in der Hauptnavigation.
