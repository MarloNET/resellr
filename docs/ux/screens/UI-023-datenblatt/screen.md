# UI-023 – Datenblatt

- Zweck: Datenblatt eines Geräts als A4-Hochformat ansehen, drucken oder als PDF speichern.
- Flows: FLOW-01 (Schritt 8)
- Anforderungen: REQ-050, REQ-051, REQ-081, REQ-040
- Rollen: Nutzer
- Gerät(e): PC; A4-Drucker
- Artefakte: default.png (Stitch b54e7fed073c49b1af58c3b5d24c1d0d, DESKTOP, 06.11.2026)

## Angezeigte Daten
| Element | Inhalt | Quelle | Hinweise |
|---|---|---|---|
| Titel | „Datenblatt WI-Nr <Nr>“ | Gerät | |
| Blatt-Vorschau | Logo der Händlermarke (Kopf, mittig), Kanalfelder „Shop:“, „eBay:“, „Kleinanzeigen:“ mit Schreiblinien, Blöcke Identifikation, Zustand, Lieferumfang (inkl. Akku-Hinweis und Akkukapazität dieses Geräts), Technik, Anschlüsse, Software als Bezeichnung | Wert | Leere Merkmale erscheinen nicht; Blockfolge und Merkmalsreihenfolge nach UI-039 |
| Hinweis | „A4 Hochformat · 1 Seite“ | | bei mehr als 1 Seite: „Datenblatt passt nicht auf eine Seite“ (Warnung, Druck bleibt möglich) |

## Eingaben und Validierung
Keine. Voraussetzungen werden beim Öffnen geprüft:
| Bedingung | Meldung |
|---|---|
| Gerät mit Prüfmarkierung | „Werte noch zu prüfen“ |
| Gerät keinem Modell-Inserat zugeordnet | „Gerät keinem Modell-Inserat zugeordnet“ |
| Gerät storniert | „Gerät storniert“ |
| Kein Logo gepflegt | „Logo der Händlermarke fehlt“ (Link zu UI-026) |

## Aktionen
| Aktion | Auslöser | Voraussetzung | Ergebnis bei Erfolg | Ergebnis bei Fehler | Navigation danach |
|---|---|---|---|---|---|
| Drucken | Primärbutton, Strg+P | Voraussetzungen erfüllt | Druckdialog des Systems; Blatt A4 Hochformat | „Datenblatt konnte nicht erzeugt werden. Referenz: <Nr>“ | bleibt |
| Als PDF speichern | Sekundärbutton | Voraussetzungen erfüllt | PDF-Datei „Datenblatt_<WI-Nr>.pdf“ | wie oben | bleibt |
| Zurück zum Gerät | Link | – | – | – | UI-010 |

## Zustände
| Zustand | Darstellung | Artefakt | Text |
|---|---|---|---|
| default | Blattvorschau | default.png | – |
| loading | Blatt als Platzhalter | nur Text | „Datenblatt wird erzeugt …“ |
| empty | n/a | – | – |
| error | Voraussetzungs-Meldung statt Vorschau (siehe Tabelle) oder technischer Fehler | nur Text | siehe oben |
| success | Banner nach PDF | nur Text | „PDF gespeichert“ |
| disabled | Buttons deaktiviert bei Voraussetzungs-Meldung | nur Text | |
| permission | n/a | – | – |

## Responsive und Barrierefreiheit
Vorschau skaliert auf Fensterbreite, Seitenverhältnis 210:297. Das Layout ist inhaltlich gleichwertig zu `Datenblatt.xlsx` (Annahme A-10/OP-01, nicht pixelgenau).

## Bekannte Abweichungen im Mockup
„Business Portal“ (Stitch); im Blatt hat Stitch die Blöcke teils zweispaltig gesetzt und den Akku-Hinweis kursiv hervorgehoben (maßgeblich: zweispaltig Bezeichnung | Wert je Block, einheitlich); Schreiblinien zeigen „Shop:“ usw. wie in Requirements (die Excel schreibt „shop:“, „ebay:“, „Kleinenzeigen:“); Logo-Platzhalterbox nur Platzhalter (Logo liefert der Pilotkunde, OP-13).

## Annahmen und offene Fragen
- Offen (OP-01/A-10): exakte oder inhaltlich gleichwertige Nachbildung des Excel-Layouts.
- Offen (OP-15): Druckdialog ist System-/Browser-Dialog und nicht Teil des Designs.
