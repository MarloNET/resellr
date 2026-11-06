# UI-015 – Fotos verwalten

- Zweck: Fotos eines Modell-Inserats hinzufügen, ordnen, entfernen (gleich für alle Kanäle).
- Flows: FLOW-01 (Schritt 4) · Anforderungen: REQ-042, REQ-048, A-06 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (Mockup geplant)

## Angezeigte Daten
Raster nummerierter Vorschaubilder (01, 02 …) in der Reihenfolge, die der Kopier-Assistent verwendet; Zähler „n von 20 Fotos“; Dateiname und Größe je Foto.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Fotodateien | Dateiauswahl (mehrere) und Ablegen per Ziehen | nein | JPEG oder PNG, je Datei ≤ 20 MB, höchstens 20 je Modell-Inserat | „<Datei>: nur JPEG oder PNG bis 20 MB“; „Höchstens 20 Fotos je Modell-Inserat“ |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Fotos hinzufügen | Button, Ablegen | – | Fotos angehängt, Fortschritt je Datei | Meldung je Datei | bleibt |
| Reihenfolge ändern | Ziehen oder Buttons „nach vorn/hinten“ | – | Nummerierung aktualisiert | – | bleibt |
| Foto entfernen | Button je Foto | – | Foto entfernt (Bestätigung P-04) | – | bleibt |
| Fertig | Primärbutton | – | Banner „Fotos gespeichert“ | – | UI-014 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Raster | nur Text | – |
| loading | Hochladen mit Fortschritt | nur Text | „Lade <Datei> hoch (n %)“ |
| empty | | nur Text | „Noch keine Fotos. Fotos hinzufügen oder hierher ziehen.“ |
| error | Meldung je Datei | nur Text | „<Datei> konnte nicht hochgeladen werden. Referenz: <Nr>“ |
| validation | siehe Eingaben | nur Text | |
| success | Banner | nur Text | |
| disabled | „Fotos hinzufügen“ deaktiviert bei 20 Fotos | nur Text | |
| permission | n/a | – | – |

## Responsive und Barrierefreiheit
Raster passt sich der Breite an; Tastatur: Pfeile wählen, Alt+Pfeil verschiebt.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Das System bearbeitet Fotos nicht (kein Zuschneiden).
