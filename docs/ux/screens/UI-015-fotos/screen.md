# UI-015 – Fotos verwalten

- Zweck: Fotos eines Modell-Inserats hinzufügen, ordnen, entfernen (gleich für alle Kanäle).
- Flows: FLOW-01 (Schritt 4) · Anforderungen: REQ-042, REQ-048, A-06 · Rollen: Nutzer · Gerät(e): PC · Artefakte: nur Text (kein Mockup; Screen ist Text-Spezifikation)

## Angezeigte Daten
Raster nummerierter Vorschaubilder (01, 02 …) in der Reihenfolge, die der Kopier-Assistent verwendet; Zähler „n von 20 Fotos“; Dateiname und Größe je Foto.

## Eingaben und Validierung
| Feld | Typ | Pflicht | Regel | Fehlermeldung |
|---|---|---|---|---|
| Fotodateien | Dateiauswahl (mehrere) und Ablegen per Ziehen | nein | JPEG oder PNG, je Datei ≤ 20 MB, höchstens 20 je Modell-Inserat | „<Datei>: nur JPEG oder PNG bis 20 MB“; „Höchstens 20 Fotos je Modell-Inserat“ |

## Aktionen
**Sofort gespeichert (v0.5):** Hinzufügen, Reihenfolge ändern und Entfernen eines Fotos werden jeweils **sofort gespeichert**; es gibt keinen Speicherknopf und keinen Zustand „ungespeichert“. Während eines Vorgangs zeigt das Foto „Speichern …“ bzw. den Fortschritt (Zustand loading); bei Verbindungsverlust „Ausgang unbekannt, bitte neu laden“ (P-08). „Fertig“ führt nur zurück. **Folge:** Fotoänderungen bilden die Kanal-Inhalte neu (Fotos stehen in UI-016 und im Kopier-Assistenten, REQ-042); Fotos sind nach Kap. 6.0 („Preis je Kanal, Fotos“) eine Inhaltsangabe; die Statuswirkung nach REQ-045 gilt (Entscheidung Product Owner, MAR-148). Die Anzeige des neuen Status bleibt Sache der Kanal-Karten in UI-014. Das Foto-Ergebnis erscheint **nicht** in UI-043 (UI-043 gilt nur nach UI-030/UI-031). Auf manuell angepasste Texte haben Fotoänderungen **keine** Wirkung, weil sich der automatisch gebildete Titel und die Beschreibung nicht ändern (Zusatz Kap. 6.0); es gibt keinen Hinweis „Daten geändert …“.

| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Fotos hinzufügen | Button, Ablegen | – | Fotos angehängt, Fortschritt je Datei | Meldung je Datei | bleibt |
| Reihenfolge ändern | Ziehen oder Buttons „nach vorn/hinten“ | – | Nummerierung aktualisiert | – | bleibt |
| Foto entfernen | Button je Foto | – | Foto entfernt (Bestätigung P-04) | – | bleibt |
| Fertig | Primärbutton | – | speichert **nichts**; führt nur zurück (alle Fotoänderungen sind bereits gespeichert) | – | UI-014 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Raster | nur Text | – |
| loading | Hochladen mit Fortschritt | nur Text | „Lade <Datei> hoch (n %)“ |
| empty | | nur Text | „Noch keine Fotos. Fotos hinzufügen oder hierher ziehen.“ |
| error | Meldung je Datei | nur Text | „<Datei> konnte nicht hochgeladen werden. Referenz: <Nr>“ |
| validation | siehe Eingaben | nur Text | |
| success | kein Banner „Fotos gespeichert“; die Anzeige im Raster ist die Rückmeldung | nur Text | – |
| disabled | „Fotos hinzufügen“ deaktiviert bei 20 Fotos | nur Text | |

## Fenstergröße und Bedienung
Raster passt sich der Breite an; Tastatur: Pfeile wählen, Alt+Pfeil verschiebt.

## Bekannte Abweichungen im Mockup
keine (kein Mockup).

## Annahmen und offene Fragen
- Das System bearbeitet Fotos nicht (kein Zuschneiden).
